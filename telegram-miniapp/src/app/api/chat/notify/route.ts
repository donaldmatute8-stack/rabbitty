import { NextRequest, NextResponse } from 'next/server';
import { notifyChatRecipient, resolveTelegramRecipient } from '@/lib/chat';

export const runtime = 'nodejs';

/**
 * Server-to-server: notifica un mensaje de chat (el admin responde a un cliente).
 * Canal completo de la miniapp: in-app + APNs push + Telegram DM.
 * Auth: Bearer RABBITTY_API_SECRET.
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.RABBITTY_API_SECRET;
    if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    const body = await req.json().catch(() => ({}));
    const conversationId = String(body?.conversationId || '');
    const recipientId = String(body?.recipientUserId || '');
    const preview = String(body?.preview || '').slice(0, 140);
    const senderName = String(body?.senderName || 'El negocio');
    if (!conversationId || !recipientId) {
      return NextResponse.json({ error: 'conversationId y recipientUserId requeridos' }, { status: 400 });
    }

    const recipient = await resolveTelegramRecipient(recipientId).catch(() => null);
    await notifyChatRecipient({
      recipientUserId: recipientId,
      recipientTelegramId: recipient?.telegramId || null,
      senderName,
      preview,
      conversationId,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CHAT NOTIFY S2S ERROR]', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
