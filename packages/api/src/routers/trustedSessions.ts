import { z } from "zod";
import { eq, and, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import { verify as verifyTotp } from "otplib";
import { router, protectedProcedure, publicLimitedProcedure } from "../trpc";
import { trustedSessions, users } from "@rabbitty/database-core";
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

export const trustedSessionsRouter = router({
  create: protectedProcedure
    .input(z.object({
      deviceName: z.string().optional(),
      userAgent: z.string().optional(),
      ipAddress: z.string().optional(),
      expiresInDays: z.number().default(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + input.expiresInDays * 86400000);

      await ctx.coreDb.insert(trustedSessions).values({
        userId: ctx.userId,
        token,
        deviceName: input.deviceName ?? "Dispositivo confiable",
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        expiresAt,
      });

      return { token, expiresAt };
    }),

  verify: publicLimitedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const [session] = await ctx.coreDb.select()
        .from(trustedSessions)
        .where(and(
          eq(trustedSessions.token, input.token),
          eq(trustedSessions.userId, ctx.userId ?? ""),
          lt(trustedSessions.expiresAt, new Date()),
        ))
        .limit(1);
      if (!session) return { valid: false };
      return { valid: true, userId: session.userId };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.coreDb.select({
      id: trustedSessions.id,
      deviceName: trustedSessions.deviceName,
      userAgent: trustedSessions.userAgent,
      createdAt: trustedSessions.createdAt,
      expiresAt: trustedSessions.expiresAt,
    }).from(trustedSessions).where(eq(trustedSessions.userId, ctx.userId)).orderBy(trustedSessions.createdAt);
  }),

  revoke: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.coreDb.select().from(trustedSessions).where(eq(trustedSessions.id, input.id)).limit(1);
      if (!existing || existing.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.coreDb.delete(trustedSessions).where(eq(trustedSessions.id, input.id));
      return { success: true };
    }),

  revokeAll: protectedProcedure
    .input(z.object({ verificationCode: z.string().length(6).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireTotpIfEnabled(ctx.coreDb, ctx.userId, input.verificationCode);
      await ctx.coreDb.delete(trustedSessions).where(eq(trustedSessions.userId, ctx.userId));
      return { success: true };
    }),
});
