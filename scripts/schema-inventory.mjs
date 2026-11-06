#!/usr/bin/env node
/**
 * Extrae el esquema desde el código (Drizzle) y verifica el SQL read-only
 * contra él. Sin DB, sin red.
 *
 *   node scripts/schema-inventory.mjs --out DOCS/data/schema-inventory.json
 *   node scripts/schema-inventory.mjs --check-sql DOCS/BUNZ-CAPTURA-READONLY.sql
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const SCHEMA_FILES = [
  "packages/database-core/src/schema/index.ts",
  "packages/database-restaurant/src/schema/index.ts",
];

function matchBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return text.length;
}

const INVENTORY_JSON = fileURLToPath(new URL("../DOCS/data/schema-inventory.json", import.meta.url));

export function extractSchema(files = SCHEMA_FILES) {
  // Si el código fuente no está al lado (p. ej. dentro del bundle), se usa el
  // inventario ya generado. El inventario ES el artefacto.
  const present = files.filter((f) => fs.existsSync(f));
  if (!present.length && fs.existsSync(INVENTORY_JSON)) {
    const inv = JSON.parse(fs.readFileSync(INVENTORY_JSON, "utf8"));
    return Object.fromEntries(
      Object.entries(inv.tables).map(([name, cols]) => [
        name,
        { source: "inventory", columns: Object.fromEntries(Object.entries(cols).map(([c, t]) => [c, { type: t }])) },
      ])
    );
  }
  const tables = {};
  for (const file of present) {
    const text = fs.readFileSync(file, "utf8");
    const re = /export const \w+ = pgTable\("([^"]+)",\s*\{/g;
    let m;
    while ((m = re.exec(text))) {
      const name = m[1];
      const open = text.indexOf("{", m.index + m[0].length - 1);
      const close = matchBrace(text, open);
      const body = text.slice(open + 1, close);
      const columns = {};

      if (/\.\.\.timestamps/.test(body)) {
        columns.createdAt = { type: "timestamp" };
        columns.updatedAt = { type: "timestamp" };
      }
      const colRe = /^\s{2}([A-Za-z0-9_]+):\s*([A-Za-z0-9_]+)\("([^"]+)"/gm;
      let c;
      while ((c = colRe.exec(body))) {
        columns[c[3]] = { type: c[2] };
      }
      const idRe = /^\s{2}id:\s*id\(\)/m;
      if (idRe.test(body)) columns.id = { type: "id" };

      tables[name] = { source: file, columns };
    }
  }
  return tables;
}

/** Resuelve alias → tabla y comprueba cada `alias."columna"`. */
export function checkSql(sqlText, tables) {
  const aliases = new Map();
  const refRe = /(?:FROM|JOIN)\s+"([^"]+)"(?:\s+(?:AS\s+)?([A-Za-z_][A-Za-z0-9_]*))?/gi;
  let r;
  while ((r = refRe.exec(sqlText))) {
    const table = r[1];
    const alias = r[2] && !/^(WHERE|LEFT|JOIN|ON|GROUP|ORDER|LIMIT|WINDOW)$/i.test(r[2]) ? r[2] : table;
    aliases.set(alias, table);
    aliases.set(table, table);
  }

  const problems = [];
  const checked = [];
  const colRe = /([A-Za-z_][A-Za-z0-9_]*)\."([^"]+)"/g;
  let c;
  while ((c = colRe.exec(sqlText))) {
    const [, alias, column] = c;
    const table = aliases.get(alias);
    if (!table) continue; // CTE o alias no resuelto: no se valida
    if (!tables[table]) {
      problems.push(`tabla '${table}' (alias ${alias}) no existe en el esquema`);
      continue;
    }
    if (!tables[table].columns[column]) {
      problems.push(`${table}.${column} no existe`);
    } else {
      checked.push(`${table}.${column}`);
    }
  }
  return { checked, problems };
}

const isDirectRun = process.argv[1] && process.argv[1].endsWith("schema-inventory.mjs");
if (isDirectRun) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf("--out");
  const sqlIdx = args.indexOf("--check-sql");
  const tables = extractSchema();

  if (outIdx >= 0) {
    const out = args[outIdx + 1];
    const payload = {
      generated_from: SCHEMA_FILES,
      tables: Object.fromEntries(
        Object.entries(tables).map(([name, t]) => [
          name,
          Object.fromEntries(Object.entries(t.columns).map(([c, d]) => [c, d.type])),
        ])
      ),
      counts: { tables: Object.keys(tables).length, columns: Object.values(tables).reduce((a, t) => a + Object.keys(t.columns).length, 0) },
    };
    fs.writeFileSync(out, JSON.stringify(payload, null, 2) + "\n");
    console.log(`esquema: ${payload.counts.tables} tablas, ${payload.counts.columns} columnas → ${out}`);
  }

  if (sqlIdx >= 0) {
    const file = args[sqlIdx + 1];
    const { checked, problems } = checkSql(fs.readFileSync(file, "utf8"), tables);
    console.log(`\nSQL ${file}`);
    console.log(`  columnas verificadas: ${checked.length}`);
    if (problems.length) {
      console.log(`  problemas: ${problems.length}`);
      for (const p of [...new Set(problems)]) console.log(`    ✗ ${p}`);
      process.exit(1);
    }
    console.log("  ✓ todas las columnas cualificadas existen en el esquema");
  }
}
