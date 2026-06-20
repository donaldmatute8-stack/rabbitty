import { z } from "zod";
import { eq } from "drizzle-orm";
import { verify as verifyTotp } from "otplib";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { router, protectedProcedure, publicLimitedProcedure } from "../trpc";
import { passkeys, users } from "@rabbitty/database-core";
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

const rpName = process.env.RP_NAME ?? "Rabbitty Admin";
const rpID = process.env.RP_ID ?? "localhost";
const origin = process.env.ORIGIN ?? `http://${rpID}:3003`;

const challengeMap = new Map<string, string>();

export const passkeysRouter = router({
  generateRegistrationOptions: protectedProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.coreDb.select({ credentialId: passkeys.credentialId }).from(passkeys).where(eq(passkeys.userId, ctx.userId));
    const excludeCredentials = existing.map((pk) => ({
      id: pk.credentialId,
      transports: [] as AuthenticatorTransportFuture[],
    }));

    const [user] = await ctx.coreDb.select({ email: users.email, firstName: users.firstName, lastName: users.lastName }).from(users).where(eq(users.id, ctx.userId)).limit(1);
    const userName = user?.email ?? ctx.userId;
    const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || userName;

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName,
      userDisplayName: displayName,
      attestationType: "none",
      excludeCredentials,
    });

    challengeMap.set(ctx.userId, options.challenge);
    return options;
  }),

  verifyRegistration: protectedProcedure
    .input(z.object({
      credential: z.any(),
      deviceName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const challenge = challengeMap.get(ctx.userId);
      if (!challenge) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No registration challenge found. Generate one first." });

      const verification = await verifyRegistrationResponse({
        response: input.credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      challengeMap.delete(ctx.userId);

      if (!verification.verified || !verification.registrationInfo) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Verification failed" });
      }

      const { credential } = verification.registrationInfo;

      await ctx.coreDb.insert(passkeys).values({
        userId: ctx.userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString("base64url"),
        counter: credential.counter,
        transports: JSON.stringify(credential.transports ?? []),
        deviceName: input.deviceName ?? "Passkey",
      });

      return { success: true };
    }),

  generateAuthenticationOptions: publicLimitedProcedure.query(async ({ ctx }) => {
    if (!ctx.userId) {
      const options = await generateAuthenticationOptions({ rpID, allowCredentials: [] });
      return { ...options, allowCredentials: [] };
    }

    const existing = await ctx.coreDb.select({ credentialId: passkeys.credentialId, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.userId, ctx.userId));
    const allowCredentials = existing.map((pk) => ({
      id: pk.credentialId,
      transports: JSON.parse(pk.transports) as AuthenticatorTransportFuture[],
    }));

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
      userVerification: "preferred",
    });

    challengeMap.set(ctx.userId, options.challenge);
    return options;
  }),

  verifyAuthentication: protectedProcedure
    .input(z.object({ credential: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const challenge = challengeMap.get(ctx.userId);
      if (!challenge) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No authentication challenge found" });

      const [cred] = await ctx.coreDb.select().from(passkeys).where(eq(passkeys.userId, ctx.userId)).limit(1);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "No passkey found for this user" });

      const verification = await verifyAuthenticationResponse({
        response: input.credential,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credentialId,
          publicKey: Buffer.from(cred.publicKey, "base64url"),
          counter: cred.counter,
          transports: JSON.parse(cred.transports) as AuthenticatorTransportFuture[],
        },
      });

      challengeMap.delete(ctx.userId);

      if (!verification.verified) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Passkey verification failed" });
      }

      await ctx.coreDb.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, cred.id));

      return { success: true, credentialId: cred.id };
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.coreDb.select({
      id: passkeys.id,
      deviceName: passkeys.deviceName,
      createdAt: passkeys.createdAt,
    }).from(passkeys).where(eq(passkeys.userId, ctx.userId)).orderBy(passkeys.createdAt);
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid(), verificationCode: z.string().length(6).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireTotpIfEnabled(ctx.coreDb, ctx.userId, input.verificationCode);
      const [existing] = await ctx.coreDb.select().from(passkeys).where(eq(passkeys.id, input.id)).limit(1);
      if (!existing || existing.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      await ctx.coreDb.delete(passkeys).where(eq(passkeys.id, input.id));
      return { success: true };
    }),
});
