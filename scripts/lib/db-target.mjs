/**
 * Resolución de destino de base de datos, compartida por las herramientas de
 * esquema (`sql-migrate.mjs`, `schema-guard.mjs`).
 *
 * El objetivo es que **nunca** se pueda confundir producción con local: el
 * destino se pide explícitamente, se imprime, y se valida contra la URL.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const DBS = {
  restaurant: {
    urlVar: "RESTAURANT_DATABASE_URL",
    dir: path.join(ROOT, "packages/database-restaurant/migrations"),
    schemaFile: path.join(ROOT, "packages/database-restaurant/src/schema/index.ts"),
    // Tabla centinela: si existe, la base ya tiene historia (no es una base nueva).
    sentinel: "branches",
  },
  core: {
    urlVar: "CORE_DATABASE_URL",
    dir: path.join(ROOT, "packages/database-core/migrations"),
    schemaFile: path.join(ROOT, "packages/database-core/src/schema/index.ts"),
    sentinel: "users",
  },
};

export function fail(msg) {
  console.error(`\x1b[31m✖ ${msg}\x1b[0m`);
  process.exit(1);
}

export function warn(msg) {
  console.error(`\x1b[33m⚠ ${msg}\x1b[0m`);
}

export function describe(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
  } catch {
    return "(url inválida)";
  }
}

export function isLocalHost(host) {
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".local");
}

function readEnvLocal(varName) {
  const file = path.join(ROOT, "apps/admin/.env.local");
  if (!fs.existsSync(file)) fail(`No existe ${file} para --target local`);
  const line = fs
    .readFileSync(file, "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${varName}=`));
  if (!line) fail(`${varName} no está en apps/admin/.env.local`);
  return line.slice(varName.length + 1).trim().replace(/^["']|["']$/g, "");
}

function readRailwayVars(environment = "production") {
  try {
    const raw = execSync(
      `railway variables --service rabbitty-admin --environment ${environment} --json`,
      { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    return JSON.parse(raw);
  } catch {
    fail(`No pude leer variables de Railway (${environment}). Autentica el CLI o usa --target env.`);
  }
}

/**
 * Resuelve la URL y aplica la guarda anti-confusión:
 * - `local` exige host local.
 * - `prod`/`staging`/`env` exigen host NO local.
 */
export function resolveTargetUrl({ target, db }) {
  const cfg = DBS[db];
  if (!cfg) fail(`--db inválido: ${db}`);

  let url;
  if (target === "env") {
    // En el pre-deploy las migraciones necesitan DDL, y el runtime ya no corre
    // con el rol dueño. `MIGRATE_<VAR>` es la credencial de migraciones; si no
    // existe se cae a la de la app (comportamiento anterior).
    const migrateVar = `MIGRATE_${cfg.urlVar}`;
    url = process.env[migrateVar] || process.env[cfg.urlVar];
    if (!url) fail(`${migrateVar} / ${cfg.urlVar} no están en el entorno`);
  } else if (target === "local") {
    url = readEnvLocal(cfg.urlVar);
  } else if (target === "prod" || target === "staging") {
    const env = target === "prod" ? "production" : "staging";
    const vars = readRailwayVars(env);
    // Las migraciones necesitan DDL: el runtime usa un rol restringido, así que
    // se prefiere la credencial de migraciones si existe.
    const migrateVar = `MIGRATE_${cfg.urlVar}`;
    url = vars[migrateVar] || vars[cfg.urlVar];
    if (!url) fail(`Railway (${env}) no tiene ${migrateVar} ni ${cfg.urlVar}`);
  } else {
    fail("Falta --target env|local|staging|prod");
  }

  const host = new URL(url).hostname;
  const local = isLocalHost(host);

  if (target === "local" && !local) {
    fail(`Pediste --target local pero la URL apunta a ${describe(url)}. Abortado.`);
  }
  if ((target === "prod" || target === "staging" || target === "env") && local) {
    fail(`Pediste --target ${target} pero la URL es LOCAL (${describe(url)}). Abortado.`);
  }

  return { url, cfg, host, local };
}

export async function connect(url) {
  const { Client } = await import("pg");
  const local = isLocalHost(new URL(url).hostname);
  const client = new Client({
    connectionString: url,
    ssl: local ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}
