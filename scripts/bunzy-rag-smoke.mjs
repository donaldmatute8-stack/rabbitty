#!/usr/bin/env node
/**
 * ── bunzy-rag-smoke.mjs ── Certificación del KB semántico de Bunzy (Fase 0 RAG).
 *
 * Qué valida end-to-end contra el deployment indicado:
 *   1. GET  /api/bunzy/kb → salud (chunks totales vs. con embedding)
 *   2. POST seed-support → ingesta idempotente
 *   3. Certificación semántica: la ruta AUTO-verifica que la consulta canónica
 *      ("¿Cómo gano Bunz?") recupere su FAQ correcta (score ≥ 0.25) usando los
 *      embeddings recién creados — retorna 502 si la retrieval está rota.
 *   4. Sanity local: el total de chunks debe ser ≥ al conteo esperado
 *      (FAQS + DOC_SECTIONS de support-content.ts — contado de la fuente).
 *
 * Uso:
 *   BUNZY_KB_SECRET=sk_... node scripts/bunzy-rag-smoke.mjs [url]
 *   (url default https://app.rabbitty.me)
 * Exit codes: 0 = certificado · 1 = falló · 2 = falta OPENAI_API_KEY en el server
 */
import { readFileSync } from 'node:fs';

const url = (process.argv[2] || 'https://app.rabbitty.me').replace(/\/$/, '');
const secret = process.env.BUNZY_KB_SECRET || '';

function fail(code, msg) {
  console.error(`✗ ${msg}`);
  process.exit(code);
}
function ok(msg) {
  console.log(`✓ ${msg}`);
}

if (!secret) fail(1, 'Falta BUNZY_KB_SECRET en el entorno (no lo pegues en el código).');

// ── Conteo esperado desde la fuente (support-content.ts en el repo) ──
let expectedFaqs = 0;
let expectedDocs = 0;
try {
  const src = readFileSync(new URL('../telegram-miniapp/src/lib/support-content.ts', import.meta.url), 'utf8');
  expectedFaqs = (src.match(/^\s{4}q: '/gm) || []).length;
  const docsSection = src.slice(src.indexOf('DOC_SECTIONS'), src.indexOf('SUPPORT_QUICK_QUESTIONS'));
  expectedDocs = (docsSection.match(/title:\s*'/g) || []).length;
} catch {
  console.log('• (repo fuente no accesible — salto sanity de conteo esperado)');
}
const expectedTotal = expectedFaqs + expectedDocs;
if (expectedTotal > 0) ok(`Conteo esperado desde el fuente: ${expectedFaqs} FAQs + ${expectedDocs} Docs = ${expectedTotal}`);

// 1) stats previas
try {
  const r = await fetch(`${url}/api/bunzy/kb`, { headers: { 'x-bunzy-kb-secret': secret }, cache: 'no-store' });
  const j = await r.json().catch(() => null);
  if (r.status === 401) fail(1, 'El server rechazó el secret — revisa BUNZY_KBsecret en Vercel (mismo valor).');
  if (j && typeof j.total === 'number') {
    ok(`Stats previas: ${j.total} chunks (${j.withEmbedding} con embedding${j.ready === false ? ' · listo para seed' : ''})`);
  }
} catch (e) {
  fail(1, `No se pudo contactar ${url}: ${e.message}`);
}

// 2 + 3) seed + certificación semántica integrada
let res;
try {
  res = await fetch(`${url}/api/bunzy/kb`, {
    method: 'POST',
    headers: { 'x-bunzy-kb-secret': secret, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'seed-support' }),
  });
} catch (e) {
  fail(1, `POST falló: ${e.message}`);
}
const data = await res.json().catch(() => null);

if (res.status === 503) {
  fail(2, 'Sin proveedor de embeddings en el server — verifica OLLAMA_API_URL (+ OLLAMA_EMBED_MODEL, ej. nomic-embed-text) u OPENAI_API_KEY en Vercel y re-corre este smoke.');
}
if (res.status === 401) fail(1, 'Auth rechazada en el POST — secret inconsistentes entre proyecto Vercel y tu shell.');
if (!data) fail(1, `Respuesta no-JSON (HTTP ${res.status})`);
if (!data.ok) fail(1, `Seed/semantic FAILED: ${data.error || JSON.stringify(data).slice(0, 240)}`);

ok(`Seed idempotente: ${data.seeded} chunks nuevos · total ${data.total} (${data.withEmbedding} con embedding)`);
if (data.top) {
  ok(`Top-1 semántico: ${data.top.sourceId} · score ${data.top.score}`);
} else {
  fail(1, 'La certificación semántica no devolvió top hit.');
}

// 4) sanity de conteo esperado vs. total
if (expectedTotal > 0 && data.total < expectedTotal) {
  fail(1, `total (${data.total}) < esperado (${expectedTotal}) — la ingesta no cubrió todo el contenido.`);
} else if (expectedTotal > 0) {
  ok(`Contenido completo sembrado (${data.total} ≥ ${expectedTotal} esperados).`);
}

console.log(`
✅ CERTIFICADO: Bunzy RAG Fase 0 — KB semántico funcional end-to-end
   · auth por secret ✓ · ingesta idempotente ✓ · embeddings sincrónicos ✓ ·
   · retrieval semántico con fuente correcta ✓
   Verificación en la app de usuario: el chat de Bunzy debe contestar preguntas
   de producto/políticas citando (Fuente: FAQ faq:XX)`);
process.exit(0);
