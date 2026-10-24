import { NextResponse } from 'next/server';
import { db } from '@/db';
import { messages, conversations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { getOwnedBusinessIds, resolveConversationAccess, resolveTelegramRecipient } from '@/lib/chat';
import { generateBunzyAssist } from '@/lib/bunzy';
import { checkRateLimit } from '@/lib/rateLimit';

const RATE_LIMIT_WINDOW_SECONDS = 60;
const MAX_REQUESTS_PER_WINDOW = 10;

export async function POST(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Rate limiting compartido entre instancias (Redis si REDIS_URL existe; memoria si no)
    const limit = await checkRateLimit(
      `bunzy-assist:${caller.id}`,
      MAX_REQUESTS_PER_WINDOW,
      RATE_LIMIT_WINDOW_SECONDS,
    );
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'Límite de solicitudes alcanzado. Espera un momento antes de invocar a Bunzy de nuevo.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
      );
    }

    const body = (await req.json()) as {
      conversationId?: string;
      mode?: 'draft' | 'summarize' | 'admin_qa' | 'marketing_proposal';
      intent?: string;
    };

    if (!body.conversationId) {
      return NextResponse.json({ error: 'Falta conversationId' }, { status: 400 });
    }

    const conversation = await db.query.conversations.findFirst({
      where: eq(conversations.id, body.conversationId),
    });
    if (!conversation) {
      return NextResponse.json({ error: 'Conversación no encontrada' }, { status: 404 });
    }

    const businessIds = await getOwnedBusinessIds(caller.id);
    const access = resolveConversationAccess(conversation, caller.id, businessIds);
    if (!access) {
      return NextResponse.json({ error: 'Sin acceso a esta conversación' }, { status: 403 });
    }

    const rows = await db.query.messages
      .findMany({
        where: eq(messages.conversationId, conversation.id),
        orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        limit: 20,
      })
      .catch(() => []);

    const other = await resolveTelegramRecipient(access.otherParticipantId).catch(() => null);

    // Roles reales en la app: 'USER' (Rabbitter) y 'AFFILIATE' (negocio).
    const isMerchantOrAdmin =
      businessIds.length > 0 ||
      caller.role === 'AFFILIATE' ||
      access.isBusinessInbox;

    // Si un usuario ordinario intenta invocar modos de negocio (admin_qa o marketing_proposal), degradar limpiamente a draft
    let effectiveMode: 'draft' | 'summarize' | 'admin_qa' | 'marketing_proposal' = body.mode || 'draft';
    if ((body.mode === 'admin_qa' || body.mode === 'marketing_proposal') && !isMerchantOrAdmin) {
      effectiveMode = 'draft';
    }

    // Telemetría ligera de auditoría
    if (body.mode === 'admin_qa' || body.mode === 'marketing_proposal') {
      console.log(`[BunzyAssist Audit] ${body.mode} query by user=${caller.id} isMerchant=${isMerchantOrAdmin} intent="${body.intent || ''}"`);
    }

    const text = await generateBunzyAssist({
      mode: effectiveMode,
      intent: body.intent,
      otherName: other?.displayName,
      messages: rows
        .filter((m) => m.type !== 'AUTO_REPLY')
        .map((m) => ({ fromMe: m.senderId === access.myParticipantId, content: m.content })),
    });

    return NextResponse.json({ success: true, text });
  } catch (error) {
    console.error('Bunzy assist error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
