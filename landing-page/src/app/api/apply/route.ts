import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || process.env.ADMIN_TELEGRAM_IDS || '798431743';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    console.log('[Landing Apply] New form submission received:', data);

    const msg = `🆕 *Nueva solicitud negocio Rabbitty*\n\n` +
      `🏪 *Negocio:* ${data.negocio || 'N/A'}\n` +
      `📂 *Tipo:* ${data.tipo || 'N/A'}\n` +
      `👤 *Contacto:* ${data.nombre || 'N/A'}\n` +
      `📱 *Tel:* ${data.telefono || 'N/A'}\n` +
      `✉️ *Email:* ${data.email || 'N/A'}\n` +
      `📍 *Ubicación:* ${data.ubicacion || 'N/A'}\n` +
      `🔍 *Cómo supo:* ${data.como_supo || 'N/A'}\n` +
      `💬 *Mensaje:* ${data.mensaje || 'N/A'}`;

    if (!BOT_TOKEN) {
      console.error('[Landing Apply] TELEGRAM_BOT_TOKEN not configured on Vercel');
      return NextResponse.json({ ok: false, error: 'Telegram bot not configured' }, { status: 200 });
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' }),
    });

    const result = await res.json();
    console.log('[Landing Apply] Telegram response:', result);

    // Disparar correo de confirmación de recepción al usuario si proporcionó email
    if (data.email) {
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey) {
        try {
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: 'Rabbitty Team <hola@rabbitty.me>',
              to: [data.email],
              subject: `🐰 Recibimos tu solicitud para ${data.negocio || 'tu negocio'}`,
              html: `
                <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #0A0314; color: #FFFFFF; border-radius: 24px; padding: 40px; border: 1px solid rgba(233, 30, 99, 0.3);">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 42px;">🐰</span>
                    <h1 style="color: #F43F5E; font-size: 24px; margin: 12px 0 4px 0;">¡Recibimos la solicitud de ${data.negocio || 'tu negocio'}!</h1>
                    <p style="color: #A855F7; font-size: 14px; margin: 0;">Bienvenido al ecosistema Rabbitty</p>
                  </div>
                  <div style="background: rgba(255,255,255,0.04); border-radius: 16px; padding: 24px; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1);">
                    <p style="font-size: 15px; line-height: 1.6; color: #E2E8F0; margin: 0 0 12px 0;">Hola <strong>${data.nombre || 'Emprendedor'}</strong>,</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0 0 12px 0;">Tu solicitud para registrar <strong>${data.negocio || 'tu comercio'}</strong> está en proceso de revisión por nuestro equipo.</p>
                    <p style="font-size: 14px; line-height: 1.6; color: #CBD5E1; margin: 0;">⏱️ <strong>Tiempo de respuesta:</strong> Entre 2 y 24 horas. Te notificaremos por correo y en Telegram.</p>
                  </div>
                  <div style="background: linear-gradient(135deg, rgba(233,30,99,0.15), rgba(168,85,247,0.15)); border-radius: 16px; padding: 20px; text-align: center; margin-bottom: 28px;">
                    <h3 style="margin: 0 0 8px 0; color: #FFF; font-size: 16px;">📲 Mientras tanto, descarga la Telegram MiniApp</h3>
                    <p style="margin: 0 0 16px 0; color: #E2E8F0; font-size: 13px;">Explora la red y prepárate para premiar a tus clientes.</p>
                    <a href="https://t.me/Rabbittyme_bot/app" style="display: inline-block; background: #F43F5E; color: #FFF; font-weight: 800; font-size: 14px; padding: 12px 28px; border-radius: 12px; text-decoration: none;">Abrir Rabbitty en Telegram 🚀</a>
                  </div>
                </div>
              `,
            }),
          });
        } catch (e) {
          console.error('[Landing Apply] Resend email send error:', e);
        }
      }
    }

    return NextResponse.json({ ok: result.ok, telegramResult: result });
  } catch (error) {
    console.error('[Landing Apply] Internal Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 200 });
  }
}
