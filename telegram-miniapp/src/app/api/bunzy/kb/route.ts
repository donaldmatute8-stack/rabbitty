import { NextRequest, NextResponse } from 'next/server';
import { ingestSupportKnowledge, knowledgeStats } from '@/lib/bunzyRag';

/**
 * ── Bunzy KB (Fase 0 RAG) ── Ingesta y salud del knowledge base semántico.
 * Docs/BUNZY_ROADMAP_SUPREMO.md §2.1. Protegido por header compartido
 * (`x-bunzy-kb-secret` === BUNZY_KB_SECRET), mismo patrón que CHANNEL x-push-secret.
 *
 * POST { action: 'seed-support' } → re-ingesta de FAQS + DOC_SECTIONS con
 *   embeddings renovados SOLO de chunks cuyo contentHash cambió (idempotente).
 * GET → stats: total de chunks y con embedding (para push-check/audit).
 *
 * Debe llamarse post-deploy ONCE (curier después de cada cambio de FAQs/Docs):
 *   curl -X POST https://app.rabbitty.me/api/bunzy/kb \
 *     -H "x-bunzy-kb-secret: $BUNZY_KB_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"action":"seed-support"}'
 * Requiere OPENAI_API_KEY en el entorno (Vercel) — sin key responde 503.
 */
function authorize(req: NextRequest): boolean {
  const expected = process.env.BUNZY_KB_SECRET || '';
  const provided = req.headers.get('x-bunzy-kb-secret') || '';
  return Boolean(expected) && provided === expected;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const stats = await knowledgeStats();
  return NextResponse.json({
    ok: true,
    embedModel: 'text-embedding-3-small',
    ...stats,
    ready: stats.withEmbedding > 0,
  });
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.action !== 'seed-support') {
      return NextResponse.json({ error: 'action inválida — solo seed-support en Fase 0' }, { status: 400 });
    }
    const result = await ingestSupportKnowledge();
    if (result.skipped) {
      return NextResponse.json(
        { ok: false, error: 'OPENAI_API_KEY no configurada en este entorno — seed omitido' },
        { status: 503 }
      );
    }
    const stats = await knowledgeStats();
    return NextResponse.json({ ok: true, seeded: result.seeded, ...stats });
  } catch (err) {
    console.error('[BunzyKB] ingesta falló:', err);
    return NextResponse.json({ error: 'Error interno de ingesta' }, { status: 500 });
  }
}
