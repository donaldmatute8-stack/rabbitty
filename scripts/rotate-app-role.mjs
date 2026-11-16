#!/usr/bin/env node
/**
 * ── Rotación de la credencial de la aplicación (sin caída) ──────────────────
 *
 * Contexto: la app usa `rabbitty_app` (solo DML) y las migraciones usan el rol
 * dueño (`MIGRATE_*`). Esta herramienta rota SOLO la credencial de la app.
 *
 * Por qué ping-pong y no "cambiar la contraseña y ya":
 *   Postgres permite UNA contraseña por rol. Si cambias la del rol que la app
 *   está usando, toda conexión nueva falla hasta que el despliegue propague la
 *   variable nueva (minutos de errores). Por eso se mantienen DOS roles gemelos
 *   (`rabbitty_app_a` / `rabbitty_app_b`) con los mismos permisos:
 *
 *     1. Se resetea la contraseña del rol INACTIVO (nadie lo usa → riesgo 0)
 *     2. Se verifica esa credencial antes de publicarla
 *     3. Se publica en Railway (un solo cambio de variables)
 *     4. Se espera el rollout y se comprueba /api/health?strict=1
 *     5. El rol anterior sigue válido 72 h: volver atrás es republicar su URL
 *     6. Pasado ese plazo, la siguiente rotación lo reutiliza (y así alternan)
 *
 * Uso:
 *   node scripts/rotate-app-role.mjs --target prod                 # dry-run
 *   node scripts/rotate-app-role.mjs --target prod --apply         # ejecuta
 */

import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import { ROOT, fail, describe } from "./lib/db-target.mjs";

const PAIR = ["rabbitty_app", "rabbitty_app_b"];

function parseArgs(argv) {
  const out = { target: null, apply: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--target") out.target = argv[++i];
    else if (argv[i] === "--apply") out.apply = true;
  }
  return out;
}

function railwayVars(env) {
  const raw = execFileSync(
    "railway",
    ["variables", "--service", "rabbitty-admin", "--environment", env, "--json"],
    { cwd: ROOT, encoding: "utf8" },
  );
  return JSON.parse(raw);
}

function parseUrl(url) {
  const u = new URL(url);
  return { user: decodeURIComponent(u.username), pass: decodeURIComponent(u.password), host: u.host, path: u.pathname };
}

const buildUrl = (role, pass, host, path) => `postgresql://${role}:${pass}@${host}${path}?sslmode=require`;

async function pg(url) {
  const { Client } = await import("pg");
  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  return client;
}

async function setRailwayVars(env, vars) {
  const args = ["variables", "--service", "rabbitty-admin", "--environment", env];
  for (const [k, v] of Object.entries(vars)) args.push("--set", `${k}=${v}`);
  execFileSync("railway", args, { cwd: ROOT, stdio: "inherit" });
}

async function waitHealthy(minutes = 8) {
  const deadline = Date.now() + minutes * 60_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch("https://admin.rabbitty.me/api/health?strict=1");
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.status === "ok") return true;
    } catch {
      /* rollout en curso */
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return false;
}

async function recordRotation(ownerUrl, row) {
  const client = await pg(ownerUrl);
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "_secret_rotations" (
        "id" text PRIMARY KEY,
        "fromRole" text,
        "toRole" text NOT NULL,
        "target" text NOT NULL,
        "appliedAt" timestamptz NOT NULL DEFAULT now(),
        "healthOk" boolean NOT NULL DEFAULT false,
        "notes" text
      )`);
    await client.query(
      'INSERT INTO "_secret_rotations" ("id","fromRole","toRole","target","healthOk","notes") VALUES ($1,$2,$3,$4,$5,$6)',
      [crypto.randomUUID(), row.from, row.to, row.target, row.healthOk, row.notes ?? null],
    );
  } finally {
    await client.end();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.target) fail("Falta --target prod|staging");

  const env = args.target === "prod" ? "production" : "staging";
  const vars = railwayVars(env);
  const appUrl = vars.RESTAURANT_DATABASE_URL;
  const ownerUrl = vars.MIGRATE_RESTAURANT_DATABASE_URL || vars.RESTAURANT_DATABASE_URL;

  if (!appUrl || !ownerUrl) fail("Faltan variables de base de datos en Railway");
  if (appUrl === ownerUrl) {
    fail(
      "La app y las migraciones usan la MISMA credencial: falta separar roles (MIGRATE_*).\n" +
        "Rotar así reiniciaría la credencial del rol dueño.",
    );
  }

  const current = parseUrl(appUrl);
  if (!PAIR.includes(current.user)) {
    fail(
      `La app no está usando un rol del par ${PAIR.join(" / ")} (usa "${current.user}").\n` +
        "Primero migra a rabbitty_app_a (ver Docs/PROTECCION-DB-Y-SECRETOS-PLAN.md §3.4).",
    );
  }

  const nextRole = PAIR.find((r) => r !== current.user);
  const newPass = crypto.randomBytes(24).toString("hex");
  const newUrl = buildUrl(nextRole, newPass, current.host, current.path);

  console.log(`\n\x1b[1mRotación de credencial de aplicación\x1b[0m`);
  console.log(`  entorno: ${env} (${describe(appUrl)})`);
  console.log(`  rol actual:  ${current.user}`);
  console.log(`  rol destino: ${nextRole}`);
  console.log(`  migraciones: ${ownerUrl === vars.RESTAURANT_DATABASE_URL ? "MISMA credencial ⚠" : "rol separado ✔"}\n`);

  if (!args.apply) {
    console.log("  Plan (dry-run, no se toca nada):");
    console.log(`   1) crear/reutilizar el rol ${nextRole} y resetear su contraseña`);
    console.log(`   2) verificar esa credencial (conexión + lectura de tablas de negocio)`);
    console.log(`   3) publicar RESTAURANT_DATABASE_URL y CORE_DATABASE_URL en Railway (${env})`);
    console.log(`   4) esperar rollout y comprobar /api/health?strict=1`);
    console.log(`   5) dejar ${current.user} válido 72 h (rollback = republicar su URL)`);
    console.log(
      `\n\x1b[33mDRY-RUN\x1b[0m: nada ejecutado.\n` +
        `Para ejecutar: node scripts/rotate-app-role.mjs --target ${args.target} --apply\n`,
    );
    return;
  }

  // ── 1) Preparar el rol destino (inactivo: resetear su contraseña no afecta a nadie) ──
  const admin = await pg(ownerUrl);
  try {
    const dbName = current.path.replace(/^\//, "");
    await admin.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${nextRole}') THEN
          CREATE ROLE ${nextRole} LOGIN;
        END IF;
      END
      $$;`);
    await admin.query(`ALTER ROLE ${nextRole} WITH LOGIN PASSWORD '${newPass}'`);
    await admin.query(`GRANT CONNECT ON DATABASE "${dbName}" TO ${nextRole}`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO ${nextRole}`);
    await admin.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${nextRole}`);
    await admin.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${nextRole}`);
    await admin.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${nextRole}`,
    );
    await admin.query(
      `ALTER DEFAULT PRIVILEGES FOR ROLE neondb_owner IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${nextRole}`,
    );
    console.log(`  1) rol ${nextRole} preparado y con GRANTs`);
  } finally {
    await admin.end();
  }

  // ── 2) Verificar la credencial nueva ANTES de publicarla ──
  const probe = await pg(newUrl);
  try {
    const r = await probe.query('select (select count(*) from "branches") as sucursales');
    console.log(`  2) credencial nueva verificada (lectura): ${r.rows[0].sucursales} sucursales`);
    await probe.query('select 1 from "orders" where false');
    console.log(`  2) privilegios de lectura sobre tablas de negocio: ok`);
  } finally {
    await probe.end();
  }

  // ── 3) Publicar (un solo cambio de variables → un solo rollout) ──
  await setRailwayVars(env, {
    RESTAURANT_DATABASE_URL: newUrl,
    CORE_DATABASE_URL: newUrl,
  });
  console.log(`  3) variables publicadas (app → ${nextRole})`);

  // ── 4) Verificar que el servicio quedó sano ──
  const healthy = await waitHealthy();
  if (!healthy) {
    console.error(
      "\n\x1b[31m✖ El servicio no reportó sano. ROLLBACK:\x1b[0m\n" +
        `   vuelve a publicar la URL anterior:\n` +
        `   railway variables --service rabbitty-admin --environment ${env} --set "RESTAURANT_DATABASE_URL=${appUrl}" --set "CORE_DATABASE_URL=${appUrl}"\n` +
        `   (la credencial de ${current.user} sigue activa: por eso no se revoca en la misma corrida)`,
    );
    await recordRotation(ownerUrl, { from: current.user, to: nextRole, target: env, healthOk: false, notes: "rollback sugerido" }).catch(() => {});
    process.exit(1);
  }
  console.log(`  4) /api/health?strict=1 → ok`);

  await recordRotation(ownerUrl, { from: current.user, to: nextRole, target: env, healthOk: true }).catch(() => {});

  console.log(`\n\x1b[32m✔ Rotación completada.\x1b[0m`);
  console.log(`  activo:  ${nextRole}`);
  console.log(`  en espera (revocar en 72 h o reutilizar en la próxima rotación): ${current.user}\n`);
}

main().catch((e) => fail(e.stack || e.message));
