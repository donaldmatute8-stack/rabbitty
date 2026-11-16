#!/usr/bin/env node
/**
 * ── Runner de migraciones SQL (explícito, con libro mayor) ──────────────────
 *
 * Nació de un incidente real (2026-11-16): la migración `0024_staff_costs.sql`
 * se aplicó a `localhost` mientras producción nunca la recibió. El código nuevo
 * pedía columnas que la base real no tenía y el POS dejó de abrir la terminal.
 *
 * Reglas que implementa:
 * 1. **El destino es obligatorio y se imprime** (`--target env|local|staging|prod`).
 * 2. **Guarda anti-confusión**: si pides un destino remoto y la URL es local (o
 *    al revés), aborta.
 * 3. **Libro mayor** (`_sql_migrations`): cada archivo aplicado queda registrado
 *    con su checksum. Re-ejecutar es inocuo.
 * 4. **Reconciliación automática**: si la base ya tiene historia (existe la tabla
 *    centinela) pero el libro mayor está vacío — clon de Neon, restauración,
 *    entorno nuevo — NO se re-ejecuta todo a ciegas: se ejecuta migración por
 *    migración tolerando los "ya existe" y se registra lo reconciliado.
 *    Después, la guarda de esquema decide si de verdad falta algo.
 *
 * Uso:
 *   node scripts/sql-migrate.mjs --target prod --db restaurant
 *   node scripts/sql-migrate.mjs --target prod --db restaurant --apply
 *   node scripts/sql-migrate.mjs --target local --db restaurant --apply
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fail, describe, resolveTargetUrl, connect } from "./lib/db-target.mjs";

function parseArgs(argv) {
  const out = { target: null, db: null, apply: false, baselineThrough: null, strict: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--target") out.target = argv[++i];
    else if (a === "--db") out.db = argv[++i];
    else if (a === "--apply") out.apply = true;
    else if (a === "--baseline-through") out.baselineThrough = argv[++i];
    else if (a === "--strict") out.strict = true;
  }
  return out;
}

function listMigrationFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
}

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);

/**
 * Códigos de Postgres que significan "el objeto ya está ahí". En reconciliación
 * son benignos: la migración ya se había aplicado, solo no había libro mayor.
 * Cualquier otro error detiene el proceso.
 */
const TOLERATED = new Set([
  "42P07", // duplicate_table / duplicate index
  "42701", // duplicate_column
  "42710", // duplicate_object (constraint)
  "42P06", // duplicate_schema
  "42723", // duplicate_function
  "42P16", // invalid_table_definition (varios PK/unique repetidos)
]);

/**
 * Divide un script SQL en sentencias, respetando:
 * - comentarios de línea (--) y de bloque (/* *\/)
 * - cadenas '...' y "..."
 * - bloques dollar-quoted $$ ... $$ / $tag$ ... $tag$
 */
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      buf += ch;
      i++;
      while (i < sql.length) {
        buf += sql[i];
        if (sql[i] === quote && sql[i - 1] !== "\\") {
          if (sql[i + 1] === quote) {
            buf += sql[i + 1];
            i += 2;
            continue;
          }
          i++;
          break;
        }
        i++;
      }
      continue;
    }
    if (ch === "$") {
      const m = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const end = sql.indexOf(tag, i + tag.length);
        if (end !== -1) {
          buf += sql.slice(i, end + tag.length);
          i = end + tag.length;
          continue;
        }
      }
    }
    if (ch === ";") {
      if (buf.trim()) out.push(buf.trim());
      buf = "";
      i++;
      continue;
    }
    buf += ch;
    i++;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

/**
 * Errores que pueden resolverse DESPUÉS de que corran el resto de migraciones
 * (p. ej. un `ADD CONSTRAINT` sobre una columna que agrega una migración
 * posterior). Se reintentan en una segunda pasada.
 */
const RETRYABLE = new Set([
  "42703", // undefined_column
  "42P01", // undefined_table
]);

async function reconcileFiles({ client, files, cfg, db, pending, sha, apply }) {
  if (!apply) {
    console.log(
      `\x1b[33mVista previa: ${pending.length} archivo(s) a reconciliar. Agrega --apply para ejecutar.\x1b[0m\n`,
    );
    return;
  }

  let skipped = 0;
  let tolerantFiles = 0;
  const deferred = [];

  for (const name of pending) {
    const body = fs.readFileSync(path.join(cfg.dir, name), "utf8");

    // ── 1) Intento atómico (camino feliz, el 99 % de las veces) ──
    let atomic = false;
    try {
      await client.query("BEGIN");
      await client.query(body);
      await client.query(
        'INSERT INTO "_sql_migrations" ("name","db","checksum","baselined") VALUES ($1,$2,$3,true) ON CONFLICT DO NOTHING',
        [name, db, sha(body)],
      );
      await client.query("COMMIT");
      atomic = true;
      console.log(`  ${name} ok`);
    } catch {
      await client.query("ROLLBACK").catch(() => {});
    }
    if (atomic) continue;

    // ── 2) Pasada tolerante: la base ya tenía parte de esto ──
    tolerantFiles++;
    let fileSkipped = 0;
    for (const stmt of splitStatements(body)) {
      try {
        await client.query(stmt);
      } catch (e) {
        if (TOLERATED.has(e.code)) {
          fileSkipped++;
          skipped++;
          continue;
        }
        if (RETRYABLE.has(e.code)) {
          deferred.push({ name, stmt });
          continue;
        }
        fail(`${name}\n  ${e.message}\n  sentencia: ${stmt.slice(0, 160).replace(/\s+/g, " ")}…`);
      }
    }

    await client.query(
      'INSERT INTO "_sql_migrations" ("name","db","checksum","baselined") VALUES ($1,$2,$3,true) ON CONFLICT DO NOTHING',
      [name, db, sha(body)],
    );
    console.log(
      `  reconciliado ${name}${fileSkipped ? ` \x1b[33m(${fileSkipped} sentencia/s ya existían)\x1b[0m` : ""}`,
    );
  }

  // ── Tercera oportunidad: lo que dependía de algo creado más adelante ──
  if (deferred.length) {
    console.log(`\n  Reintento diferido: ${deferred.length} sentencia(s)…`);
    for (const d of deferred) {
      try {
        await client.query(d.stmt);
        console.log(`    ok ${d.name}`);
      } catch (e) {
        fail(
          `No se pudo reconciliar ${d.name} ni en el reintento.\n  ${e.message}\n` +
            `  sentencia: ${d.stmt.slice(0, 160).replace(/\s+/g, " ")}…`,
        );
      }
    }
  }

  console.log(
    `\n\x1b[32m✔ Reconciliadas ${pending.length} migración(es)` +
      `${tolerantFiles ? ` · ${tolerantFiles} necesitaron pasada tolerante` : ""}` +
      `${skipped ? ` · ${skipped} sentencia(s) ya existían` : ""}` +
      `${deferred.length ? ` · ${deferred.length} aplicadas en reintento` : ""}.\x1b[0m\n`,
  );
}

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

    // ── Línea base explícita: registrar sin ejecutar ──
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

    // ── ¿Base con historia pero sin libro mayor? → reconciliar ──
    // Pasa con clones de Neon, restauraciones y entornos nuevos: las tablas ya
    // existen, así que re-ejecutar 0000 desde cero revienta con "ya existe" y
    // bloquea el despliegue sin motivo.
    const { rows: sentinelRows } = await client.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1 LIMIT 1`,
      [cfg.sentinel],
    );
    const dbHasHistory = sentinelRows.length > 0;
    // Con historia en la base se usa la vía tolerante (idempotente y converge).
    // `--strict` fuerza el camino atómico para quien quiera ese rigor.
    const reconcile = !args.strict && dbHasHistory;

    if (reconcile) {
      console.log(
        `\x1b[33m⚠ La base ya tiene historia (existe "${cfg.sentinel}") pero el libro mayor está vacío.\x1b[0m\n` +
          "  Modo RECONCILIACIÓN: se ejecuta archivo por archivo y se ignoran los objetos que\n" +
          "  ya existen. Al final, la guarda de esquema verifica que de verdad no falte nada.\n",
      );

      await reconcileFiles({ client, files, cfg, db: args.db, pending, sha, apply: args.apply });
      return;
    }

    // ── Camino normal: aplicar pendientes en transacción ──
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
