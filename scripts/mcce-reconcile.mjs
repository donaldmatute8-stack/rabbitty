#!/usr/bin/env node
/**
 * MCCE · Reconciliación de composición (solo lectura)
 *
 * No escribe ni reclasifica. Propone una lectura de cada afiliado:
 *   - qué parte del stock podría ser capacidad adelantada
 *   - qué parte podría ser generada
 *   - qué señales impiden afirmarlo
 *
 * La reclasificación real requiere aprobación y asiento contable.
 */

import fs from "node:fs";
import path from "node:path";

const input =
  process.argv.find((a) => a.startsWith("--input="))?.split("=")[1] ||
  path.join("DOCS", "data", "mcce-shadow-2026-11-07.json");

if (!fs.existsSync(input)) {
  console.error(`No existe ${input}. Corre primero scripts/mcce-shadow.mjs.`);
  process.exit(1);
}

const v1 = JSON.parse(fs.readFileSync(input, "utf8"));

const rows = v1.affiliates.map((a) => {
  const stock = Number(a.current.bunzBalance) || 0;
  const creditLimit = Number(a.current.creditLimit) || 0;
  const creditUsed = Number(a.current.creditUsed) || 0;
  const packageLabel = a.package || null;

  const advanceHypothesis = Math.min(creditLimit, stock);
  const generatedHypothesis = Math.max(0, stock - advanceHypothesis);

  const issues = [];
  let confidence = "baja";

  if (creditLimit > 0 && creditUsed === 0) {
    issues.push("creditUsed=0 con creditLimit>0: no hay registro de la parte usada");
  }
  if (creditLimit === 0 && stock > 0) {
    issues.push("sin línea de capacidad: el stock no tiene origen de adelanto registrado");
    confidence = "media";
  }
  if (creditLimit > 0 && stock === creditLimit) {
    issues.push("stock igual a la línea: probablemente todo es adelanto");
    confidence = "media";
  }
  if (creditLimit > 0 && stock > creditLimit) {
    issues.push("stock por encima de la línea: hay capacidad generada o ajustes manuales");
    confidence = confidence === "media" ? "media" : "baja";
  }
  if (creditLimit > 0 && stock < creditLimit) {
    issues.push("stock por debajo de la línea: parte de la línea no está provisionada");
  }
  if (!packageLabel) {
    issues.push("package vacío: no hay etiqueta comercial que ayude a interpretar");
  }
  if (a.activity.rewards === 0 && stock > 0) {
    issues.push("sin recompensas en la ventana: no se puede atribuir el stock a actividad");
    confidence = "baja";
  }
  if (creditUsed > 0) confidence = "alta";

  return {
    name: a.name,
    stock,
    creditLimit,
    creditUsed,
    packageLabel,
    advanceHypothesis,
    generatedHypothesis,
    confidence,
    issues,
    recommended:
      creditLimit > 0
        ? `Lectura propuesta: ${advanceHypothesis} de capacidad adelantada + ${generatedHypothesis} generada. Requiere confirmación y asiento antes de migrar.`
        : `Sin línea de capacidad: ${stock} de capacidad generada/manual. Revisar origen antes de migrar.`,
  };
});

const report = {
  generatedAt: new Date().toISOString(),
  source: input,
  note: "Reconciliación propuesta. No modifica datos ni reclasifica capacidad.",
  rows,
};

const out = path.join("DOCS", "data", "mcce-reconciliacion-2026-11-07.json");
fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

const lines = [
  `# MCCE · Reconciliación de composición — ${report.generatedAt}`,
  "",
  `Fuente: ${input}`,
  "",
  "| Afiliado | Stock | Línea | Usado | ¿Adelanto? | ¿Generado? | Confianza |",
  "|---|---:|---:|---:|---:|---:|---|",
  ...rows.map(
    (r) =>
      `| ${r.name} | ${r.stock} | ${r.creditLimit} | ${r.creditUsed} | ${r.advanceHypothesis} | ${r.generatedHypothesis} | ${r.confidence} |`
  ),
  "",
];
for (const r of rows) {
  lines.push(`## ${r.name}`);
  lines.push(`- Etiqueta: ${r.packageLabel ?? "—"}`);
  lines.push(`- Lectura: ${r.recommended}`);
  if (r.issues.length) lines.push(`- Señales: ${r.issues.join(" · ")}`);
  lines.push("");
}
lines.push("## Regla");
lines.push(
  "Ninguna cifra de esta reconciliación es una reclasificación. La composición real se confirma con el afiliado, el contrato y el asiento contable."
);

console.log(lines.join("\n"));
console.log(`\n→ ${out}`);
