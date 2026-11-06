/**
 * ── Validación (panel GOD) — adaptador READ-ONLY ────────────────────────────
 *
 * Lee snapshots JSON generados por `scripts/validation-snapshot.mjs`.
 * NO escribe, NO consulta la DB, NO contiene lógica económica.
 * El panel solo muestra lo que el pipeline ya calculó y firmó con hashes.
 */

import fs from "node:fs";
import path from "node:path";

export const VALIDATION_FLAG = "GOD_VALIDATION_PANEL";
export const DEFAULT_DIR = "documents/validation";
/** Solo nombres simples: evita traversal. */
export const SNAPSHOT_ID_RE = /^[A-Za-z0-9._-]{1,80}$/;

/** Límites defensivos: un snapshot es un JSON pequeño, no un volcado. */
export const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024; // 2 MB
export const MAX_SNAPSHOTS = 500;

/**
 * Resuelve un nombre dentro del directorio y verifica que no escape de él.
 * No sigue enlaces simbólicos: el archivo debe ser regular (lstat).
 */
export function safePath(dir: string, name: string): string | null {
  const base = path.resolve(dir);
  const full = path.resolve(base, name);
  if (full === base || !full.startsWith(base + path.sep)) return null;
  return full;
}

export function readableRegularFile(full: string | null): boolean {
  if (!full) return false;
  try {
    const st = fs.lstatSync(full);
    if (!st.isFile()) return false; // symlink, directorio, socket…
    if (st.size <= 0 || st.size > MAX_SNAPSHOT_BYTES) return false;
    return true;
  } catch {
    return false;
  }
}

export interface SnapshotStatus {
  valid: boolean;
  calibration_ready: boolean;
  audit_verdict: string;
  next_step: string;
}

export interface SnapshotSummary {
  id: string;
  export_id: string;
  generated_at: string | null;
  dataset_kind: string;
  dataset_hash: string | null;
  status: SnapshotStatus | null;
  active_affiliates: number | null;
  datasets_missing: string[];
  rules_not_checked: string[];
}

export interface ValidationSnapshot {
  snapshot_version?: string;
  export_id?: string;
  generated_at?: string;
  source_commit?: string | null;
  dataset_kind?: string;
  dataset_hash?: string;
  status?: Partial<SnapshotStatus>;
  counts?: Record<string, number>;
  coverage?: Record<string, unknown>;
  pilot?: {
    datasets_present?: string[];
    datasets_missing?: string[];
    rules_not_checked?: string[];
    note?: string;
  } | null;
  metrics?: Record<string, number | null>;
  rules?: { errors?: unknown[]; warnings?: unknown[]; not_checked?: string[] };
  backtest?: Record<string, unknown> | { skipped?: boolean; reason?: string };
  audit?: Record<string, unknown>;
  decisions?: Array<{ id: string; label: string; status: string; owner?: string }>;
  artifacts?: Record<string, string | null>;
}

/** Feature flag: apagado por defecto. */
export function isValidationPanelEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = env[VALIDATION_FLAG];
  return v === "1" || v === "true" || v === "TRUE";
}

export function validationDir(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.GOD_VALIDATION_DIR || DEFAULT_DIR;
  return path.isAbsolute(configured) ? configured : path.join(process.cwd(), configured);
}

export function summarize(id: string, snapshot: ValidationSnapshot): SnapshotSummary {
  const status = snapshot.status;
  return {
    id,
    export_id: snapshot.export_id ?? id,
    generated_at: snapshot.generated_at ?? null,
    dataset_kind: snapshot.dataset_kind ?? "unknown",
    dataset_hash: snapshot.dataset_hash ?? null,
    status: status
      ? {
          valid: Boolean(status.valid),
          calibration_ready: Boolean(status.calibration_ready),
          audit_verdict: status.audit_verdict ?? "desconocido",
          next_step: status.next_step ?? "",
        }
      : null,
    active_affiliates:
      typeof (snapshot.coverage as { active_affiliates?: unknown } | undefined)?.active_affiliates === "number"
        ? ((snapshot.coverage as { active_affiliates: number }).active_affiliates)
        : null,
    datasets_missing: snapshot.pilot?.datasets_missing ?? [],
    rules_not_checked: snapshot.pilot?.rules_not_checked ?? [],
  };
}

/**
 * Lista los snapshots del directorio. Archivos ilegibles o JSON inválidos se
 * reportan en `ignored`; nunca rompen el panel.
 */
export function listSnapshots(dir: string): { snapshots: SnapshotSummary[]; ignored: string[] } {
  const ignored: string[] = [];
  if (!fs.existsSync(dir)) return { snapshots: [], ignored: [dir] };

  const snapshots: SnapshotSummary[] = [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .slice(0, MAX_SNAPSHOTS);

  for (const file of files) {
    const id = file.slice(0, -5);
    const full = safePath(dir, file);
    if (!SNAPSHOT_ID_RE.test(id) || !readableRegularFile(full)) {
      ignored.push(file);
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(full as string, "utf8")) as ValidationSnapshot;
      if (!parsed || typeof parsed !== "object" || !parsed.status) {
        ignored.push(file);
        continue;
      }
      snapshots.push(summarize(id, parsed));
    } catch {
      ignored.push(file);
    }
  }

  snapshots.sort((a, b) => String(b.generated_at ?? b.id).localeCompare(String(a.generated_at ?? a.id)));
  return { snapshots, ignored };
}

/** Lee un snapshot por id. Devuelve null si el id no es válido o no existe. */
export function readSnapshot(dir: string, id: string): ValidationSnapshot | null {
  const clean = String(id ?? "").replace(/\.json$/i, "");
  if (!SNAPSHOT_ID_RE.test(clean)) return null;
  const full = safePath(dir, `${clean}.json`);
  if (!readableRegularFile(full)) return null;
  try {
    return JSON.parse(fs.readFileSync(full as string, "utf8")) as ValidationSnapshot;
  } catch {
    // JSON inválido o archivo a medio escribir: el panel lo trata como ausente.
    return null;
  }
}
