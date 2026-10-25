import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { sendTelegramMessage } from '@/lib/chat';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',');

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    const body = await req.json();
    const { type, title, message, url, userAgent } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
    }

    const reportType = type === 'BUG' ? '🐞 REPORTE DE ERROR (BUG)' : '💡 FEEDBACK DE USUARIO';
    const cleanTitle = (title || 'Sin título').trim().slice(0, 100);
    const cleanMessage = message.trim().slice(0, 2000);
    const originUrl = (url || 'No especificada').slice(0, 250);
    const clientAgent = (userAgent || 'Desconocido').slice(0, 150);

    const senderInfo = caller
      ? `Usuario ID: ${caller.id} (@${caller.username || 'Sin alias'})`
      : 'Usuario no autenticado / Anónimo';

    // 1. Notificar a los administradores vía Telegram
    const telegramText =
      `${reportType}\n\n` +
      `📌 *Título:* ${cleanTitle}\n` +
      `📝 *Detalle:*\n${cleanMessage}\n\n` +
      `👤 *Remitente:* ${senderInfo}\n` +
      `🌐 *Ruta:* \`${originUrl}\`\n` +
      `📱 *Dispositivo:* \`${clientAgent}\``;

    for (const adminId of ADMIN_TELEGRAM_IDS) {
      if (adminId.trim()) {
        await sendTelegramMessage(adminId.trim(), telegramText).catch(() => {});
      }
    }

    // 2. Si el remitente es un usuario registrado, guardar un acuse en sus notificaciones in-app
    if (caller?.id) {
      await db.insert(notifications).values({
        userId: caller.id,
        title: type === 'BUG' ? 'Recibimos tu reporte de error' : '¡Gracias por tu sugerencia!',
        message: 'Nuestro equipo de ingeniería ya está revisando tu mensaje para seguir mejorando Rabbitty.',
        type: 'SYSTEM',
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[FEEDBACK_API_ERROR]', err);
    return NextResponse.json({ error: 'Error procesando reporte' }, { status: 500 });
  }
}
