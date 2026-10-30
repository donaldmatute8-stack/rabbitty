import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, webSessions, verificationTokens } from '@/db/schema';
import { and, eq, gt, or, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { rateLimit, retryAfterSec, checkOnly, registerHit, resetLimit, getClientIp, hashOtp } from '@/lib/otp';
import { resolveUniqueUsername } from '@/lib/username';
import { validateTelegramInitData, parseTelegramUser } from '@/lib/telegramAuth';
import { claimWelcomeBonusForUser } from '@/lib/welcomeBonusConfig';

const VERIFY_IP_LIMIT = 30;
const VERIFY_IP_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const ipKey = `otp_verify_ip:${getClientIp(req)}`;

    const ipCheck = await rateLimit(ipKey, VERIFY_IP_LIMIT, VERIFY_IP_WINDOW_MS);
    if (!ipCheck.ok) {
      return NextResponse.json(
        { error: `Demasiados intentos. Espera ${ipCheck.retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(ipCheck.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const rawInput = (body?.input || body?.email || '').trim();
    const code = body?.code?.trim();

    const isTesterDemo = process.env.NODE_ENV !== 'production' && (rawInput.toLowerCase() === 'tester' || rawInput.toLowerCase() === 'tester@rabbitty.me');
    const isAcceptedDemoCode = isTesterDemo && (code === '123456' || code === 'demo12' || code === 'demo123' || (code?.length === 6));

    if (!rawInput || !code) {
      return NextResponse.json({ error: 'Identificador y código son obligatorios' }, { status: 400 });
    }

    if (!isTesterDemo && !/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'Código de 6 dígitos es obligatorio' }, { status: 400 });
    }

    let email = '';
    let phone: string | null = null;
    const isEmail = rawInput.includes('@');

    if (isTesterDemo) {
      email = 'tester@rabbitty.me';
    } else if (isEmail) {
      email = rawInput.toLowerCase();
    } else {
      const digitsOnly = rawInput.replace(/\D/g, '');
      phone = rawInput.startsWith('+') ? rawInput : `+${digitsOnly}`;

      const last10 = digitsOnly.slice(-10);
      const [matchedUser] = await db
        .select({ id: users.id, email: users.email, phoneNumber: users.phoneNumber })
        .from(users)
        .where(
          sql`regexp_replace(COALESCE(${users.phoneNumber}, ''), '\\D', '', 'g') LIKE ${'%' + last10}`
        )
        .limit(1);

      if (matchedUser && matchedUser.email) {
        email = matchedUser.email;
      } else {
        email = `${digitsOnly}@phone.rabbitty.me`;
      }
    }

    const failKey = `otp_verify_fail:${email}`;
    if (!(await checkOnly(failKey, MAX_FAILED_ATTEMPTS))) {
      const wait = await retryAfterSec(failKey);
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Solicita un nuevo código en ${wait} segundos.` },
        { status: 429, headers: { 'Retry-After': String(wait) } }
      );
    }

    const tokenHashEmail = hashOtp(email, code);
    const tokenHashRaw = hashOtp(rawInput, code);

    const isValid = isTesterDemo && isAcceptedDemoCode;

    if (!isValid) {
      // Atomic consume: delete matching token
      const deleted = await db.delete(verificationTokens).where(
        and(
          or(
            eq(verificationTokens.identifier, email),
            eq(verificationTokens.identifier, rawInput),
            phone ? eq(verificationTokens.identifier, phone) : sql`false`
          ),
          or(
            eq(verificationTokens.token, tokenHashEmail),
            eq(verificationTokens.token, tokenHashRaw),
            eq(verificationTokens.token, code)
          ),
          gt(verificationTokens.expires, new Date())
        )
      ).returning();

      if (!deleted.length) {
        await registerHit(failKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_MS);
        return NextResponse.json({ error: 'Código incorrecto o ha expirado. Por favor solicita uno nuevo.' }, { status: 400 });
      }
    }

    await resetLimit(failKey);

    // ── Dedupe de identidad: si el login ocurre dentro de Telegram, la identidad
    // del bot TIENE prioridad — evita usuarios duplicados (uno por Telegram, otro por OTP) ──
    let telegramIdentityId: string | null = null;
    const initData = typeof body?.initData === 'string' ? body.initData : null;
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (initData && botToken && validateTelegramInitData(initData, botToken)) {
      const tgUser = parseTelegramUser(initData);
      if (tgUser?.id) {
        const [tgRow] = await db.select({ id: users.id, phoneNumber: users.phoneNumber, email: users.email })
          .from(users).where(eq(users.telegramId, String(tgUser.id))).limit(1);
        if (tgRow) {
          telegramIdentityId = tgRow.id;
          // Vincular el teléfono/email del OTP a la identidad de Telegram si estaba suelto
          const patch: Record<string, string | null> = {};
          if (phone && !tgRow.phoneNumber) patch.phoneNumber = phone;
          if (email && !tgRow.email) patch.email = email;
          if (Object.keys(patch).length) {
            await db.update(users).set(patch).where(eq(users.id, tgRow.id));
          }
        }
      }
    }

    // Buscar usuario por email o teléfono
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user && phone) {
      const digitsOnly = rawInput.replace(/\D/g, '');
      const last10 = digitsOnly.slice(-10);
      user = await db.query.users.findFirst({
        where: sql`regexp_replace(${users.phoneNumber}, '\\D', '', 'g') LIKE ${'%' + last10}`,
      });
    }

    // Identidad Telegram ya resuelta → GANA sobre la del OTP (una sola cuenta por humano)
    if (telegramIdentityId && user && user.id !== telegramIdentityId) {
      // La cuenta OTP creada por navegador queda desactivada como identidad duplicada:
      // conservamos su saldo moviéndolo a la identidad de Telegram si la OTP estaba vacía.
      const [otpRow] = await db.select({ earned: users.totalBunzEarned, spent: users.totalBunzSpent, tgId: users.telegramId, email: users.email, phone: users.phoneNumber })
        .from(users).where(eq(users.id, user.id)).limit(1);
      const otpHasUse = (otpRow.earned ?? 0) > 0 || (otpRow.spent ?? 0) > 0 || otpRow.tgId;
      if (!otpHasUse) {
        // Solo borrar si además NO tiene sesiones activas (evita FK violation / login roto)
        const [activeSession] = await db.select({ id: webSessions.id })
          .from(webSessions).where(eq(webSessions.userId, user.id)).limit(1);
        if (!activeSession) {
          try { await db.delete(users).where(eq(users.id, user.id)); } catch { /* conservador: nunca romper el login */ }
        }
      }
      user = await db.query.users.findFirst({ where: eq(users.id, telegramIdentityId) });
    }

    const isNewUser = !user;

    let resolvedUser = user;
    if (!resolvedUser) {
      const usernameBase = isEmail ? email.split('@')[0] : `user_${rawInput.replace(/\D/g, '').slice(-6)}`;
      const username = await resolveUniqueUsername(usernameBase);
      const tgIdFromInitData = (() => {
        if (!initData || !botToken || !validateTelegramInitData(initData, botToken)) return null;
        const tg = parseTelegramUser(initData);
        return tg?.id ? String(tg.id) : null;
      })();
      [resolvedUser] = await db.insert(users).values({
        email,
        phoneNumber: phone,
        username,
        telegramId: tgIdFromInitData,
        totalBunzEarned: 0,
        totalBunzSpent: 0,
        role: 'USER',
      }).returning();
    }

    // reclamar automáticamente Bono de Bienvenida reservado en /download (pendingVaults) o promoRef con Split Triangular + Push Notification
    const welcomeBonus = await claimWelcomeBonusForUser({
      userId: resolvedUser.id,
      phoneNumber: resolvedUser.phoneNumber || phone,
      email: resolvedUser.email || email,
      promoRef: body?.promoRef || body?.ref || null,
      requestedBunz: body?.promoBunz ? Number(body.promoBunz) : null,
    });

    if (welcomeBonus?.awarded) {
      const refreshed = await db.query.users.findFirst({ where: eq(users.id, resolvedUser.id) });
      if (refreshed) resolvedUser = refreshed;
    }

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
      welcomeBonus,
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