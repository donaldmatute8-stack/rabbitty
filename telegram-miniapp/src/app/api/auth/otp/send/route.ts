import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verificationTokens } from '@/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { sendEmail, getOtpEmailTemplate } from '@/lib/email';
import { rateLimit, getClientIp, hashOtp } from '@/lib/otp';

const EMAIL_RESEND_COOLDOWN_MS = 60 * 1000;
const IP_SEND_LIMIT = 10;
const IP_SEND_WINDOW_MS = 15 * 60 * 1000;

const OTP_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const email = body?.email?.toLowerCase()?.trim();

    if (!email || !OTP_REGEX.test(email)) {
      return NextResponse.json({ error: 'Por favor ingresa un correo electrónico válido' }, { status: 400 });
    }

    const emailCheck = rateLimit(`otp_send_email:${email}`, 1, EMAIL_RESEND_COOLDOWN_MS);
    if (!emailCheck.ok) {
      return NextResponse.json(
        { error: `Ya se envió un código. Solicita uno nuevo en ${emailCheck.retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(emailCheck.retryAfterSec) } }
      );
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const tokenHash = hashOtp(email, code);
    const expires = new Date(Date.now() + 10 * 60 * 1000);

    await db.delete(verificationTokens).where(eq(verificationTokens.identifier, email));

    await db.insert(verificationTokens).values({
      identifier: email,
      token: tokenHash,
      expires,
    });

    const emailResult = await sendEmail({
      to: email,
      subject: `🔑 ${code} es tu código de acceso Rabbitty`,
      html: getOtpEmailTemplate(code),
    });

    if (!emailResult.ok) {
      console.warn('[OTP SEND] Could not dispatch email, but token saved. Details:', emailResult.error);
    }

    return NextResponse.json({
      success: true,
      message: 'Código de acceso enviado correctamente.',
    });
  } catch (error) {
    console.error('[OTP SEND ERROR]', error);
    return NextResponse.json({ error: 'Error al enviar código de verificación' }, { status: 500 });
  }
}