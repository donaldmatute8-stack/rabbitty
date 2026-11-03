import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { liveActivityTokens } from '@/db/schema';
import { isApnsConfigured, sendLiveActivityUpdate, type LiveActivityContentState } from '@/lib/push/apns';

export const runtime = 'nodejs';

/**
 * ── POST /api/internal/live-activity/update ── (S2S, Bearer RABBITTY_API_SECRET)
 *
 * El POS (packages/api → setOrderStage) avisa aquí cada cambio de etapa para
 * mover la tarjeta de la pantalla de bloqueo SIN depender de que la app esté
 * abierta. Best-effort: si APNs no está configurado responde ok:false y el
 * flujo del pedido continúa igual.
 */
export async function POST(req: NextRequest) {
  const serverSecret = process.env.RABBITTY_API_SECRET;
  const authHeader = req.headers.get('authorization');
  if (!serverSecret || authHeader !== `Bearer ${serverSecret}`) {
    return NextResponse.json({ success: false, error: 'No autorizado' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null) as
      | {
          orderId?: string;
          event?: 'update' | 'end';
          contentState?: Partial<LiveActivityContentState>;
          alertTitle?: string;
          alertBody?: string;
        }
      | null;

    const orderId = body?.orderId?.trim();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId requerido' }, { status: 400 });
    }
    if (!isApnsConfigured()) {
      return NextResponse.json({ success: false, reason: 'APNS_NOT_CONFIGURED' });
    }

    const tokens = await db
      .select({ token: liveActivityTokens.token })
      .from(liveActivityTokens)
      .where(eq(liveActivityTokens.orderId, orderId));

    if (tokens.length === 0) {
      return NextResponse.json({ success: true, sent: 0, reason: 'NO_ACTIVITY' });
    }

    const cs = body?.contentState ?? {};
    const contentState: LiveActivityContentState = {
      stage: String(cs.stage ?? 'RECEIVED'),
      stageLabel: String(cs.stageLabel ?? 'Pedido recibido'),
      step: Number(cs.step ?? 0),
      stepCount: Number(cs.stepCount ?? 4),
      total: Number(cs.total ?? 0),
      itemsSummary: String(cs.itemsSummary ?? ''),
    };

    const dead: string[] = [];
    let sent = 0;
    for (const row of tokens) {
      try {
        const res = await sendLiveActivityUpdate(row.token, {
          event: body?.event === 'end' ? 'end' : 'update',
          contentState,
          alertTitle: body?.alertTitle,
          alertBody: body?.alertBody,
          dismissalInSeconds: 300,
        });
        if (res.ok) sent += 1;
        else if (res.status === 410 || res.status === 404) dead.push(row.token);
      } catch (err) {
        console.warn('[LIVE ACTIVITY] envío falló:', err instanceof Error ? err.message : err);
      }
    }

    if (dead.length > 0) {
      await db.delete(liveActivityTokens).where(inArray(liveActivityTokens.token, dead));
    }

    return NextResponse.json({ success: true, sent, pruned: dead.length });
  } catch (error) {
    console.error('[LIVE ACTIVITY UPDATE]', error);
    return NextResponse.json({ success: false, error: 'No se pudo actualizar la actividad' }, { status: 500 });
  }
}
