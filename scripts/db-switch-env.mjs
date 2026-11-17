#!/usr/bin/env node
/**
 * ── Cambiar la base en TODOS los servicios de Railway ──────────────────────
 *
 * Un cambio de base mal hecho deja servicios apuntando al proyecto viejo: el
 * admin abre, el KDS no, y el bot escribe en la base que ya nadie usa. Este
 * script lista exactamente qué variable toca en cada servicio y lo hace de una
 * sola pasada (sin desplegar N veces a mano).
 *
 * Inventario real del proyecto (2026-11-16):
 *   admin    RESTAURANT_DATABASE_URL, CORE_DATABASE_URL,
 *            MIGRATE_RESTAURANT_DATABASE_URL, MIGRATE_CORE_DATABASE_URL
 *   kds      RESTAURANT_DATABASE_URL, CORE_DATABASE_URL
 *   bot      CORE_DATABASE_URL, DATABASE_URL
 *   landing  CORE_DATABASE_URL
 *
 * Uso:
 *   node scripts/db-switch-env.mjs --url "<URL_NUEVA>"                 # dry-run
 *   node scripts/db-switch-env.mjs --url "<URL_NUEVA>" --apply
 *   node scripts/db-switch-env.mjs --url "<URL_NUEVA>" --apply --env staging
 *
 * Ojo: Vercel NO se toca desde aquí (miniapp y app). Ahí la variable es
 * DATABASE_URL y se actualiza desde el panel de Vercel o reconectando Neon.
 */

import { execFileSync } from "node:child_process";
import { fail, describe } from "./lib/db-target.mjs";

const PLAN = {
  "rabbitty-admin": [
    "RESTAURANT_DATABASE_URL",
    "CORE_DATABASE_URL",
    "MIGRATE_RESTAURANT_DATABASE_URL",
    "MIGRATE_CORE_DATABASE_URL",
  ],
  "rabbitty-kds": ["RESTAURANT_DATABASE_URL", "CORE_DATABASE_URL"],
  "rabbitty-bot": ["CORE_DATABASE_URL", "DATABASE_URL"],
  "rabbitty-landing": ["CORE_DATABASE_URL"],
};

function parseArgs(argv) {
  const out = { url: null, apply: false, env: "production" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--url") out.url = argv[++i];
    else if (argv[i] === "--env") out.env = argv[++i];
    else if (argv[i] === "--apply") out.apply = true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) fail("Falta --url con la cadena de conexión nueva");
  if (!/^postgres(ql)?:\/\//.test(args.url)) fail("La URL no parece de Postgres");

  const target = describe(args.url);
  if (/localhost|127\.0\.0\.1/.test(target)) fail(`Esa URL es local (${target}). Abortado.`);

  console.log(`\nAmbiente: ${args.env}`);
  console.log(`Nueva base: ${target}\n`);

  const services = Object.keys(PLAN);
  for (const svc of services) {
    console.log(`${svc}`);
    for (const v of PLAN[svc]) console.log(`   · ${v}`);
  }

  if (!args.apply) {
    console.log("\n\x1b[33mVista previa\x1b[0m: no se cambió nada. Agrega --apply.\n");
    return;
  }

  for (const svc of services) {
    const cliArgs = [
      "variables",
      "--service",
      svc,
      "--environment",
      args.env,
      "--skip-deploys",
    ];
    for (const v of PLAN[svc]) cliArgs.push("--set", `${v}=${args.url}`);

    console.log(`\n→ actualizando ${svc}…`);
    try {
      execFileSync("railway", cliArgs, { stdio: "inherit" });
    } catch {
      console.warn(`   ⚠ ${svc}: no se pudo actualizar (¿existe en ${args.env}?)`);
    }
  }

  console.log(
    "\n\x1b[32m✔ Variables actualizadas.\x1b[0m\n" +
      "Siguiente:\n" +
      "  1. Desplegar para que los servicios tomen las variables nuevas:\n" +
      "     railway redeploy --service rabbitty-admin --yes  (y kds, bot, landing)\n" +
      "  2. Vercel: actualizar DATABASE_URL de la app (o reconectar Neon).\n" +
      "  3. Verificar: curl 'https://admin.rabbitty.me/api/health?strict=1'\n" +
      "  4. Recrear el rol de aplicación y sus GRANTs en el proyecto nuevo.\n",
  );
}

main().catch((e) => fail(e.stack || e.message));
