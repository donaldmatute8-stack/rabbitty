import { z } from "zod";
import { eq, ne, and, or, not, inArray, isNull, sql, asc, desc, type SQL } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { bunzyDeliveries, bunzyPreferences, conversations, messages, ownedBusinesses, users, chatEventOutbox } from "@rabbitty/database-core";
import type { Context } from "../trpc";

export interface BusinessRef {
  id: string;
  name: string;
}

const TELEGRAM_EMAIL_RE = /^(\d+)@telegram\.rabbitty$/i;
const PHONE_EMAIL_RE = /^(\d+)@phone\.rabbitty\.me$/i;

// An admin session identifies its core user differently depending on the provider
// that issued it (magic-link => telegram id, email-token => adminAuthUsers id,
// resend/email => real email). Resolve every plausible identifier so ownership is
// matched exactly instead of only by email.
async function resolveOwnerUserIds(ctx: Context): Promise<string[]> {
  const email = ctx.user?.email?.trim().toLowerCase() ?? "";
  const sessionId = ctx.user?.id?.trim() ?? "";

  const conditions: SQL[] = [];

  if (email) conditions.push(eq(users.email, email));

  const telegramFromEmail = email.match(TELEGRAM_EMAIL_RE)?.[1];
  if (telegramFromEmail) conditions.push(eq(users.telegramId, telegramFromEmail));

  const phoneFromEmail = email.match(PHONE_EMAIL_RE)?.[1];
  if (phoneFromEmail) {
    conditions.push(
      sql`regexp_replace(${users.phoneNumber}, '\\D', '', 'g') = ${phoneFromEmail}`
    );
  }

  if (sessionId) {
    conditions.push(eq(users.id, sessionId));
    if (/^\d{5,}$/.test(sessionId)) conditions.push(eq(users.telegramId, sessionId));
  }

  if (conditions.length === 0) return [];

  const rows = await ctx.coreDb
    .select({ id: users.id })
    .from(users)
    .where(or(...conditions));

  return [...new Set(rows.map((r) => r.id))];
}

async function resolveOwnerBusinesses(ctx: Context): Promise<BusinessRef[]> {
  const ownerIds = await resolveOwnerUserIds(ctx);
  const owned = ownerIds.length > 0
    ? await ctx.coreDb
        .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
        .from(ownedBusinesses)
        .where(inArray(ownedBusinesses.ownerId, ownerIds))
    : [];

  // ── Fallback por branch: el inbox del negocio SIEMPRE es visible para quien
  // opera su sucursal (cajero/pairing con email distinto, god, impersonación) ──
  if (ctx.branchId) {
    try {
      const dbR = await import("@rabbitty/database-restaurant/schema");
      const [br] = await ctx.restaurantDb
        .select({ restaurantId: dbR.branches.restaurantId })
        .from(dbR.branches)
        .where(eq(dbR.branches.id, ctx.branchId))
        .limit(1);
      if (br?.restaurantId) {
        const [rest] = await ctx.restaurantDb
          .select({ businessId: dbR.restaurants.businessId })
          .from(dbR.restaurants)
          .where(eq(dbR.restaurants.id, br.restaurantId))
          .limit(1);
        if (rest?.businessId && !owned.some((b) => b.id === rest.businessId)) {
          const [biz] = await ctx.coreDb
            .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.id, rest.businessId))
            .limit(1);
          if (biz) owned.unshift(biz);
        }
      }
    } catch (brErr) {
      console.error("[customerChat] branch fallback falló:", brErr);
    }
  }

  return owned;
}

export const customerChatRouter = router({
  myBusinesses: protectedProcedure.query(async ({ ctx }) => resolveOwnerBusinesses(ctx)),

  listConversations: protectedProcedure.query(async ({ ctx }) => {
    const biz = await resolveOwnerBusinesses(ctx);
    if (biz.length === 0) return [];
    const bizIds = biz.map((b) => b.id);
    const nameById = new Map(biz.map((b) => [b.id, b.name]));

    // Guard del caso mixto: excluir donde el propio dueño es participante.
    const ownerId = typeof ctx.userId === 'string' && ctx.userId ? ctx.userId : null;
    const selfParticipantGuard = ownerId
      // IS DISTINCT FROM: con participant2 NULL, `NOT (...)` daba NULL y se
      // perdían conversaciones legítimas. DISTINCT conserva las filas válidas.
      ? sql`${conversations.participant1} IS DISTINCT FROM ${ownerId} AND ${conversations.participant2} IS DISTINCT FROM ${ownerId}`
      : undefined;

    const convs = await ctx.coreDb
      .select()
      .from(conversations)
      .where(
        and(
          // Bandeja del admin: chats con clientes (BUSINESS) y el canal oficial
          // de Bunzy (BUNZY). Los chats entre Rabbitters (PEER) no van aquí.
          or(
            eq(conversations.audience, 'BUSINESS'),
            eq(conversations.audience, 'BUNZY'),
          ),
          or(
            inArray(conversations.participant1, bizIds),
            inArray(conversations.participant2, bizIds)
          ),
          // Caso mixto (afiliado Y rabbitter): si el DUEÑO es participante
          // directo, es su chat como cliente — no es un cliente escribiéndole
          // al negocio, así que no debe aparecer en el inbox.
          ...(selfParticipantGuard ? [selfParticipantGuard] : [])
        )
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(100);

    const rows = await Promise.all(
      convs.map(async (conv) => {
        const businessId = bizIds.includes(conv.participant1)
          ? conv.participant1
          : conv.participant2;
        const customerId =
          businessId === conv.participant1 ? conv.participant2 : conv.participant1;

        // H-CHAT-TRUTH: unread del negocio ponderado EN DB (mensajes del cliente
        // con readAt NULL). Antes el contador vivía en localStorage del navegador
        // — cada Mac/iPad veía su propio "visto" y eso no es fuente de verdad.
        const [unseenRow] = await ctx.coreDb
          .select({ n: sql<number>`COUNT(*)` })
          .from(messages)
          .where(and(
            eq(messages.conversationId, conv.id),
            eq(messages.senderId, customerId),
            sql`"readAt" IS NULL`
          ));

        const [messageTotalRow] = await ctx.coreDb
          .select({ n: sql<number>`COUNT(*)` })
          .from(messages)
          .where(eq(messages.conversationId, conv.id));

        const [customer] = await ctx.coreDb
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
          })
          .from(users)
          .where(eq(users.id, customerId));

        const [last] = await ctx.coreDb
          .select({
            content: messages.content,
            createdAt: messages.createdAt,
            senderId: messages.senderId,
            metadata: messages.metadata,
          })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const isBunzy = customerId === 'bunzy';
        const lastMeta = (last?.metadata ?? null) as { title?: string } | null;
        const customerName = isBunzy
          ? 'Bunzy'
          : customer
            ? `${customer.firstName ?? ""} ${customer.lastName ?? ""}`.trim() ||
              customer.username ||
              "Cliente"
            : "Cliente";

        return {
          id: conv.id,
          businessId,
          businessName: nameById.get(businessId) ?? "Mi Negocio",
          customerId,
          customerName,
          lastMessage: isBunzy && lastMeta?.title ? lastMeta.title : last?.content ?? "",
          lastMessageSenderId: last?.senderId ?? null,
          lastMessageAt: last?.createdAt ?? conv.updatedAt,
          // H-CHAT-TRUTH: la UI deja de depender de localStorage para el badge.
          isOfficial: isBunzy,
          unread: Number(unseenRow?.n ?? 0),
          messageTotal: Number(messageTotalRow?.n ?? 0),
        };
      })
    );

    return rows;
  }),

  getMessages: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const biz = await resolveOwnerBusinesses(ctx);
      const bizIds = biz.map((b) => b.id);

      const [conv] = await ctx.coreDb
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId));

      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversación no encontrada" });

      const businessId = bizIds.includes(conv.participant1)
        ? conv.participant1
        : bizIds.includes(conv.participant2)
          ? conv.participant2
          : null;

      if (!businessId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta conversación" });
      }

      const rows = await ctx.coreDb
        .select()
        .from(messages)
        .where(eq(messages.conversationId, conv.id))
        .orderBy(asc(messages.createdAt))
        .limit(200);

      return { businessId, messages: rows };
    }),

  /**
   * H-CHAT-TRUTH · markRead — el NEGOCIO marca leídos en DB (readAt de los
   * mensajes del cliente). Dos efectos con un solo comando:
   *  1) badge de sin leer del admin persistente (adiós a la verdad por
   *     localStorage por dispositivo);
   *  2) recibos de lectura reales para el chat móvil del cliente (sus "✓✓"
   *     dejan de depender de que Marco abra la miniapp).
   * GET getMessages queda puro (regla: GET no muta estado).
   */
  markRead: protectedProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const biz = await resolveOwnerBusinesses(ctx);
      const bizIds = biz.map((b) => b.id);

      const [conv] = await ctx.coreDb
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId));

      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversación no encontrada" });

      const businessId = bizIds.includes(conv.participant1)
        ? conv.participant1
        : bizIds.includes(conv.participant2)
          ? conv.participant2
          : null;

      if (!businessId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta conversación" });
      }

      const marked = await ctx.coreDb
        .update(messages)
        .set({ readAt: new Date() })
        .where(and(
          eq(messages.conversationId, input.conversationId),
          ne(messages.senderId, businessId),
          sql`"readAt" IS NULL`
        ))
        .returning({ id: messages.id });

      // Bunzy Connect (C0): sincroniza el estado de lectura del delivery con el
      // mark-read real del chat. No inventa lectura: solo cuando el negocio lee.
      await ctx.coreDb
        .update(bunzyDeliveries)
        .set({ status: "READ", readAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(bunzyDeliveries.conversationId, input.conversationId),
          isNull(bunzyDeliveries.readAt),
        ))
        .catch(() => undefined);

      return { ok: true, markedCount: marked.length };
    }),

  sendMessage: protectedProcedure
    .input(z.object({ conversationId: z.string(), content: z.string().min(1).max(2000) }))
    .mutation(async ({ ctx, input }) => {
      const biz = await resolveOwnerBusinesses(ctx);
      const bizIds = biz.map((b) => b.id);

      const [conv] = await ctx.coreDb
        .select()
        .from(conversations)
        .where(eq(conversations.id, input.conversationId));

      if (!conv) throw new TRPCError({ code: "NOT_FOUND", message: "Conversación no encontrada" });

      const businessId = bizIds.includes(conv.participant1)
        ? conv.participant1
        : bizIds.includes(conv.participant2)
          ? conv.participant2
          : null;

      if (!businessId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a esta conversación" });
      }

      const [msg] = await ctx.coreDb
        .insert(messages)
        .values({
          conversationId: conv.id,
          senderId: businessId,
          content: input.content.trim(),
        })
        .returning();

      await ctx.coreDb
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, conv.id));

      // ── Fase 4: evento realtime ──
      // El admin escribe en el MISMO Postgres que la app, así que basta con
      // encolar el evento y pedirle a la miniapp que lo publique. Sin esto el
      // cliente solo se enteraba por la campana/push, no en el hilo abierto.
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
                senderId: businessId,
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
            // Piggyback del worker: no bloquea la respuesta del admin.
            void fetch(`${url.replace(/\/$/, "")}/api/cron/chat-outbox`, {
              method: "POST",
              headers: { Authorization: `Bearer ${secret}` },
            }).catch(() => {});
          }
        } catch (rtErr) {
          console.error("[customerChat] encolar realtime falló:", rtErr);
        }
      }

      // Notificar al cliente por el canal completo de la miniapp (in-app + APNs + Telegram)
      // — fuente única ida y vuelta: el admin responde Y el cliente se entera.
      if (msg) {
        try {
          const url = process.env.RABBITTY_MINIAPP_URL;
          const secret = process.env.RABBITTY_API_SECRET;
          if (url && secret) {
            // El participante cliente de la conversación
            const customerId = conv.participant1 === businessId ? conv.participant2 : conv.participant1;
            await fetch(`${url.replace(/\/$/, "")}/api/chat/notify`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
              body: JSON.stringify({
                conversationId: conv.id,
                recipientUserId: customerId,
                preview: input.content.trim(),
                senderName: "El negocio",
              }),
            });
          }
        } catch (notifyErr) {
          console.error("[customerChat] notify cliente falló:", notifyErr);
        }
      }

      return msg;
    }),

  // ── Bunzy Connect · preferencias del negocio ──
  bunzyPreferences: protectedProcedure.query(async ({ ctx }) => {
    const biz = await resolveOwnerBusinesses(ctx);
    const businessId = biz[0]?.id ?? null;
    if (!businessId) return { businessId: null, product: true, tips: true, news: true };
    const [pref] = await ctx.coreDb
      .select()
      .from(bunzyPreferences)
      .where(and(eq(bunzyPreferences.recipientType, "BUSINESS"), eq(bunzyPreferences.recipientId, businessId)))
      .limit(1);
    return {
      businessId,
      product: pref?.product ?? true,
      tips: pref?.tips ?? true,
      news: pref?.news ?? true,
    };
  }),

  updateBunzyPreferences: protectedProcedure
    .input(z.object({ product: z.boolean(), tips: z.boolean(), news: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const biz = await resolveOwnerBusinesses(ctx);
      const businessId = biz[0]?.id;
      if (!businessId) throw new TRPCError({ code: "FORBIDDEN", message: "Sin negocio asociado" });
      await ctx.coreDb
        .insert(bunzyPreferences)
        .values({
          recipientType: "BUSINESS",
          recipientId: businessId,
          product: input.product,
          tips: input.tips,
          news: input.news,
        })
        .onConflictDoUpdate({
          target: [bunzyPreferences.recipientType, bunzyPreferences.recipientId],
          set: { product: input.product, tips: input.tips, news: input.news, updatedAt: new Date() },
        });
      return { ok: true };
    }),
});
