/**
 * Mapeo de las tablas contables (OT-2 / OT-3) al contrato v1.0.
 * Puro y testeable. No toca DB.
 */

export const OBLIGATION_STATES = [
  "OPEN",
  "DISPUTED",
  "RESOLVED_PAYABLE",
  "PARTIALLY_PAID",
  "PAID",
  "RESOLVED_NOT_PAYABLE",
];

export const OBLIGATION_ORIGINS = ["fiat_sale", "redeem_fee"];
export const INSTRUMENTS = ["bunz", "fiat", "mixed"];
export const LEDGER_ACCOUNTS = [
  "emission_budget",
  "user_wallet",
  "redemption_capacity",
  "commission_reserved",
  "treasury_bunz",
  "written_off",
  "external",
];
export const LEDGER_REF_TYPES = ["reward", "redemption", "obligation", "reversal", "funding"];
export const LEDGER_DIRECTIONS = ["debit", "credit"];

const EPS = 0.01;
const iso = (d) => (d ? new Date(d).toISOString() : null);
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);

/** Fila → fila de contrato, con validación explícita. */
export function obligationToDataset(row) {
  if (!OBLIGATION_STATES.includes(row.state)) {
    return { ok: false, reason: `estado inválido '${row.state}'` };
  }
  if (!OBLIGATION_ORIGINS.includes(row.origin)) {
    return { ok: false, reason: `origen inválido '${row.origin}'` };
  }
  if (row.instrument != null && !INSTRUMENTS.includes(row.instrument)) {
    return { ok: false, reason: `instrumento inválido '${row.instrument}'` };
  }
  const amount = Number(row.amountBunz) || 0;
  const settledBunz = Number(row.settledBunz) || 0;
  const settledFiat = Number(row.settledFiatMxn) || 0;
  if (settledBunz > amount + EPS) {
    return { ok: false, reason: `settled_bunz ${settledBunz} > importe ${amount}` };
  }
  return {
    ok: true,
    row: {
      id: row.id,
      affiliate_id: row.affiliateId,
      origin: row.origin,
      accrued_at: day(row.accruedAt),
      due_at: day(row.dueAt),
      bunz: amount,
      state: row.state,
      settled_at: day(row.settledAt),
      instrument: row.instrument ?? null,
      settled_bunz: settledBunz,
      settled_fiat_mxn: settledFiat,
      written_off_at: day(row.writtenOffAt),
    },
  };
}

export function obligationsToDataset(rows) {
  const out = [];
  const invalid = [];
  for (const r of rows) {
    const m = obligationToDataset(r);
    if (m.ok) out.push(m.row);
    else invalid.push({ id: r.id, reason: m.reason });
  }
  return { rows: out, invalid };
}

export function ledgerEntryToDataset(row) {
  if (!LEDGER_ACCOUNTS.includes(row.account)) {
    return { ok: false, reason: `cuenta inválida '${row.account}'` };
  }
  if (!LEDGER_DIRECTIONS.includes(row.direction)) {
    return { ok: false, reason: `dirección inválida '${row.direction}'` };
  }
  if (!LEDGER_REF_TYPES.includes(row.refType)) {
    return { ok: false, reason: `refType inválido '${row.refType}'` };
  }
  const amount = Number(row.amount) || 0;
  if (amount <= 0) return { ok: false, reason: "importe no positivo" };
  return {
    ok: true,
    row: {
      id: row.id,
      group: row.groupId,
      ts: iso(row.ts),
      account: row.account,
      direction: row.direction,
      amount,
      ref_type: row.refType,
      ref_id: row.refId ?? null,
    },
  };
}

export function ledgerToDataset(rows) {
  const out = [];
  const invalid = [];
  for (const r of rows) {
    const m = ledgerEntryToDataset(r);
    if (m.ok) out.push(m.row);
    else invalid.push({ id: r.id, reason: m.reason });
  }
  return { rows: out, invalid };
}

/** Invariante del libro: cada grupo balancea. Devuelve los descuadrados. */
export function unbalancedGroups(entries) {
  const groups = new Map();
  for (const e of entries) {
    const g = groups.get(e.group) ?? { debit: 0, credit: 0 };
    g[e.direction] += e.amount;
    groups.set(e.group, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => Math.abs(g.debit - g.credit) > EPS)
    .map(([group, g]) => ({ group, debit: g.debit, credit: g.credit }));
}

/** Saldos por cuenta (créditos − débitos), como los lee el contrato. */
export function balancesByAccount(entries) {
  const b = Object.fromEntries(LEDGER_ACCOUNTS.map((a) => [a, 0]));
  for (const e of entries) b[e.account] += (e.direction === "credit" ? 1 : -1) * e.amount;
  return b;
}

/** Resumen contable de obligaciones (Bunz; el fiat va aparte). */
export function summarizeObligations(rows, { today = new Date(), longOverdueDays = 30 } = {}) {
  let accrued = 0;
  let settledBunz = 0;
  let settledFiat = 0;
  let writtenOff = 0;
  let outstanding = 0;
  let overdue = 0;
  let disputed = 0;

  for (const o of rows) {
    accrued += o.bunz;
    settledBunz += o.settled_bunz || 0;
    settledFiat += o.settled_fiat_mxn || 0;
    if (o.state === "RESOLVED_NOT_PAYABLE") writtenOff += o.bunz;
    if (o.state === "DISPUTED") disputed += o.bunz - (o.settled_bunz || 0);
    const pending = o.bunz - (o.settled_bunz || 0) - (o.settled_fiat_mxn || 0);
    if (o.state !== "RESOLVED_NOT_PAYABLE" && pending > EPS) {
      outstanding += pending;
      // Una disputa congelada no cuenta como vencida (contrato: scope "overdue").
      const days = (today.getTime() - new Date(o.due_at).getTime()) / 86_400_000;
      if (o.state !== "DISPUTED" && days > longOverdueDays) overdue += pending;
    }
  }

  return { accrued, settledBunz, settledFiat, writtenOff, outstanding, overdue, disputed };
}
