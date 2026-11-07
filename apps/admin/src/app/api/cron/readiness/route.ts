import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getCoreDb, getRestaurantDb } from "@rabbitty/api/db";
import { computeAffiliateReadiness } from "@rabbitty/api/services/affiliateReadiness";
import {
  readinessEmailHtml,
  sendOwnerEmail,
  sendOwnerPush,
} from "@rabbitty/api/services/ownerNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ── /api/cron/readiness ── Avisos de preparación para salir a la app.
 *
 * Push + email al afiliado con lo que le falta para aparecer en Rabbitty.
 * No activa capacidad ni cambia saldos. Semanal; no repite si ya avisó en 7 días.
 *
 * Autorización: CRON_SECRET.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    (req.headers.get("x-cron-secret") || "") ||
    new URL(req.url).searchParams.get("secret") ||
    "";
  return provided === expected;
}

async function run(dryRun = false) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 401 });
  }

  const coreDb = getCoreDb();
  const restaurantDb = getRestaurantDb();
  const { ownedBusinesses, auditEntries } = await import("@rabbitty/database-core/schema");

  const businesses = await coreDb
    .select({
      id: ownedBusinesses.id,
      ownerId: ownedBusinesses.ownerId,
      name: ownedBusinesses.name,
      category: ownedBusinesses.category,
      address: ownedBusinesses.address,
      description: ownedBusinesses.description,
      logoUrl: ownedBusinesses.logoUrl,
      activeDays: ownedBusinesses.activeDays,
      startTime: ownedBusinesses.startTime,
      endTime: ownedBusinesses.endTime,
      verificationData: ownedBusinesses.verificationData,
      sandbox: ownedBusinesses.sandbox,
      status: ownedBusinesses.status,
    })
    .from(ownedBusinesses)
    .where(inArray(ownedBusinesses.status, ["APPROVED", "VERIFIED"]));

  const adminUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_APP_URL || "https://admin.rabbitty.me";
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  let ready = 0;
  let notified = 0;
  let skipped = 0;
  const preview: Array<{ business: string; ready: boolean; missing: string[]; email: string | null }> = [];

  for (const business of businesses) {
    if (business.sandbox) {
      skipped++;
      continue;
    }

    const readiness = await computeAffiliateReadiness(coreDb, restaurantDb, business);
    if (readiness.ready) ready++;
    if (dryRun) {
      preview.push({
        business: business.name,
        ready: readiness.ready,
        missing: readiness.missing,
        email: readiness.ownerEmail,
      });
      continue;
    }

    // Anti-spam: último aviso de readiness.
    const [last] = await coreDb
      .select({ createdAt: auditEntries.createdAt, details: auditEntries.details })
      .from(auditEntries)
      .where(
        and(
          eq(auditEntries.resourceId, business.id),
          eq(auditEntries.action, "AFFILIATE_READINESS_NOTIFIED")
        )
      )
      .orderBy(desc(auditEntries.createdAt))
      .limit(1);

    if (last?.createdAt && new Date(last.createdAt) > weekAgo) {
      skipped++;
      continue;
    }

    let lastReady = false;
    try {
      lastReady = Boolean(JSON.parse(last?.details || "{}")?.ready);
    } catch {
      lastReady = false;
    }
    if (readiness.ready && lastReady) {
      skipped++;
      continue;
    }

    const title = readiness.ready
      ? "🎉 Tu negocio está listo para aparecer en Rabbitty"
      : "Completa estos pasos para aparecer en Rabbitty";
    const body = readiness.ready
      ? `${business.name} ya cumple los pasos mínimos para recibir Rabbitters en la app.`
      : `A ${business.name} le falta: ${readiness.missing.slice(0, 3).join(", ")}${readiness.missing.length > 3 ? "…" : ""}`;

    const [pushOk, emailOk] = await Promise.all([
      readiness.ownerId ? sendOwnerPush(readiness.ownerId, title, body, "/settings") : Promise.resolve(false),
      readiness.ownerEmail
        ? sendOwnerEmail(
            readiness.ownerEmail,
            readiness.ready
              ? `${business.name} está listo para aparecer en Rabbitty`
              : `Completa estos pasos para aparecer en Rabbitty`,
            readinessEmailHtml({
              businessName: business.name,
              missing: readiness.missing,
              ready: readiness.ready,
              adminUrl,
            })
          )
        : Promise.resolve(false),
    ]);

    if (!pushOk && !emailOk) {
      skipped++;
      continue;
    }

    await coreDb.insert(auditEntries).values({
      userId: business.ownerId,
      action: "AFFILIATE_READINESS_NOTIFIED",
      resource: "ownedBusinesses",
      resourceId: business.id,
      details: JSON.stringify({
        ready: readiness.ready,
        missing: readiness.missing,
        channels: { push: pushOk, email: emailOk },
      }),
    });

    notified++;
  }

  return NextResponse.json({
    ok: true,
    date: new Date().toISOString().slice(0, 10),
    dryRun,
    total: businesses.length,
    ready,
    notified,
    skipped,
    ...(dryRun ? { preview } : {}),
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run(new URL(req.url).searchParams.get("dryRun") === "1");
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run(new URL(req.url).searchParams.get("dryRun") === "1");
}
