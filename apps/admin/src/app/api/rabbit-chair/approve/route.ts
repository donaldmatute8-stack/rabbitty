import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@rabbitty/auth";
import { getCoreDb, getRestaurantDb } from "@rabbitty/api/db";
import { ownedBusinesses, rabbitChairRequests, users } from "@rabbitty/database-core/schema";
import { isGodAdminIdentity } from "@rabbitty/api/services/god2fa";
import { sendOwnerEmail, sendOwnerPush } from "@rabbitty/api/services/ownerNotify";
import { sendTelegramToChat } from "@rabbitty/api/services/telegramNotify";
import { signRabbitChairInvite } from "@/lib/rabbit-chair-token";
import { createGrant } from "@rabbitty/api/services/rabbitChair";

export const runtime = "nodejs";

/**
 * ── Aprobar una solicitud de Rabbit Chair (solo God) ────────────────────────
 *
 * Genera el token firmado, lo guarda en la solicitud y avisa al tenant por
 * push, correo y (si tiene Telegram) mensaje directo con su enlace.
 */

const ADMIN_URL = process.env.ORIGIN || "https://admin.rabbitty.me";

export async function POST(req: NextRequest) {
  const session = await auth();
  const email = (session?.user?.email || "").trim().toLowerCase();
  const name = session?.user?.name || "";

  if (!isGodAdminIdentity(email, name)) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Solicitud inválida" }, { status: 400 });
  }

  const requestId = String(body?.requestId || "").trim();
  const type = body?.type === "upgrade" ? "upgrade" : "gift";
  const milestone = String(body?.milestone || "").trim().slice(0, 80) || "3 activaciones de prueba";
  const days = Math.min(365, Math.max(1, Number(body?.days) || 30));

  if (!requestId) {
    return NextResponse.json({ success: false, error: "Falta la solicitud" }, { status: 400 });
  }

  const db = getCoreDb();
  const [request] = await db
    .select()
    .from(rabbitChairRequests)
    .where(eq(rabbitChairRequests.id, requestId))
    .limit(1);

  if (!request) {
    return NextResponse.json({ success: false, error: "Solicitud no encontrada" }, { status: 404 });
  }

  const displayName = request.businessName || request.name || request.email;
  const token = signRabbitChairInvite({
    b: request.businessId || "sin-vincular",
    n: displayName,
    t: type,
    m: milestone,
    exp: Math.floor(Date.now() / 1000) + days * 86400,
  });
  const url = `${ADMIN_URL}/rabbit-chair?t=${encodeURIComponent(token)}`;

  await db
    .update(rabbitChairRequests)
    .set({ status: "APPROVED", token, resolvedAt: new Date(), resolvedBy: email })
    .where(eq(rabbitChairRequests.id, requestId));

  // El regalo por hito son 3 activaciones. Se crean en la misma base que las
  // activaciones para que consumirlas sea transaccional. Si el negocio aún no
  // está vinculado (businessId null), God puede otorgarlas después.
  if (request.businessId) {
    try {
      await createGrant(getRestaurantDb(), {
        businessId: request.businessId,
        credits: 3,
        days: 90,
        requestId: request.id,
        createdBy: email,
      });
    } catch (error) {
      console.error("[RABBIT_CHAIR_GRANT]", error);
    }
  }

  // ── Avisar al tenant ──
  let owner: { id: string; email: string | null; telegramId: string | null } | undefined;
  try {
    if (request.businessId) {
      const [owned] = await db
        .select({ ownerId: ownedBusinesses.ownerId })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, request.businessId))
        .limit(1);
      if (owned?.ownerId) {
        const [user] = await db
          .select({ id: users.id, email: users.email, telegramId: users.telegramId })
          .from(users)
          .where(eq(users.id, owned.ownerId))
          .limit(1);
        owner = user;
      }
    }
    if (!owner) {
      const [user] = await db
        .select({ id: users.id, email: users.email, telegramId: users.telegramId })
        .from(users)
        .where(eq(users.email, request.email))
        .limit(1);
      owner = user;
    }
  } catch {
    /* sin dueño identificado: queda el enlace en la solicitud */
  }

  if (owner?.id) {
    void sendOwnerPush(
      owner.id,
      "Rabbit Chair · tu acceso está listo",
      `Abre tu enlace privado y agenda ${milestone}.`,
      "/",
    ).catch(() => undefined);
  }

  if (request.email) {
    void sendOwnerEmail(
      request.email,
      "Rabbit Chair · tu acceso privado",
      `<div style="font-family:system-ui,sans-serif;line-height:1.6">
        <p>Hola${request.name ? ` ${request.name}` : ""},</p>
        <p>Tu acceso a <strong>Rabbit Chair</strong> está listo. Es un enlace privado y personal.</p>
        <p style="margin:24px 0">
          <a href="${url}" style="background:#dc2626;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-weight:700">
            Abrir mi Rabbit Chair
          </a>
        </p>
        <p style="color:#666;font-size:12px">Vale ${days} días · ${milestone} · no lo compartas.</p>
      </div>`,
    ).catch(() => undefined);
  }

  if (owner?.telegramId && /^\d+$/.test(owner.telegramId)) {
    void sendTelegramToChat(
      owner.telegramId,
      `🐰 Rabbit Chair · tu acceso está listo\n\n${milestone}\n${url}\n\nEnlace privado, no lo compartas.`,
    ).catch(() => undefined);
  }

  return NextResponse.json({ success: true, url, expiresInDays: days });
}
