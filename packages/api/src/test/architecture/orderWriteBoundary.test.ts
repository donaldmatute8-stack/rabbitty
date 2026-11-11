/**
 * ── Test de arquitectura: frontera de escritura de órdenes ─────────────────
 *
 * Implementa D-04 de Docs/POS-FASE-0/ADR-018-integridad-ordenes.md.
 *
 * Qué mide (y qué NO): no cuenta "cuántas escrituras hay", mide **protección**.
 * Un archivo que escribe en `orders` / `order_items` debe importar
 * `withOrderMutation` (o estar en una excepción documentada). Las escrituras
 * dentro del callback del helper siguen viviendo en el router: eso es correcto,
 * porque el helper es quien bloquea la orden y sube la versión.
 *
 * Trinquete:
 *  · Archivo nuevo con escrituras            → falla
 *  · Más escrituras que el baseline          → falla
 *  · Archivo sin helper que no esté listado  → falla
 *  · Lista `pendingFiles` que no coincida    → falla (obliga a actualizarla al migrar)
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import baseline from "./order-write-baseline.json";

const WRITE_PATTERN = /(insert|update|delete)\((orders|orderItems)\)/g;
/** Copia sin flag global: `.test()` con /g es stateful y da falsos negativos. */
const WRITE_TEST = /(insert|update|delete)\((orders|orderItems)\)/;
const HELPER_IMPORT = /withOrder(Create|Mutation)/;
const HELPER_CALL = /withOrder(Create|Mutation)\(/;
const POS_ROUTER = "packages/api/src/routers/pos.ts";

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".turbo", "coverage"]);

function findRepoRoot(start: string = process.cwd()): string {
  let dir = start;
  for (let i = 0; i < 10; i += 1) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`No se encontró la raíz del repo desde ${start}`);
}

function scanRoots(repoRoot: string): string[] {
  const roots: string[] = [];
  for (const group of ["packages", "apps"]) {
    const base = path.join(repoRoot, group);
    if (!fs.existsSync(base)) continue;
    for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const src = path.join(base, entry.name, "src");
      if (fs.existsSync(src)) roots.push(src);
    }
  }
  for (const extra of ["telegram-miniapp/src", "landing-page/src"]) {
    const p = path.join(repoRoot, extra);
    if (fs.existsSync(p)) roots.push(p);
  }
  return roots;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), out);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

type Found = { count: number; importsHelper: boolean };

function collectWrites(repoRoot: string): Map<string, Found> {
  const found = new Map<string, Found>();
  for (const root of scanRoots(repoRoot)) {
    for (const file of walk(root)) {
      const source = fs.readFileSync(file, "utf8");
      const hits = source.match(WRITE_PATTERN);
      if (hits && hits.length > 0) {
        found.set(path.relative(repoRoot, file), {
          count: hits.length,
          importsHelper: HELPER_IMPORT.test(source),
        });
      }
    }
  }
  return found;
}

/** Procedimientos de primer nivel en un router tRPC con escrituras sin helper. */
function pendingProcedures(file: string): string[] {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const procRe = /^  ([a-zA-Z][A-Za-z0-9]*): (posProcedure|adminOnlyProcedure|protectedProcedure|posPermission\()/;
  const bounds: Array<{ line: number; name: string }> = [];
  lines.forEach((line, i) => {
    const m = procRe.exec(line);
    if (m && m[1]) bounds.push({ line: i, name: m[1] });
  });
  bounds.push({ line: lines.length, name: "__end__" });

  const pending: string[] = [];
  for (let i = 0; i < bounds.length - 1; i += 1) {
    const current = bounds[i];
    const next = bounds[i + 1];
    if (!current || !next) continue;
    const block = lines.slice(current.line, next.line).join("\n");
    if (WRITE_TEST.test(block) && !HELPER_CALL.test(block)) {
      pending.push(current.name);
    }
  }
  return pending.sort();
}

describe("Frontera de escritura de órdenes (ADR-018)", () => {
  const repoRoot = findRepoRoot();
  const baselineFiles = (baseline as any).files as Record<
    string,
    { count: number; category: string }
  >;
  const baselinePending = ((baseline as any).pendingFiles as string[]) ?? [];
  const current = collectWrites(repoRoot);

  it("no aparecen escrituras en archivos fuera del baseline", () => {
    const unexpected = [...current.keys()].filter((file) => !(file in baselineFiles));
    expect(
      unexpected,
      `Escrituras nuevas sin clasificar:\n${unexpected.join("\n")}\n\n` +
        `Toda mutación de orders/order_items debe pasar por withOrderMutation ` +
        `(packages/api/src/services/orderIntegrity.ts).`,
    ).toEqual([]);
  });

  it("no crece el número de escrituras por archivo", () => {
    const increased: string[] = [];
    for (const [file, info] of current.entries()) {
      const allowed = baselineFiles[file]?.count ?? 0;
      if (info.count > allowed) increased.push(`${file}: ${info.count} > ${allowed}`);
    }
    expect(increased, `Escrituras agregadas sobre el baseline:\n${increased.join("\n")}`).toEqual([]);
  });

  it("todo archivo que escribe órdenes usa el helper (o está exceptuado)", () => {
    const unprotected = [...current.entries()]
      .filter(([file, info]) => {
        const category = baselineFiles[file]?.category;
        if (category === "ALLOWED" || category === "ALLOWED_EXCEPTION") return false;
        if (category === "SANDBOX" || category === "SEED") return false;
        return !info.importsHelper;
      })
      .map(([file]) => file)
      .sort();

    expect(
      unprotected,
      `Archivos que escriben órdenes SIN withOrderMutation:\n${unprotected.join("\n")}\n\n` +
        `Migra el archivo al helper o registra una excepción en el baseline.`,
    ).toEqual([...baselinePending].sort());
  });

  it("cada procedimiento de pos.ts que escribe órdenes usa el helper", () => {
    const baselineProcedures = ((baseline as any).pendingPosProcedures as string[]) ?? [];
    const currentProcedures = pendingProcedures(path.join(repoRoot, POS_ROUTER));
    expect(
      currentProcedures,
      `Procedimientos sin withOrderMutation:\n${currentProcedures.join("\n")}`,
    ).toEqual([...baselineProcedures].sort());
  });

  it("reporta el avance de la migración", () => {
    const remaining = baselinePending.length;
    const writes = baselinePending.reduce((sum, f) => sum + (current.get(f)?.count ?? 0), 0);
    console.log(
      `[ADR-018] Archivos sin helper: ${remaining} (escrituras: ${writes}). Objetivo: 0.`,
    );
    expect(remaining).toBeGreaterThanOrEqual(0);
  });
});
