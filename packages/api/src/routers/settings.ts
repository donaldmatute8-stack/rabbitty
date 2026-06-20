import { z } from "zod";
import { eq } from "drizzle-orm";
import { verify as verifyTotp } from "otplib";
import { router, protectedProcedure } from "../trpc";
import { users, trustedSessions, passkeys } from "@rabbitty/database-core";
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
});
