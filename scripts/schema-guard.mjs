#!/usr/bin/env node
/**
 * ── Guarda de esquema: el código y la base deben coincidir ─────────────────
 *
 * Incidente que la originó (2026-11-16): se agregaron `hourlyRate` y
 * `commissionPct` al esquema de `staff` y se desplegó el código, pero la
 * migración se aplicó a la base local. En producción cada `select` sobre
 * `staff` reventó y el POS dejó de abrir la terminal.
 *
 * Esta guarda lee el esquema real de Drizzle (no una copia) y lo compara contra
 * `information_schema`. Si el código pide tablas o columnas que la base no
 * tiene, **sale con código 1**. En Railway eso corre como pre-deploy: un
 * desajuste **detiene el despliegue** y producción sigue con la versión
 * anterior, en lugar de romperse.
 *
 * Uso:
 *   node scripts/schema-guard.mjs --target prod --db restaurant
 *   node scripts/schema-guard.mjs --target local --db restaurant
 *   node scripts/schema-guard.mjs --target env --db restaurant --soft   (solo avisa)
 */

import fs from "node:fs";
import { fail, warn, describe, resolveTargetUrl, connect, DBS } from "./lib/db-target.mjs";

function parseArgs(argv) {
  const out = { target: null, db: null, soft: false, all: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") out.target = argv[++i];
    else if (a === "--db") out.db = argv[++i];
    else if (a === "--soft") out.soft = true;
    else if (a === "--all") out.all = true;
  }
  return out;
}

/** Lee un objeto `{ ... }` balanceado desde `start` (índice justo después de `{`). */
function readObject(src, start) {
  let depth = 1;
  let i = start;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const quote = ch;
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") i++;
        i++;
      }
    } else if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
    } else if (ch === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i++;
    } else if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  return src.slice(start, i - 1);
}

// Helpers del esquema que expanden a varias columnas.
const SPREADS = { timestamps: ["createdAt", "updatedAt"] };
// Helpers con firma sin nombre de columna (el nombre ES la columna).
const NO_ARG_HELPERS = new Set(["id"]);

function extractTables(src) {
  const tables = new Map();
  const unknownSpreads = new Set();
  const re = /pgTable\(\s*"([^"]+)"\s*,\s*\{/g;
  let m;
  while ((m = re.exec(src))) {
    const table = m[1];
    const body = readObject(src, re.lastIndex);
    const cols = new Set();

    const colRe = /([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_.]+)\s*\(\s*(?:"([^"]*)")?/g;
    let c;
    while ((c = colRe.exec(body))) {
      const [, , fn, name] = c;
      if (name) cols.add(name);
      else if (NO_ARG_HELPERS.has(fn)) cols.add(fn);
    }

    const spreadRe = /\.\.\.\s*([A-Za-z0-9_]+)/g;
    let s;
    while ((s = spreadRe.exec(body))) {
      const key = s[1];
      const expanded = SPREADS[key];
      if (expanded) expanded.forEach((x) => cols.add(x));
      else unknownSpreads.add(key);
    }

    if (cols.size) tables.set(table, cols);
  }
  return { tables, unknownSpreads };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dbs = args.all ? Object.keys(DBS) : [args.db || "restaurant"];

  let problems = 0;

  for (const db of dbs) {
    const { url, cfg } = resolveTargetUrl({ target: args.target, db });
    if (!fs.existsSync(cfg.schemaFile)) fail(`No existe el esquema: ${cfg.schemaFile}`);

    const src = fs.readFileSync(cfg.schemaFile, "utf8");
    const { tables, unknownSpreads } = extractTables(src);
    if (tables.size === 0) fail(`No pude leer tablas de ${cfg.schemaFile}`);

    const client = await connect(url);
    try {
      const { rows } = await client.query(
        `SELECT table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'`,
      );
      const actual = new Map();
      for (const r of rows) {
        if (!actual.has(r.table_name)) actual.set(r.table_name, new Set());
        actual.get(r.table_name).add(r.column_name);
      }

      const missingTables = [];
      const missingCols = [];

      for (const [table, cols] of tables) {
        const have = actual.get(table);
        if (!have) {
          missingTables.push(table);
          continue;
        }
        const missing = [...cols].filter((c) => !have.has(c));
        if (missing.length) missingCols.push({ table, missing });
      }

      const total = missingTables.length + missingCols.length;
      console.log(`\n\x1b[1mEsquema vs base\x1b[0m · ${db} → ${describe(url)}`);
      console.log(`  tablas en el código: ${tables.size} · tablas en la base: ${actual.size}`);

      if (total === 0) {
        console.log("  \x1b[32m✔ Sin desajustes\x1b[0m\n");
        continue;
      }

      problems += total;
      if (missingTables.length) {
        console.log(`  \x1b[31m✖ ${missingTables.length} tabla(s) que el código usa y la base no tiene:\x1b[0m`);
        missingTables.slice(0, 25).forEach((t) => console.log(`     · ${t}`));
      }
      if (missingCols.length) {
        console.log(`  \x1b[31m✖ ${missingCols.length} tabla(s) con columnas faltantes:\x1b[0m`);
        for (const { table, missing } of missingCols.slice(0, 25)) {
          console.log(`     · ${table}: ${missing.join(", ")}`);
        }
      }
      console.log("");
    } finally {
      await client.end();
    }

    if (unknownSpreads.size) {
      warn(`spreads no expandidos (no se validaron): ${[...unknownSpreads].join(", ")}`);
    }
  }

  if (problems === 0) return;

  const hint =
    "Aplica la migración que falta: node scripts/sql-migrate.mjs --target <local|prod> --db <restaurant|core> --apply";
  if (args.soft) {
    warn(`Desajuste de esquema (modo suave, no bloquea). ${hint}`);
    return;
  }
  fail(`Desajuste de esquema: el código pide cosas que la base no tiene. ${hint}`);
}

main().catch((e) => fail(e.stack || e.message));
