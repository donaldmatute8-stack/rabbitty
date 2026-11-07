import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const execFileAsync = promisify(execFile);

/**
 * ── /api/cron/validation ── Captura semanal de evidencia económica (OT-1…OT-4).
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

function findScript(): string | null {
  const cwd = process.cwd();
  const candidates = [
    path.resolve(cwd, "scripts/capture-weekly.mjs"), // cwd = repo root
    path.resolve(cwd, "../../scripts/capture-weekly.mjs"), // cwd = apps/admin
    "/app/scripts/capture-weekly.mjs",
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      /* ignore */
    }
  }
  return null;
}

async function run() {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 401 });
  }
  const script = findScript();
  if (!script) {
    return NextResponse.json({ ok: false, error: "capture-weekly.mjs no encontrado en la imagen" }, { status: 500 });
  }
  if (!process.env.RESTAURANT_DATABASE_URL) {
    return NextResponse.json({ ok: false, error: "RESTAURANT_DATABASE_URL no configurada" }, { status: 500 });
  }

  const dir = process.env.GOD_VALIDATION_DIR || "documents/validation";
  const label = new Date().toISOString().slice(0, 10);
  const args = [script, "--restaurant-url", process.env.RESTAURANT_DATABASE_URL, "--documents-dir", dir, "--label", label];
  if (process.env.CORE_DATABASE_URL) args.push("--core-url", process.env.CORE_DATABASE_URL);

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: path.resolve(path.dirname(script), ".."),
      timeout: 240_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    return NextResponse.json({
      ok: true,
      dir,
      label,
      snapshot: path.join(dir, `${label}.json`),
      output: stdout.trim().split("\n").slice(-8),
      warnings: stderr.trim() ? stderr.trim().split("\n").slice(-3) : [],
    });
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: string; stdout?: string };
    return NextResponse.json(
      {
        ok: false,
        error: err?.message ?? "captura falló",
        stderr: String(err?.stderr ?? "").slice(0, 800),
        stdout: String(err?.stdout ?? "").slice(-800),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run();
}
