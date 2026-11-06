import test from "node:test";
import assert from "node:assert/strict";
import { makeSample } from "./fixtures/make-real-data-sample.mjs";
import { runValidation } from "./lib/real-data-spec.mjs";
import {
  appendEntry,
  asOf,
  checkMonotonic,
  correction,
  createJournal,
  exportHash,
  journalHash,
  restatements,
  sha256,
  tombstone,
  versionAt,
  versionsOf,
} from "./lib/asof.mjs";

const base = () => JSON.parse(JSON.stringify(makeSample()));
const T1 = "2026-03-31";
const T2 = "2026-04-10";
const journal = () => createJournal(base(), { recorded_at: T1 });

// ── 1 · Un evento futuro no altera el corte anterior ────────────────────────

test("OT-7.1: un evento registrado después del corte no altera as-of(T1)", () => {
  const j = journal();
  const antes = asOf(j, T1);
  const conFuturo = appendEntry(j, {
    dataset: "sales",
    id: "s-futuro",
    occurred_at: "2026-04-02T12:00:00Z",
    recorded_at: "2026-04-05",
    payload: {
      id: "s-futuro",
      affiliate_id: "a01",
      ts: "2026-04-02T12:00:00Z",
      gross_mxn: 999,
      tickets: 1,
      user: "u1",
    },
  });
  const despues = asOf(conFuturo, T1);
  assert.equal(exportHash(despues), exportHash(antes));
  assert.equal(despues.sales.some((s) => s.id === "s-futuro"), false);
});

// ── 2 · Llegada tardía ──────────────────────────────────────────────────────

test("OT-7.2: una llegada tardía no entra en T1 y sí en T2, reportada como reexpresión", () => {
  const j = journal();
  const tarde = appendEntry(j, {
    dataset: "redemptions",
    id: "rd-tardia",
    occurred_at: "2026-02-10T18:00:00Z", // ocurrió dentro de T1
    recorded_at: T2, // pero se supo después
    payload: {
      id: "rd-tardia",
      user: "u9",
      requested_at: "2026-02-10T18:00:00Z",
      requested_affiliate: "a02",
      bunz: 25,
      fulfilled_bunz: 25,
      status: "fulfilled",
      reasons: [],
      fulfilled_at: "2026-02-11T10:00:00Z",
      fulfilled_affiliate: "a02",
      reward_id: "rw0001",
    },
  });

  const enT1 = asOf(tarde, T1);
  const enT2 = asOf(tarde, T2);

  assert.equal(enT1.redemptions.some((r) => r.id === "rd-tardia"), false);
  assert.equal(enT2.redemptions.some((r) => r.id === "rd-tardia"), true);

  const diff = restatements(enT1, enT2);
  const item = diff.find((d) => d.dataset === "redemptions" && d.id === "rd-tardia");
  assert.ok(item, "debe reportarse como reexpresión");
  assert.equal(item.kind, "added");
  assert.equal(item.occurred_at, "2026-02-10T18:00:00Z");
});

// ── 3 · Independencia del orden de ingesta ──────────────────────────────────

test("OT-7.3: barajar el journal produce un export byte-idéntico", () => {
  const j = journal();
  const shuffled = [...j].sort(() => Math.random() - 0.5);
  assert.equal(exportHash(asOf(j, T1)), exportHash(asOf(shuffled, T1)));
  assert.equal(journalHash(j), journalHash(shuffled), "el hash del journal ignora el orden");
});

// ── 4 · Conjunto monótono ───────────────────────────────────────────────────

test("OT-7.4: el conocimiento no retrocede entre T1 y T2", () => {
  const j = journal();
  assert.deepEqual(checkMonotonic(j, T1, T2), []);
  const a = asOf(j, T1);
  const b = asOf(j, T2);
  for (const name of ["sales", "redemptions", "obligations", "capacity"]) {
    const idsB = new Set(b[name].map((r) => r.id ?? `${r.affiliate_id}@${r.date}`));
    for (const r of a[name]) {
      const k = r.id ?? `${r.affiliate_id}@${r.date}`;
      assert.ok(idsB.has(k), `${name}:${k} desapareció sin tombstone`);
    }
  }
});

// ── 5 · Corrección versionada ───────────────────────────────────────────────

test("OT-7.5: una corrección es versión nueva; el pasado no se sobrescribe", () => {
  const j = journal();
  const original = j.find((e) => e.dataset === "obligations");
  const corregida = correction(original, {
    recorded_at: T2,
    payload: { ...original.payload, due_at: "2026-05-15" },
  });
  const j2 = appendEntry(j, corregida);

  const enT1 = asOf(j2, T1).obligations.find((o) => o.id === original.id);
  const enT2 = asOf(j2, T2).obligations.find((o) => o.id === original.id);

  assert.equal(enT1.due_at, original.payload.due_at);
  assert.equal(enT2.due_at, "2026-05-15");
  assert.equal(versionsOf(j2, "obligations", original.id).length, 2, "se conservan las dos versiones");
});

// ── 6 · Hash estable ────────────────────────────────────────────────────────

test("OT-7.6: reexportar el mismo corte produce el mismo hash", () => {
  const j = journal();
  const a = exportHash(asOf(j, T1));
  const b = exportHash(asOf(j, T1));
  assert.equal(a, b);
  assert.match(a, /^[0-9a-f]{64}$/);
});

// ── 7 · Implementación independiente ────────────────────────────────────────

test("OT-7.7: el export coincide con una reconstrucción independiente del crudo", () => {
  const j = journal();
  const cut = T1;

  // Reimplementación deliberadamente separada: filtra el journal a mano.
  const rank = (e) => `${e.recorded_at}|${sha256(JSON.stringify(e.payload ?? null)).slice(0, 16)}`;
  const naive = {};
  for (const e of j) {
    if (e.dataset === "__meta" || e.recorded_at > cut) continue;
    if (!naive[e.dataset]) naive[e.dataset] = {};
    const prev = naive[e.dataset][e.id];
    if (!prev || rank(e) > rank(prev)) naive[e.dataset][e.id] = e;
  }

  const exportado = asOf(j, cut);
  for (const name of Object.keys(naive)) {
    const esperado = Object.values(naive[name])
      .filter((e) => !e.deleted)
      .map((e) => e.payload)
      .sort((a, b) => {
        const ka = name === "capacity" ? `${a.affiliate_id}@${a.date}` : name === "treasury" ? a.date : a.id;
        const kb = name === "capacity" ? `${b.affiliate_id}@${b.date}` : name === "treasury" ? b.date : b.id;
        return ka < kb ? -1 : ka > kb ? 1 : 0;
      });
    assert.deepEqual(exportado[name], esperado, name);
  }
});

// ── Extras ──────────────────────────────────────────────────────────────────

test("OT-7: el export as-of del fixture sigue siendo válido y calibrable", () => {
  const out = asOf(journal(), T1);
  const report = runValidation(out);
  assert.equal(report.ok, true, JSON.stringify(report.errors.slice(0, 3)));
  assert.equal(report.calibration_ready, true);
  assert.equal(out.spec_version, "1.0.0");
  assert.equal(out.capacity_scope, "affiliate");
  assert.equal(out.unit_policy.approved, true);
});

test("OT-7: asOf no muta el journal (append-only)", () => {
  const j = journal();
  const copia = JSON.parse(JSON.stringify(j));
  asOf(j, T1);
  assert.deepEqual(j, copia);
});

test("OT-7: un tombstone oculta la fila pero no la borra del journal", () => {
  const j = journal();
  const sale = j.find((e) => e.dataset === "sales");
  const j2 = appendEntry(j, tombstone(sale, { recorded_at: T2 }));

  assert.equal(asOf(j, T1).sales.some((s) => s.id === sale.id), true);
  assert.equal(asOf(j2, T1).sales.some((s) => s.id === sale.id), true, "el tombstone es posterior");
  assert.equal(asOf(j2, T2).sales.some((s) => s.id === sale.id), false);
  assert.equal(j2.length, j.length + 1, "el original sigue en el journal");
});

test("OT-7: versionAt respeta el corte y devuelve null si no existía", () => {
  const j = journal();
  const e = j.find((x) => x.dataset === "sales");
  assert.equal(versionAt(j, "sales", e.id, "2026-01-01"), null);
  assert.ok(versionAt(j, "sales", e.id, T1));
});

// ── CLI ─────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

test("OT-7: CLI construye journal y exporta un as-of válido", () => {
  const root = fileURLToPath(new URL("./", import.meta.url));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bunz-asof-"));
  const journalFile = path.join(dir, "journal.json");
  const outFile = path.join(dir, "asof.json");

  execFileSync(
    process.execPath,
    [path.join(root, "asof-export.mjs"), "--journal-from", path.join(root, "fixtures", "real-data-sample.json"), "--recorded-at", T1, "--out", journalFile],
    { encoding: "utf8" }
  );
  const journalDisk = JSON.parse(fs.readFileSync(journalFile, "utf8"));
  assert.ok(journalDisk.length > 100);

  execFileSync(
    process.execPath,
    [path.join(root, "asof-export.mjs"), journalFile, "--cut", T1, "--out", outFile],
    { encoding: "utf8" }
  );
  const exportado = JSON.parse(fs.readFileSync(outFile, "utf8"));
  assert.equal(exportado.sales.length, 120);
  assert.equal(runValidation(exportado).calibration_ready, true);
});
