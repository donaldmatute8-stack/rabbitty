import { z } from "zod";
import crypto from "crypto";
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
import { passkeys, users, verificationTokens } from "@rabbitty/database-core";
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

  // ── LOGIN con passkey (público): options → verify → token single-use para NextAuth ──
  loginOptions: publicLimitedProcedure.mutation(async ({ ctx }) => {
    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [], // discoverable credentials (Face ID elige la passkey)
      userVerification: "required",
    });
    const loginId = crypto.randomBytes(16).toString("hex");
    await ctx.coreDb.insert(verificationTokens).values({
      identifier: `pk_challenge:${loginId}`,
      token: options.challenge,
      expires: new Date(Date.now() + 3 * 60 * 1000),
    });
    return { options, loginId };
  }),

  loginVerify: publicLimitedProcedure
    .input(z.object({ response: z.any(), loginId: z.string().min(10) }))
    .mutation(async ({ ctx, input }) => {
      const idKey = `pk_challenge:${input.loginId}`;
      const [challengeRow] = await ctx.coreDb
        .select()
        .from(verificationTokens)
        .where(eq(verificationTokens.identifier, idKey))
        .limit(1);
      if (!challengeRow || new Date(challengeRow.expires) < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Challenge expirado. Intenta de nuevo." });
      }
      const challenge = challengeRow.token;

      // Localizar la credencial por rawId
      let credentialId = "";
      try {
        const resp = input.response as { id?: string; rawId?: string };
        credentialId = resp.id || resp.rawId || "";
      } catch {}
      if (!credentialId) throw new TRPCError({ code: "BAD_REQUEST", message: "Respuesta inválida" });

      const [cred] = await ctx.coreDb.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).limit(1);
      if (!cred) throw new TRPCError({ code: "NOT_FOUND", message: "Passkey no registrada en este servidor" });

      const verification = await verifyAuthenticationResponse({
        response: input.response,
        expectedChallenge: challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: cred.credentialId,
          publicKey: Buffer.from(cred.publicKey, "base64url"),
          counter: cred.counter,
          transports: JSON.parse(cred.transports || "[]") as AuthenticatorTransportFuture[],
        },
      });
      if (!verification.verified) throw new TRPCError({ code: "BAD_REQUEST", message: "Verificación fallida" });

      await ctx.coreDb.update(passkeys).set({ counter: verification.authenticationInfo.newCounter }).where(eq(passkeys.id, cred.id));
      // challenge single-use
      await ctx.coreDb.delete(verificationTokens).where(eq(verificationTokens.identifier, idKey));

      const [user] = await ctx.coreDb.select({ email: users.email, firstName: users.firstName }).from(users).where(eq(users.id, cred.userId)).limit(1);
      const email = (user?.email || `passkey-${cred.userId}@rabbitty.me`).toLowerCase();

      // Token single-use (5 min) para el proveedor NextAuth "passkey"
      const loginToken = crypto.randomBytes(32).toString("hex");
      await ctx.coreDb.insert(verificationTokens).values({
        identifier: `pk_login:${email}`,
        token: loginToken,
        expires: new Date(Date.now() + 5 * 60 * 1000),
      });

      return { success: true, token: loginToken, email };
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
