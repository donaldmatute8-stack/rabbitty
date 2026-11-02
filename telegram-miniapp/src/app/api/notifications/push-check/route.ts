import { NextRequest, NextResponse } from "next/server";
import { isApnsConfigured } from "@/lib/push/apns";
import { db } from "@/db";
import { pushDevices } from "@/db/schema";
import { desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

/**
 * ── Diagnóstico de push (Fase reparación) ──
 * Duplica la pregunta que el código hace en silencio: ¿están configurados los
 * envs de APNs en Vercel y hay dispositivos iOS activos registrados?
 * Auth por sesión del usuario o por Bearer RABBITTY_API_SECRET (S2S).
 * Responde: apnsConfigured, envs faltantes, dispositivos y los últimos pushes
 * encontrados en la campana (para comparar "fila creada vs push enviado").
 */
export async function GET(req: NextRequest) {
  try {
    const serverSecret = process.env.RABBITTY_API_SECRET;
    const authHeader = req.headers.get("authorization");
    const s2s = !!serverSecret && authHeader === `Bearer ${serverSecret}`;
    const caller = s2s ? { id: "s2s" } : await getAuthenticatedUser(req).catch(() => null);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Espejo exacto de getConfig() en lib/push/apns.ts (sin leer claves)
    const missing: string[] = [];
    if (!process.env.APNS_KEY_ID?.trim()) missing.push("APNS_KEY_ID");
    if (!process.env.APNS_TEAM_ID?.trim()) missing.push("APNS_TEAM_ID");
    if (!process.env.APNS_BUNDLE_ID?.trim()) missing.push("APNS_BUNDLE_ID");
    if (!process.env.APNS_PRIVATE_KEY) missing.push("APNS_PRIVATE_KEY");

    const devices = await db
      .select({
        platform: pushDevices.platform,
        isActive: pushDevices.isActive,
        tokenPrefix: pushDevices.token,
        updatedAt: pushDevices.updatedAt,
      })
      .from(pushDevices)
      .orderBy(desc(pushDevices.updatedAt))
      .limit(10);

    return NextResponse.json({
      success: true,
      apnsConfigured: isApnsConfigured(),
      missingEnvs: missing,
      apnsEnv: process.env.APNS_ENV || "production",
      devices: devices.map((d: { tokenPrefix: string }) => ({ ...d, tokenPrefix: String(d.tokenPrefix).slice(-12) })),
    });
  } catch (err: unknown) {
    console.error("[PUSH_CHECK]", err);
    return NextResponse.json({ error: "No se pudo verificar el sistema de push" }, { status: 500 });
  }
}
