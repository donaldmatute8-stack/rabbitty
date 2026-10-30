import { z } from "zod";
import { eq, or, inArray, sql, asc, desc, type SQL } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { conversations, messages, ownedBusinesses, users } from "@rabbitty/database-core";
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

    const convs = await ctx.coreDb
      .select()
      .from(conversations)
      .where(
        or(
          inArray(conversations.participant1, bizIds),
          inArray(conversations.participant2, bizIds)
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

        const [customer] = await ctx.coreDb
          .select({
            firstName: users.firstName,
            lastName: users.lastName,
            username: users.username,
          })
          .from(users)
          .where(eq(users.id, customerId));

        const [last] = await ctx.coreDb
          .select({ content: messages.content, createdAt: messages.createdAt, senderId: messages.senderId })
          .from(messages)
          .where(eq(messages.conversationId, conv.id))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const customerName = customer
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
          lastMessage: last?.content ?? "",
          lastMessageSenderId: last?.senderId ?? null,
          lastMessageAt: last?.createdAt ?? conv.updatedAt,
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
});
