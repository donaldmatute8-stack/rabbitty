#!/usr/bin/env node
/**
 * Bundle de auditoría ENFOCADO (para compartir con enlace, no para reconstruir
 * todo el repo). Incluye solo lo que el revisor necesita: contrato, validador,
 * backtest, as-of, auditoría, panel GOD y sus pruebas.
 *
 *   node scripts/make-audit-bundle.mjs
 *   → audit/
 *       index.html            (portada con índice y hashes)
 *       audit-bundle.md       (todo el contenido en un solo documento)
 *       audit-bundle.zip      (descarga única)
 *       manifest.json         (ruta, bytes, sha256)
 *       files/…               (árbol navegable)
 *       server.mjs, package.json  (sitio read-only con Basic Auth)
 */

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
/**
 * El bundle se genera FUERA del repo (por defecto ~/rabbitty-audit).
 * Así no se toca el .gitignore del proyecto y Railway no excluye DOCS/.
 */
const OUT = process.env.AUDIT_OUT
  ? path.resolve(process.env.AUDIT_OUT)
  : path.join(os.homedir(), "rabbitty-audit");

const GROUPS = [
  {
    title: "Contrato y método",
    files: [
      "DOCS/BUNZ-REAL-DATA-SPEC-v1.0.md",
      "DOCS/BUNZ-BACKTEST-v1.0.md",
      "DOCS/BUNZ-AUDITORIA-PIPELINE-2026-11-06.md",
      "DOCS/BUNZ-ORDEN-DE-TRABAJO-INSTRUMENTACION.md",
      "DOCS/BUNZ-PLAN-SEGUIMIENTO-GOD.md",
      "DOCS/BUNZ-OPERACION-SEGUIMIENTO.md",
      "DOCS/BUNZ-ARQUITECTURA-OPERATIVA.md",
      "DOCS/BUNZ-SIGUIENTE-NIVEL.md",
      "DOCS/BUNZ-DECISIONES-G3-G4.md",
      "DOCS/BUNZ-CIERRE-GAPS-2026-11-07.md",
      "packages/database-restaurant/migrations/manual/0027_ot1_ot4_bunz_observability.sql",
      "packages/database-restaurant/migrations/manual/0028_ot2_ot3_bunz_books.sql",
      "packages/database-restaurant/migrations/manual/0029_ot5_abuse_signals.sql",
      "DOCS/BUNZ-CAPTURA-READONLY.sql",
    ],
  },
  {
    title: "Código del pipeline",
    files: [
      "scripts/lib/real-data-spec.mjs",
      "scripts/lib/backtest.mjs",
      "scripts/lib/asof.mjs",
      "scripts/lib/pipeline-audit.mjs",
      "scripts/lib/validation-snapshot.mjs",
      "scripts/schema-inventory.mjs",
      "scripts/real-data-validate.mjs",
      "scripts/backtest-run.mjs",
      "scripts/pipeline-audit.mjs",
      "scripts/validation-snapshot.mjs",
      "scripts/capture-weekly.mjs",
      "scripts/cron-weekly.sh",
      "scripts/lib/capture-map.mjs",
      "scripts/lib/econ-books-map.mjs",
    ],
  },
  {
    title: "Panel GOD (read-only)",
    files: [
      "packages/api/src/services/validationSnapshots.ts",
      "packages/api/src/services/bunzBooks.ts",
      "packages/api/src/services/bunzObligations.ts",
      "packages/api/src/services/bunzAbuse.ts",
      "apps/admin/src/app/(dashboard)/god/validacion/page.tsx",
      "apps/admin/src/app/(dashboard)/god/page.tsx",
      "apps/pos/src/components/RedemptionRejectModal.tsx",
      "apps/pos/src/components/CheckoutModal.tsx",
      "apps/pos/src/app/orders/page.tsx",
      "apps/admin/src/app/api/cron/validation/route.ts",
      "apps/admin/src/app/api/cron/capacity/route.ts",
      "apps/admin/src/app/api/cron/obligations/route.ts",
      "apps/admin/src/app/api/cron/abuse-signals/route.ts",
      ".github/workflows/bunz-validation-cron.yml",
      ".github/workflows/bunz-capacity-cron.yml",
      ".github/workflows/bunz-daily-ops.yml",
    ],
  },
  {
    title: "Pruebas",
    files: [
      "scripts/real-data-spec.test.mjs",
      "scripts/backtest.test.mjs",
      "scripts/asof.test.mjs",
      "scripts/pipeline-audit.test.mjs",
      "scripts/seguimiento.test.mjs",
      "scripts/capture-map.test.mjs",
      "scripts/econ-books-map.test.mjs",
      "packages/api/src/test/validationSnapshots.test.ts",
      "packages/api/src/test/bunzBooks.test.ts",
      "packages/api/src/test/bunzObligations.test.ts",
      "packages/api/src/test/bunzAbuse.test.ts",
    ],
  },
  {
    title: "Evidencia",
    files: [
      "DOCS/data/schema-inventory.json",
      "DOCS/data/validation-snapshot-pilot.json",
      "DOCS/data/validation-snapshot-sample.json",
      "DOCS/data/backtest-report-sample.json",
      "DOCS/data/real-data-validation-sample.json",
    ],
  },
];

const EXCLUSIONS = [
  ["Simulador v2.3.2.3 y sus pruebas", "ya revisado y congelado; no cambia en esta entrega"],
  ["scripts/fixtures/real-data-sample.json", "219 KB sintéticos, no aportan a la auditoría del panel"],
  ["scripts/templates/*.csv", "plantillas de captura, sin relación con R24–R26 ni con el panel"],
  ["CSVs comparativos v2.3.1→v2.3.2.x", "histórico del simulador, ya auditado"],
  ["packages/api/src/routers/god.ts completo", "se incluye el fragmento exacto en panel/god-router.fragment.ts"],
];

const sha = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

// Las rutas se conservan tal cual: al estar fuera del repo, no aplica .gitignore.
const exportPath = (rel) => rel;
const lang = (f) =>
  f.endsWith(".ts") || f.endsWith(".tsx") ? "ts" : f.endsWith(".mjs") ? "js" : f.endsWith(".md") ? "md" : f.endsWith(".sql") ? "sql" : "json";

function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function writeFile(rel, content) {
  const full = path.join(OUT, "files", rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
  return full;
}

/** Extrae del router solo el bloque añadido, para auditar sin cargar 1.200 líneas. */
function routerFragment() {
  const src = fs.readFileSync(path.join(ROOT, "packages/api/src/routers/god.ts"), "utf8");
  const start = src.indexOf("  // ── Validación económica (READ-ONLY)");
  const end = src.indexOf("});", start);
  const block = start >= 0 ? src.slice(start, end) : "// fragmento no encontrado";
  return [
    "// FRAGMENTO: procedimientos añadidos a packages/api/src/routers/god.ts",
    "// Se insertan al final del objeto godRouter, antes del cierre `});`.",
    "// Import añadido en la cabecera:",
    "//   import { isValidationPanelEnabled, listSnapshots, readSnapshot, validationDir }",
    "//     from \"../services/validationSnapshots\";",
    "",
    block.trimEnd(),
    "",
  ].join("\n");
}

function main() {
  rmrf(OUT);
  fs.mkdirSync(path.join(OUT, "files"), { recursive: true });

  const entries = [];
  for (const group of GROUPS) {
    for (const rel of group.files) {
      const buf = fs.readFileSync(path.join(ROOT, rel));
      const out = exportPath(rel);
      writeFile(out, buf);
      entries.push({ group: group.title, path: out, repo_path: rel, bytes: buf.length, sha256: sha(buf) });
    }
  }

  // Fragmento del router
  const frag = Buffer.from(routerFragment(), "utf8");
  writeFile("panel/god-router.fragment.ts", frag);
  entries.push({
    group: "Panel GOD (read-only)",
    path: "panel/god-router.fragment.ts",
    repo_path: "packages/api/src/routers/god.ts (fragmento)",
    bytes: frag.length,
    sha256: sha(frag),
  });

  const total = entries.reduce((a, e) => a + e.bytes, 0);

  // ── manifest ──────────────────────────────────────────────────────────────
  const manifest = {
    kind: "audit-bundle",
    generated_at: new Date().toISOString(),
    scope: "Panel GOD read-only · R24–R26 · aislamiento · protocolo temporal OT-6/OT-7",
    files: entries,
    exclusions: EXCLUSIONS.map(([what, why]) => ({ what, why })),
    totals: { files: entries.length, bytes: total },
    bundle_hash: sha(JSON.stringify(entries.map((e) => [e.path, e.sha256]))),
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  // ── documento único ──────────────────────────────────────────────────────
  const md = [];
  md.push("# Auditoría — Panel GOD, R24–R26 y aislamiento read-only");
  md.push("");
  md.push(`Generado: ${manifest.generated_at}`);
  md.push(`Archivos: ${entries.length} · ${(total / 1024).toFixed(1)} KB · bundle ${manifest.bundle_hash.slice(0, 16)}…`);
  md.push("");
  md.push("> **Read-only.** Este paquete no incluye credenciales, no toca la base de datos y no modifica el sistema.");
  md.push("");
  md.push("## Índice");
  for (const group of GROUPS.concat([{ title: "Panel GOD (read-only)", files: ["panel/god-router.fragment.ts"] }])) {
    md.push(`- **${group.title}**`);
    for (const f of group.files) md.push(`  - \`${f}\``);
  }
  md.push("");
  md.push("## Exclusiones (y por qué)");
  for (const [what, why] of EXCLUSIONS) md.push(`- **${what}**: ${why}`);
  md.push("");
  md.push("---");
  for (const e of entries) {
    md.push("");
    md.push(`## \`${e.repo_path}\`${e.path !== e.repo_path ? `  ·  en el bundle: \`${e.path}\`` : ""}`);
    md.push("");
    md.push("```" + lang(e.path));
    md.push(fs.readFileSync(path.join(OUT, "files", e.path), "utf8").replace(/\n$/, ""));
    md.push("```");
  }
  fs.writeFileSync(path.join(OUT, "audit-bundle.md"), md.join("\n") + "\n");

  // ── portada ─────────────────────────────────────────────────────────────
  const rows = entries
    .map((e) => {
      const href = "files/" + e.path.split("/").map(encodeURIComponent).join("/");
      const label = e.repo_path.replace(/</g, "&lt;");
      return `<tr><td><a href="${href}"><code>${label}</code></a></td><td class="n">${e.bytes.toLocaleString("en-US")}</td><td><code>${e.sha256.slice(0, 12)}…</code></td></tr>`;
    })
    .join("\n");
  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auditoría · Rabbitty</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0b0d;color:#e7e7ea}
  main{max-width:980px;margin:0 auto;padding:40px 20px 80px}
  h1{font-size:24px;margin:0 0 6px}
  p.sub{color:#9a9aa3;margin:0 0 24px}
  .cards{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 28px}
  a.btn{display:inline-block;padding:10px 14px;border:1px solid #2a2a31;border-radius:10px;color:#e7e7ea;text-decoration:none;background:#141418}
  a.btn:hover{border-color:#3fa66d}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;background:rgba(63,166,109,.15);color:#5fd08c;border:1px solid rgba(63,166,109,.3)}
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th,td{text-align:left;padding:8px 10px;border-bottom:1px solid #1d1d22}
  th{color:#9a9aa3;font-weight:600}
  td.n{text-align:right;color:#c9c9d1}
  code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:#d7d7de}
  h2{font-size:15px;margin:28px 0 10px;color:#cfcfd6}
  .muted{color:#7d7d87;font-size:12px}
</style></head><body><main>
  <span class="badge">read-only</span>
  <h1>Auditoría — Panel GOD · R24–R26 · aislamiento</h1>
  <p class="sub">Generado ${manifest.generated_at} · ${entries.length} archivos · ${(total / 1024).toFixed(1)} KB · bundle <code>${manifest.bundle_hash.slice(0, 16)}…</code></p>
  <div class="cards">
    <a class="btn" href="/bundle.zip">DescARGAR ZIP</a>
    <a class="btn" href="bundle.md">Ver todo en un documento</a>
    <a class="btn" href="manifest.json">manifest.json</a>
  </div>
  <h2>Árbol de archivos</h2>
  <table><thead><tr><th>Archivo</th><th class="n">Bytes</th><th>SHA-256</th></tr></thead><tbody>
  ${rows}
  </tbody></table>
  <h2>Qué incluye</h2>
  <ul>${GROUPS.map((g) => `<li>${g.title}: ${g.files.length} archivos</li>`).join("")}<li>Fragmento exacto del router GOD</li></ul>
  <h2>Qué no incluye</h2>
  <ul>${EXCLUSIONS.map(([w, y]) => `<li><b>${w}</b>: ${y}</li>`).join("")}</ul>
  <p class="muted">Este sitio solo sirve archivos estáticos. No tiene acceso a Rabbitty, ni a base de datos, ni a secretos. Si necesitas revocarlo, elimina el servicio en Railway.</p>
</main></body></html>`;
  fs.writeFileSync(path.join(OUT, "index.html"), html);

  // ── servidor y paquete ──────────────────────────────────────────────────
  const siteDir = path.join(ROOT, "scripts/audit-site");
  fs.copyFileSync(path.join(siteDir, "server.mjs"), path.join(OUT, "server.mjs"));
  fs.copyFileSync(path.join(siteDir, "package.json"), path.join(OUT, "package.json"));

  // ── zip ─────────────────────────────────────────────────────────────────
  try {
    execFileSync("zip", ["-r", "-q", "audit-bundle.zip", "files", "index.html", "audit-bundle.md", "manifest.json"], {
      cwd: OUT,
    });
  } catch {
    console.warn("aviso: no se pudo crear el zip (¿falta el comando `zip`?)");
  }

  const size = (f) => (fs.existsSync(path.join(OUT, f)) ? fs.statSync(path.join(OUT, f)).size : 0);
  console.log(`audit bundle: ${entries.length} archivos · ${(total / 1024).toFixed(1)} KB`);
  console.log(`  index.html        ${(size("index.html") / 1024).toFixed(1)} KB`);
  console.log(`  audit-bundle.md   ${(size("audit-bundle.md") / 1024).toFixed(1)} KB`);
  console.log(`  audit-bundle.zip  ${(size("audit-bundle.zip") / 1024).toFixed(1)} KB`);
  console.log(`  hash              ${manifest.bundle_hash}`);
  console.log(`  destino           ${OUT}`);
  console.log(`  (fuera del repo: no se toca .gitignore ni se commitea nada)`);
}

main();
