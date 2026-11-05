// server-only: imported desde el chat de Bunzy y la ruta de ingesta (no client)

/**
 * ── bunzyRag ── Bunzy Supreme Fase 0: RAG semántico sobre `knowledgeChunks`.
 * Docs/BUNZY_ROADMAP_SUPREMO.md §2.1 + §11 (Bunzy × Rabbitty Score).
 *
 * Reglas:
 * - Degradación graceful: sin OPENAI_API_KEY o mejor grasa la tabla vacía →
 *   searchKnowledge devuelve [] y el chat de Bunzy sigue sin cambiar (jamás rompe).
 * - El seed institucional vive en `support-content.ts` (FAQS + DOC_SECTIONS) —
 *   la fuente que ya responde a Rabbitters y Merchants hoy.
 * - Upsert idempotente por (sourceType, sourceId): re-seed solo renueva
 *   embeddings cuando cambió el contentHash.
 */

import crypto from "crypto";
import { db } from "@/db";
import { knowledgeChunks } from "@/db/schema";
import { sql } from "drizzle-orm";
import { FAQS, DOC_SECTIONS } from "@/lib/support-content";

const EMBED_MODEL = "text-embedding-3-small";
/** Distancia coseno máxima para considerar un chunk relevante (0=idéntico). */
const MAX_COSINE_DISTANCE = 0.75;

export interface KbHit {
  sourceType: string;
  sourceId: string;
  content: string;
  /** Similitud coseno 0–1 (1 = idéntico). */
  score: number;
}

function openAiKey(): string | null {
  const key = process.env.OPENAI_API_KEY;
  return key && key !== "dummy_key_for_build" ? key : null;
}

/**
 * ── Embeddings provider-agnostic (el stack de Rabbitty es Ollama, no OpenAI) ──
 * 1) OLLAMA_API_URL (+OLLAMA_API_KEY, OLLAMA_EMBED_MODEL || OLLAMA_MODEL):
 *    native /api/embed → fallback OpenAI-compat /v1/embeddings en el mismo host.
 * 2) OPENAI_API_KEY como respaldo.
 *
 * pgvector column es vector(1536). Si el modelo de embeddings da menos dims,
 * se PADDEA con ceros — la similitud coseno se PRESERVA exacta (los ceros no
 * aportan al dot ni a la norma; query == docs = misma deducción). Si da MÁS de
 * 1536, error explícito (la columna requeriría migración de dimensión).
 */
function ollamaEmbedBase(): string | null {
  // Endpoint dedicado para embeddings; si no existe, usa el de chat.
  const raw = process.env.OLLAMA_EMBED_URL || process.env.OLLAMA_API_URL;
  if (!raw) return null;
  for (const suffix of ["/api/chat", "/v1/chat/completions", "/chat/completions", "/chat", "/v1/messages"]) {
    if (raw.endsWith(suffix)) return raw.slice(0, -suffix.length);
  }
  return raw.replace(/\/$/, "");
}

async function padTo1536(v: number[]): Promise<number[]> {
  const dim = v.length;
  if (dim === 1536) return v;
  if (dim > 1536) throw new Error(`embedding dim ${dim} > 1536 (columna pgvector) — migración de dimensión requerida`);
  return [...v, ...new Array(1536 - dim).fill(0)];
}

async function embedWithOllama(texts: string[]): Promise<number[][] | null> {
  const base = ollamaEmbedBase();
  if (!base) return null;
  const key = process.env.OLLAMA_API_KEY || "";
  const model = process.env.OLLAMA_EMBED_MODEL || process.env.OLLAMA_MODEL || "nomic-embed-text";
  const textsSafe = texts.map((t) => (t || " "));

  // Native endpoint primero
  try {
    lastEmbedError.attempts.push('embed-request');
    lastEmbedError.detail = 'ollama://api/embed intentando';
    const res = await fetch(`${base}/api/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ model, input: textsSafe }),
    });
    if (res.ok) {
      const data = (await res.json()) as { embeddings?: number[][]; error?: string };
      if (Array.isArray(data.embeddings) && data.embeddings.length === textsSafe.length) {
        lastEmbedError.detail = 'ok /api/embed';
        return await Promise.all(data.embeddings.map((v) => padTo1536(v)));
      }
      lastEmbedError.attempts.push(`/api/embed sin embeddings: ${JSON.stringify(data).slice(0, 180)}`);
      lastEmbedError.detail = `/api/embed sin embeddings: ${JSON.stringify(data).slice(0, 180)}`;
    } else {
      const body = await res.text().catch(() => '');
      lastEmbedError.attempts.push(`/api/embed HTTP ${res.status}: ${body.slice(0, 180)}`);
      lastEmbedError.detail = `/api/embed HTTP ${res.status}: ${body.slice(0, 180)}`;
    }
  } catch (err) {
    lastEmbedError.attempts.push(`/api/embed falló: ${err instanceof Error ? err.message : 'unknown'}`);
  }

  // fallback OpenAI-compat en el mismo host
  try {
    const base2 = ollamaEmbedBase() ?? '';
    const key2 = process.env.OLLAMA_API_KEY || '';
    const model2 = process.env.OLLAMA_EMBED_MODEL || process.env.OLLAMA_MODEL || 'nomic-embed-text';
    const res2 = await fetch(`${base2}/v1/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(key2 ? { Authorization: `Bearer ${key2}` } : {}) },
      body: JSON.stringify({ model: model2, input: texts }),
    });
    if (res2.ok) {
      const data2 = (await res2.json()) as { data?: Array<{ index: number; embedding: number[] }> };
      if (Array.isArray(data2.data)) {
        const out = new Array<number[]>(texts.length);
        for (const d of data2.data) out[d.index] = await padTo1536(d.embedding);
        if (out.every(Boolean)) {
          lastEmbedError.detail = 'ok /v1/embeddings';
          return out;
        }
      }
      lastEmbedError.detail = '/v1/embeddings sin embeddings válidos';
    } else {
      const body = await res2.text().catch(() => '');
      lastEmbedError.detail = `/v1/embeddings HTTP ${res2.status}: ${body.slice(0, 200)}`;
    }
  } catch (err) {
    lastEmbedError.detail = `/v1/embeddings falló: ${err instanceof Error ? err.message : 'unknown'}`;
  }
  void 0;

  // Fallback OpenAI-compat en el mismo host
  try {
    const res = await fetch(`${base}/v1/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(key ? { Authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ model, input: textsSafe }),
    });
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ index: number; embedding: number[] }> };
      if (Array.isArray(data.data)) {
        const out = new Array<number[]>(textsSafe.length);
        for (const d of data.data) out[d.index] = await padTo1536(d.embedding);
        if (out.every(Boolean)) return out;
      }
      console.warn("[BunzyRAG] ollama /v1/embeddings sin embeddings válidos");
    }
  } catch (err) {
    console.warn("[BunzyRAG] ollama /v1/embeddings falló:", err instanceof Error ? err.message : err);
  }
  return null;
}

/** Embeddings: OLLAMA (stack Rabbitty) primero, OpenAI como respaldo. null = sin provider. */
export const lastEmbedError = { detail: 'sin intento', attempts: [] as string[] };

/** Embeddings: OLLAMA (stack Rabbitty) primero, OpenAI como respaldo. null = sin provider. */
async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const viaOllama = await embedWithOllama(texts);
  if (viaOllama) return viaOllama;
  const key = openAiKey();
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: EMBED_MODEL, input: texts }),
    });
    if (!res.ok) {
      console.warn("[BunzyRAG] embeddings falló:", res.status);
      return null;
    }
    const data = (await res.json()) as { data?: Array<{ index: number; embedding: number[] }> };
    if (!data.data) return null;
    const out = new Array<number[]>(texts.length);
    for (const d of data.data) out[d.index] = d.embedding;
    return out.every(Boolean) ? out : null;
  } catch (err) {
    console.warn("[BunzyRAG] embeddings falló:", err instanceof Error ? err.message : err);
    return null;
  }
}

function sourceHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}

interface SeedItem {
  sourceType: "FAQ" | "DOC";
  sourceId: string;
  content: string;
}

/** Un chunk por FAQ (pregunta+respuesta — la unidad natural) y por sección de docs. */
export function buildSupportSeed(): SeedItem[] {
  const items: SeedItem[] = [];
  FAQS.forEach((f, i) => {
    items.push({
      sourceType: "FAQ",
      sourceId: `faq:${String(i).padStart(2, "0")}`,
      content: `${f.q}\n${f.a}`,
    });
  });
  DOC_SECTIONS.forEach((d, i) => {
    items.push({
      sourceType: "DOC",
      sourceId: `doc:${String(i).padStart(2, "0")}`,
      content: `${d.title}. ${d.body}`,
    });
  });
  return items;
}

/**
 * Ingesta idempotente del contenido institucional (FAQS + DOC_SECTIONS).
 * Renueva el embedding solo si cambió el contentHash (ahorra $ en re-seeds).
 */
export async function ingestSupportKnowledge(): Promise<{ seeded: number; skipped: boolean }> {
  const seed = buildSupportSeed();
  const embeddings = await embedTexts(seed.map((s) => s.content));
  if (!embeddings) {
    console.warn("[BunzyRAG] sin OPENAI_API_KEY — seed omitido (el chat degrada al FAQ matcher local)");
    return { seeded: 0, skipped: true };
  }

  const existing = await db
    .select({
      sourceType: knowledgeChunks.sourceType,
      sourceId: knowledgeChunks.sourceId,
      contentHash: knowledgeChunks.contentHash,
    })
    .from(knowledgeChunks);
  const hashByKey = new Map(existing.map((r) => [`${r.sourceType}:${r.sourceId}`, r.contentHash]));

  let seeded = 0;
  for (let i = 0; i < seed.length; i += 1) {
    const item = seed[i];
    const hash = sourceHash(item.content);
    if (hashByKey.get(`${item.sourceType}:${item.sourceId}`) === hash) continue; // sin cambios
    await db
      .insert(knowledgeChunks)
      .values({
        scope: "GLOBAL",
        businessId: null,
        sourceType: item.sourceType,
        sourceId: item.sourceId,
        content: item.content,
        contentHash: hash,
        embedding: embeddings[i],
        embeddingModel: EMBED_MODEL,
      })
      .onConflictDoUpdate({
        target: [knowledgeChunks.sourceType, knowledgeChunks.sourceId],
        set: { content: item.content, contentHash: hash, embedding: embeddings[i], embeddingModel: EMBED_MODEL },
      });
    seeded += 1;
  }
  return { seeded, skipped: false };
}

/**
 * Búsqueda semántica (cosine) en knowledgeChunks. JAMÁS lanza: si falla
 * o no hay embeddings, devuelve [] y el chat sigue con su fallback local.
 */
export async function searchKnowledge(query: string, opts: { limit?: number } = {}): Promise<KbHit[]> {
  if (!query.trim()) return [];
  const [emb] = (await embedTexts([query.trim()])) ?? [];
  if (!emb) return [];
  const limit = Math.min(8, opts.limit ?? 3);
  try {
    const vectorLiteral = `[${emb.join(",")}]`;
    const res: any = await db.execute(sql`
      SELECT "sourceType", "sourceId", content,
             (embedding <=> ${vectorLiteral}::vector) AS dist
      FROM "knowledgeChunks"
      WHERE embedding IS NOT NULL
        AND (embedding <=> ${vectorLiteral}::vector) < ${MAX_COSINE_DISTANCE}
      ORDER BY dist ASC
      LIMIT ${limit}`);
    const rows = ((res?.rows ?? res) as Array<{ sourceType: string; sourceId: string; content: string; dist: string }>) ?? [];
    return rows.map((r) => ({
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      content: r.content,
      score: Math.round((1 - Number(r.dist)) * 1000) / 1000,
    }));
  } catch (err) {
    console.warn("[BunzyRAG] search falló (degrada sin RAG):", err instanceof Error ? err.message : err);
    return [];
  }
}

/** Barra de salud del KB (para la ruta de ingesta / push-check). */
export async function knowledgeStats(): Promise<{ total: number; withEmbedding: number }> {
  try {
    const res: any = await db.execute(sql`
      SELECT COUNT(*)::int AS total, COUNT(embedding)::int AS with_embedding FROM "knowledgeChunks"`);
    const row = ((res?.rows ?? res) as Array<{ total: number; with_embedding: number }>)[0];
    if (!row) return { total: 0, withEmbedding: 0 };
    return { total: Number(row.total), withEmbedding: Number(row.with_embedding) };
  } catch {
    return { total: 0, withEmbedding: 0 };
  }
}
