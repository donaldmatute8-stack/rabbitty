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
