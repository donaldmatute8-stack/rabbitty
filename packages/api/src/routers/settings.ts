import { z } from "zod";
import { eq } from "drizzle-orm";
import { verify as verifyTotp } from "otplib";
import { router, protectedProcedure } from "../trpc";
import { users, trustedSessions, passkeys, ownedBusinesses } from "@rabbitty/database-core";
import { TRPCError } from "@trpc/server";
import { decryptText } from "../services/crypto";

async function requireTotpIfEnabled(coreDb: any, userId: string, code?: string) {
  const [user] = await coreDb.select({ totpEnabled: users.totpEnabled, totpSecret: users.totpSecret }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user?.totpEnabled) return;
  if (!code || code.length !== 6) throw new TRPCError({ code: "BAD_REQUEST", message: "Se requiere un código de verificación 2FA" });
  const secret = decryptText(user.totpSecret ?? "");
  const result = await verifyTotp({ token: code, secret });
  if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código de verificación inválido" });
}

export const settingsRouter = router({
  updateEmail: protectedProcedure
    .input(z.object({ email: z.string().email(), verificationCode: z.string().length(6).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireTotpIfEnabled(ctx.coreDb, ctx.userId, input.verificationCode);
      const existing = await ctx.coreDb.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing.length > 0 && existing[0]!.id !== ctx.userId) {
        throw new TRPCError({ code: "CONFLICT", message: "Ese correo ya está en uso" });
      }
      await ctx.coreDb.update(users).set({ email: input.email }).where(eq(users.id, ctx.userId));
      return { success: true };
    }),

  updateWhatsApp: protectedProcedure
    .input(z.object({ supportWhatsApp: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.coreDb.update(users).set({ supportWhatsApp: input.supportWhatsApp ?? null }).where(eq(users.id, ctx.userId));
      return { success: true };
    }),

  getSecuritySettings: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.coreDb.select({
      email: users.email,
      supportWhatsApp: users.supportWhatsApp,
      totpEnabled: users.totpEnabled,
      requireTotpForLogin: users.requireTotpForLogin,
    }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    const trustedSessionsCount = await ctx.coreDb.select().from(trustedSessions).where(eq(trustedSessions.userId, ctx.userId));
    const passkeysList = await ctx.coreDb.select({
      id: passkeys.id,
      deviceName: passkeys.deviceName,
      createdAt: passkeys.createdAt,
    }).from(passkeys).where(eq(passkeys.userId, ctx.userId));
    return {
      ...user,
      trustedSessionsCount: trustedSessionsCount.length,
      passkeys: passkeysList,
    };
  }),

  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.coreDb.select({
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      phoneNumber: users.phoneNumber,
      supportWhatsApp: users.supportWhatsApp,
      username: users.username,
    }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return user;
  }),

  updateProfile: protectedProcedure
    .input(z.object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      phoneNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.coreDb.update(users).set(input).where(eq(users.id, ctx.userId));
      return { success: true };
    }),

  /**
   * Canal de contestación preferido del afiliado hacia Rabbitters.
   * Persistido en ownedBusinesses.chatReplyChannel y respetado por el motor de notificaciones.
   */
  getChatReplyChannel: protectedProcedure.query(async ({ ctx }) => {
    const [biz] = await ctx.coreDb
      .select({ chatReplyChannel: ownedBusinesses.chatReplyChannel })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.ownerId, ctx.userId))
      .limit(1);
    return { chatReplyChannel: biz?.chatReplyChannel ?? "hybrid" };
  }),

  setChatReplyChannel: protectedProcedure
    .input(z.object({
      channel: z.enum(["hybrid", "telegram", "admin", "mobile"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const [biz] = await ctx.coreDb
        .select({ id: ownedBusinesses.id })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.ownerId, ctx.userId))
        .limit(1);
      if (!biz) throw new TRPCError({ code: "NOT_FOUND", message: "Comercio no encontrado para tu cuenta" });
      await ctx.coreDb
        .update(ownedBusinesses)
        .set({ chatReplyChannel: input.channel, updatedAt: new Date() })
        .where(eq(ownedBusinesses.id, biz.id));
      return { success: true, chatReplyChannel: input.channel };
    }),

  /**
   * ── Perfil público del negocio (lo que ve el Rabbitter en la app) ──
   * Fuente única: ownedBusinesses. Antes solo se podía tocar el canal de chat;
   * horario, "Acerca de" y sitio web no tenían editor en ningún admin.
   */
  getBusinessProfile: protectedProcedure.query(async ({ ctx }) => {
    const [biz] = await ctx.coreDb
      .select({
        id: ownedBusinesses.id,
        name: ownedBusinesses.name,
        category: ownedBusinesses.category,
        description: ownedBusinesses.description,
        address: ownedBusinesses.address,
        website: ownedBusinesses.website,
        activeDays: ownedBusinesses.activeDays,
        startTime: ownedBusinesses.startTime,
        endTime: ownedBusinesses.endTime,
        timezone: ownedBusinesses.timezone,
        rewardPercentage: ownedBusinesses.rewardPercentage,
        gallery: ownedBusinesses.gallery,
        logoUrl: ownedBusinesses.logoUrl,
      })
      .from(ownedBusinesses)
      .where(eq(ownedBusinesses.ownerId, ctx.userId))
      .limit(1);
    if (!biz) return { business: null };
    return { business: biz };
  }),

  updateBusinessProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(2).max(80).optional(),
      description: z.string().max(600).nullable().optional(),
      address: z.string().min(3).max(200).optional(),
      website: z.string().max(200).nullable().optional(),
      /** Días activos ISO-8601: 1=lunes … 7=domingo */
      activeDays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
      /** "HH:MM" 24h */
      startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      timezone: z.string().max(60).optional(),
      rewardPercentage: z.number().int().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [biz] = await ctx.coreDb
        .select({ id: ownedBusinesses.id })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.ownerId, ctx.userId))
        .limit(1);
      if (!biz) throw new TRPCError({ code: "NOT_FOUND", message: "No tienes un comercio asociado a esta cuenta" });

      // Normaliza el sitio web: acepta "midominio.com" y guarda con protocolo.
      let website: string | null | undefined = input.website;
      if (typeof website === "string") {
        const trimmed = website.trim();
        website = trimmed.length === 0 ? null : (trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      }

      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.name !== undefined) patch.name = input.name.trim();
      if (input.description !== undefined) patch.description = input.description?.trim() || null;
      if (input.address !== undefined) patch.address = input.address.trim();
      if (website !== undefined) patch.website = website;
      if (input.activeDays !== undefined) patch.activeDays = JSON.stringify(Array.from(new Set(input.activeDays)).sort());
      if (input.startTime !== undefined) patch.startTime = input.startTime;
      if (input.endTime !== undefined) patch.endTime = input.endTime;
      if (input.timezone !== undefined) patch.timezone = input.timezone;
      if (input.rewardPercentage !== undefined) patch.rewardPercentage = input.rewardPercentage;

      await ctx.coreDb.update(ownedBusinesses).set(patch).where(eq(ownedBusinesses.id, biz.id));
      return { success: true };
    }),
});
