/**
 * Mapeo de las tablas de captura (OT-1 / OT-4) al contrato v1.0.
 * Puro y testeable: no toca DB ni escribe nada.
 */

import crypto from "node:crypto";

/** Hash estable del identificador de usuario: nunca se guarda el original. */
export function hashUser(value) {
  if (!value) return "walkin";
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
}

export const REASON_CATALOG = [
  "capacity_exhausted",
  "out_of_stock",
  "affiliate_refused",
  "closed",
  "inactive_branch",
  "tech_failure",
  "user_cancelled",
  "duplicate",
  "fraud",
  "unknown",
];

export const ATTEMPT_STATUS = ["fulfilled", "partial", "unfulfilled", "cancelled", "fraud", "duplicate"];

/** Acepta JSON string o array; normaliza al catálogo cerrado. */
export function normalizeReasons(input) {
  let list = input;
  if (typeof input === "string") {
    try {
      list = JSON.parse(input);
    } catch {
      list = [input];
    }
  }
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const raw of list) {
    const r = String(raw);
    out.push(REASON_CATALOG.includes(r) ? r : "unknown");
  }
  return [...new Set(out)];
}

/** Fila de `bunz_redemption_attempts` → fila de `redemptions` del contrato. */
export function attemptToRedemption(row, branchToAffiliate) {
  const affiliate =
    branchToAffiliate.get(row.branchId) ?? branchToAffiliate.get(row.fulfilledBranchId) ?? null;
  if (!affiliate) return null;

  const status = ATTEMPT_STATUS.includes(row.status) ? row.status : "unfulfilled";
  const fulfilled = Number(row.bunzFulfilled) || 0;
  const requested = Number(row.bunzRequested) || 0;

  return {
    id: row.id,
    user: hashUser(row.userHash),
    requested_at: new Date(row.requestedAt).toISOString(),
    requested_affiliate: affiliate,
    bunz: requested,
    fulfilled_bunz: Math.min(fulfilled, requested),
    status,
    reasons: normalizeReasons(row.reasons),
    fulfilled_at: row.fulfilledAt ? new Date(row.fulfilledAt).toISOString() : null,
    fulfilled_affiliate: row.fulfilledBranchId
      ? branchToAffiliate.get(row.fulfilledBranchId) ?? affiliate
      : affiliate,
    wait_seconds: row.waitSeconds ?? null,
    reward_id: row.rewardId ?? null,
  };
}

export function attemptsToRedemptions(rows, branchToAffiliate) {
  return rows.map((r) => attemptToRedemption(r, branchToAffiliate)).filter(Boolean);
}

/** Fila de `bunz_capacity_daily` → fila de `capacity` del contrato. */
export function capacityToDataset(rows) {
  return rows.map((r) => ({
    affiliate_id: r.affiliateId,
    date: String(r.date).slice(0, 10),
    authorized_bunz: Number(r.authorizedBunz) || 0,
    consumed_bunz: Number(r.consumedBunz) || 0,
  }));
}

export const ABUSE_TYPES = ["rapid_redemption", "redemption_burst", "discount_streak", "other"];
export const ABUSE_SEVERITIES = ["low", "medium", "high"];

/** Fila de `bunz_abuse_signals` → fila de `abuse_signals` del contrato. */
export function abuseSignalToDataset(row) {
  const type = ABUSE_TYPES.includes(row.type) ? row.type : "other";
  const severity = ABUSE_SEVERITIES.includes(row.severity) ? row.severity : "low";
  return {
    id: row.id,
    ts: new Date(row.detectedAt).toISOString(),
    user: row.userHash,
    type,
    severity,
    ref_id: row.refId ?? null,
  };
}

export function abuseSignalsToDataset(rows) {
  return rows.map(abuseSignalToDataset);
}

/** Qué fuentes existen: decide si el pipeline usa captura real o fallback. */
export function pickSources({ hasAttempts, hasCapacity, hasObligations = false, hasLedger = false }) {
  return {
    redemptions: hasAttempts ? "attempts" : "orders-fallback",
    capacity: hasCapacity ? "daily-snapshots" : "derived-fallback",
    obligations: hasObligations ? "db" : "gap",
    ledger: hasLedger ? "db" : "gap",
    gaps: [
      ...(hasAttempts ? [] : ["bunz_redemption_attempts"]),
      ...(hasCapacity ? [] : ["bunz_capacity_daily"]),
      ...(hasObligations ? [] : ["bunz_obligations"]),
      ...(hasLedger ? [] : ["bunz_ledger_entries"]),
    ],
  };
}
