/**
 * ── OT-7 · Bitemporalidad y reconstrucción as-of ────────────────────────────
 *
 * Un *journal* es un registro append-only de lo que el sistema supo y cuándo lo
 * supo. Cada entrada tiene:
 *   - `occurred_at`: cuándo pasó el hecho (tiempo de negocio)
 *   - `recorded_at`: cuándo se registró (tiempo de conocimiento)
 *
 * `asOf(journal, T)` reconstruye el dataset tal como se conocía en T:
 *   - solo entradas con `recorded_at <= T`
 *   - para cada clave lógica, la versión más reciente <= T
 *   - `supersedes` marca correcciones; `deleted` es un tombstone
 *
 * Reglas duras:
 *   - nunca se muta el journal (append-only)
 *   - el resultado se ordena de forma determinista (independiente del orden de
 *     ingesta)
 *   - una llegada tardía (occurred_at < T, recorded_at > T) NO entra en asOf(T)
 *     y sí en asOf(T2), donde se reporta como reexpresión
 */

import crypto from "node:crypto";

const OCCURRED_FIELD = {
  affiliates: "opened_at",
  sales: "ts",
  rewards_issued: "ts",
  redemptions: "requested_at",
  capacity: "date",
  obligations: "accrued_at",
  fiat_settlements: "received_at",
  bunz_ledger: "ts",
  treasury: "date",
  abuse_signals: "ts",
};

const KEY_OF = {
  capacity: (r) => `${r.affiliate_id}@${r.date}`,
  treasury: (r) => r.date,
};
const keyOf = (dataset, row) => (KEY_OF[dataset] ? KEY_OF[dataset](row) : row.id);

const META_FIELDS = [
  "spec_version",
  "dataset_kind",
  "window",
  "granularity",
  "unit_policy",
  "capacity_scope",
];
const DATASETS = Object.keys(OCCURRED_FIELD);

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export const sha256 = (text) => crypto.createHash("sha256").update(text).digest("hex");

/** Hash del dataset exportado (estable, independiente del orden de claves). */
export function exportHash(dataset) {
  return sha256(canonical(dataset));
}

/** Hash del journal completo (para identificar la fuente del export). */
export function journalHash(journal) {
  // Identifica el CONTENIDO, no el orden de llegada: dos ingestas de los mismos
  // hechos en distinto orden producen el mismo hash.
  const rows = journal
    .map((e) => [e.dataset, e.id, e.recorded_at, e.payload ?? null, e.deleted ?? false])
    .sort((a, b) => (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0));
  return sha256(canonical(rows));
}

/**
 * Construye un journal a partir de un dataset estático, asignando a todas las
 * filas el mismo `recorded_at` (escenario "todo conocido en esa fecha").
 * Para uso real, el journal lo produce la ingesta; esto sirve para pruebas y
 * para materializar exports históricos ya consolidados.
 */
export function createJournal(dataset, { recorded_at }) {
  if (!recorded_at) throw new Error("createJournal requiere recorded_at");
  const journal = [];

  const meta = {};
  for (const f of META_FIELDS) if (dataset[f] !== undefined) meta[f] = dataset[f];
  journal.push({
    dataset: "__meta",
    id: "meta",
    occurred_at: recorded_at,
    recorded_at,
    payload: meta,
  });

  for (const name of DATASETS) {
    for (const row of dataset[name] ?? []) {
      journal.push({
        dataset: name,
        id: keyOf(name, row),
        occurred_at: row[OCCURRED_FIELD[name]] ?? recorded_at,
        recorded_at,
        payload: { ...row },
      });
    }
  }
  return journal;
}

/**
 * Journal con `recorded_at = occurred_at`: supone que cada hecho se registró el
 * día en que ocurrió (lo que haría una ingesta normal). Sirve para materializar
 * cortes históricos de un export consolidado sin inventar conocimiento futuro.
 */
export function createJournalFromOccurrence(dataset) {
  const journal = [];
  const meta = {};
  for (const f of META_FIELDS) if (dataset[f] !== undefined) meta[f] = dataset[f];
  journal.push({
    dataset: "__meta",
    id: "meta",
    occurred_at: "1970-01-01",
    recorded_at: "1970-01-01",
    payload: meta,
  });
  for (const name of DATASETS) {
    for (const row of dataset[name] ?? []) {
      const occurred = row[OCCURRED_FIELD[name]] ?? "1970-01-01";
      journal.push({
        dataset: name,
        id: keyOf(name, row),
        occurred_at: occurred,
        recorded_at: String(occurred).slice(0, 10),
        payload: { ...row },
      });
    }
  }
  return journal;
}

/** Añade (nunca modifica) una entrada al journal. */
export function appendEntry(journal, entry) {
  if (!entry.dataset || !entry.id || !entry.recorded_at) {
    throw new Error("entrada de journal incompleta");
  }
  return [...journal, { ...entry }];
}

/**
 * Corrección versionada: nueva entrada para la misma clave, con `supersedes`
 * apuntando a la anterior. La anterior se conserva.
 */
export function correction(entry, { recorded_at, payload }) {
  return {
    ...entry,
    recorded_at,
    payload: { ...payload },
    supersedes: { recorded_at: entry.recorded_at, id: entry.id },
  };
}

/** Tombstone: la clave deja de existir a partir de `recorded_at`, sin borrar. */
export function tombstone(entry, { recorded_at }) {
  return {
    dataset: entry.dataset,
    id: entry.id,
    occurred_at: entry.occurred_at,
    recorded_at,
    deleted: true,
  };
}

// ── Selección de versión ────────────────────────────────────────────────────

function versionRank(entry) {
  // desempate determinista: recorded_at y luego hash del payload
  return `${entry.recorded_at}|${sha256(canonical(entry.payload ?? null)).slice(0, 16)}`;
}

/**
 * Devuelve la entrada vigente para (dataset, id) en el corte T, o null si no
 * existía o estaba borrada.
 */
export function versionAt(journal, dataset, id, cut) {
  const candidates = journal.filter(
    (e) => e.dataset === dataset && e.id === id && e.recorded_at <= cut
  );
  if (!candidates.length) return null;
  candidates.sort((a, b) => (versionRank(a) < versionRank(b) ? -1 : versionRank(a) > versionRank(b) ? 1 : 0));
  const latest = candidates[candidates.length - 1];
  return latest.deleted ? null : latest;
}

/** Historial completo (versiones) de una clave, en orden. */
export function versionsOf(journal, dataset, id) {
  return journal
    .filter((e) => e.dataset === dataset && e.id === id)
    .sort((a, b) => (versionRank(a) < versionRank(b) ? -1 : 1));
}

// ── Export as-of ───────────────────────────────────────────────────────────

/**
 * Materializa el dataset conocido en `cut`. Determinista: ordena filas por clave.
 */
export function asOf(journal, cut) {
  const metaEntry = versionAt(journal, "__meta", "meta", cut);
  const meta = metaEntry?.payload ?? { spec_version: "1.0.0" };

  const result = { ...meta };
  for (const name of DATASETS) result[name] = [];

  const idsByDataset = new Map();
  for (const e of journal) {
    if (e.recorded_at > cut) continue;
    if (!DATASETS.includes(e.dataset)) continue;
    if (!idsByDataset.has(e.dataset)) idsByDataset.set(e.dataset, new Set());
    idsByDataset.get(e.dataset).add(e.id);
  }

  for (const [name, ids] of idsByDataset) {
    for (const id of [...ids].sort()) {
      const v = versionAt(journal, name, id, cut);
      if (v) result[name].push({ ...v.payload });
    }
  }
  for (const name of DATASETS) {
    result[name].sort((a, b) => (keyOf(name, a) < keyOf(name, b) ? -1 : keyOf(name, a) > keyOf(name, b) ? 1 : 0));
  }
  return result;
}

// ── Reexpresiones y monotonía ───────────────────────────────────────────────

const canonicalRow = (row) => canonical(row);

/**
 * Compara dos exports y reporta reexpresiones: claves nuevas, cambiadas o
 * desaparecidas. Una llegada tardía aparece como `added` con occurred_at < corte.
 */
export function restatements(before, after) {
  const out = [];
  for (const name of DATASETS) {
    const b = new Map((before[name] ?? []).map((r) => [keyOf(name, r), r]));
    const a = new Map((after[name] ?? []).map((r) => [keyOf(name, r), r]));
    for (const [k, row] of a) {
      if (!b.has(k)) out.push({ dataset: name, id: k, kind: "added", occurred_at: OCCURRED_FIELD[name] ? row[OCCURRED_FIELD[name]] ?? null : null });
      else if (canonicalRow(b.get(k)) !== canonicalRow(row)) out.push({ dataset: name, id: k, kind: "changed", occurred_at: OCCURRED_FIELD[name] ? row[OCCURRED_FIELD[name]] ?? null : null });
    }
    for (const [k, row] of b) {
      if (!a.has(k)) out.push({ dataset: name, id: k, kind: "removed", occurred_at: OCCURRED_FIELD[name] ? row[OCCURRED_FIELD[name]] ?? null : null });
    }
  }
  out.sort((x, y) => `${x.dataset}:${x.id}`.localeCompare(`${y.dataset}:${y.id}`));
  return out;
}

/**
 * Verifica monotonía del conocimiento: nada presente en T1 puede desaparecer en
 * T2 > T1 sin un tombstone, y ninguna clave puede retroceder a una versión más
 * antigua.
 */
export function checkMonotonic(journal, t1, t2) {
  const problems = [];
  const keys = new Map();
  for (const e of journal) {
    if (!DATASETS.includes(e.dataset)) continue;
    if (!keys.has(e.dataset)) keys.set(e.dataset, new Set());
    keys.get(e.dataset).add(e.id);
  }
  for (const [name, ids] of keys) {
    for (const id of ids) {
      const v1 = versionAt(journal, name, id, t1);
      const v2 = versionAt(journal, name, id, t2);
      if (v1 && !v2) {
        const tomb = journal.some(
          (e) => e.dataset === name && e.id === id && e.deleted && e.recorded_at <= t2
        );
        if (!tomb) problems.push({ dataset: name, id, kind: "desaparece-sin-tombstone" });
      }
      if (v1 && v2 && versionRank(v2) < versionRank(v1)) {
        problems.push({ dataset: name, id, kind: "retrocede-de-version" });
      }
    }
  }
  return problems;
}
