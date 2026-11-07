#!/usr/bin/env node
/**
 * ── MCCE · Simulación en sombra ──────────────────────────────────────────────
 *
 * Lee la base real (solo SELECT), calcula capacidad, opciones híbridas y
 * escenarios de recuperación para los afiliados activos. **No escribe nada.**
 *
 * Uso:
 *   node scripts/mcce-shadow.mjs \
 *     --restaurant-url "$RESTAURANT_DATABASE_URL" \
 *     --core-url "$CORE_DATABASE_URL" \
 *     --days 30
 *
 * Salida:
 *   - resumen Markdown por consola
 *   - DOCS/data/mcce-shadow-AAAA-MM-DD.json
 */

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import {
  buildCapacityOptions,
  coverageDaysOf,
  estimateDailyDemand,
  extraordinaryRetention,
  recoverFromGeneratedCapacity,
  shouldAccelerate,
} from "./lib/mcce.mjs";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const RESTAURANT = flag("--restaurant-url") || process.env.RESTAURANT_DATABASE_URL;
const CORE = flag("--core-url") || process.env.CORE_DATABASE_URL;
const DAYS = Math.max(7, Number(flag("--days")) || 30);
const OUT =
  flag("--out") ||
  path.join("DOCS", "data", `mcce-shadow-${new Date().toISOString().slice(0, 10)}.json`);

if (!RESTAURANT) {
  console.error("Falta --restaurant-url o RESTAURANT_DATABASE_URL");
  process.exit(1);
}

const REDEMPTION_PRIORS = {
  cafe: 0.35,
  cafeteria: 0.35,
  restaurant: 0.35,
  restaurante: 0.35,
  fitness: 0.25,
  gym: 0.25,
  barber: 0.3,
  barberia: 0.3,
  default: 0.3,
};

const priorFor = (niche) =>
  REDEMPTION_PRIORS[String(niche || "").toLowerCase()] ?? REDEMPTION_PRIORS.default;

async function withClient(url, fn) {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function collect() {
  const affiliates = await withClient(CORE || RESTAURANT, async (db) => {
    const r = await db.query(
      `SELECT id, name, COALESCE(niche, category) AS niche, package,
              "creditLimit", "creditUsed", "bunzBalance", "rewardPercentage", "createdAt"
         FROM "ownedBusinesses"
        WHERE status IN ('APPROVED', 'VERIFIED')
        ORDER BY name`
    );
    return r.rows;
  });

  const sales = await withClient(RESTAURANT, async (db) => {
    const r = await db.query(
      `SELECT r."businessId",
              COUNT(*)::int AS orders,
              COALESCE(SUM(o.total), 0) AS fiat,
              COALESCE(AVG(o.total), 0) AS avg_ticket,
              COALESCE(SUM(o."bunzReward"), 0) AS rewards
         FROM orders o
         JOIN branches b ON b.id = o."branchId"
         JOIN restaurants r ON r.id = b."restaurantId"
        WHERE o."createdAt" >= now() - ($1 || ' days')::interval
          AND o.status = 'COMPLETED'
        GROUP BY r."businessId"`,
      [String(DAYS)]
    );
    return r.rows;
  });

  const redemptions = await withClient(RESTAURANT, async (db) => {
    const r = await db.query(
      `SELECT r."businessId",
              COUNT(*)::int AS attempts,
              COALESCE(SUM(a."bunzFulfilled"), 0) AS redeemed
         FROM bunz_redemption_attempts a
         JOIN branches b ON b.id = a."branchId"
         JOIN restaurants r ON r.id = b."restaurantId"
        WHERE a."requestedAt" >= now() - ($1 || ' days')::interval
        GROUP BY r."businessId"`,
      [String(DAYS)]
    );
    return r.rows;
  });

  const byId = (rows) => new Map(rows.map((r) => [r.businessId, r]));
  const salesBy = byId(sales);
  const redemptionsBy = byId(redemptions);

  return affiliates.map((a) => {
    const s = salesBy.get(a.id);
    const red = redemptionsBy.get(a.id);
    const fiat = Number(s?.fiat) || 0;
    const rewards = Number(s?.rewards) || 0;
    const redeemed = Number(red?.redeemed) || 0;
    const attempts = Number(red?.attempts) || 0;
    const days = DAYS;

    const dailyFiat = fiat / days;
    const rewardRate = (Number(a.rewardPercentage) || 0) / 100;
    const prior = priorFor(a.niche);
    const dailyDemand = estimateDailyDemand({
      dailyFiatSales: dailyFiat,
      rewardRate,
      redemptionShare: prior,
    });
    const dailyRedemption = redeemed > 0 ? redeemed / days : dailyDemand;

    const coverage = coverageDaysOf({
      capacityAvailable: Number(a.bunzBalance) || 0,
      dailyRedemption,
    });

    const options = buildCapacityOptions({
      dailyCapacityDemand: dailyRedemption,
      nicheFloor: 1000,
      nicheCeiling: 20000,
      solvencyCap: 10000,
      coverageDays: [7, 14, 30],
      promoShare: 0.4,
    });

    // Hipótesis de composición: no se asume; se muestra el rango.
    const creditLimit = Number(a.creditLimit) || 0;
    const creditUsed = Number(a.creditUsed) || 0;
    const bal = Number(a.bunzBalance) || 0;
    const creditOutstandingHypothesis = Math.min(creditLimit, bal);

    const coverageNeed = dailyRedemption * 7;
    const monthlyGenerated = days > 0 ? (rewards * 30) / days : 0;
    const recoveryScenarios = [0.1, 0.2, 0.3].map((retainShare) => {
      const r = recoverFromGeneratedCapacity({
        generatedGross: rewards,
        coverageNeed,
        creditOutstanding: creditOutstandingHypothesis,
        baseAvailable: bal,
        retainShare,
      });
      const monthlyRecovery = monthlyGenerated * retainShare;
      const recoveryMonths =
        creditOutstandingHypothesis > 0 && monthlyRecovery > 0
          ? Math.round((creditOutstandingHypothesis / monthlyRecovery) * 10) / 10
          : null;
      return { retainShare, ...r, monthlyRecovery, recoveryMonths };
    });

    const acceleration = [2, 3, 4].flatMap((ratio) =>
      [30, 60, 90].map((window) => {
        const generatedNet = Math.max(0, bal - creditOutstandingHypothesis);
        const check = shouldAccelerate({
          generatedNet,
          creditOutstanding: creditOutstandingHypothesis,
          coverageDays: coverage,
          triggerRatio: ratio,
          triggerDays: window,
          daysAtTrigger: window,
          minCoverageDays: 7,
        });
        const extra = extraordinaryRetention({
          generatedGross: rewards,
          coverageNeed,
          creditOutstanding: creditOutstandingHypothesis,
          extraordinaryShare: 0.5,
        });
        return { triggerRatio: ratio, triggerDays: window, ...check, ...extra };
      })
    );

    const warnings = [];
    const maxOption = Math.max(...options.map((o) => o.totalCapacity), 0);
    if (maxOption > 0 && bal > maxOption * 1.5) {
      warnings.push("capacidad actual muy por encima de la opción calculada");
    }
    if (creditLimit > 0 && creditUsed === 0) {
      warnings.push("creditUsed=0 con creditLimit>0: composición no reconciliada");
    }
    if (bal < creditLimit) {
      warnings.push("bunzBalance < creditLimit: capacidad por debajo del adelanto autorizado");
    }
    if (redeemed === 0) {
      warnings.push("sin redenciones en la ventana: demanda estimada con prior de nicho");
    }
    if (!a.package) warnings.push("package vacío: etiqueta comercial sin catálogo");

    return {
      id: a.id,
      name: a.name,
      niche: a.niche,
      package: a.package,
      current: {
        creditLimit,
        creditUsed,
        bunzBalance: bal,
        rewardPercentage: a.rewardPercentage,
        creditOutstandingHypothesis,
      },
      activity: {
        windowDays: days,
        orders: Number(s?.orders) || 0,
        fiat,
        avgTicket: Number(s?.avg_ticket) || 0,
        rewards,
        attempts,
        redeemed,
        dailyFiat,
        dailyDemand,
        dailyRedemption,
      },
      coverage,
      options,
      recoveryScenarios,
      acceleration,
      warnings,
    };
  });
}

function md(report) {
  const lines = [
    `# MCCE · Simulación en sombra — ${report.generatedAt}`,
    "",
    `Ventana: ${report.windowDays} días · afiliados activos: ${report.affiliates.length}`,
    "> Solo lectura. Datos reales, cálculo en sombra. No es una autorización.",
    "",
  ];
  for (const a of report.affiliates) {
    lines.push(`## ${a.name}`);
    lines.push(
      `- Nicho: ${a.niche ?? "n/d"} · paquete: ${a.package ?? "—"} · reward: ${a.current.rewardPercentage}%`
    );
    lines.push(
      `- Actividad: ${a.activity.orders} ventas · ${a.activity.fiat.toFixed(0)} MXN · ${a.activity.rewards} Bunz emitidos · ${a.activity.redeemed} redimidos`
    );
    lines.push(
      `- Capacidad actual: ${a.current.bunzBalance} · cobertura: ${
        a.coverage === null ? "sin redenciones" : `${a.coverage.toFixed(1)} días`
      }`
    );
    lines.push(
      `- Composición reportada: creditLimit ${a.current.creditLimit} · creditUsed ${a.current.creditUsed} → hipótesis de pendiente ${a.current.creditOutstandingHypothesis}`
    );
    lines.push("- Opciones calculadas (bruto antes del piso):");
    for (const o of a.options) {
      lines.push(
        `  - ${o.tier} (${o.coverageDays}d): ${o.totalCapacity} = ${o.promoCapacity} incentivo + ${o.creditCapacity} adelanto (bruto ${o.rawCapacity})`
      );
    }
    lines.push("- Recuperación por retención:");
    for (const r of a.recoveryScenarios) {
      lines.push(
        `  - ${(r.retainShare * 100).toFixed(0)}%: retiene ${r.retained}, neto ${r.generatedNet}, pendiente ${r.newCreditOutstanding}, disponible ${r.newAvailable}${r.coverageBlocked ? " (cobertura bloquea)" : ""} · recuperación estimada ${r.recoveryMonths === null ? "n/d" : `${r.recoveryMonths} meses`}`
      );
    }
    if (a.warnings.length) lines.push(`- Avisos: ${a.warnings.join(" · ")}`);
    lines.push("");
  }
  lines.push("## Lectura");
  lines.push(
    "Los importes son una simulación, no una autorización. La composición real de cada afiliado debe reconciliarse antes de migrar."
  );
  return lines.join("\n");
}

const report = {
  generatedAt: new Date().toISOString(),
  windowDays: DAYS,
  note: "Simulación en sombra, solo lectura. No modifica datos ni autoriza capacidad.",
  affiliates: await collect(),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2) + "\n");

console.log(md(report));
console.log(`\n→ ${OUT}`);
