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
    let telegramId: string | null = null;

    const isEmail = rawInput.includes('@');
    const isTesterDemo = process.env.NODE_ENV !== 'production' && (rawInput.toLowerCase() === 'tester' || rawInput.toLowerCase() === 'tester@rabbitty.me');

    if (isTesterDemo) {
      email = 'tester@rabbitty.me';
      mode = 'email';
    } else if (isEmail) {
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
        .select({ id: users.id, email: users.email, phoneNumber: users.phoneNumber, telegramId: users.telegramId })
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
      if (matchedUser?.telegramId) telegramId = matchedUser.telegramId;
    }

    const emailCheck = rateLimit(`otp_send_target:${rawInput}`, 1, EMAIL_RESEND_COOLDOWN_MS);
    if (!emailCheck.ok) {
      return NextResponse.json(
        { error: `Ya se envió un código. Solicita uno nuevo en ${emailCheck.retryAfterSec} segundos.` },
        { status: 429, headers: { 'Retry-After': String(emailCheck.retryAfterSec) } }
      );
    }

    const code = isTesterDemo ? '123456' : crypto.randomInt(100000, 1000000).toString();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for tester demo

    // Borrar tokens previos para email, rawInput o teléfono
    await db.delete(verificationTokens).where(
      or(
        eq(verificationTokens.identifier, email),
        eq(verificationTokens.identifier, rawInput),
        phone ? eq(verificationTokens.identifier, phone) : sql`false`
      )
    );

    // Guardar tokens con hash único por identifier+code para evitar colisión de PK en verificationTokens.token
    const tokenHashEmail = hashOtp(email, code);
    await db.insert(verificationTokens).values({
      identifier: email,
      token: tokenHashEmail,
      expires,
    });

    if (isTesterDemo) {
      return NextResponse.json({
        success: true,
        message: 'Código de acceso demo para revisión Apple generado.',
        channel: 'email',
        mode: 'email',
        otpCode: '123456',
      });
    }

    if (rawInput !== email) {
      try {
        const tokenHashRaw = hashOtp(rawInput, code);
        await db.insert(verificationTokens).values({
          identifier: rawInput,
          token: tokenHashRaw,
          expires,
        });
      } catch {}
    }

    if (phone && phone !== rawInput && phone !== email) {
      try {
        const tokenHashPhone = hashOtp(phone, code);
        await db.insert(verificationTokens).values({
          identifier: phone,
          token: tokenHashPhone,
          expires,
        });
      } catch {}
    }

    console.log(`[MINIAPP OTP GENERATED] Mode: ${mode} | Target: ${rawInput} | Code: ${code.slice(0, 2)}****`);

    // Entregar el código por el canal disponible: email real o bot de Telegram.
    const isGenericPhoneEmail = email.endsWith('@phone.rabbitty.me');
    let delivered = false;
    let deliveryChannel: 'email' | 'telegram' | 'dev' = 'dev';

    if (!isGenericPhoneEmail) {
      const emailResult = await sendEmail({
        to: email,
        subject: `🔑 ${code} es tu código de acceso Rabbitty`,
        html: getOtpEmailTemplate(code),
      });
      if (emailResult.ok) {
        delivered = true;
        deliveryChannel = 'email';
      } else {
        console.error('[OTP SEND] Email dispatch failed:', emailResult.error);
      }
    } else if (telegramId) {
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      if (botToken) {
        try {
          const botRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramId,
              text: `🔑 Tu código de acceso Rabbitty es: ${code}\n\nExpira en 10 minutos. No lo compartas con nadie.`,
            }),
          });
          if (botRes.ok) {
            delivered = true;
            deliveryChannel = 'telegram';
          } else {
            console.error('[OTP SEND] Telegram dispatch failed:', botRes.status);
          }
        } catch (botErr) {
          console.error('[OTP SEND] Telegram dispatch error:', botErr);
        }
      }
    }

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev && !delivered) {
      delivered = true;
      deliveryChannel = 'dev';
    }

    if (!delivered) {
      // Sin canal de entrega: limpiar tokens para no dejar códigos huérfanos.
      await db.delete(verificationTokens).where(
        or(
          eq(verificationTokens.identifier, email),
          eq(verificationTokens.identifier, rawInput),
          phone ? eq(verificationTokens.identifier, phone) : sql`false`
        )
      );
      return NextResponse.json(
        { error: 'No podemos enviar el código a ese número todavía. Inicia sesión con tu correo electrónico o vincúlalo desde Telegram.' },
        { status: 502 }
      );
    }

    const maskedEmail = email.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => `${first}***${domain}`);

    return NextResponse.json({
      success: true,
      mode,
      target: rawInput,
      resolvedEmail: maskedEmail,
      channel: deliveryChannel,
      otpCode: isDev ? code : undefined,
      message: deliveryChannel === 'telegram'
        ? `Enviamos un código de 6 dígitos a tu Telegram vinculado`
        : mode === 'phone'
          ? `Enviamos un código de 6 dígitos a tu correo vinculado (${maskedEmail})`
          : `Enviamos un código de 6 dígitos a ${email}`,
    });
  } catch (error) {
    console.error('[OTP SEND ERROR]', error);
    return NextResponse.json({ error: 'Error al enviar código de verificación' }, { status: 500 });
  }
}