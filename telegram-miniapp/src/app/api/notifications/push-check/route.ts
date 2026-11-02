import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isApnsConfigured } from "@/lib/push/apns";
import { db } from "@/db";
import { pushDevices, notificationsOutbox, notificationDeliveries } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/**
 * ── Diagnóstico de push (Fase reparación) v2 ──
 * AUTH: sesión del usuario (getAuthHeaders de la app) O sesión S2S — ANTES
 * exigía RABBITTY_API_SECRET y si Vercel tenía un valor distinto al local
 * devolvía 401 sin explicación. Ahora:
 *  - usuario con sesión válida funciona directo (botón "Diagnóstico de push")
 *  - si viene S2S y no coincide, respondemos HUELLA (sha256·8) del esperado y
 *    del provisto — comparable sin exponer el valor.
 * Responde: apnsConfigured, envs APNs faltantes, dispositivos iOS activos.
 */
const fingerprint = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 8);

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req).catch(() => null);
    const providedSecret = req.headers.get("authorization")?.replace(/^Bearer /, "").trim() || "";

    if (!caller) {
      // Sin sesión: solo revelamos huellas de comparación (nada del valor)
      const expected = process.env.RABBITTY_API_SECRET;
      return NextResponse.json({
        success: true,
        auth: "no-session",
        s2sEnabled: Boolean(expected),
        expectedFingerprint: expected ? fingerprint(expected) : null,
        providedFingerprint: providedSecret ? fingerprint(providedSecret) : null,
        hint: "Si expectedFingerprint ≠ providedFingerprint, tu valor local de RABBITTY_API_SECRET difiere del de Vercel — cópialo desde Vercel (Settings → Environment variables).",
        diagnosticNeeds: "abre el Diagnóstico de push dentro de la app (sesión) para ver dispositivos y APNs.",
      });
    }

    const missing: string[] = [];
    if (!process.env.APNS_KEY_ID?.trim()) missing.push("APNS_KEY_ID");
    if (!process.env.APNS_TEAM_ID?.trim()) missing.push("APNS_TEAM_ID");
    if (!process.env.APNS_BUNDLE_ID?.trim()) missing.push("APNS_BUNDLE_ID");
    if (!process.env.APNS_PRIVATE_KEY) missing.push("APNS_PRIVATE_KEY");

    const devices = await db
      .select({
        platform: pushDevices.platform,
        isActive: pushDevices.isActive,
        token: pushDevices.token,
        userId: pushDevices.userId,
        updatedAt: pushDevices.updatedAt,
      })
      .from(pushDevices)
      .orderBy(desc(pushDevices.updatedAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      callerId: "id" in caller ? (caller as { id: string }).id : null,
      apnsConfigured: isApnsConfigured(),
      missingEnvs: missing,
      apnsEnv: process.env.APNS_ENV || "production",
      devices: devices.map((d: { token: string }) => ({ ...d, token: String(d.token).slice(-12) })),
      // Telemetría de entregas (P5): últimas filas de notificationDeliveries
      deliveries: await db
        .select({ channel: notificationDeliveries.channel, status: notificationDeliveries.status, reason: notificationDeliveries.reason, createdAt: notificationDeliveries.createdAt })
        .from(notificationDeliveries)
        .orderBy(desc(notificationDeliveries.createdAt))
        .limit(8),
      // Cola viva: últimos eventos en outbox (visibilidad de la plataforma P0)
      outbox: await db
        .select({ id: notificationsOutbox.id, type: notificationsOutbox.type, status: notificationsOutbox.status, attempts: notificationsOutbox.attempts })
        .from(notificationsOutbox)
        .limit(6),
    });
  } catch (err: unknown) {
    console.error("[PUSH_CHECK]", err);
    return NextResponse.json({ error: "No se pudo verificar el sistema de push" }, { status: 500 });
  }
}
