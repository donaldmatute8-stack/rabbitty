import { NextResponse } from 'next/server';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const msg = `🆕 *Nueva solicitud negocio Rabbitty*\n\n🏪 *Negocio:* ${data.negocio}\n📂 *Tipo:* ${data.tipo}\n👤 *Contacto:* ${data.nombre}\n📱 *Tel:* ${data.telefono}\n✉️ *Email:* ${data.email}\n📍 *Ubicación:* ${data.ubicacion}\n🔍 *Cómo supo:* ${data.como_supo}\n💬 *Mensaje:* ${data.mensaje}`;

    if (!BOT_TOKEN || !CHAT_ID) {
      return NextResponse.json({ ok: false, error: 'Telegram not configured' }, { status: 200 });
    }

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'Markdown' }),
    });

    const result = await res.json();
    return NextResponse.json({ ok: result.ok });
  } catch {
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 200 });
  }
}
