import { z } from "zod";
import { and, eq, desc, sql } from "drizzle-orm";
import { router, godAdminProcedure } from "../trpc";
import { conversations, messages, ownedBusinesses, chatEventOutbox } from "@rabbitty/database-core";
import { TRPCError } from "@trpc/server";
import { ensureCoreColumnsReady } from "../db";

/**
 * ── Bandeja de soporte (God) ───────────────────────────────────────────────
 *
 * El hilo de soporte vive en el NEGOCIO (conversations.audience='SUPPORT',
 * participant2=businessId). El admin de un afiliado solo ve el suyo; el equipo
 * de Rabbitty necesita ver TODOS para responder.
 *
 * MVP deliberado: lista + hilo + responder + marcar leído. Sin SLA, sin
 * asignación y sin estados — eso es la siguiente fase, cuando haya volumen.
 */
const FIRST_RESPONSE_MINUTES = Number(process.env.SUPPORT_FIRST_RESPONSE_MINUTES ?? 120);
const RESOLVE_HOURS = Number(process.env.SUPPORT_RESOLVE_HOURS ?? 24);

function slaFor(createdAt: Date | null, firstResponseAt: Date | null, resolvedAt: Date | null) {
  if (!createdAt) return { state: "ON_TIME" as const, firstResponseDueAt: null, resolveDueAt: null };
  const firstDue = new Date(createdAt.getTime() + FIRST_RESPONSE_MINUTES * 60_000);
  const resolveDue = new Date(createdAt.getTime() + RESOLVE_HOURS * 3_600_000);
  const now = Date.now();
  const firstBreached = !firstResponseAt && now > firstDue.getTime();
  const resolveBreached = !resolvedAt && now > resolveDue.getTime();
  const state = resolvedAt
    ? "RESOLVED"
    : firstBreached || resolveBreached
    ? "BREACHED"
    : "ON_TIME";
  return { state, firstResponseDueAt: firstDue, resolveDueAt: resolveDue };
}

export const supportInboxRouter = router({
  list: godAdminProcedure.query(async ({ ctx }) => {
    await ensureCoreColumnsReady();
    const rows = await ctx.coreDb
      .select({
        id: conversations.id,
        businessId: conversations.participant2,
        businessName: ownedBusinesses.name,
        lastMessageAt: conversations.lastMessageAt,
        updatedAt: conversations.updatedAt,
        createdAt: conversations.createdAt,
        supportStatus: conversations.supportStatus,
        supportFirstResponseAt: conversations.supportFirstResponseAt,
        supportResolvedAt: conversations.supportResolvedAt,
      })
      .from(conversations)
      .leftJoin(ownedBusinesses, eq(ownedBusinesses.id, conversations.participant2))
      .where(eq(conversations.audience, "SUPPORT"))
      .orderBy(desc(conversations.lastMessageAt));

    return Promise.all(
      rows.map(async (c) => {
        const [last] = await ctx.coreDb
          .select({ content: messages.content, senderId: messages.senderId, createdAt: messages.createdAt })
          .from(messages)
          .where(eq(messages.conversationId, c.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);
        const [unread] = await ctx.coreDb
          .select({ n: sql<number>`COUNT(*)` })
          .from(messages)
          .where(and(
            eq(messages.conversationId, c.id),
            eq(messages.senderId, c.businessId),
            sql`"readAt" IS NULL`,
          ));
        return {
          ...c,
          lastMessage: last?.content ?? "",
          lastSenderId: last?.senderId ?? null,
          unread: Number(unread?.n ?? 0),
          sla: slaFor(c.createdAt ?? null, c.supportFirstResponseAt ?? null, c.supportResolvedAt ?? null),
        };
      }),
    );
  }),

  getMessages: godAdminProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ensureCoreColumnsReady();
      const [conv] = await ctx.coreDb
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.id, input.conversationId),
          eq(conversations.audience, "SUPPORT"),
        ))
        .limit(1);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Hilo de soporte no encontrado" });

      const [biz] = await ctx.coreDb
        .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, conv.participant2))
        .limit(1);

      const rows = await ctx.coreDb
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(messages.createdAt)
        .limit(300);

      return {
        conversationId: conv.id,
        businessId: conv.participant2,
        businessName: biz?.name ?? "Afiliado",
        supportStatus: conv.supportStatus,
        supportFirstResponseAt: conv.supportFirstResponseAt,
        supportResolvedAt: conv.supportResolvedAt,
        createdAt: conv.createdAt,
        sla: slaFor(conv.createdAt ?? null, conv.supportFirstResponseAt ?? null, conv.supportResolvedAt ?? null),
        messages: rows,
      };
    }),

  markRead: godAdminProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ensureCoreColumnsReady();
      const [conv] = await ctx.coreDb
        .select({ id: conversations.id, businessId: conversations.participant2 })
        .from(conversations)
        .where(and(
          eq(conversations.id, input.conversationId),
          eq(conversations.audience, "SUPPORT"),
        ))
        .limit(1);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Hilo de soporte no encontrado" });

      const marked = await ctx.coreDb
        .update(messages)
        .set({ readAt: new Date() })
        .where(and(
          eq(messages.conversationId, conv.id),
          eq(messages.senderId, conv.businessId),
          sql`"readAt" IS NULL`,
        ))
        .returning({ id: messages.id });

      return { ok: true, markedCount: marked.length };
    }),

  setStatus: godAdminProcedure
    .input(z.object({
      conversationId: z.string(),
      status: z.enum(["OPEN", "PENDING", "RESOLVED"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureCoreColumnsReady();
      const [conv] = await ctx.coreDb
        .select({ id: conversations.id })
        .from(conversations)
        .where(and(
          eq(conversations.id, input.conversationId),
          eq(conversations.audience, "SUPPORT"),
        ))
        .limit(1);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Hilo de soporte no encontrado" });

      await ctx.coreDb
        .update(conversations)
        .set({
          supportStatus: input.status,
          supportResolvedAt: input.status === "RESOLVED" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, conv.id));

      return { ok: true, status: input.status };
    }),

  send: godAdminProcedure
    .input(z.object({
      conversationId: z.string(),
      content: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureCoreColumnsReady();
      const [conv] = await ctx.coreDb
        .select()
        .from(conversations)
        .where(and(
          eq(conversations.id, input.conversationId),
          eq(conversations.audience, "SUPPORT"),
        ))
        .limit(1);
      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Hilo de soporte no encontrado" });

      const content = input.content.trim();
      const [msg] = await ctx.coreDb
        .insert(messages)
        .values({
          conversationId: conv.id,
          // El equipo responde como 'support': el afiliado ve a Rabbitty, no
          // un mensaje suyo.
          senderId: "support",
          content,
        })
        .returning();

      await ctx.coreDb
        .update(conversations)
        .set({
          updatedAt: new Date(),
          lastMessageAt: new Date(),
          // Primera respuesta humana: arranca el reloj de SLA y deja el hilo
          // esperando al afiliado (PENDING).
          supportFirstResponseAt: conv.supportFirstResponseAt ?? new Date(),
          supportStatus: "PENDING",
        })
        .where(eq(conversations.id, conv.id));

      // Realtime para la app del afiliado (mismo outbox que el chat normal).
      if (msg) {
        try {
          await ctx.coreDb
            .insert(chatEventOutbox)
            .values({
              conversationId: conv.id,
              type: "message.created",
              eventId: `msg:${msg.id}`,
              payload: {
                messageId: msg.id,
                conversationId: conv.id,
                senderId: "support",
                content: msg.content,
                type: msg.type,
                metadata: msg.metadata ?? null,
                createdAt: msg.createdAt,
              },
            })
            .onConflictDoNothing({ target: chatEventOutbox.eventId });

          const url = process.env.RABBITTY_MINIAPP_URL;
          const secret = process.env.RABBITTY_API_SECRET;
          if (url && secret) {
            void fetch(`${url.replace(/\/$/, "")}/api/cron/chat-outbox`, {
              method: "POST",
              headers: { Authorization: `Bearer ${secret}` },
            }).catch(() => {});
          }
        } catch (rtErr) {
          console.error("[supportInbox] realtime falló:", rtErr);
        }
      }

      // Aviso al dueño del negocio (in-app + push) vía el canal del chat.
      if (msg) {
        try {
          const [biz] = await ctx.coreDb
            .select({ ownerId: ownedBusinesses.ownerId, name: ownedBusinesses.name })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.id, conv.participant2))
            .limit(1);
          const url = process.env.RABBITTY_MINIAPP_URL;
          const secret = process.env.RABBITTY_API_SECRET;
          if (biz?.ownerId && url && secret) {
            await fetch(`${url.replace(/\/$/, "")}/api/chat/notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
              body: JSON.stringify({
                conversationId: conv.id,
                recipientUserId: biz.ownerId,
                preview: content,
                senderName: "Soporte Rabbitty",
                targetId: "support",
              }),
            });
          }
        } catch (notifyErr) {
          console.error("[supportInbox] aviso al afiliado falló:", notifyErr);
        }
      }

      return msg;
    }),
});
