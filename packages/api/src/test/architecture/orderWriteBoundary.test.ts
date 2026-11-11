/**
 * ── Test de arquitectura: frontera de escritura de órdenes ─────────────────
 *
 * Implementa D-04 de Docs/POS-FASE-0/ADR-018-integridad-ordenes.md.
 *
 * Regla: solo `packages/api/src/services/orderIntegrity.ts` (el helper) puede
 * escribir en `orders` / `order_items`. Todo lo demás está en proceso de
 * migración y vive en el baseline.
 *
 * El baseline es un TRINQUETE:
 *  · Puede BAJAR (cuando migramos un camino al helper) → test verde.
 *  · Nunca puede SUBIR (una escritura nueva sin clasificar) → test rojo.
 *  · Un archivo nuevo con escrituras → test rojo.
 *
 * Cuando termines de migrar un archivo, baja su contador aquí y vuelve a correr.
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import baseline from "./order-write-baseline.json";

const WRITE_PATTERN = /(insert|update|delete)\((orders|orderItems)\)/g;

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".turbo", "coverage"]);

/** Sube desde el cwd hasta encontrar el workspace. */
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

/** Directorios de código que se auditan (mismo alcance que el ADR-018). */
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

function collectWrites(repoRoot: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const root of scanRoots(repoRoot)) {
    for (const file of walk(root)) {
      const source = fs.readFileSync(file, "utf8");
      const found = source.match(WRITE_PATTERN);
      if (found && found.length > 0) {
        counts.set(path.relative(repoRoot, file), found.length);
      }
    }
  }
  return counts;
}

describe("Frontera de escritura de órdenes (ADR-018)", () => {
  const repoRoot = findRepoRoot();
  const baselineFiles = (baseline as any).files as Record<string, { count: number; category: string }>;
  const current = collectWrites(repoRoot);

  it("no introduce escrituras en archivos fuera del baseline", () => {
    const unexpected = [...current.keys()].filter((file) => !(file in baselineFiles));
    expect(
      unexpected,
      `Escrituras nuevas sin clasificar:\n${unexpected.join("\n")}\n\n` +
        `Toda mutación de orders/order_items debe pasar por withOrderMutation ` +
        `(packages/api/src/services/orderIntegrity.ts).`,
    ).toEqual([]);
  });

  it("no incrementa el número de escrituras por archivo (el trinquete solo baja)", () => {
    const increased: string[] = [];
    for (const [file, count] of current.entries()) {
      const allowed = baselineFiles[file]?.count ?? 0;
      if (count > allowed) increased.push(`${file}: ${count} > ${allowed}`);
    }
    expect(increased, `Escrituras agregadas sobre el baseline:\n${increased.join("\n")}`).toEqual([]);
  });

  it("reporta el avance de la migración", () => {
    const pending = Object.entries(baselineFiles)
      .filter(([, meta]) => meta.category === "PENDING_MIGRATION")
      .reduce((sum, [, meta]) => sum + meta.count, 0);
    const remaining = [...current.entries()]
      .filter(([file]) => baselineFiles[file]?.category === "PENDING_MIGRATION")
      .reduce((sum, [, count]) => sum + count, 0);

    // Visibilidad: no falla, pero deja el número en el log de CI.
    console.log(
      `[ADR-018] Escrituras pendientes de migrar: ${remaining} (baseline inicial: ${pending}). ` +
        `Objetivo: 0.`,
    );
    expect(remaining).toBeLessThanOrEqual(pending);
  });
});
