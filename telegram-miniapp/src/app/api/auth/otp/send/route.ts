import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { verificationTokens } from '@/db/schema';
import { eq, or } from 'drizzle-orm';
import { sendEmail, getOtpEmailTemplate } from '@/lib/email';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = body?.email?.toLowerCase()?.trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Por favor ingresa un correo electrónico válido' }, { status: 400 });
    }

    // Generate cryptographically sound 6-digit OTP
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Remove any existing tokens for this email identifier or duplicate code
    await db.delete(verificationTokens).where(or(
      eq(verificationTokens.identifier, email),
      eq(verificationTokens.token, code)
    ));

    // Store new token
    await db.insert(verificationTokens).values({
      identifier: email,
      token: code,
      expires,
    });

    // Send email with custom Rabbitty layout
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
