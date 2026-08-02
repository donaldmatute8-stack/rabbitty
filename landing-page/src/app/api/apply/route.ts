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
    return NextResponse.json({ ok: result.ok, telegramResult: result });
  } catch (error) {
    console.error('[Landing Apply] Internal Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 200 });
  }
}
