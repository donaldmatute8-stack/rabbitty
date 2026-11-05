import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { updatePosts } from "@rabbitty/database-core";

export const runtime = "nodejs";

/**
 * ── Update Log · ingesta local ──
 *
 * El contenido se escribe en local (markdown con frontmatter) y se inyecta con
 * `scripts/update-log.mjs`. Este endpoint hace el upsert por `slug`, así que
 * corregir el texto NO cambia la URL pública que ya se envió por broadcast.
 *
 * Auth: `x-update-log-secret` (o `x-bunzy-connect-secret`) contra
 * UPDATE_LOG_SECRET || BUNZY_CONNECT_SECRET. Nunca se registra ni se devuelve.
 */

function timingSafeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.UPDATE_LOG_SECRET || process.env.BUNZY_CONNECT_SECRET || "";
  const provided =
    req.headers.get("x-update-log-secret") || req.headers.get("x-bunzy-connect-secret") || "";
  return Boolean(expected) && timingSafeEqual(expected, provided);
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const CATEGORIES = new Set(["PRODUCT", "IMPROVEMENT", "FIX", "SECURITY"]);

function baseUrl(): string {
  return (process.env.UPDATE_LOG_BASE_URL || "https://app.rabbitty.me").replace(/\/+$/, "");
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const db = getCoreDb();
  const rows = await db
    .select({
      slug: updatePosts.slug,
      version: updatePosts.version,
      title: updatePosts.title,
      status: updatePosts.status,
      publishedAt: updatePosts.publishedAt,
    })
    .from(updatePosts)
    .limit(50);
  return NextResponse.json({
    ok: true,
    base: baseUrl(),
    items: rows.map((r) => ({ ...r, url: `${baseUrl()}/updates/${r.slug}` })),
  });
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const body = typeof raw.body === "string" ? raw.body.trim() : "";
  if (title.length < 3) return NextResponse.json({ error: "title requerido (mín. 3)" }, { status: 400 });
  if (body.length < 10) return NextResponse.json({ error: "body requerido (mín. 10)" }, { status: 400 });

  const version = typeof raw.version === "string" ? raw.version.trim() : null;
  const slug =
    (typeof raw.slug === "string" && raw.slug.trim() ? slugify(raw.slug) : "") ||
    slugify(version ? `${version}-${title}` : title);
  if (!slug) return NextResponse.json({ error: "No se pudo derivar el slug" }, { status: 400 });

  const summary =
    typeof raw.summary === "string" && raw.summary.trim()
      ? raw.summary.trim()
      : body.replace(/\s+/g, " ").slice(0, 180);

  const categoryRaw = typeof raw.category === "string" ? raw.category.toUpperCase() : "PRODUCT";
  const category = CATEGORIES.has(categoryRaw) ? categoryRaw : "PRODUCT";
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [];
  const status = raw.status === "DRAFT" ? "DRAFT" : "PUBLISHED";
  const publishedAt =
    typeof raw.publishedAt === "string" && !Number.isNaN(Date.parse(raw.publishedAt))
      ? new Date(raw.publishedAt)
      : new Date();

  const db = getCoreDb();
  const now = new Date();
  const values = {
    slug,
    version,
    title,
    summary,
    body,
    category,
    tags,
    coverUrl: typeof raw.coverUrl === "string" ? raw.coverUrl : null,
    status,
    publishedAt,
    createdBy: typeof raw.createdBy === "string" ? raw.createdBy : "local",
    updatedAt: now,
  };

  const [row] = await db
    .insert(updatePosts)
    .values(values)
    .onConflictDoUpdate({
      target: updatePosts.slug,
      set: {
        version: values.version,
        title: values.title,
        summary: values.summary,
        body: values.body,
        category: values.category,
        tags: values.tags,
        coverUrl: values.coverUrl,
        status: values.status,
        publishedAt: values.publishedAt,
        updatedAt: now,
      },
    })
    .returning({ id: updatePosts.id, slug: updatePosts.slug, status: updatePosts.status });

  return NextResponse.json({
    ok: true,
    id: row?.id,
    slug,
    status: row?.status,
    url: `${baseUrl()}/updates/${slug}`,
  });
}
