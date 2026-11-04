import { NextRequest, NextResponse } from 'next/server';
import { processChatOutboxBatch, chatOutboxStats } from '@/lib/realtime/chatOutbox';

export const runtime = 'nodejs';

/**
 * ── Chat Outbox Worker (Fase 4) ──
 * Drena `chat_event_outbox` hacia Centrifugo.
 *   - Piggyback tras cada envío (baja latencia).
 *   - Este cron como piso (reintentos con backoff exponencial).
 * Auth: Bearer CRON_SECRET (schedule) o RABBITTY_API_SECRET (S2S).
 * GET devuelve stats para diagnóstico.
 */
function authorize(req: NextRequest): boolean {
  const auth = (req.headers.get('authorization') || '').replace(/^Bearer /, '').trim();
  const cron = process.env.CRON_SECRET;
  const s2s = process.env.RABBITTY_API_SECRET;
  return Boolean(auth && ((cron && auth === cron) || (s2s && auth === s2s)));
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  try {
    const stats = await chatOutboxStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('[CHAT OUTBOX STATS]', error);
    return NextResponse.json({ success: false, error: 'No se pudieron leer las stats' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }
  try {
    const summary = await processChatOutboxBatch(50);
    return NextResponse.json({ success: true, ...summary });
  } catch (error) {
    console.error('[CHAT OUTBOX WORKER]', error);
    return NextResponse.json({ success: false, error: 'Worker falló' }, { status: 500 });
  }
}
