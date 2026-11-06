/**
 * ── BUNZ REAL DATA SPEC v1.0 — contratos y validadores ──────────────────────
 * Puro: sin DB, sin red, sin producción. Solo valida datasets ya exportados.
 *
 * Principio: toda métrica se reconstruye desde eventos trazables.
 */

export const SPEC_VERSION = "1.0.0";

// ── Enums ────────────────────────────────────────────────────────────────────

export const REASONS = {
  capacity_exhausted: { economic: true },
  out_of_stock: { economic: true },
  affiliate_refused: { economic: true },
  closed: { economic: false },
  inactive_branch: { economic: false },
  tech_failure: { economic: false },
  user_cancelled: { economic: false },
  duplicate: { economic: false, discard: true },
  fraud: { economic: false, discard: true },
  unknown: { economic: false, unknown: true },
};

export const REDEMPTION_STATUS = ["fulfilled", "partial", "unfulfilled", "cancelled", "fraud", "duplicate"];
export const OBLIGATION_STATES = [
  "OPEN",
  "DISPUTED",
  "RESOLVED_PAYABLE",
  "PARTIALLY_PAID",
  "PAID",
  "RESOLVED_NOT_PAYABLE",
];
export const INSTRUMENTS = ["bunz", "fiat", "mixed", null];
export const ACCOUNTS = [
  "emission_budget",
  "user_wallet",
  "redemption_capacity",
  "commission_reserved",
  "treasury_bunz",
  "written_off",
  "external", // contrapartida de fondeo/apertura; no se interpreta como saldo
];

export const DATASETS = {
  affiliates: ["id", "category", "size_band", "branch_id", "opened_at", "status"],
  sales: ["id", "affiliate_id", "ts", "gross_mxn", "tickets", "user"],
  rewards_issued: ["id", "affiliate_id", "user", "ts", "bunz", "origin", "expires_at"],
  redemptions: [
    "id",
    "user",
    "requested_at",
    "requested_affiliate",
    "bunz",
    "fulfilled_bunz",
    "status",
    "reasons",
  ],
  capacity: ["affiliate_id", "date", "authorized_bunz", "consumed_bunz"],
  obligations: ["id", "affiliate_id", "origin", "accrued_at", "due_at", "bunz", "state"],
  fiat_settlements: ["id", "obligation_id", "received_at", "amount_mxn", "reconciled"],
  bunz_ledger: ["id", "group", "ts", "account", "direction", "amount", "ref_type", "ref_id"],
  treasury: ["date", "bunz_balance", "fiat_balance", "bank_balance", "reconciled"],
  abuse_signals: ["id", "ts", "user", "type", "severity"],
};

const EPS = 0.01;
const num = (x) => typeof x === "number" && Number.isFinite(x);
const sum = (xs) => xs.reduce((a, x) => a + x, 0);
const dayMs = 86_400_000;
const asDate = (x) => (x ? new Date(x).getTime() : NaN);
const monthOf = (x) => String(x).slice(0, 7);

export function activeEvents(events = []) {
  const reversed = new Set(events.filter((e) => e.reversal_of).map((e) => e.reversal_of));
  return events.filter((e) => !e.reversal_of && !reversed.has(e.id));
}

// ── Validación de estructura ─────────────────────────────────────────────────

export function validateStructure(data) {
  const errors = [];
  const warnings = [];
  const add = (code, msg, sev = "error") => (sev === "error" ? errors : warnings).push({ code, msg });

  if (!data || typeof data !== "object") {
    add("R00", "el dataset raíz no es un objeto");
    return { errors, warnings };
  }
  if (data.spec_version !== SPEC_VERSION) {
    add("R00", `spec_version esperada ${SPEC_VERSION}, recibida ${data.spec_version}`);
  }
  if (!data.window || !data.window.operational || !data.window.financial) {
    add("R19", "faltan las ventanas operational/financial");
  }

  const pilot = data.dataset_kind === "pilot";
  for (const [name, fields] of Object.entries(DATASETS)) {
    const rows = data[name];
    if (!Array.isArray(rows)) {
      // En un piloto la ausencia se DECLARA como hueco; no se rellena.
      if (pilot) add("R27", `dataset ${name} ausente (hueco declarado en piloto)`, "warning");
      else add("R00", `dataset ${name} ausente o no es array`);
      continue;
    }
    rows.forEach((row, i) => {
      for (const f of fields) {
        if (row[f] === undefined) add("R01", `${name}[${i}] sin campo obligatorio '${f}'`);
      }
    });
    const ids = new Map();
    const key = name === "capacity" ? (r) => `${r.affiliate_id}@${r.date}`
      : name === "treasury" ? (r) => r.date
      : (r) => r.id;
    rows.forEach((row, i) => {
      const k = key(row);
      if (ids.has(k)) add("R01", `${name}[${i}] clave duplicada '${k}'`);
      else ids.set(k, i);
    });
  }
  return { errors, warnings };
}

// ── Referencias ─────────────────────────────────────────────────────────────

export function validateReferences(data) {
  const errors = [];
  const add = (code, msg) => errors.push({ code, msg });
  const affiliates = new Set((data.affiliates || []).map((a) => a.id));
  const rewards = new Set((data.rewards_issued || []).map((r) => r.id));
  const obligations = new Set((data.obligations || []).map((o) => o.id));

  const checkRef = (set, value, where) => {
    if (value != null && !set.has(value)) add("R02", `${where}: referencia inexistente '${value}'`);
  };

  (data.sales || []).forEach((s, i) => checkRef(affiliates, s.affiliate_id, `sales[${i}]`));
  (data.rewards_issued || []).forEach((r, i) => checkRef(affiliates, r.affiliate_id, `rewards_issued[${i}]`));
  (data.redemptions || []).forEach((r, i) => {
    checkRef(affiliates, r.requested_affiliate, `redemptions[${i}].requested_affiliate`);
    checkRef(affiliates, r.fulfilled_affiliate, `redemptions[${i}].fulfilled_affiliate`);
    checkRef(rewards, r.reward_id, `redemptions[${i}].reward_id`);
  });
  (data.capacity || []).forEach((c, i) => checkRef(affiliates, c.affiliate_id, `capacity[${i}]`));
  (data.obligations || []).forEach((o, i) => checkRef(affiliates, o.affiliate_id, `obligations[${i}]`));
  // Sin tabla de obligaciones no se puede exigir la referencia (piloto).
  if (Array.isArray(data.obligations)) {
    (data.fiat_settlements || []).forEach((f, i) =>
      checkRef(obligations, f.obligation_id, `fiat_settlements[${i}]`)
    );
  }

  const refSets = {
    reward: rewards,
    redemption: new Set((data.redemptions || []).map((r) => r.id)),
    obligation: obligations,
    reversal: new Set((data.rewards_issued || []).map((r) => r.id)),
  };
  (data.bunz_ledger || []).forEach((e, i) => {
    if (e.ref_type === "funding") return; // contrapartida externa, sin referencia interna
    const set = refSets[e.ref_type];
    if (!set) add("R02", `bunz_ledger[${i}]: ref_type desconocido '${e.ref_type}'`);
    else if (!set.has(e.ref_id)) add("R02", `bunz_ledger[${i}]: ref_id inexistente '${e.ref_id}'`);
  });

  return errors;
}

// ── Metadatos que condicionan la calibración (R24, R25) ─────────────────────

/**
 * R24 · Unidades. La identidad contable del modelo suma Bunz y MXN
 * (`liquidado_bunz + liquidado_fiat`). Eso es una conversión implícita: sin
 * `unit_policy` declarada (y aprobada) el dataset NO es calibrable.
 *
 * R25 · Agregación de capacidad. La capacidad puede ser por afiliado, por
 * sucursal o por paquete. Sin declararlo, el snapshot puede duplicar u omitir
 * capacidad sin que nadie lo note.
 */
export function validateMeta(data) {
  const errors = [];
  const warnings = [];
  const add = (code, msg, sev = "error") => (sev === "error" ? errors : warnings).push({ code, msg });

  const up = data.unit_policy;
  if (!up) {
    add("R24", "falta unit_policy: sin unidad y paridad declaradas no se calibra", "warning");
  } else {
    if (!(typeof up.bunz_per_mxn === "number") || !(up.bunz_per_mxn > 0)) {
      add("R24", "unit_policy.bunz_per_mxn inválido o ausente");
    }
    if (typeof up.approved !== "boolean") {
      add("R24", "unit_policy.approved debe ser booleano");
    } else if (!up.approved) {
      add(
        "R24",
        "paridad Bunz↔MXN no aprobada: la identidad contable mezcla unidades → no se calibra",
        "warning"
      );
    }
  }

  const scope = data.capacity_scope;
  if (!scope) {
    add("R25", "falta capacity_scope (affiliate|branch): la capacidad puede agregarse mal", "warning");
  } else if (!["affiliate", "branch"].includes(scope)) {
    add("R25", `capacity_scope inválido '${scope}'`);
  } else if (scope === "branch") {
    const rows = data.capacity || [];
    if (!rows.every((c) => c.branch_id)) {
      add("R25", "capacity_scope=branch exige branch_id en todas las filas de capacity");
    }
    const keys = new Set();
    for (const c of rows) {
      const k = `${c.branch_id}@${c.date}`;
      if (keys.has(k)) add("R25", `capacity duplicada para sucursal/fecha '${k}'`);
      keys.add(k);
    }
  }

  return {
    errors,
    warnings,
    declared: errors.length === 0 && warnings.length === 0,
  };
}

// ── Reglas de negocio ───────────────────────────────────────────────────────

export function validateBusinessRules(data) {
  const errors = [];
  const warnings = [];
  const add = (code, msg, sev = "error") => (sev === "error" ? errors : warnings).push({ code, msg });

  const fin = data.window?.financial;
  const inWindow = (d) => !fin || (asDate(d) >= asDate(fin.from) && asDate(d) <= asDate(fin.to) + dayMs - 1);

  for (const [i, r] of (data.redemptions || []).entries()) {
    if (!REDEMPTION_STATUS.includes(r.status)) add("R06", `redemptions[${i}]: status inválido '${r.status}'`);
    if (r.status === "fulfilled" || r.status === "partial") {
      if (!r.fulfilled_at) add("R06", `redemptions[${i}]: atendida sin fulfilled_at`);
      if (!r.fulfilled_affiliate) add("R06", `redemptions[${i}]: atendida sin fulfilled_affiliate`);
      if (!(r.fulfilled_bunz > 0)) add("R06", `redemptions[${i}]: atendida sin fulfilled_bunz`);
    }
    if (!["fulfilled", "partial", "duplicate", "fraud"].includes(r.status) && !(r.reasons || []).length) {
      add("R07", `redemptions[${i}]: no atendida sin reasons`);
    }
    for (const reason of r.reasons || []) {
      if (!REASONS[reason]) add("R07", `redemptions[${i}]: motivo desconocido '${reason}'`);
      if (REASONS[reason]?.unknown) {
        // R22: unknown nunca se imputa como incumplimiento económico
        if (r.status === "fulfilled") add("R22", `redemptions[${i}]: 'unknown' en una redención atendida`);
      }
    }
    if (num(r.fulfilled_bunz) && num(r.bunz) && r.fulfilled_bunz > r.bunz + EPS) {
      add("R04", `redemptions[${i}]: fulfilled_bunz > bunz`);
    }
    if (!inWindow(r.requested_at)) add("R03", `redemptions[${i}]: requested_at fuera de ventana`);
  }

  for (const [i, o] of (data.obligations || []).entries()) {
    if (!OBLIGATION_STATES.includes(o.state)) add("R08", `obligations[${i}]: state inválido`);
    if (["PAID", "PARTIALLY_PAID"].includes(o.state)) {
      if (!o.settled_at) add("R08", `obligations[${i}]: ${o.state} sin settled_at`);
      if (!o.instrument) add("R08", `obligations[${i}]: ${o.state} sin instrument`);
    }
    if (o.state === "RESOLVED_NOT_PAYABLE" && !o.written_off_at) {
      add("R09", `obligations[${i}]: castigo sin written_off_at`);
    }
    if (num(o.settled_bunz) && num(o.bunz) && o.settled_bunz > o.bunz + EPS) {
      add("R04", `obligations[${i}]: settled_bunz > bunz`);
    }
    if (asDate(o.due_at) < asDate(o.accrued_at)) add("R04", `obligations[${i}]: due_at < accrued_at`);
    if (!inWindow(o.accrued_at)) add("R03", `obligations[${i}]: accrued_at fuera de ventana`);
  }

  for (const [i, c] of (data.capacity || []).entries()) {
    if (c.consumed_bunz > c.authorized_bunz + EPS) {
      add("R05", `capacity[${i}]: consumed > authorized`);
    }
    if (c.authorized_bunz < 0 || c.consumed_bunz < 0) add("R04", `capacity[${i}]: importe negativo`);
  }

  // R26 · conciliación POR OBLIGACIÓN, dimensionalmente correcta.
  //
  // Los importes de `bunz` y `settled_bunz` están en Bunz; `settled_fiat_mxn` y
  // `amount_mxn` en MXN. Comparar sumas de ambos SIN conversión explícita es un
  // error dimensional. Por eso:
  //   - siempre se valida cada instrumento por separado (misma unidad);
  //   - la identidad mixta solo se evalúa si `unit_policy.approved === true`,
  //     aplicando `bunz_per_mxn` (cuántos Bunz equivalen a 1 MXN) de forma explícita.
  const unit = data.unit_policy;
  const parityApproved =
    unit?.approved === true &&
    typeof unit?.bunz_per_mxn === "number" &&
    unit.bunz_per_mxn > 0;
  const bunzPerMxn = parityApproved ? unit.bunz_per_mxn : null;
  let skippedMixed = 0;

  const fiatByObligation = new Map();
  for (const f of data.fiat_settlements || []) {
    fiatByObligation.set(f.obligation_id, (fiatByObligation.get(f.obligation_id) || 0) + f.amount_mxn);
  }

  for (const [i, o] of (data.obligations || []).entries()) {
    const settledBunz = o.settled_bunz || 0;
    const settledFiat = o.settled_fiat_mxn || 0;

    // (a) Misma unidad: Bunz contra Bunz. Siempre válido.
    if (settledBunz > o.bunz + EPS) {
      add("R26", `obligations[${i}]: settled_bunz ${settledBunz.toFixed(2)} > importe ${o.bunz} Bunz`);
    }

    // (b) Misma unidad: cobros fiat contra lo declarado liquidado en fiat (MXN/MXN).
    const cobrado = fiatByObligation.get(o.id) || 0;
    if (cobrado > settledFiat + EPS) {
      add(
        "R26",
        `obligation ${o.id}: cobros fiat ${cobrado.toFixed(2)} MXN > settled_fiat_mxn ${settledFiat.toFixed(2)} MXN`
      );
    }

    // (c) Identidad mixta: requiere conversión explícita y autorizada.
    if (settledFiat > EPS) {
      if (!parityApproved) {
        skippedMixed++;
        continue;
      }
      const fiatInBunz = settledFiat * bunzPerMxn;
      const settledTotal = settledBunz + fiatInBunz;
      if (settledTotal > o.bunz + EPS) {
        add(
          "R26",
          `obligations[${i}]: liquidado ${settledTotal.toFixed(2)} Bunz (${settledBunz.toFixed(2)} + ${settledFiat.toFixed(2)} MXN × ${bunzPerMxn}) > importe ${o.bunz}`
        );
      }
      if (o.state === "PAID" && Math.abs(settledTotal - o.bunz) > EPS) {
        add(
          "R26",
          `obligations[${i}]: PAID con liquidado ${settledTotal.toFixed(2)} Bunz ≠ ${o.bunz} (paridad ${bunzPerMxn} Bunz/MXN)`
        );
      }
      if (o.state === "PARTIALLY_PAID" && !(settledTotal > EPS && settledTotal < o.bunz - EPS)) {
        add("R26", `obligations[${i}]: PARTIALLY_PAID fuera de rango (${settledTotal.toFixed(2)} Bunz)`);
      }
    } else {
      // Solo Bunz: identidad directa, sin conversión.
      if (o.state === "PAID" && Math.abs(settledBunz - o.bunz) > EPS) {
        add("R26", `obligations[${i}]: PAID con settled_bunz ${settledBunz.toFixed(2)} ≠ ${o.bunz}`);
      }
      if (o.state === "PARTIALLY_PAID" && !(settledBunz > EPS && settledBunz < o.bunz - EPS)) {
        add("R26", `obligations[${i}]: PARTIALLY_PAID fuera de rango (${settledBunz.toFixed(2)} Bunz)`);
      }
    }
  }

  if (skippedMixed > 0) {
    add(
      "R26",
      `${skippedMixed} obligación(es) con liquidación fiat no se comparan contra Bunz: paridad no aprobada (R24). Se validan ambos instrumentos por separado.`,
      "warning"
    );
  }

  for (const [i, f] of (data.fiat_settlements || []).entries()) {
    if (!f.reconciled || !f.bank_ref) {
      add("R17", `fiat_settlements[${i}]: sin conciliar/bank_ref, no cuenta como cobrado`, "warning");
    }
    if (f.amount_mxn <= 0) add("R04", `fiat_settlements[${i}]: importe no positivo`);
  }

  for (const [i, t] of (data.treasury || []).entries()) {
    if (t.reconciled && Math.abs(t.fiat_balance - t.bank_balance) > EPS) {
      add("R16", `treasury[${i}]: conciliada con diferencia ${(t.fiat_balance - t.bank_balance).toFixed(2)}`);
    }
  }

  // R18 huecos en series
  const tol = data.granularity?.capacity === "weekly" ? 8 : 2;
  for (const name of ["capacity", "treasury"]) {
    const dates = [...new Set((data[name] || []).map((r) => r.date))].sort();
    for (let i = 1; i < dates.length; i++) {
      const gap = Math.round((asDate(dates[i]) - asDate(dates[i - 1])) / dayMs);
      if (gap > tol) add("R18", `${name}: hueco de ${gap} días entre ${dates[i - 1]} y ${dates[i]}`, "warning");
    }
  }

  // R19 ventanas
  const op = data.window?.operational;
  if (op) {
    const days = Math.round((asDate(op.to) - asDate(op.from)) / dayMs) + 1;
    if (days < 84) {
      add(
        "R19",
        `ventana operativa de ${days} días (< 84)${data.dataset_kind === "pilot" ? ": limitación de piloto" : ""}`,
        data.dataset_kind === "pilot" ? "warning" : "error"
      );
    }
  }
  if (fin) {
    const months = Math.round((asDate(fin.to) - asDate(fin.from)) / (dayMs * 30.44));
    if (months < 6) {
      add(
        "R19",
        `ventana financiera de ~${months} meses (< 6)${data.dataset_kind === "pilot" ? ": limitación de piloto" : ""}`,
        data.dataset_kind === "pilot" ? "warning" : "error"
      );
    }
  }

  return { errors, warnings };
}

// ── Doble libro ─────────────────────────────────────────────────────────────

export function validateLedger(entries = []) {
  const errors = [];
  const groups = new Map();
  for (const [i, e] of entries.entries()) {
    if (!ACCOUNTS.includes(e.account)) errors.push({ code: "R10", msg: `bunz_ledger[${i}]: cuenta desconocida '${e.account}'` });
    if (!["debit", "credit"].includes(e.direction)) errors.push({ code: "R10", msg: `bunz_ledger[${i}]: dirección inválida` });
    if (!(e.amount > 0)) errors.push({ code: "R04", msg: `bunz_ledger[${i}]: importe no positivo` });
    const g = groups.get(e.group) || { debit: 0, credit: 0 };
    if (e.direction === "debit") g.debit += e.amount;
    else g.credit += e.amount;
    groups.set(e.group, g);
  }
  for (const [group, g] of groups) {
    if (Math.abs(g.debit - g.credit) > EPS) {
      errors.push({ code: "R10", msg: `grupo '${group}' descuadrado: débito ${g.debit} ≠ crédito ${g.credit}` });
    }
  }
  return errors;
}

export function ledgerBalances(entries = []) {
  const b = Object.fromEntries(ACCOUNTS.map((a) => [a, 0]));
  for (const e of entries) {
    b[e.account] += (e.direction === "credit" ? 1 : -1) * e.amount;
  }
  return b;
}

// ── Métricas ────────────────────────────────────────────────────────────────

export function computeMetrics(data) {
  const rewards = activeEvents(data.rewards_issued);
  const redemptions = activeEvents(data.redemptions);
  const obligations = activeEvents(data.obligations);

  const emitted = sum(rewards.map((r) => r.bunz));
  const fulfilled = redemptions.filter((r) => r.status === "fulfilled" || r.status === "partial");
  const redeemed = sum(fulfilled.map((r) => r.fulfilled_bunz));

  let unmetEconomic = 0;
  let unmetOperational = 0;
  let unmetUnknown = 0;
  let requestedTotal = 0;
  const unmetByReason = {};

  for (const r of redemptions) {
    if (r.status === "fulfilled") {
      requestedTotal += r.bunz;
      continue;
    }
    if (r.status === "duplicate" || r.status === "fraud") continue;
    requestedTotal += r.bunz;
    const missing = Math.max(0, r.bunz - (r.fulfilled_bunz || 0));
    const defs = (r.reasons || []).map((x) => REASONS[x]).filter(Boolean);
    for (const reason of r.reasons || []) unmetByReason[reason] = (unmetByReason[reason] || 0) + missing;
    if (defs.some((d) => d.economic)) unmetEconomic += missing;
    else if (defs.some((d) => d.unknown)) unmetUnknown += missing;
    else unmetOperational += missing;
  }

  const accrued = sum(obligations.map((o) => o.bunz));
  const settledBunz = sum(obligations.map((o) => o.settled_bunz || 0));
  const settledFiat = sum(obligations.map((o) => o.settled_fiat_mxn || 0));
  const writtenOff = sum(obligations.filter((o) => o.state === "RESOLVED_NOT_PAYABLE").map((o) => o.bunz));
  const outstanding = accrued - settledBunz - settledFiat - writtenOff;

  const fiatCollected = sum(
    (data.fiat_settlements || []).filter((f) => f.reconciled && f.bank_ref).map((f) => f.amount_mxn)
  );

  const balances = ledgerBalances(data.bunz_ledger || []);
  const circulating = balances.user_wallet;
  const treasuryBunz = balances.treasury_bunz;
  const reserved = balances.commission_reserved;

  const rewardOrigin = new Map(rewards.map((r) => [r.id, r.affiliate_id]));
  let movedAmount = 0;
  let movedCount = 0;
  for (const r of fulfilled) {
    const origin = r.reward_id ? rewardOrigin.get(r.reward_id) : null;
    if (origin && r.fulfilled_affiliate && origin !== r.fulfilled_affiliate) {
      movedAmount += r.fulfilled_bunz;
      movedCount++;
    }
  }

  const capacityRows = data.capacity || [];
  const capacityAvailable = capacityRows.length
    ? capacityRows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1).authorized_bunz
    : 0;

  const claims = circulating + treasuryBunz;
  const ce = claims > 0 ? capacityAvailable / claims : null;

  const now = asDate(data.window?.financial?.to || new Date().toISOString());
  const overdue = obligations.filter((o) => {
    if (!["OPEN", "DISPUTED", "RESOLVED_PAYABLE", "PARTIALLY_PAID"].includes(o.state)) return false;
    if (o.state === "DISPUTED") return false;
    return (now - asDate(o.due_at)) / dayMs > 30;
  });
  const moraImporte = sum(overdue.map((o) => o.bunz - (o.settled_bunz || 0) - (o.settled_fiat_mxn || 0)));
  const moraConteo = overdue.length;

  return {
    emitted_bunz: emitted,
    redeemed_bunz: redeemed,
    circulating_bunz: circulating,
    treasury_bunz: treasuryBunz,
    reserved_bunz: reserved,
    accrued_bunz: accrued,
    settled_bunz: settledBunz,
    settled_fiat_mxn: settledFiat,
    fiat_collected_mxn: fiatCollected,
    written_off_bunz: writtenOff,
    outstanding_bunz: outstanding,
    requested_bunz: requestedTotal,
    unmet_economic_bunz: unmetEconomic,
    unmet_operational_bunz: unmetOperational,
    unmet_unknown_bunz: unmetUnknown,
    unmet_rate: requestedTotal > 0 ? unmetEconomic / requestedTotal : 0,
    unmet_by_reason: unmetByReason,
    mobility_rate_amount: redeemed > 0 ? movedAmount / redeemed : null,
    mobility_rate_count: fulfilled.length > 0 ? movedCount / fulfilled.length : null,
    capacity_available_bunz: capacityAvailable,
    ce,
    mora_importe_bunz: moraImporte,
    mora_conteo: moraConteo,
    balances,
  };
}

// ── Conciliación ────────────────────────────────────────────────────────────

export function reconcile(data, metrics) {
  const errors = [];
  const warnings = [];
  const add = (code, msg, sev = "error") => (sev === "error" ? errors : warnings).push({ code, msg });
  const b = ledgerBalances(data.bunz_ledger || []);

  if (Math.abs(b.user_wallet - metrics.circulating_bunz) > EPS) {
    add("R11", "circulación del libro ≠ métrica de circulación");
  }
  if (Math.abs((b.emission_budget * -1) - metrics.emitted_bunz) > EPS) {
    add("R11", `emisión neta del libro (${(-b.emission_budget).toFixed(2)}) ≠ recompensas activas (${metrics.emitted_bunz.toFixed(2)})`);
  }
  if (Math.abs(b.redemption_capacity - metrics.redeemed_bunz) > EPS) {
    add("R12", `capacidad redimida del libro (${b.redemption_capacity.toFixed(2)}) ≠ redenciones atendidas (${metrics.redeemed_bunz.toFixed(2)})`);
  }

  const settledLedger = sum(
    (data.bunz_ledger || [])
      .filter((e) => e.account === "treasury_bunz" && e.direction === "credit" && e.ref_type === "obligation")
      .map((e) => e.amount)
  );
  if (Math.abs(settledLedger - metrics.settled_bunz) > EPS) {
    add("R13", `liquidado en Bunz del libro (${settledLedger.toFixed(2)}) ≠ obligaciones (${metrics.settled_bunz.toFixed(2)})`);
  }

  if (metrics.fiat_collected_mxn + EPS < metrics.settled_fiat_mxn) {
    add(
      "R17",
      `cobro fiat declarado en obligaciones (${metrics.settled_fiat_mxn.toFixed(2)}) sin respaldo conciliado (${metrics.fiat_collected_mxn.toFixed(2)})`,
      "warning"
    );
  }

  const identity = metrics.settled_bunz + metrics.settled_fiat_mxn + metrics.written_off_bunz + metrics.outstanding_bunz;
  if (Math.abs(identity - metrics.accrued_bunz) > EPS) {
    add("R14", `devengado ${metrics.accrued_bunz.toFixed(2)} ≠ liquidado+cobrado+castigado+pendiente ${identity.toFixed(2)}`);
  }

  const snapshots = (data.treasury || []).slice().sort((a, b2) => String(a.date).localeCompare(String(b2.date)));
  const last = snapshots.at(-1);
  if (last) {
    if (Math.abs(last.bunz_balance - metrics.treasury_bunz) > EPS) {
      add("R15", `snapshot tesorería Bunz (${last.bunz_balance}) ≠ libro (${metrics.treasury_bunz.toFixed(2)})`);
    }
    if (last.reconciled && Math.abs(last.fiat_balance - last.bank_balance) > EPS) {
      add("R16", "snapshot conciliado con diferencia fiat/banco");
    }
  }

  return { errors, warnings };
}

// ── Cobertura y representatividad ───────────────────────────────────────────

export function coverageReport(data) {
  const active = (data.affiliates || []).filter((a) => a.status === "active");
  const salesBy = new Map();
  for (const s of data.sales || []) salesBy.set(s.affiliate_id, (salesBy.get(s.affiliate_id) || 0) + s.gross_mxn);

  const cells = new Map();
  for (const a of active) {
    const key = `${a.category}|${a.size_band}`;
    cells.set(key, (cells.get(key) || 0) + 1);
  }
  const insufficient = [...cells.entries()].filter(([, n]) => n < 5).map(([cell, n]) => ({ cell, affiliates: n }));

  const byAffiliate = active
    .map((a) => ({ id: a.id, gross: salesBy.get(a.id) || 0 }))
    .sort((x, y) => y.gross - x.gross);
  const totalGross = sum(byAffiliate.map((x) => x.gross));
  const top3 = totalGross > 0 ? sum(byAffiliate.slice(0, 3).map((x) => x.gross)) / totalGross : 0;

  const coverage = {};
  for (const name of Object.keys(DATASETS)) {
    const rows = data[name] || [];
    const dates = rows
      .map((r) => r.ts || r.date || r.requested_at || r.accrued_at || r.received_at)
      .filter(Boolean)
      .map((d) => asDate(d));
    coverage[name] = dates.length
      ? { from: new Date(Math.min(...dates)).toISOString().slice(0, 10), to: new Date(Math.max(...dates)).toISOString().slice(0, 10), rows: rows.length }
      : { from: null, to: null, rows: 0 };
  }

  const warnings = [];
  if (insufficient.length) {
    warnings.push({
      code: "R20",
      msg: `celdas con < 5 afiliados activos: ${insufficient.map((c) => `${c.cell}(${c.affiliates})`).join(", ")}`,
    });
  }
  if (top3 > 0.6) {
    warnings.push({ code: "R21", msg: `muestra concentrada: top3 de ventas ${(top3 * 100).toFixed(1)}%` });
  }

  return {
    active_affiliates: active.length,
    inactive_affiliates: (data.affiliates || []).length - active.length,
    cells: [...cells.entries()].map(([cell, n]) => ({ cell, affiliates: n })),
    insufficient_cells: insufficient,
    sample_top3_sales_share: top3,
    coverage,
    warnings,
    limitations: [
      ...(insufficient.length ? ["cobertura insuficiente por celda: no extrapolar"] : []),
      ...(top3 > 0.6 ? ["muestra dominada por pocos afiliados: conclusiones no generalizables"] : []),
    ],
  };
}

// ── Export para backtest ────────────────────────────────────────────────────

export function toBacktestInput(data) {
  const metrics = computeMetrics(data);
  const affiliates = new Map((data.affiliates || []).map((a) => [a.id, a]));
  const originOf = new Map((data.rewards_issued || []).map((r) => [r.id, r.affiliate_id]));
  const months = new Set();
  const rows = new Map();

  const row = (affiliateId, month) => {
    const key = `${affiliateId}|${month}`;
    if (!rows.has(key)) {
      rows.set(key, {
        affiliate_id: affiliateId,
        month,
        demand_mxn: 0,
        rewards_issued_bunz: 0,
        redeemed_bunz: 0,
        unmet_economic_bunz: 0,
        capacity_authorized_bunz: 0,
        capacity_consumed_bunz: 0,
        accrued_bunz: 0,
        settled_bunz: 0,
        settled_fiat_mxn: 0,
        outstanding_bunz: 0,
        written_off_bunz: 0,
        mobility_amount_bunz: 0,
        redeemed_for_mobility_bunz: 0,
      });
    }
    return rows.get(key);
  };

  for (const s of data.sales || []) {
    const m = monthOf(s.ts);
    months.add(m);
    row(s.affiliate_id, m).demand_mxn += s.gross_mxn;
  }
  for (const r of activeEvents(data.rewards_issued)) {
    const m = monthOf(r.ts);
    months.add(m);
    row(r.affiliate_id, m).rewards_issued_bunz += r.bunz;
  }
  for (const r of activeEvents(data.redemptions)) {
    if (!r.fulfilled_at) continue;
    const m = monthOf(r.fulfilled_at);
    months.add(m);
    const target = r.fulfilled_affiliate || r.requested_affiliate;
    const x = row(target, m);
    x.redeemed_bunz += r.fulfilled_bunz || 0;
    x.redeemed_for_mobility_bunz += r.fulfilled_bunz || 0;
    const origin = r.reward_id ? originOf.get(r.reward_id) : null;
    if (origin && origin !== target) x.mobility_amount_bunz += r.fulfilled_bunz || 0;
  }
  for (const r of activeEvents(data.redemptions)) {
    if (["fulfilled", "duplicate", "fraud"].includes(r.status)) continue;
    const defs = (r.reasons || []).map((x) => REASONS[x]).filter(Boolean);
    if (!defs.some((d) => d.economic)) continue;
    const m = monthOf(r.requested_at);
    months.add(m);
    row(r.requested_affiliate, m).unmet_economic_bunz += Math.max(0, r.bunz - (r.fulfilled_bunz || 0));
  }
  for (const c of data.capacity || []) {
    const m = monthOf(c.date);
    months.add(m);
    const x = row(c.affiliate_id, m);
    x.capacity_authorized_bunz = Math.max(x.capacity_authorized_bunz, c.authorized_bunz);
    x.capacity_consumed_bunz += c.consumed_bunz;
  }
  for (const o of activeEvents(data.obligations)) {
    const m = monthOf(o.accrued_at);
    months.add(m);
    const x = row(o.affiliate_id, m);
    x.accrued_bunz += o.bunz;
    x.settled_bunz += o.settled_bunz || 0;
    x.settled_fiat_mxn += o.settled_fiat_mxn || 0;
    if (o.state === "RESOLVED_NOT_PAYABLE") x.written_off_bunz += o.bunz;
  }
  for (const x of rows.values()) {
    x.outstanding_bunz = x.accrued_bunz - x.settled_bunz - x.settled_fiat_mxn - x.written_off_bunz;
    x.mobility_rate_amount = x.redeemed_for_mobility_bunz > 0
      ? x.mobility_amount_bunz / x.redeemed_for_mobility_bunz
      : null;
    const a = affiliates.get(x.affiliate_id);
    x.category = a?.category ?? null;
    x.size_band = a?.size_band ?? null;
    delete x.redeemed_for_mobility_bunz;
    delete x.mobility_amount_bunz;
  }

  const missing = [];
  if (metrics.mobility_rate_amount === null) missing.push("mobility_rate_amount");
  if (metrics.ce === null) missing.push("ce");
  if (metrics.fiat_collected_mxn === 0) missing.push("fiat_collected_mxn");

  return {
    metadata: {
      spec_version: SPEC_VERSION,
      generated_from_rows: Object.fromEntries(Object.keys(DATASETS).map((n) => [n, (data[n] || []).length])),
      months: [...months].sort(),
      operational_window: data.window?.operational ?? null,
      financial_window: data.window?.financial ?? null,
      missing_metrics: missing,
      note: "Si falta una métrica, el backtest no debe arrancar: no se rellena con datos sintéticos.",
    },
    monthly: [...rows.values()].sort((x, y) => x.month.localeCompare(y.month) || x.affiliate_id.localeCompare(y.affiliate_id)),
  };
}

// ── Modo piloto ─────────────────────────────────────────────────────────────

/** Reglas que no se pueden evaluar si falta el dataset que las sustenta. */
export const RULE_REQUIRES = {
  R08: ["obligations"],
  R09: ["obligations"],
  R10: ["bunz_ledger"],
  R11: ["bunz_ledger"],
  R12: ["bunz_ledger"],
  R13: ["bunz_ledger"],
  R14: ["obligations"],
  R15: ["bunz_ledger", "treasury"],
  R16: ["treasury"],
  R26: ["obligations"],
};

// ── Orquestación ────────────────────────────────────────────────────────────

export function runValidation(data) {
  const structure = validateStructure(data);
  const references = validateReferences(data);
  const business = validateBusinessRules(data);
  const meta = validateMeta(data);
  const ledger = validateLedger(data.bunz_ledger || []);
  const metrics = computeMetrics(data);
  const recon = reconcile(data, metrics);
  const coverage = coverageReport(data);

  const pilot = data.dataset_kind === "pilot";
  const present = Object.keys(DATASETS).filter((n) => Array.isArray(data[n]));
  const missing = Object.keys(DATASETS).filter((n) => !Array.isArray(data[n]));

  let errors = [
    ...structure.errors,
    ...references,
    ...business.errors,
    ...ledger,
    ...recon.errors,
    ...meta.errors,
  ];
  let warnings = [
    ...structure.warnings,
    ...business.warnings,
    ...recon.warnings,
    ...coverage.warnings,
    ...meta.warnings,
  ];

  // En piloto, las reglas que dependen de datasets ausentes no se evalúan:
  // pasan a `not_checked` en vez de fingir un fallo o un aprobado.
  const notChecked = [];
  if (pilot) {
    const dependsOnMissing = (e) =>
      (RULE_REQUIRES[e.code] ?? []).some((d) => missing.includes(d));
    notChecked.push(...errors.filter(dependsOnMissing));
    notChecked.push(...warnings.filter(dependsOnMissing));
    errors = errors.filter((e) => !dependsOnMissing(e));
    warnings = warnings.filter((w) => !dependsOnMissing(w));
  }

  return {
    spec_version: SPEC_VERSION,
    ok: errors.length === 0,
    counts: {
      datasets: Object.fromEntries(Object.keys(DATASETS).map((n) => [n, (data[n] || []).length])),
      errors: errors.length,
      warnings: warnings.length,
    },
    errors,
    warnings,
    metrics,
    coverage,
    reconciliation: {
      ledger_balanced: ledger.length === 0,
      errors: recon.errors.length,
    },
    meta: {
      unit_policy: data.unit_policy ?? null,
      capacity_scope: data.capacity_scope ?? null,
      declared: meta.declared,
    },
    pilot: pilot
      ? {
          kind: "pilot",
          datasets_present: present,
          datasets_missing: missing,
          // Reglas que el piloto NO puede evaluar (por dependencia, aunque no hayan fallado)
          rules_not_checked: Object.entries(RULE_REQUIRES)
            .filter(([, deps]) => deps.some((d) => missing.includes(d)))
            .map(([code]) => code)
            .sort(),
          suppressed_findings: notChecked.length,
          gaps: missing.map((m) => ({
            dataset: m,
            reason: `sin fuente o sin instrumentación: ${m}`,
          })),
          note: "Un piloto no calibra: sirve para probar la instrumentación con datos reales.",
        }
      : null,
    calibration_ready: pilot
      ? false
      : errors.length === 0 && coverage.insufficient_cells.length === 0 && meta.declared,
  };
}
