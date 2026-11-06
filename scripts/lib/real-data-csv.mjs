/**
 * ── CSV ⇄ dataset JSON (BUNZ REAL DATA SPEC v1.0) ───────────────────────────
 * Permite que el equipo de datos exporte CSV por dataset y se validen con el
 * mismo contrato. Sin DB, sin red, sin producción.
 *
 * Convenciones:
 *  - una fila por evento/snapshot; primera fila = cabecera
 *  - números con punto decimal, sin separador de miles
 *  - booleanos: true / false
 *  - arrays: separados por "|" (p. ej. reasons: capacity_exhausted|out_of_stock)
 *  - campo vacío = ausente (undefined), no cero
 */

import fs from "node:fs";
import path from "node:path";

export const DATASET_ORDER = [
  "affiliates",
  "sales",
  "rewards_issued",
  "redemptions",
  "capacity",
  "obligations",
  "fiat_settlements",
  "bunz_ledger",
  "treasury",
  "abuse_signals",
];

/** Columnas completas por dataset (obligatorias + usadas por las reglas). */
export const COLUMNS = {
  affiliates: ["id", "category", "size_band", "branch_id", "opened_at", "status", "city_hash"],
  sales: ["id", "affiliate_id", "ts", "gross_mxn", "discount_bunz", "tickets", "user"],
  rewards_issued: ["id", "affiliate_id", "user", "ts", "bunz", "origin", "reward_id", "expires_at", "reversal_of"],
  redemptions: [
    "id",
    "user",
    "requested_at",
    "requested_affiliate",
    "bunz",
    "fulfilled_bunz",
    "status",
    "reasons",
    "fulfilled_at",
    "fulfilled_affiliate",
    "wait_seconds",
    "reward_id",
  ],
  capacity: ["affiliate_id", "date", "authorized_bunz", "consumed_bunz"],
  obligations: [
    "id",
    "affiliate_id",
    "origin",
    "accrued_at",
    "due_at",
    "bunz",
    "state",
    "settled_at",
    "instrument",
    "settled_bunz",
    "settled_fiat_mxn",
    "written_off_at",
  ],
  fiat_settlements: ["id", "obligation_id", "received_at", "amount_mxn", "bank_ref", "reconciled"],
  bunz_ledger: ["id", "group", "ts", "account", "direction", "amount", "ref_type", "ref_id"],
  treasury: ["date", "bunz_balance", "fiat_balance", "bank_balance", "reconciled"],
  abuse_signals: ["id", "ts", "user", "type", "severity", "ref_id"],
};

const TYPES = {
  affiliates: { opened_at: "s", id: "s", category: "s", size_band: "s", branch_id: "s", status: "s", city_hash: "s" },
  sales: { id: "s", affiliate_id: "s", ts: "s", gross_mxn: "n", discount_bunz: "n", tickets: "n", user: "s" },
  rewards_issued: {
    id: "s", affiliate_id: "s", user: "s", ts: "s", bunz: "n", origin: "s",
    reward_id: "s", expires_at: "s", reversal_of: "s",
  },
  redemptions: {
    id: "s", user: "s", requested_at: "s", requested_affiliate: "s", bunz: "n", fulfilled_bunz: "n",
    status: "s", reasons: "a", fulfilled_at: "s", fulfilled_affiliate: "s", wait_seconds: "n", reward_id: "s",
  },
  capacity: { affiliate_id: "s", date: "s", authorized_bunz: "n", consumed_bunz: "n" },
  obligations: {
    id: "s", affiliate_id: "s", origin: "s", accrued_at: "s", due_at: "s", bunz: "n", state: "s",
    settled_at: "s", instrument: "s", settled_bunz: "n", settled_fiat_mxn: "n", written_off_at: "s",
  },
  fiat_settlements: { id: "s", obligation_id: "s", received_at: "s", amount_mxn: "n", bank_ref: "s", reconciled: "b" },
  bunz_ledger: { id: "s", group: "s", ts: "s", account: "s", direction: "s", amount: "n", ref_type: "s", ref_id: "s" },
  treasury: { date: "s", bunz_balance: "n", fiat_balance: "n", bank_balance: "n", reconciled: "b" },
  abuse_signals: { id: "s", ts: "s", user: "s", type: "s", severity: "s", ref_id: "s" },
};

// ── CSV ─────────────────────────────────────────────────────────────────────

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

export function stringifyCsv(rows) {
  const esc = (v) => {
    const s = v === undefined || v === null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

// ── Coerción ────────────────────────────────────────────────────────────────

function coerce(value, type) {
  // Los arrays son obligatorios pero pueden estar vacíos: "" = [] (no ausente).
  if (type === "a") {
    if (value === undefined || value === "") return [];
    return String(value).split("|").map((x) => x.trim()).filter(Boolean);
  }
  if (value === undefined || value === "") return undefined;
  if (type === "n") {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  if (type === "b") {
    if (String(value).toLowerCase() === "true") return true;
    if (String(value).toLowerCase() === "false") return false;
    return undefined;
  }
  return String(value);
}

export function rowsToObjects(dataset, rows) {
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim());
  const types = TYPES[dataset] ?? {};
  return rows.slice(1).map((cells) => {
    const obj = {};
    header.forEach((col, i) => {
      if (!col) return;
      const v = coerce(cells[i], types[col] ?? "s");
      if (v !== undefined) obj[col] = v;
    });
    return obj;
  });
}

export function objectsToRows(dataset, objects) {
  const cols = COLUMNS[dataset] ?? [];
  const types = TYPES[dataset] ?? {};
  const rows = [cols];
  for (const o of objects) {
    rows.push(
      cols.map((c) => {
        const v = o[c];
        if (v === undefined || v === null) return "";
        if (types[c] === "a") return (v || []).join("|");
        if (types[c] === "b") return v ? "true" : "false";
        return v;
      })
    );
  }
  return rows;
}

// ── Conversión de directorio ────────────────────────────────────────────────

export function csvDirToDataset(dir) {
  const metaPath = path.join(dir, "meta.json");
  if (!fs.existsSync(metaPath)) throw new Error(`falta ${metaPath}`);
  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  const dataset = {
    spec_version: meta.spec_version ?? "1.0.0",
    dataset_kind: meta.dataset_kind ?? "real-export",
    window: meta.window,
    granularity: meta.granularity ?? { capacity: "daily", treasury: "daily" },
    unit_policy: meta.unit_policy,
    capacity_scope: meta.capacity_scope,
  };
  for (const name of DATASET_ORDER) {
    const file = path.join(dir, `${name}.csv`);
    dataset[name] = fs.existsSync(file)
      ? rowsToObjects(name, parseCsv(fs.readFileSync(file, "utf8")))
      : [];
  }
  return dataset;
}

export function datasetToCsvDir(dataset, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    spec_version: dataset.spec_version ?? "1.0.0",
    dataset_kind: dataset.dataset_kind ?? "real-export",
    window: dataset.window,
    granularity: dataset.granularity ?? { capacity: "daily", treasury: "daily" },
    unit_policy: dataset.unit_policy,
    capacity_scope: dataset.capacity_scope,
    note: "Export CSV de un dataset. Ver BUNZ-REAL-DATA-SPEC-v1.0.",
  };
  fs.writeFileSync(path.join(dir, "meta.json"), JSON.stringify(meta, null, 2) + "\n");
  for (const name of DATASET_ORDER) {
    const rows = objectsToRows(name, dataset[name] ?? []);
    fs.writeFileSync(path.join(dir, `${name}.csv`), stringifyCsv(rows));
  }
  return dir;
}
