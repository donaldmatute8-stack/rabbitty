import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { and, eq, ilike } from "drizzle-orm";
import { getCoreDb } from "@rabbitty/api/db";
import { ownedBusinesses, rabbitChairRequests, users } from "@rabbitty/database-core/schema";
import { notifySupportStaff } from "@rabbitty/api/services/supportNotify";
import { sendTelegramToGod } from "@rabbitty/api/services/telegramNotify";

export const runtime = "nodejs";

/**
 * ── Solicitud de acceso a Rabbit Chair ──────────────────────────────────────
 * Pública: la usa la landing privada cuando alguien abre el enlace sin token.
 *
 * - Identifica al negocio por el correo del dueño (si existe).
 * - Guarda la solicitud en `rabbit_chair_requests` (PENDING).
 * - Avisa a God por campana in-app + push (`notifySupportStaff`) y, si está
 *   configurado, por Telegram.
 *
 * Rate limit en memoria: 3 solicitudes por IP por hora. No revela si el correo
 * pertenece a un negocio real (siempre responde igual).
 */

const hits = new Map<string, { n: number; reset: number }>();
function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { n: 1, reset: now + 60 * 60_000 });
    return true;
  }
  entry.n += 1;
  return entry.n <= 3;
}

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export async function POST(req: NextRequest) {
  const ip = (req.headers.get("x-forwarded-for") || "anon").split(",")[0].trim();
  if (!rateLimitOk(ip)) {
    return NextResponse.json({ success: false, error: "Demasiadas solicitudes. Intenta más tarde." }, { status: 429 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Solicitud inválida" }, { status: 400 });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const businessName = String(body?.businessName || "").trim().slice(0, 120);
  const name = String(body?.name || "").trim().slice(0, 120);
  const note = String(body?.note || "").trim().slice(0, 500);

  if (!isEmail(email)) {
    return NextResponse.json({ success: false, error: "Necesito un correo válido." }, { status: 400 });
  }

  const db = getCoreDb();

  // Negocio por correo del dueño (best-effort; nunca se revela al visitante).
  let businessId: string | null = null;
  let resolvedName = businessName || "";
  try {
    const [owner] = await db
      .select({ id: users.id })
      .from(users)
      .where(ilike(users.email, email))
      .limit(1);
    if (owner?.id) {
      const [owned] = await db
        .select({ id: ownedBusinesses.id, name: ownedBusinesses.name })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.ownerId, owner.id))
        .limit(1);
      if (owned?.id) {
        businessId = owned.id;
        resolvedName = owned.name || resolvedName;
      }
    }
  } catch {
    /* sin match: se guarda igual para revisión manual */
  }

  const requestId = crypto.randomUUID();
  try {
    await db.insert(rabbitChairRequests).values({
      id: requestId,
      businessId,
      businessName: resolvedName || null,
      email,
      name: name || null,
      note: note || null,
      status: "PENDING",
    });
  } catch (err) {
    console.error("[RABBIT_CHAIR_REQUEST]", err);
    return NextResponse.json({ success: false, error: "No se pudo registrar la solicitud." }, { status: 500 });
  }

  // Aviso al equipo: campana in-app + push nativo (mismo canal que soporte).
  const label = resolvedName || name || email;
  void notifySupportStaff(db, {
    title: "Rabbit Chair · nueva solicitud",
    message: `${label} pidió acceso${businessId ? "" : " (sin negocio vinculado)"} · ${email}`,
    // La app no tiene el panel de God: se abre un puente que lanza el admin.
    route: "/admin-link?to=rabbit-chair",
  }).catch(() => undefined);

  // Telegram (si GOD_TELEGRAM_CHAT_ID está configurado).
  void sendTelegramToGod(
    [
      "🐰 Rabbit Chair · solicitud de acceso",
      `Negocio: ${label}`,
      `Correo: ${email}`,
      businessId ? `Tenant: ${businessId}` : "Tenant: sin vincular",
      note ? `Nota: ${note}` : "",
      "",
      "Revisar y aprobar: https://admin.rabbitty.me/god/rabbit-chair",
    ]
      .filter(Boolean)
      .join("\n"),
  ).catch(() => undefined);

  return NextResponse.json({ success: true, requestId });
}
