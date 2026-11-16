#!/usr/bin/env node
/**
 * ── Pre-deploy: migrar y verificar antes de arrancar el contenedor ─────────
 *
 * Corre en Railway como `preDeployCommand`. Si falla, el despliegue **no
 * procede** y producción sigue sirviendo la versión anterior.
 *
 * Secuencia por base:
 *   1. Aplicar migraciones pendientes (`_sql_migrations` como libro mayor).
 *   2. Verificar que el esquema del código exista en la base (guarda).
 *
 * Notas de seguridad:
 * - Solo actúa para el servicio `rabbitty-admin`; en los demás sale con 0 para
 *   no estorbar despliegues que no tocan las bases.
 * - Si las URLs no están en el entorno del servicio admin, **falla**: desplegar
 *   código nuevo sin poder migrar es exactamente lo que rompió producción el
 *   2026-11-16.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";
import { ROOT, DBS, warn } from "./lib/db-target.mjs";

const SERVICE = process.env.RAILWAY_SERVICE_NAME || "";
const IS_ADMIN = SERVICE === "rabbitty-admin" || SERVICE === "rabbitty-admin-staging" || SERVICE === "";
// SERVICE === "" → corrida local/manual: también queremos la protección.

function run(args) {
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: "inherit" });
    return true;
  } catch {
    return false;
  }
}

function main() {
  if (!IS_ADMIN) {
    console.log(`[predeploy] ${SERVICE}: no es admin, no toco base de datos.`);
    return;
  }

  const available = Object.entries(DBS).filter(([, cfg]) => Boolean(process.env[cfg.urlVar]));

  if (available.length === 0) {
    console.error(
      "[predeploy] ✖ Ni RESTAURANT_DATABASE_URL ni CORE_DATABASE_URL están en el entorno de este servicio.\n" +
        "            Desplegar sin poder migrar/verificar fue la causa del incidente del 2026-11-16.\n" +
        "            Revisa las variables del servicio antes de reintentar.",
    );
    process.exit(1);
  }

  for (const [db, cfg] of Object.entries(DBS)) {
    if (!process.env[cfg.urlVar]) {
      warn(`[predeploy] ${cfg.urlVar} ausente: se omite la base "${db}".`);
      continue;
    }

    console.log(`\n[predeploy] ── ${db} ─────────────────────────────────────────`);
    if (!run([path.join(ROOT, "scripts/sql-migrate.mjs"), "--target", "env", "--db", db, "--apply"])) {
      console.error(`[predeploy] ✖ Fallaron las migraciones de "${db}". Despliegue detenido.`);
      process.exit(1);
    }
    if (!run([path.join(ROOT, "scripts/schema-guard.mjs"), "--target", "env", "--db", db])) {
      console.error(`[predeploy] ✖ El esquema de "${db}" no coincide con el código. Despliegue detenido.`);
      process.exit(1);
    }
  }

  console.log("\n[predeploy] ✔ Bases migradas y esquema verificado.\n");
}

main();
