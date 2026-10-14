import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, webSessions, verificationTokens } from '@/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import crypto from 'crypto';
import { rateLimit, retryAfterSec, checkOnly, registerHit, resetLimit, getClientIp, hashOtp } from '@/lib/otp';

const VERIFY_IP_LIMIT = 30;
const VERIFY_IP_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const ipKey = `otp_verify_ip:${getClientIp(req)}`;

    const ipCheck = rateLimit(ipKey, VERIFY_IP_LIMIT, VERIFY_IP_WINDOW_MS);
    if (!ipCheck.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${ipCheck.retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(ipCheck.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const email = body?.email?.toLowerCase()?.trim();
    const code = body?.code?.trim();

    if (!email || !code || !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Email y código de 6 dígitos son obligatorios' }, { status: 400 });
    }

    const failKey = `otp_verify_fail:${email}`;
    if (!checkOnly(failKey, MAX_FAILED_ATTEMPTS)) {
      const wait = retryAfterSec(failKey);
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Solicita un nuevo código en ${wait} segundos.` },
        { status: 429, headers: { 'Retry-After': String(wait) } }
      );
    }

    const tokenHash = hashOtp(email, code);

    // Atomic consume: the delete itself verifies the token, so it can never be
    // redeemed twice even under concurrent requests.
    const deleted = await db.delete(verificationTokens).where(
      and(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.token, tokenHash),
        gt(verificationTokens.expires, new Date())
      )
    ).returning();

    if (!deleted.length) {
      registerHit(failKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_MS);
      return NextResponse.json({ error: 'Código incorrecto o ha expirado. Por favor solicita uno nuevo.' }, { status: 400 });
    }

    resetLimit(failKey);

    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    const isNewUser = !user;

    const resolvedUser =
      user ??
      (
        await db.insert(users).values({
          email,
          username: email.split('@')[0],
          totalBunzEarned: 0,
          totalBunzSpent: 0,
          role: 'USER',
        }).returning()
      )[0];

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.insert(webSessions).values({
      jwtToken: sessionToken,
      userId: resolvedUser.id,
      expiresAt,
    });

    return NextResponse.json({
      success: true,
      isNewUser,
      sessionToken,
      user: {
        id: resolvedUser.id,
        email: resolvedUser.email,
        username: resolvedUser.username,
        firstName: resolvedUser.firstName,
        lastName: resolvedUser.lastName,
        telegramId: resolvedUser.telegramId,
        tonWalletAddress: resolvedUser.tonWalletAddress,
        totalBunzEarned: resolvedUser.totalBunzEarned,
        totalBunzSpent: resolvedUser.totalBunzSpent,
        role: resolvedUser.role,
      },
    });
  } catch (error) {
    console.error('[OTP VERIFY ERROR]', error);
    return NextResponse.json({ error: 'Error al verificar código' }, { status: 500 });
  }
}