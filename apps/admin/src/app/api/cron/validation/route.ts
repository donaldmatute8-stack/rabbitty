import { NextRequest, NextResponse } from "next/server";
import { runValidationCapture } from "@rabbitty/api/services/validationCapture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ── /api/cron/validation ── Captura semanal de evidencia económica (OT-1…OT-5).
 *
 * READ-ONLY sobre la base: ejecuta `scripts/capture-weekly.mjs`, que solo hace
 * SELECT, y escribe el snapshot en `GOD_VALIDATION_DIR` (volumen del panel).
 * No toca tasas, saldos, stock ni tesorería.
 *
 * Autorización: CRON_SECRET (mismo patrón que affiliate-nudges).
 * Programación: GitHub Action `bunz-validation-cron` (viernes 15:00 UTC).
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

async function run() {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 401 });
  }

  const result = await runValidationCapture();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}
