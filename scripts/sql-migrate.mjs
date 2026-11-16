#!/usr/bin/env node
/**
 * ── Runner de migraciones SQL (explícito, con libro mayor) ──────────────────
 *
 * Nació de un incidente real (2026-11-16): la migración `0024_staff_costs.sql`
 * se aplicó a `localhost` mientras producción nunca la recibió. El código nuevo
 * pedía columnas que la base real no tenía y el POS dejó de abrir la terminal.
 *
 * Reglas que implementa:
 * 1. **El destino es obligatorio y se imprime** (`--target env|local|prod`).
 * 2. **Guarda anti-confusión**: si pides un destino remoto y la URL es local (o
 *    al revés), aborta. Ya no se puede aplicar "sin querer" al destino equivocado.
 * 3. **Libro mayor** (`_sql_migrations`): cada archivo aplicado queda registrado
 *    con su checksum. Re-ejecutar es inocuo.
 * 4. **Línea base** (`--baseline-through`): marca lo ya aplicado a mano sin
 *    ejecutarlo, para arrancar el libro mayor sin repetir historia.
 *
 * Uso:
 *   node scripts/sql-migrate.mjs --target prod --db restaurant
 *   node scripts/sql-migrate.mjs --target prod --db restaurant --apply
 *   node scripts/sql-migrate.mjs --target prod --db restaurant --baseline-through 0024_staff_costs.sql
 *   node scripts/sql-migrate.mjs --target local --db restaurant --apply
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fail, describe, resolveTargetUrl, connect } from "./lib/db-target.mjs";

function parseArgs(argv) {
  const out = { target: null, db: null, apply: false, baselineThrough: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") out.target = argv[++i];
    else if (a === "--db") out.db = argv[++i];
    else if (a === "--apply") out.apply = true;
    else if (a === "--baseline-through") out.baselineThrough = argv[++i];
  }
  return out;
}

function listMigrationFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.db) fail("Falta --db restaurant|core");

  const { url, cfg } = resolveTargetUrl({ target: args.target, db: args.db });
  const files = listMigrationFiles(cfg.dir);
  if (files.length === 0) fail(`Sin migraciones en ${cfg.dir}`);

  const client = await connect(url);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_sql_migrations" (
        "name" text PRIMARY KEY,
        "db" text NOT NULL,
        "checksum" text NOT NULL,
        "appliedAt" timestamptz NOT NULL DEFAULT now(),
        "baselined" boolean NOT NULL DEFAULT false
      )
    `);

    const { rows } = await client.query('SELECT "name", "checksum" FROM "_sql_migrations" WHERE "db" = $1', [args.db]);
    const applied = new Map(rows.map((r) => [r.name, r.checksum]));

    console.log(`\n\x1b[1mDestino:\x1b[0m ${args.target} → ${describe(url)}`);
    console.log(
      `\x1b[1mBase:\x1b[0m ${args.db}  ·  \x1b[1mArchivos:\x1b[0m ${files.length}  ·  \x1b[1mEn libro mayor:\x1b[0m ${applied.size}\n`,
    );

    // ── Línea base: registrar lo ya aplicado a mano, sin ejecutar ──
    if (args.baselineThrough) {
      const idx = files.indexOf(args.baselineThrough);
      if (idx === -1) fail(`--baseline-through "${args.baselineThrough}" no coincide con ningún archivo`);
      const toMark = files.slice(0, idx + 1).filter((f) => !applied.has(f));
      if (toMark.length) {
        console.log(`Línea base hasta ${args.baselineThrough}:`);
        for (const name of toMark) {
          const body = fs.readFileSync(path.join(cfg.dir, name), "utf8");
          await client.query(
            'INSERT INTO "_sql_migrations" ("name","db","checksum","baselined") VALUES ($1,$2,$3,true) ON CONFLICT DO NOTHING',
            [name, args.db, sha(body)],
          );
          applied.set(name, sha(body));
          console.log(`  · ${name}`);
        }
        console.log("");
      }
    }

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log("\x1b[32m✔ Nada pendiente. La base está al día.\x1b[0m\n");
      return;
    }

    console.log(`Pendientes (${pending.length}):`);
    for (const f of pending) console.log(`  → ${f}`);

    if (!args.apply) {
      console.log("\n\x1b[33mVista previa. Agrega --apply para ejecutar.\x1b[0m\n");
      return;
    }

    console.log("");
    for (const name of pending) {
      const body = fs.readFileSync(path.join(cfg.dir, name), "utf8");
      process.stdout.write(`Aplicando ${name} … `);
      try {
        await client.query("BEGIN");
        await client.query(body);
        await client.query('INSERT INTO "_sql_migrations" ("name","db","checksum") VALUES ($1,$2,$3)', [
          name,
          args.db,
          sha(body),
        ]);
        await client.query("COMMIT");
        console.log("\x1b[32mok\x1b[0m");
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {});
        console.log("\x1b[31mfalló\x1b[0m");
        fail(`${name}: ${e.message}`);
      }
    }
    console.log(`\n\x1b[32m✔ Aplicadas ${pending.length} migración(es) en ${describe(url)}\x1b[0m\n`);
  } finally {
    await client.end();
  }
}

main().catch((e) => fail(e.stack || e.message));
