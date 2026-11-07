/**
 * ── Ejecutor de la captura semanal ───────────────────────────────────────────
 *
 * Envuelve `scripts/capture-weekly.mjs`, que solo hace SELECT sobre la base y
 * escribe el snapshot en disco. Lo usan:
 *  - `/api/cron/validation` (CRON_SECRET, GitHub Action)
 *  - `god.runValidationCapture` (sesión God Admin + 2FA, botón del panel)
 *
 * No calcula economía ni toca tasas, saldos, stock ni tesorería.
 */

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ValidationCaptureResult = {
  ok: boolean;
  dir?: string;
  label?: string;
  snapshot?: string;
  output: string[];
  warnings: string[];
  error?: string;
  stderr?: string;
  stdout?: string;
};

/** Busca el script en los layouts conocidos (repo root, apps/admin, imagen). */
export function findCaptureScript(): string | null {
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

export async function runValidationCapture(
  { label, timeoutMs = 240_000 }: { label?: string; timeoutMs?: number } = {}
): Promise<ValidationCaptureResult> {
  const script = findCaptureScript();
  if (!script) {
    return {
      ok: false,
      error: "capture-weekly.mjs no encontrado en la imagen",
      output: [],
      warnings: [],
    };
  }
  if (!process.env.RESTAURANT_DATABASE_URL) {
    return { ok: false, error: "RESTAURANT_DATABASE_URL no configurada", output: [], warnings: [] };
  }

  const dir = process.env.GOD_VALIDATION_DIR || "documents/validation";
  const stamp = label || new Date().toISOString().slice(0, 10);
  const args = [
    script,
    "--restaurant-url",
    process.env.RESTAURANT_DATABASE_URL,
    "--documents-dir",
    dir,
    "--label",
    stamp,
  ];
  if (process.env.CORE_DATABASE_URL) args.push("--core-url", process.env.CORE_DATABASE_URL);

  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, args, {
      cwd: path.resolve(path.dirname(script), ".."),
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
    return {
      ok: true,
      dir,
      label: stamp,
      snapshot: path.join(dir, `${stamp}.json`),
      output: stdout.trim().split("\n").slice(-8),
      warnings: stderr.trim() ? stderr.trim().split("\n").slice(-3) : [],
    };
  } catch (e: unknown) {
    const err = e as { message?: string; stderr?: string; stdout?: string };
    return {
      ok: false,
      error: err?.message ?? "captura falló",
      stderr: String(err?.stderr ?? "").slice(0, 800),
      stdout: String(err?.stdout ?? "").slice(-800),
      output: [],
      warnings: [],
    };
  }
}
