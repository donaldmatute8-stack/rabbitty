import { z } from "zod";
import { eq } from "drizzle-orm";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { router, protectedProcedure } from "../trpc";
import { users } from "@rabbitty/database-core";
import { TRPCError } from "@trpc/server";
import { encryptText, decryptText } from "../services/crypto";

export const totpRouter = router({
  generateSecret: protectedProcedure.mutation(async ({ ctx }) => {
    const [user] = await ctx.coreDb.select({ email: users.email, totpSecret: users.totpSecret, totpEnabled: users.totpEnabled }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    if (user.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "2FA ya está activada. Desactívala primero para regenerar." });

    const secret = generateSecret();
    const serviceName = process.env.RP_NAME ?? "Rabbitty Admin";
    const label = user.email ?? ctx.userId;
    const otpauth = generateURI({ issuer: serviceName, label, secret });

    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
    const encryptedSecret = encryptText(secret);
    await ctx.coreDb.update(users).set({ totpSecret: encryptedSecret }).where(eq(users.id, ctx.userId));

    return { secret, qrCodeDataUrl, otpauth };
  }),

  verifyAndEnable: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.coreDb.select({ totpSecret: users.totpSecret }).from(users).where(eq(users.id, ctx.userId)).limit(1);
      if (!user?.totpSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Primero genera un secreto TOTP" });

      const secret = decryptText(user.totpSecret ?? "");
      const result = await verify({ token: input.code, secret });
      if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido. Verifica que la hora de tu dispositivo esté sincronizada." });

      await ctx.coreDb.update(users).set({ totpEnabled: true }).where(eq(users.id, ctx.userId));
      return { success: true };
    }),

  verify: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.coreDb.select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled }).from(users).where(eq(users.id, ctx.userId)).limit(1);
      if (!user?.totpSecret || !user.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "2FA no está activada" });

      const secret = decryptText(user.totpSecret ?? "");
      const result = await verify({ token: input.code, secret });
      if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido" });

      return { success: true };
    }),

  disable: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.coreDb.select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled }).from(users).where(eq(users.id, ctx.userId)).limit(1);
      if (!user?.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "2FA no está activada" });

      const secret = decryptText(user.totpSecret ?? "");
      const result = await verify({ token: input.code, secret });
      if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido" });

      await ctx.coreDb.update(users).set({ totpEnabled: false, totpSecret: null, requireTotpForLogin: false }).where(eq(users.id, ctx.userId));
      return { success: true };
    }),

  toggleLoginRequirement: protectedProcedure
    .input(z.object({ require: z.boolean(), verificationCode: z.string().length(6).optional() }))
    .mutation(async ({ ctx, input }) => {
      const [user] = await ctx.coreDb.select({ totpEnabled: users.totpEnabled, totpSecret: users.totpSecret }).from(users).where(eq(users.id, ctx.userId)).limit(1);
      if (!user?.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Activa 2FA primero antes de requerirla para login" });

      if (!input.require) {
        if (!input.verificationCode || input.verificationCode.length !== 6) throw new TRPCError({ code: "BAD_REQUEST", message: "Se requiere un código de verificación 2FA para desactivar este requisito" });
        const secret = decryptText(user.totpSecret ?? "");
        const result = await verify({ token: input.verificationCode, secret });
        if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código de verificación inválido" });
      }

      await ctx.coreDb.update(users).set({ requireTotpForLogin: input.require }).where(eq(users.id, ctx.userId));
      return { success: true };
    }),

  checkRequirement: protectedProcedure.query(async ({ ctx }) => {
    const [user] = await ctx.coreDb.select({
      requireTotpForLogin: users.requireTotpForLogin,
      totpEnabled: users.totpEnabled,
    }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return user;
  }),
});
