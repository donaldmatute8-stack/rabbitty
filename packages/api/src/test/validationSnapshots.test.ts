import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  isValidationPanelEnabled,
  listSnapshots,
  readSnapshot,
  summarize,
  validationDir,
  VALIDATION_FLAG,
} from "../services/validationSnapshots";

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "god-val-"));

const snapshot = (over: Record<string, unknown> = {}) => ({
  snapshot_version: "1.0",
  export_id: "exp-x",
  generated_at: "2026-11-06T12:00:00Z",
  dataset_kind: "pilot",
  dataset_hash: "a".repeat(64),
  status: { valid: true, calibration_ready: false, audit_verdict: "hallazgos", next_step: "instrumentar" },
  coverage: { active_affiliates: 1, inactive_affiliates: 0 },
  pilot: { datasets_missing: ["obligations"], rules_not_checked: ["R10"] },
  ...over,
});

describe("panel de validación — adaptador read-only", () => {
  it("el flag está apagado por defecto y acepta true/1", () => {
    expect(isValidationPanelEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isValidationPanelEnabled({ [VALIDATION_FLAG]: "false" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isValidationPanelEnabled({ [VALIDATION_FLAG]: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isValidationPanelEnabled({ [VALIDATION_FLAG]: "1" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("usa GOD_VALIDATION_DIR cuando existe y cae al default", () => {
    const base = process.cwd();
    expect(validationDir({} as NodeJS.ProcessEnv)).toBe(path.join(base, "documents/validation"));
    expect(validationDir({ GOD_VALIDATION_DIR: "/tmp/x" } as NodeJS.ProcessEnv)).toBe("/tmp/x");
  });

  it("lista snapshots, ordena por fecha y reporta los ilegibles", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "2026-11-06.json"), JSON.stringify(snapshot()));
    fs.writeFileSync(
      path.join(dir, "2026-11-13.json"),
      JSON.stringify(snapshot({ generated_at: "2026-11-13T12:00:00Z", export_id: "exp-y" }))
    );
    fs.writeFileSync(path.join(dir, "roto.json"), "{no-json");
    fs.writeFileSync(path.join(dir, "sin-status.json"), JSON.stringify({ export_id: "z" }));

    const { snapshots, ignored } = listSnapshots(dir);
    expect(snapshots.map((s) => s.id)).toEqual(["2026-11-13", "2026-11-06"]);
    expect(ignored.sort()).toEqual(["roto.json", "sin-status.json"]);
  });

  it("devuelve vacío si el directorio no existe (no rompe el panel)", () => {
    const { snapshots, ignored } = listSnapshots(path.join(tmp(), "no-existe"));
    expect(snapshots).toEqual([]);
    expect(ignored.length).toBe(1);
  });

  it("lee por id y rechaza traversal", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "2026-11-06.json"), JSON.stringify(snapshot()));
    expect(readSnapshot(dir, "2026-11-06")?.export_id).toBe("exp-x");
    expect(readSnapshot(dir, "2026-11-06.json")?.export_id).toBe("exp-x");
    expect(readSnapshot(dir, "../../etc/passwd")).toBeNull();
    expect(readSnapshot(dir, "no-existe")).toBeNull();
  });

  it("el resumen expone estado, huecos y reglas sin interpretar", () => {
    const s = summarize("2026-11-06", snapshot() as never);
    expect(s.status?.valid).toBe(true);
    expect(s.status?.calibration_ready).toBe(false);
    expect(s.datasets_missing).toEqual(["obligations"]);
    expect(s.rules_not_checked).toEqual(["R10"]);
    expect(s.active_affiliates).toBe(1);
  });

  it("no escribe nada en el directorio", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "2026-11-06.json"), JSON.stringify(snapshot()));
    const before = fs.readdirSync(dir).sort();
    listSnapshots(dir);
    readSnapshot(dir, "2026-11-06");
    expect(fs.readdirSync(dir).sort()).toEqual(before);
  });
});

describe("panel de validación — aislamiento y robustez", () => {
  it("rechaza enlaces simbólicos que apunten fuera del directorio", () => {
    const dir = tmp();
    const outside = tmp();
    const real = path.join(outside, "secreto.json");
    fs.writeFileSync(real, JSON.stringify(snapshot({ export_id: "fuera" })));
    try {
      fs.symlinkSync(real, path.join(dir, "enlace.json"));
    } catch {
      return; // sistema sin symlinks: no aplica
    }
    const { snapshots, ignored } = listSnapshots(dir);
    expect(snapshots).toEqual([]);
    expect(ignored).toContain("enlace.json");
    expect(readSnapshot(dir, "enlace")).toBeNull();
  });

  it("ignora archivos por encima del límite de tamaño", () => {
    const dir = tmp();
    const big = path.join(dir, "grande.json");
    fs.writeFileSync(big, JSON.stringify({ ...snapshot(), relleno: "x".repeat(2 * 1024 * 1024) }));
    const { snapshots, ignored } = listSnapshots(dir);
    expect(snapshots).toEqual([]);
    expect(ignored).toContain("grande.json");
    expect(readSnapshot(dir, "grande")).toBeNull();
  });

  it("no confunde un directorio llamado *.json con un snapshot", () => {
    const dir = tmp();
    fs.mkdirSync(path.join(dir, "carpeta.json"));
    expect(listSnapshots(dir).snapshots).toEqual([]);
    expect(readSnapshot(dir, "carpeta")).toBeNull();
  });

  it("un JSON truncado (escritura en curso) se ignora y no rompe el listado", () => {
    const dir = tmp();
    fs.writeFileSync(path.join(dir, "2026-11-20.json"), '{"status": {"valid": tr');
    fs.writeFileSync(path.join(dir, "2026-11-06.json"), JSON.stringify(snapshot()));
    const { snapshots, ignored } = listSnapshots(dir);
    expect(snapshots.map((s) => s.id)).toEqual(["2026-11-06"]);
    expect(ignored).toContain("2026-11-20.json");
  });
});
