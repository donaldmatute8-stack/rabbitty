import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import {
  BUNZY_CATEGORIES,
  getBroadcastEvidence,
  getConnectMeta,
  previewBroadcast,
  publishBroadcast,
  type BunzyAudience,
} from "@rabbitty/api/services/bunzyConnect";

export const runtime = "nodejs";

/**
 * ── Bunzy Connect · API de publicación (C0) ──
 *
 * Autenticación por secreto compartido (`x-bunzy-connect-secret`), mismo patrón
 * que /api/bunzy/kb. El secreto NUNCA se registra ni se devuelve.
 *
 * GET  ?meta=1          → entorno + host de DB + si las tablas existen
 * GET  ?broadcast=<id>  → evidencia (solo lectura)
 * POST { dryRun:true }  → preview de audiencia y tarjeta (solo lectura)
 * POST { confirm:'PUBLICAR', ... } → publica (C0: solo un negocio)
 *
 * C0 NO permite envío masivo: ALL_AFFILIATES queda bloqueado salvo
 * BUNZY_CONNECT_ALLOW_MASS=1 (no configurado por defecto).
 */

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.BUNZY_CONNECT_SECRET || "";
  const provided = req.headers.get("x-bunzy-connect-secret") || "";
  return Boolean(expected) && timingSafeEqual(expected, provided);
}

function parseAudience(raw: unknown): BunzyAudience {
  const a = (raw ?? {}) as Record<string, unknown>;
  const scope = a.scope === "ALL_AFFILIATES" ? "ALL_AFFILIATES" : "BUSINESS";
  return {
    scope,
    businessId: typeof a.businessId === "string" ? a.businessId : undefined,
    niche: typeof a.niche === "string" ? a.niche : undefined,
    package: typeof a.package === "string" ? a.package : undefined,
  };
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const db = getCoreDb();
  const url = new URL(req.url);
  const broadcastId = url.searchParams.get("broadcast");

  if (broadcastId) {
    const evidence = await getBroadcastEvidence(db, broadcastId);
    if (!evidence) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    return NextResponse.json({ ok: true, ...evidence });
  }

  const meta = await getConnectMeta(db);
  return NextResponse.json({ ok: true, ...meta });
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const dryRun = body.dryRun === true;
  const category = String(body.category || "").toUpperCase();
  if (!BUNZY_CATEGORIES.includes(category as (typeof BUNZY_CATEGORIES)[number])) {
    return NextResponse.json({ error: "Categoría inválida" }, { status: 400 });
  }

  const audience = parseAudience(body.audience);
  if (audience.scope === "ALL_AFFILIATES" && process.env.BUNZY_CONNECT_ALLOW_MASS !== "1") {
    return NextResponse.json(
      { error: "C0 no permite envío masivo. Usa audience.scope=BUSINESS con un businessId." },
      { status: 403 },
    );
  }

  const input = {
    category: category as (typeof BUNZY_CATEGORIES)[number],
    title: String(body.title || ""),
    body: String(body.body || ""),
    ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel : null,
    ctaUrl: typeof body.ctaUrl === "string" ? body.ctaUrl : null,
    mediaKey: typeof body.mediaKey === "string" ? body.mediaKey : null,
    audience,
    requestKey: typeof body.requestKey === "string" ? body.requestKey : null,
    createdBy: "cli",
  };

  try {
    const db = getCoreDb();

    if (dryRun) {
      const preview = await previewBroadcast(db, input);
      return NextResponse.json({ ok: true, ...preview });
    }

    if (body.confirm !== "PUBLICAR") {
      return NextResponse.json(
        { error: "Falta confirmación explícita: confirm='PUBLICAR'" },
        { status: 400 },
      );
    }

    const result = await publishBroadcast(db, input);
    return NextResponse.json({ ok: result.status === "PUBLISHED", ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al publicar";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
