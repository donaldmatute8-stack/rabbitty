import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { conversations, messages } from '@/db/schema';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds } from '@/lib/chat';
import { notifySupportStaff } from '@rabbitty/api/services/supportNotify';

export const runtime = 'nodejs';

/**
 * ── Reporte de chat (App Store 1.2 · UGC) ──────────────────────────────────
 *
 * El botón "Reportar" antes solo abría el chat de Bunzy con un texto
 * prellenado. Ahora deja un reporte real: avisa al equipo (campana + push) con
 * quién reporta, a quién y el mensaje. El bloqueo persistente vive en
 * /api/chat/block.
 */
export async function POST(req: NextRequest) {
  const caller = await getAuthenticatedUser(req);
  if (!caller) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const conversationId = String(body?.conversationId || '');
  const messageId = body?.messageId ? String(body.messageId) : null;
  const reason = String(body?.reason || 'Contenido inapropiado').slice(0, 400);
  if (!conversationId) return NextResponse.json({ error: 'conversationId requerido' }, { status: 400 });

  const businessIds = await getOwnedBusinessIds(caller.id);
  const identities = [caller.id, ...businessIds];

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!conv || ![conv.participant1, conv.participant2].some((id) => identities.includes(id))) {
    return NextResponse.json({ error: 'Sin acceso a esta conversación' }, { status: 403 });
  }

  const reporter = identities.includes(conv.participant1) ? conv.participant1 : conv.participant2;
  const target = reporter === conv.participant1 ? conv.participant2 : conv.participant1;

  let preview = '';
  if (messageId) {
    const [msg] = await db
      .select({ content: messages.content })
      .from(messages)
      .where(eq(messages.id, messageId))
      .limit(1);
    preview = msg?.content?.slice(0, 300) ?? '';
  }

  try {
    await notifySupportStaff(db, {
      title: '🚩 Reporte de chat',
      message:
        `Reporta: ${caller.email || caller.id}\n` +
        `Contra: ${target}\n` +
        `Motivo: ${reason}` +
        (preview ? `\nMensaje: ${preview}` : ''),
      route: '/god/soporte',
    });
  } catch (err) {
    console.error('[CHAT_REPORT] no se pudo avisar al equipo:', err);
  }

  return NextResponse.json({ success: true });
}
