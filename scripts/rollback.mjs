#!/usr/bin/env node
/**
 * ── Rollback de un despliegue (una tecla) ───────────────────────────────────
 *
 * Busca el último commit que estuvo SUCCESS antes del actual y lo vuelve a
 * desplegar. Railway lo hace con la imagen ya construida, así que tarda poco y
 * no recompila.
 *
 * Por qué un script: cuando algo se rompe en horario de operación, la diferencia
 * entre "revertir" y "revertir 20 minutos después" es tener el comando escrito.
 *
 * Uso:
 *   node scripts/rollback.mjs --service rabbitty-admin            # dry-run
 *   node scripts/rollback.mjs --service rabbitty-admin --apply
 */

import { execFileSync } from "node:child_process";
import { fail } from "./lib/db-target.mjs";

function parseArgs(argv) {
  const out = { service: "rabbitty-admin", apply: false, env: "production" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--service") out.service = argv[++i];
    else if (a === "--environment") out.env = argv[++i];
    else if (a === "--apply") out.apply = true;
  }
  return out;
}

function deployments(service) {
  const raw = execFileSync(
    "railway",
    ["deployment", "list", "--service", service, "--json"],
    { encoding: "utf8" },
  );
  return JSON.parse(raw);
}

async function healthy(retries = 30) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("https://admin.rabbitty.me/api/health?strict=1");
      const body = await res.json();
      if (res.ok && body.status === "ok") return true;
    } catch {
      /* rollout en curso */
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const list = deployments(args.service);

  const current = list[0];
  // Railway marca los despliegues superados como REMOVED (no borra su commit) y
  // deja FAILED/CRASHED los que fallaron. Por eso "anterior bueno" = el primer
  // commit distinto que no haya fallado.
  const BAD = new Set(["FAILED", "CRASHED"]);
  const previous = list.find(
    (d, i) =>
      i > 0 &&
      d.meta?.commitHash &&
      d.meta.commitHash !== current?.meta?.commitHash &&
      !BAD.has(d.status),
  );

  if (!current) fail("No pude leer los despliegues del servicio");
  if (!previous) fail("No encontré un despliegue SUCCESS anterior para volver");

  console.log(`\nServicio: ${args.service} (${args.env})`);
  console.log(`  actual:   ${current.meta?.commitHash?.slice(0, 7)} (${current.status})`);
  console.log(`  objetivo: ${previous.meta?.commitHash?.slice(0, 7)} (${previous.createdAt})`);
  console.log(`  mensaje:  ${(previous.meta?.commitMessage ?? "").split("\n")[0]}`);

  if (!args.apply) {
    console.log("\n\x1b[33mDRY-RUN\x1b[0m: no se desplegó nada. Agrega --apply para ejecutar.\n");
    return;
  }

  console.log("\nDesplegando el commit anterior…");
  execFileSync(
    "railway",
    ["redeploy", "--service", args.service, "--environment", args.env, "--commit", previous.meta.commitHash, "--yes"],
    { stdio: "inherit" },
  );

  const ok = await healthy();
  if (!ok) {
    fail("El servicio no reportó sano tras el rollback. Revisar logs de Railway.");
  }
  console.log("\n\x1b[32m✔ Rollback completado y servicio sano.\x1b[0m\n");
}

main().catch((e) => fail(e.stack || e.message));
