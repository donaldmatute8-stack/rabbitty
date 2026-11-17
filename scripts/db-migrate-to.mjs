#!/usr/bin/env node
/**
 * ── Migrar la base a otra instancia (dump → restore → verificación) ────────
 *
 * Sirve para mover el proyecto completo (esquema + datos + libro de migraciones)
 * a un Neon nuevo, conservando la historia: el dump incluye `_sql_migrations`,
 * así que el pre-deploy no intentará repetir migraciones.
 *
 * Uso:
 *   node scripts/db-migrate-to.mjs --from <URL_ORIGEN> --to <URL_DESTINO> --apply
 *
 * Sin `--apply` solo valida el origen y muestra qué haría.
 *
 * Notas:
 * - Se usa `pg_dump -Fc --no-owner --no-privileges`, así que los roles del
 *   cluster viejo no viajan: en el nuevo hay que recrear `rabbitty_app` y sus
 *   GRANTs (ver Docs/PROTECCION-DB-Y-SECRETOS-PLAN.md).
 * - El destino debe estar **vacío**. Si ya tiene tablas, el script se niega.
 */

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fail, describe } from "./lib/db-target.mjs";

function parseArgs(argv) {
  const out = { from: null, to: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from") out.from = argv[++i];
    else if (argv[i] === "--to") out.to = argv[++i];
    else if (argv[i] === "--apply") out.apply = true;
  }
  return out;
}

/** Cuenta tablas de usuario en una base (vía psql, sin dependencias). */
function tableCount(url) {
  const r = spawnSync(
    "psql",
    [url, "-t", "-A", "-c", "select count(*) from information_schema.tables where table_schema='public'"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) {
    fail(`No pude consultar ${describe(url)}:\n${(r.stderr || "").trim().slice(0, 300)}`);
  }
  return Number((r.stdout || "0").trim());
}

function run(cmd, args, label) {
  const r = spawnSync(cmd, args, { stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) fail(`${label} falló (código ${r.status})`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.from || !args.to) fail("Faltan --from y --to");

  console.log(`\nOrigen:  ${describe(args.from)}`);
  console.log(`Destino: ${describe(args.to)}\n`);

  const fromTables = tableCount(args.from);
  const toTables = tableCount(args.to);
  console.log(`tablas en origen:  ${fromTables}`);
  console.log(`tablas en destino: ${toTables}`);

  if (fromTables === 0) fail("El origen no tiene tablas: ¿es la base correcta?");
  if (toTables > 0) {
    fail(
      "El destino YA tiene tablas. Para evitar mezclar datos, vacíalo primero o usa otro proyecto.\n" +
        "Si de verdad quieres sobrescribir, hazlo a mano con respaldo previo.",
    );
  }

  if (!args.apply) {
    console.log("\n\x1b[33mVista previa\x1b[0m: dump del origen y restore en el destino (vacío).");
    console.log("Agrega --apply para ejecutarlo.\n");
    return;
  }

  const dumpPath = path.join(os.tmpdir(), `rabbitty-migracion-${Date.now()}.dump`);

  console.log("\n1) pg_dump del origen…");
  run(
    "pg_dump",
    ["-Fc", "--no-owner", "--no-privileges", "-f", dumpPath, args.from],
    "pg_dump",
  );
  const size = fs.statSync(dumpPath).size;
  if (size < 5 * 1024) fail(`Dump sospechosamente pequeño (${size} bytes)`);
  console.log(`   ${(size / 1024 / 1024).toFixed(2)} MB → ${dumpPath}`);

  console.log("\n2) pg_restore en el destino…");
  run("pg_restore", ["--no-owner", "--no-privileges", "-d", args.to, dumpPath], "pg_restore");

  const after = tableCount(args.to);
  console.log(`\n3) Verificación: ${after} tablas en el destino (origen: ${fromTables})`);
  if (after < fromTables) fail(`Faltan tablas en el destino (${after} < ${fromTables})`);

  console.log(
    "\n\x1b[32m✔ Base migrada.\x1b[0m\n" +
      "Ahora:\n" +
      "  · recrea el rol de aplicación y sus GRANTs en el proyecto nuevo\n" +
      "    (node scripts/rotate-app-role.mjs hace ping-pong de contraseña, no crea desde cero)\n" +
      "  · cambia las variables (scripts/db-switch-env.mjs)\n" +
      "  · verifica: curl 'https://admin.rabbitty.me/api/health?strict=1'\n",
  );
}

main().catch((e) => fail(e.stack || e.message));
