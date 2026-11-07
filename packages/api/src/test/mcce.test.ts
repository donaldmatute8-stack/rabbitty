import { afterEach, describe, expect, it } from "vitest";
import { merchantCapacityAccounts } from "@rabbitty/database-core";
import {
  MCCE_ENABLED_FLAG,
  MCCE_MODE_FLAG,
  consumeCapacity,
  mcceMode,
  recognizeActivity,
  restoreCapacity,
  validateCapacityAccount,
} from "../services/mcce";

const ACCOUNT = {
  affiliateId: "a1",
  status: "ACTIVE",
  authorizedTotal: 3500,
  promoAuthorized: 1400,
  creditAuthorized: 2100,
  provisioned: 2000,
  generated: 0,
  committed: 0,
  available: 2000,
  creditOutstanding: 1200,
  creditDisbursed: 1200,
  creditRepaid: 0,
  retainShare: 0.4,
  coverageDays: 30,
  sandbox: false,
};

function fakeTx(account: any, eventExists = false) {
  const updates: any[] = [];
  const events: any[] = [];
  const tx: any = {
    updates,
    events,
    select() {
      let table: any;
      const chain: any = {
        from(t: any) {
          table = t;
          return chain;
        },
        where() {
          if (table === merchantCapacityAccounts) {
            const p: any = Promise.resolve(account ? [account] : []);
            p.for = async () => (account ? [account] : []);
            return p;
          }
          const p: any = Promise.resolve(eventExists ? [{ id: "existing" }] : []);
          p.limit = async () => (eventExists ? [{ id: "existing" }] : []);
          return p;
        },
        limit: async () => (eventExists ? [{ id: "existing" }] : []),
      };
      return chain;
    },
    update(t: any) {
      return {
        set(patch: any) {
          return {
            where: async () => {
              updates.push({ table: t, patch });
            },
          };
        },
      };
    },
    insert(t: any) {
      return {
        values(v: any) {
          events.push({ table: t, value: v });
          return { onConflictDoNothing: async () => undefined };
        },
      };
    },
  };
  return tx;
}

afterEach(() => {
  delete process.env[MCCE_ENABLED_FLAG];
  delete process.env[MCCE_MODE_FLAG];
});

describe("MCCE — modos y motor", () => {
  it("apagado por defecto; shadow si se enciende sin modo", () => {
    expect(mcceMode({} as NodeJS.ProcessEnv)).toBe("off");
    expect(mcceMode({ [MCCE_ENABLED_FLAG]: "true" } as NodeJS.ProcessEnv)).toBe("shadow");
    expect(
      mcceMode({ [MCCE_ENABLED_FLAG]: "true", [MCCE_MODE_FLAG]: "dual" } as NodeJS.ProcessEnv)
    ).toBe("dual");
  });

  it("con el motor apagado no lee ni escribe", async () => {
    const tx = fakeTx(ACCOUNT);
    const r = await recognizeActivity(tx, { affiliateId: "a1", reward: 100, orderId: "o1" });
    expect(r.skipped).toBe("disabled");
    expect(tx.updates).toHaveLength(0);
  });

  it("dual: reconoce actividad y recupera sin duplicar valor", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const tx = fakeTx(ACCOUNT);
    const r = await recognizeActivity(tx, { affiliateId: "a1", reward: 100, orderId: "o1" });
    expect(r.retained).toBe(40);
    expect(r.generatedNet).toBe(60);
    expect(r.creditOutstandingAfter).toBe(1160);
    expect(r.availableAfter).toBe(2060);

    const accountUpdate = tx.updates.find((u: any) => u.patch.provisioned != null);
    expect(accountUpdate.patch.provisioned).toBe(2060);
    expect(accountUpdate.patch.creditRepaid).toBe(40);
    expect(accountUpdate.patch.creditOutstanding).toBe(1160);
    // Valor conservado: 100 = 60 (neto) + 40 (retenido)
    expect(r.generatedNet! + r.retained!).toBeCloseTo(100, 5);
  });

  it("shadow: registra el evento pero no mueve la cuenta", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "shadow";
    const tx = fakeTx(ACCOUNT);
    const r = await recognizeActivity(tx, { affiliateId: "a1", reward: 100, orderId: "o1" });
    expect(r.mode).toBe("shadow");
    expect(tx.updates).toHaveLength(0);
    expect(tx.events).toHaveLength(1);
    expect(tx.events[0].value.metadata.shadow).toBe(true);
  });

  it("idempotencia: el mismo orderId no se aplica dos veces", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const tx = fakeTx(ACCOUNT, true);
    const r = await recognizeActivity(tx, { affiliateId: "a1", reward: 100, orderId: "o1" });
    expect(r.skipped).toBe("idempotent");
    expect(tx.updates).toHaveLength(0);
  });

  it("consume capacidad y la deja disponible", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const tx = fakeTx(ACCOUNT);
    const r = await consumeCapacity(tx, { affiliateId: "a1", bunz: 100, intentId: "i1" });
    expect(r.availableAfter).toBe(1900);
    const update = tx.updates.find((u: any) => u.patch.provisioned != null);
    expect(update.patch.provisioned).toBe(1900);
    expect(update.patch.available).toBe(1900);
    expect(tx.events[0].value.type).toBe("CAPACITY_CONSUMED");
  });

  it("restaura capacidad en un reembolso", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const tx = fakeTx(ACCOUNT);
    const r = await restoreCapacity(tx, { affiliateId: "a1", bunz: 100, refundId: "p1" });
    expect(r.availableAfter).toBe(2100);
    expect(tx.events[0].value.type).toBe("CAPACITY_RESTORED");
  });

  it("invariantes de la cuenta", () => {
    expect(validateCapacityAccount(ACCOUNT)).toEqual([]);
    const bad = { ...ACCOUNT, creditRepaid: 500, creditOutstanding: 1000 };
    expect(validateCapacityAccount(bad).length).toBeGreaterThan(0);
    const bad2 = { ...ACCOUNT, provisioned: 100, committed: 200, available: 0 };
    expect(validateCapacityAccount(bad2).length).toBeGreaterThan(0);
  });
});
