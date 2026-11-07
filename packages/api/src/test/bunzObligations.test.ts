import { afterEach, describe, expect, it } from "vitest";
import {
  COMMISSION_RATE,
  OBLIGATION_FLAG,
  accrueCommission,
  buildObligation,
  isObligationsEnabled,
} from "../services/bunzObligations";

function fakeTx(fail = false) {
  const calls: Array<{ rows: any }> = [];
  const tx: any = {
    calls,
    insert(_t: unknown) {
      return {
        values(rows: any) {
          calls.push({ rows });
          return {
            onConflictDoNothing: async () => {
              if (fail) throw new Error("db down");
            },
          };
        },
      };
    },
    async transaction<T>(fn: (sp: any) => Promise<T>): Promise<T> {
      return fn(tx);
    },
  };
  return tx;
}

const tables = { obligations: {}, events: {} };
afterEach(() => delete process.env[OBLIGATION_FLAG]);

describe("OT-2 — devengo de obligaciones", () => {
  it("flag apagado por defecto", () => {
    expect(isObligationsEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isObligationsEnabled({ [OBLIGATION_FLAG]: "true" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("devenga 6% del importe y vence a 15 días", () => {
    const o = buildObligation({
      orderId: "o1",
      affiliateId: "a01",
      fiatAmount: 1000,
      at: new Date("2026-11-06T00:00:00Z"),
    })!;
    expect(o.amountBunz).toBe(60);
    expect(o.amountBunz).toBeCloseTo(1000 * COMMISSION_RATE);
    expect(o.state).toBe("OPEN");
    expect(o.id).toBe("ob-o1");
    expect(o.dueAt.toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });

  it("no devenga importes cero o sin afiliado", () => {
    expect(buildObligation({ orderId: "o1", affiliateId: "a", fiatAmount: 0 })).toBeNull();
    expect(buildObligation({ orderId: "o1", affiliateId: "", fiatAmount: 100 })).toBeNull();
  });

  it("con el flag apagado no escribe", async () => {
    const tx = fakeTx();
    const r = await accrueCommission(tx, { orderId: "o1", affiliateId: "a01", fiatAmount: 100, tables });
    expect(r.ok).toBe(true);
    expect(tx.calls).toHaveLength(0);
  });

  it("con el flag encendido escribe obligación + evento", async () => {
    process.env[OBLIGATION_FLAG] = "true";
    const tx = fakeTx();
    const r = await accrueCommission(tx, { orderId: "o1", affiliateId: "a01", fiatAmount: 100, tables });
    expect(r.ok).toBe(true);
    expect(tx.calls).toHaveLength(2);
  });

  it("si la tabla no existe, el cobro no falla", async () => {
    process.env[OBLIGATION_FLAG] = "true";
    const tx = fakeTx(true);
    const r = await accrueCommission(tx, { orderId: "o1", affiliateId: "a01", fiatAmount: 100, tables });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
  });
});

// ── Ciclo de vida: mora (derivada) y liquidación ─────────────────────────────
import { SETTLEMENT_FLAG, scanOverdue, settleObligation } from "../services/bunzObligations";
import { BOOKS_FLAG } from "../services/bunzBooks";

function fakeDb(rows: any[]) {
  const applied: any[] = [];
  const events: any[] = [];
  const ledger: any[] = [];
  const db: any = {
    applied,
    events,
    ledger,
    insert(_t: unknown) {
      return {
        values(v: any) {
          if (Array.isArray(v)) ledger.push(...v);
          else events.push(v);
          return { onConflictDoNothing: async () => undefined };
        },
      };
    },
    update(_t: unknown) {
      return {
        set(patch: any) {
          return {
            where: async () => {
              applied.push(patch);
            },
          };
        },
      };
    },
    select() {
      const chain: any = {
        from: () => chain,
        where: () => Promise.resolve(rows),
      };
      return chain;
    },
    async transaction<T>(fn: (sp: any) => Promise<T>): Promise<T> {
      return fn(db);
    },
  };
  return db;
}

describe("OT-2 — mora y liquidación", () => {
  afterEach(() => {
    delete process.env[OBLIGATION_FLAG];
    delete process.env[SETTLEMENT_FLAG];
    delete process.env[BOOKS_FLAG];
  });

  it("la mora se deriva de dueAt: cuenta vencidas y suma pendiente", async () => {
    process.env[OBLIGATION_FLAG] = "true";
    const db = fakeDb([
      { id: "ob-1", state: "OPEN", dueAt: new Date("2026-01-01"), amountBunz: 60, settledBunz: 0 },
      { id: "ob-2", state: "PARTIALLY_PAID", dueAt: new Date("2026-01-02"), amountBunz: 40, settledBunz: 10 },
    ]);
    const r = await scanOverdue(db, { now: new Date("2026-02-01"), tables: { obligations: {} } });
    expect(r).toMatchObject({ ok: true, overdue: 2, outstanding: 90 });
    expect(db.applied).toHaveLength(0); // no escribe estado
    expect(db.events).toHaveLength(0);
  });

  it("con el flag de obligaciones apagado no cuenta", async () => {
    const db = fakeDb([{ id: "ob-1", amountBunz: 60, settledBunz: 0 }]);
    const r = await scanOverdue(db, { tables: { obligations: {} } });
    expect(r.overdue).toBe(0);
  });

  it("la liquidación está apagada por defecto (no mueve Bunz)", async () => {
    const db = fakeDb([{ id: "ob-1", state: "OPEN", amountBunz: 60, settledBunz: 0, settledFiatMxn: 0 }]);
    const r = await settleObligation(db, {
      obligationId: "ob-1",
      bunz: 60,
      tables: { obligations: {}, events: {}, ledger: {} },
    });
    expect(r.skipped).toBe(true);
    expect(db.ledger).toHaveLength(0);
  });

  it("liquidación total: PAID + settledAt + asiento de libro", async () => {
    process.env[SETTLEMENT_FLAG] = "true";
    process.env[BOOKS_FLAG] = "true";
    const db = fakeDb([{ id: "ob-1", state: "OPEN", amountBunz: 60, settledBunz: 0, settledFiatMxn: 0 }]);
    const r = await settleObligation(db, {
      obligationId: "ob-1",
      bunz: 60,
      at: new Date("2026-11-07T00:00:00Z"),
      tables: { obligations: {}, events: {}, ledger: {} },
    });
    expect(r).toMatchObject({ ok: true, state: "PAID", settledBunz: 60 });
    expect(db.applied[0]).toMatchObject({ state: "PAID", settledBunz: 60 });
    expect(db.applied[0].settledAt).toEqual(new Date("2026-11-07T00:00:00Z"));
    expect(db.ledger).toHaveLength(2);
    expect(db.ledger.every((e: any) => e.groupId === "st-ob-1-6000")).toBe(true);
  });

  it("liquidación parcial: PARTIALLY_PAID (estado del contrato)", async () => {
    process.env[SETTLEMENT_FLAG] = "true";
    process.env[BOOKS_FLAG] = "true";
    const db = fakeDb([{ id: "ob-1", state: "OPEN", amountBunz: 60, settledBunz: 0, settledFiatMxn: 0 }]);
    const r = await settleObligation(db, {
      obligationId: "ob-1",
      bunz: 20,
      tables: { obligations: {}, events: {}, ledger: {} },
    });
    expect(r.state).toBe("PARTIALLY_PAID");
    expect(r.settledBunz).toBe(20);
    expect(db.events[0]).toMatchObject({ fromState: "OPEN", toState: "PARTIALLY_PAID" });
  });

  it("no liquida una obligación ya PAID", async () => {
    process.env[SETTLEMENT_FLAG] = "true";
    process.env[BOOKS_FLAG] = "true";
    const db = fakeDb([{ id: "ob-1", state: "PAID", amountBunz: 60, settledBunz: 60, settledFiatMxn: 0 }]);
    const r = await settleObligation(db, {
      obligationId: "ob-1",
      bunz: 10,
      tables: { obligations: {}, events: {}, ledger: {} },
    });
    expect(r.ok).toBe(false);
    expect(db.ledger).toHaveLength(0);
  });
});
