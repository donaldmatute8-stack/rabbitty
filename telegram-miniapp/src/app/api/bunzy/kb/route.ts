import { NextRequest, NextResponse } from 'next/server';
import { ingestSupportKnowledge, knowledgeStats, searchKnowledge, lastEmbedError } from '@/lib/bunzyRag';

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
      return NextResponse.json({
        ok: false,
        error: 'Sin proveedor de embeddings — configura OLLAMA_EMBED_URL (u OLLAMA_API_URL) + OLLAMA_EMBED_MODEL, o OPENAI_API_KEY en este entorno',
        envStatus: {
          ollamaHost: (() => {
            try { return new URL(String(process.env.OLLAMA_EMBED_URL || process.env.OLLAMA_API_URL)).host; } catch { return 'URL-INVÁLIDA'; }
          })(),
          embedModel: process.env.OLLAMA_EMBED_MODEL || process.env.OLLAMA_MODEL || '(sin OLLAMA_EMBED_MODEL)',
          OLLAMA_EMBED_URL: Boolean(process.env.OLLAMA_EMBED_URL),
          OLLAMA_API_URL: Boolean(process.env.OLLAMA_API_URL),
          OLLAMA_API_KEY: Boolean(process.env.OLLAMA_API_KEY),
          OLLAMA_MODEL: Boolean(process.env.OLLAMA_MODEL),
          OLLAMA_EMBED_MODEL: Boolean(process.env.OLLAMA_EMBED_MODEL || process.env.OLLAMA_MODEL),
          embedDebug: lastEmbedError.detail,
          embedAttempts: lastEmbedError.attempts,
          OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
        },
      }, { status: 503 });
    }
    const stats = await knowledgeStats();

    // ── Certificación semántica integrada (smoke test) — no fiamos de que
    // "algo entró": exige que la consulta canónica recupere la FAQ correcta.
    // El seedOrFail arroja error si la retrieval no funciona.
    const semantic = await searchKnowledge('¿Cómo gano Bunz?', { limit: 3 }).catch(() => []);
    const semanticOk = semantic.some((h) => h.sourceId.startsWith('faq:') && h.score >= 0.25);

    return NextResponse.json({
      ok: semanticOk,
      seeded: result.seeded,
      ...stats,
      semanticCheck: {
        ok: semanticOk,
        top: semantic[0] ?? null,
        required: 'sourceId=faq:* · score ≥ 0.25',
      },
      error: semanticOk ? undefined : 'Seed OK pero la retrieval semántica no devolvió la FAQ esperada — revisar embeddings',
    }, { status: semanticOk ? 200 : 502 });
  } catch (err) {
    console.error('[BunzyKB] ingesta falló:', err);
    return NextResponse.json({ error: 'Error interno de ingesta' }, { status: 500 });
  }
}
