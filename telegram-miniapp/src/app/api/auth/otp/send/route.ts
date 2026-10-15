import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verificationTokens, users } from '@/db/schema';
import { eq, or, sql } from 'drizzle-orm';
import crypto from 'crypto';
import { sendEmail, getOtpEmailTemplate } from '@/lib/email';
import { rateLimit, getClientIp, hashOtp } from '@/lib/otp';

const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const IP_SEND_LIMIT = 20;
const IP_SEND_WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  try {
    const ipCheck = rateLimit(`otp_send_ip:${getClientIp(req)}`, IP_SEND_LIMIT, IP_SEND_WINDOW_MS);
    if (!ipCheck.ok) {
      return NextResponse.json(
        { error: `Demasiadas solicitudes. Intenta de nuevo en ${ipCheck.retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(ipCheck.retryAfterSec) } }
      );
    }

    const body = await req.json();
    const rawInput = (body?.input || body?.email || '').trim();

    if (!rawInput) {
      return NextResponse.json({ error: 'Por favor ingresa un correo o número celular válido.' }, { status: 400 });
    }

    let email = '';
    let phone: string | null = null;
    let mode: 'email' | 'phone' = 'email';

    const isEmail = rawInput.includes('@');

    if (isEmail) {
      email = rawInput.toLowerCase();
      mode = 'email';
    } else {
      mode = 'phone';
      const digitsOnly = rawInput.replace(/\D/g, '');
      if (digitsOnly.length < 8) {
        return NextResponse.json({ error: 'El número celular debe tener al menos 8 dígitos.' }, { status: 400 });
      }

      phone = rawInput.startsWith('+') ? rawInput : `+${digitsOnly}`;

      // Buscar si el usuario existe por teléfono o los últimos 10 dígitos
      const last10 = digitsOnly.slice(-10);
      const [matchedUser] = await db
        .select({ id: users.id, email: users.email, phoneNumber: users.phoneNumber })
        .from(users)
        .where(
          sql`regexp_replace(${users.phoneNumber}, '\\D', '', 'g') LIKE ${'%' + last10}`
        )
        .limit(1);

      if (matchedUser && matchedUser.email) {
        email = matchedUser.email;
      } else {
        email = `${digitsOnly}@phone.rabbitty.me`;
      }
    }

    const emailCheck = rateLimit(`otp_send_target:${rawInput}`, 1, EMAIL_RESEND_COOLDOWN_MS);
    if (!emailCheck.ok) {
      return NextResponse.json(
        { error: `Ya se envió un código. Solicita uno nuevo en ${emailCheck.retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(emailCheck.retryAfterSec) } }
      );
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 15 * 60 * 1000);

    // Borrar tokens previos para email, rawInput o teléfono
    await db.delete(verificationTokens).where(
      or(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.identifier, rawInput),
        phone ? eq(verificationTokens.identifier, phone) : sql`false`
      )
    );

    // Guardar tokens (hasheados y directos para compatibilidad)
    const tokenHash = hashOtp(email, code);
    await db.insert(verificationTokens).values({
      identifier: email,
      token: tokenHash,
      expires,
    });

    if (rawInput !== email) {
      try {
        await db.insert(verificationTokens).values({
          identifier: rawInput,
          token: tokenHash,
          expires,
        });
      } catch {}
    }

    if (phone && phone !== rawInput && phone !== email) {
      try {
        await db.insert(verificationTokens).values({
          identifier: phone,
          token: tokenHash,
          expires,
        });
      } catch {}
    }

    console.log(`[MINIAPP OTP GENERATED] Mode: ${mode} | Target: ${rawInput} | Email: ${email} | OTP: ${code}`);

    // Si es un correo real, despachar email de notificación
    if (isEmail && !email.endsWith('@phone.rabbitty.me')) {
      const emailResult = await sendEmail({
        to: email,
        subject: `🔑 ${code} es tu código de acceso Rabbitty`,
        html: getOtpEmailTemplate(code),
      });

      if (!emailResult.ok) {
        console.warn('[OTP SEND] Could not dispatch email, but token saved. Details:', emailResult.error);
      }
    }

    const isDev = process.env.NODE_ENV === 'development';

    return NextResponse.json({
      success: true,
      mode,
      target: rawInput,
      resolvedEmail: email,
      otpCode: isDev ? code : undefined,
      message: mode === 'phone'
        ? `Código generado para ${rawInput}`
        : `Enviamos un código de 6 dígitos a ${email}`,
    });
  } catch (error) {
    console.error('[OTP SEND ERROR]', error);
    return NextResponse.json({ error: 'Error al enviar código de verificación' }, { status: 500 });
  }
}