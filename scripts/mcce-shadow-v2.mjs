#!/usr/bin/env node
/**
 * MCCE · Simulación v2 (parámetros de crédito viable)
 *
 * Lee la simulación v1 ya generada (solo lectura) y compara:
 *  - líneas de capacidad adelantada: 500 / 1,000 / 2,000 / 3,500
 *  - retención: 20% / 40% / 60%
 *  - piso por nicho: 250 / 500 / 1,000
 *  - Bull Box: 100% incentivo vs 50/50 vs 100% adelanto
 *  - fungibilidad: recompensa emitida en 626 y redimida en Bull Box
 *
 * No toca DB ni producción.
 */

import fs from "node:fs";
import path from "node:path";
import { buildCapacityOptions } from "./lib/mcce.mjs";

const input =
  process.argv.find((a) => a.startsWith("--input="))?.split("=")[1] ||
  path.join("DOCS", "data", "mcce-shadow-2026-11-07.json");

if (!fs.existsSync(input)) {
  console.error(`No existe ${input}. Corre primero scripts/mcce-shadow.mjs.`);
  process.exit(1);
}

const v1 = JSON.parse(fs.readFileSync(input, "utf8"));
const CREDIT_LINES = [500, 1000, 2000, 3500];
const RETENTIONS = [0.2, 0.4, 0.6];
const FLOORS = [250, 500, 1000];
const FEASIBLE_MONTHS = 36;

const round1 = (v) => Math.round(v * 10) / 10;

function recoveryMonths({ credit, monthlyGenerated, retainShare }) {
  const monthlyRecovery = monthlyGenerated * retainShare;
  if (!(credit > 0)) return 0;
  if (!(monthlyRecovery > 0)) return null;
  return round1(credit / monthlyRecovery);
}

const affiliates = v1.affiliates.map((a) => {
  const monthlyGenerated = a.activity.rewards;
  const dailyDemand = a.activity.dailyDemand;
  const currentStock = a.current.bunzBalance;
  const currentCredit = a.current.creditLimit;

  const creditScenarios = CREDIT_LINES.flatMap((credit) =>
    RETENTIONS.map((retainShare) => {
      const months = recoveryMonths({ credit, monthlyGenerated, retainShare });
      return {
        credit,
        retainShare,
        recoveryMonths: months,
        feasible: months !== null && months <= FEASIBLE_MONTHS,
      };
    })
  );

  const floorScenarios = FLOORS.map((floor) => {
    const options = buildCapacityOptions({
      dailyCapacityDemand: dailyDemand,
      nicheFloor: floor,
      nicheCeiling: 20000,
      solvencyCap: 10000,
      coverageDays: [7, 14, 30],
      promoShare: 0.4,
    });
    return {
      floor,
      options: options.map((o) => ({
        tier: o.tier,
        coverageDays: o.coverageDays,
        total: o.totalCapacity,
        raw: o.rawCapacity,
        promo: o.promoCapacity,
        credit: o.creditCapacity,
      })),
    };
  });

  const compositionScenarios =
    monthlyGenerated === 0
      ? [
          { name: "100% incentivo", promo: currentStock, credit: 0, recoveryMonths: 0 },
          { name: "50/50", promo: currentStock / 2, credit: currentStock / 2, recoveryMonths: null },
          { name: "100% adelanto", promo: 0, credit: currentStock, recoveryMonths: null },
        ]
      : [];

  return {
    name: a.name,
    stock: currentStock,
    creditReported: currentCredit,
    monthlyGenerated,
    dailyDemand: round1(dailyDemand),
    creditScenarios,
    floorScenarios,
    compositionScenarios,
    bestCredit: creditScenarios
      .filter((s) => s.feasible)
      .sort((x, y) => y.credit - x.credit)[0] ?? null,
  };
});

const fungibility = (() => {
  const source = affiliates.find((a) => a.name.includes("626"));
  const target = affiliates.find((a) => a.name.toLowerCase().includes("bull"));
  const reward = source?.monthlyGenerated ?? 0;
  return {
    generatedAt: source?.name ?? "626 Café",
    redeemedAt: target?.name ?? "Bull Box",
    amount: reward,
    note:
      "Una recompensa emitida en 626 puede redimirse en Bull Box. La capacidad se genera en un afiliado y se consume en otro; sin regla de asignación, la exposición queda en la red.",
  };
})();

const report = {
  generatedAt: new Date().toISOString(),
  source: input,
  params: { creditLines: CREDIT_LINES, retentions: RETENTIONS, floors: FLOORS, feasibleMonths: FEASIBLE_MONTHS },
  affiliates,
  fungibility,
};

const out = path.join("DOCS", "data", "mcce-shadow-v2-2026-11-07.json");
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

const lines = [
  `# MCCE · Simulación v2 — ${report.generatedAt}`,
  "",
  `Fuente: ${input}`,
  "",
];
for (const a of affiliates) {
  lines.push(`## ${a.name}`);
  lines.push(`- Capacidad actual: ${a.stock} · adelanto reportado: ${a.creditReported}`);
  lines.push(`- Capacidad generada/mes: ${a.monthlyGenerated} · demanda diaria: ${a.dailyDemand}`);
  lines.push(`- Mejor línea viable (≤ ${FEASIBLE_MONTHS} meses): ${a.bestCredit ? `${a.bestCredit.credit} al ${(a.bestCredit.retainShare * 100).toFixed(0)}% (${a.bestCredit.recoveryMonths} meses)` : "ninguna"}`);
  lines.push("- Líneas y recuperación:");
  for (const s of a.creditScenarios) {
    lines.push(
      `  - ${s.credit} @ ${(s.retainShare * 100).toFixed(0)}% → ${s.recoveryMonths === null ? "n/d" : `${s.recoveryMonths} meses`}${s.feasible ? " ✓" : ""}`
    );
  }
  if (a.compositionScenarios.length) {
    lines.push("- Composición de la capacidad actual:");
    for (const c of a.compositionScenarios) {
      lines.push(`  - ${c.name}: ${c.promo} incentivo + ${c.credit} adelanto`);
    }
  }
  lines.push("");
}
lines.push("## Fungibilidad");
lines.push(
  `${fungibility.note} Emitido en ${fungibility.generatedAt}: ${fungibility.amount} Bunz; redimible en ${fungibility.redeemedAt}.`
);
lines.push("");
lines.push("## Lectura");
lines.push(
  "La línea de capacidad adelantada debe dimensionarse por recuperación real. Con la actividad actual, 3,500 no es viable; las líneas pequeñas sí. Bull Box no debe recibir adelanto sin actividad: su capacidad debe ser incentivo condicionado."
);

console.log(lines.join("\n"));
console.log(`\n→ ${out}`);
