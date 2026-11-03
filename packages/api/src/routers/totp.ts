import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import { router, protectedProcedure } from "../trpc";
import { users } from "@rabbitty/database-core";
import { TRPCError } from "@trpc/server";
import { encryptText, decryptText } from "../services/crypto";

/**
 * Resuelve la fila de `users` de la sesión.
 *
 * El admin puede entrar con una sesión cuyo `userId` NO vive en `core.users`
 * (cuentas de staff/owner creadas en otra tabla). Sin este fallback, TODA la
 * configuración de 2FA respondía `NOT_FOUND` al hacer clic.
 */
async function resolveUserId(ctx: {
  coreDb: any;
  userId?: string | null;
  user?: { email?: string | null } | null;
}): Promise<string> {
  if (ctx.userId) {
    const [byId] = await ctx.coreDb
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1);
    if (byId) return byId.id;
  }

  const email = ctx.user?.email?.trim().toLowerCase();
  if (email) {
    const [byEmail] = await ctx.coreDb
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);
    if (byEmail) return byEmail.id;
  }

  throw new TRPCError({
    code: "NOT_FOUND",
    message:
      "Tu cuenta de admin no está vinculada a un usuario Rabbitty. Entra con tu cuenta de Rabbitty (mismo email) o pide acceso al founder.",
  });
}

export const totpRouter = router({
  generateSecret: protectedProcedure.mutation(async ({ ctx }) => {
    const uid = await resolveUserId(ctx);
    const [user] = await ctx.coreDb
      .select({ email: users.email, totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos tu usuario Rabbitty." });
    if (user.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "2FA ya está activada. Desactívala primero para regenerar." });

    const secret = generateSecret();
    const serviceName = process.env.RP_NAME ?? "Rabbitty Admin";
    const label = user.email ?? uid;
    const otpauth = generateURI({ issuer: serviceName, label, secret });

    const qrCodeDataUrl = await QRCode.toDataURL(otpauth);
    const encryptedSecret = encryptText(secret);
    await ctx.coreDb.update(users).set({ totpSecret: encryptedSecret }).where(eq(users.id, uid));

    return { secret, qrCodeDataUrl, otpauth };
  }),

  verifyAndEnable: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const uid = await resolveUserId(ctx);
      const [user] = await ctx.coreDb
        .select({ totpSecret: users.totpSecret })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      if (!user?.totpSecret) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Primero genera un secreto TOTP" });

      const secret = decryptText(user.totpSecret ?? "");
      const result = await verify({ token: input.code, secret });
      if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido. Verifica que la hora de tu dispositivo esté sincronizada." });

      await ctx.coreDb.update(users).set({ totpEnabled: true }).where(eq(users.id, uid));
      return { success: true };
    }),

  verify: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const uid = await resolveUserId(ctx);
      const [user] = await ctx.coreDb
        .select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      if (!user?.totpSecret || !user.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "2FA no está activada" });

      const secret = decryptText(user.totpSecret ?? "");
      const result = await verify({ token: input.code, secret });
      if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido" });

      return { success: true };
    }),

  disable: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const uid = await resolveUserId(ctx);
      const [user] = await ctx.coreDb
        .select({ totpSecret: users.totpSecret, totpEnabled: users.totpEnabled })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      if (!user?.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "2FA no está activada" });

      const secret = decryptText(user.totpSecret ?? "");
      const result = await verify({ token: input.code, secret });
      if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código inválido" });

      await ctx.coreDb
        .update(users)
        .set({ totpEnabled: false, totpSecret: null, requireTotpForLogin: false })
        .where(eq(users.id, uid));
      return { success: true };
    }),

  toggleLoginRequirement: protectedProcedure
    .input(z.object({ require: z.boolean(), verificationCode: z.string().length(6).optional() }))
    .mutation(async ({ ctx, input }) => {
      const uid = await resolveUserId(ctx);
      const [user] = await ctx.coreDb
        .select({ totpEnabled: users.totpEnabled, totpSecret: users.totpSecret })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      if (!user?.totpEnabled) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Activa 2FA primero antes de requerirla para login" });

      if (!input.require) {
        if (!input.verificationCode || input.verificationCode.length !== 6) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Se requiere un código de verificación 2FA para desactivar este requisito" });
        }
        const secret = decryptText(user.totpSecret ?? "");
        const result = await verify({ token: input.verificationCode, secret });
        if (!result.valid) throw new TRPCError({ code: "BAD_REQUEST", message: "Código de verificación inválido" });
      }

      await ctx.coreDb.update(users).set({ requireTotpForLogin: input.require }).where(eq(users.id, uid));
      return { success: true };
    }),

  checkRequirement: protectedProcedure.query(async ({ ctx }) => {
    const uid = await resolveUserId(ctx);
    const [user] = await ctx.coreDb
      .select({ requireTotpForLogin: users.requireTotpForLogin, totpEnabled: users.totpEnabled })
      .from(users)
      .where(eq(users.id, uid))
      .limit(1);
    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "No encontramos tu usuario Rabbitty." });
    return user;
  }),
});
