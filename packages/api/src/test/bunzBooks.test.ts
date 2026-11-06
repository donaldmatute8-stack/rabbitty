import { afterEach, describe, expect, it } from "vitest";
import {
  BOOKS_FLAG,
  buildEmissionLedger,
  buildRedemptionAttempt,
  buildRedemptionLedger,
  hashUser,
  isBooksEnabled,
  recordEmissionBooks,
  recordRedemptionBooks,
  recordSettlementBooks,
  recordReversalBooks,
  buildReversalLedger,
} from "../services/bunzBooks";

type MockTx = {
  calls: Array<{ rows: unknown }>;
  insert: (table: unknown) => {
    values: (rows: unknown) => { onConflictDoNothing: () => Promise<void> };
  };
  transaction: <T>(fn: (sp: MockTx) => Promise<T>) => Promise<T>;
};

/** Simula tx con savepoint: si `fail`, el insert rechaza y el servicio lo captura. */
function fakeTx(fail = false): MockTx {
  const calls: Array<{ rows: unknown }> = [];
  const tx: MockTx = {
    calls,
    insert(_table: unknown) {
      return {
        values(rows: unknown) {
          calls.push({ rows });
          return {
            onConflictDoNothing: async () => {
              if (fail) throw new Error("db down");
            },
          };
        },
      };
    },
    async transaction<T>(fn: (sp: MockTx) => Promise<T>): Promise<T> {
      return fn(tx);
    },
  };
  return tx;
}

const tables = { attempts: {}, ledger: {} };

afterEach(() => {
  delete process.env[BOOKS_FLAG];
});

describe("escritores del libro Bunz — OT-1 / OT-3", () => {
  it("el flag está apagado por defecto", () => {
    expect(isBooksEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isBooksEnabled({ [BOOKS_FLAG]: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(isBooksEnabled({ [BOOKS_FLAG]: "1" } as NodeJS.ProcessEnv)).toBe(true);
  });

  it("el usuario se hashea y nunca se guarda el original", () => {
    const h = hashUser("cliente-123");
    expect(h).toHaveLength(32);
    expect(h).toBe(hashUser("cliente-123"));
    expect(h).not.toContain("cliente");
    expect(hashUser(null)).toBe("walkin");
  });

  it("los asientos de redención balancean y son deterministas", () => {
    const rows = buildRedemptionLedger({ orderId: "o1", bunz: 100, at: new Date("2026-11-06T10:00:00Z") });
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe("rd-o1-d");
    expect(rows[1]!.id).toBe("rd-o1-c");
    expect(rows[0]!.groupId).toBe(rows[1]!.groupId);
    const debit = rows.filter((r) => r.direction === "debit").reduce((a, r) => a + r.amount, 0);
    const credit = rows.filter((r) => r.direction === "credit").reduce((a, r) => a + r.amount, 0);
    expect(debit).toBe(credit);
  });

  it("la emisión también balancea (aún sin cablear)", () => {
    const rows = buildEmissionLedger({ orderId: "o1", bunz: 50 });
    expect(rows.map((r) => r.account)).toEqual(["emission_budget", "user_wallet"]);
    expect(rows[0]!.amount).toBe(50);
  });

  it("el intento cumplido queda idempotente", () => {
    const a = buildRedemptionAttempt({ orderId: "o1", branchId: "b1", bunz: 100, userHash: "u1" });
    expect(a?.id).toBe("rd-o1");
    expect(a?.idempotencyKey).toBe("rd-o1");
    expect(a?.status).toBe("fulfilled");
    expect(a?.bunzFulfilled).toBe(100);
    expect(a?.reasons).toBe("[]");
    expect(buildRedemptionAttempt({ orderId: "o1", branchId: "b1", bunz: 0, userHash: "u1" })).toBeNull();
  });

  it("con el flag apagado no se escribe nada", async () => {
    const tx = fakeTx();
    const r = await recordRedemptionBooks(tx, { orderId: "o1", branchId: "b1", bunz: 100, tables });
    expect(r.ok).toBe(true);
    expect(tx.calls).toHaveLength(0);
  });

  it("con el flag encendido escribe intento y asientos, sin lanzar", async () => {
    process.env[BOOKS_FLAG] = "true";
    const tx = fakeTx();
    const r = await recordRedemptionBooks(tx, { orderId: "o1", branchId: "b1", bunz: 100, userHash: "u1", tables });
    expect(r.ok).toBe(true);
    expect(tx.calls).toHaveLength(2);
  });

  it("si la tabla no existe, el pago NO falla: devuelve errores", async () => {
    process.env[BOOKS_FLAG] = "true";
    const tx = fakeTx(true);
    const r = await recordRedemptionBooks(tx, { orderId: "o1", branchId: "b1", bunz: 100, tables });
    expect(r.ok).toBe(false);
    expect(r.errors).toHaveLength(1);
  });
});

describe("emisión y liquidación", () => {
  it("la emisión se registra al cobrar y balancea", async () => {
    process.env[BOOKS_FLAG] = "true";
    const tx = fakeTx();
    const r = await recordEmissionBooks(tx, { orderId: "o1", bunz: 50, tables: { ledger: {} } });
    expect(r.ok).toBe(true);
    expect(tx.calls).toHaveLength(1);
    const rows = tx.calls[0]!.rows as Array<{ direction: string; amount: number }>;
    expect(rows).toHaveLength(2);
    expect(rows[0]!.amount).toBe(rows[1]!.amount);
  });

  it("la liquidación usa commission_reserved → treasury_bunz", async () => {
    process.env[BOOKS_FLAG] = "true";
    const tx = fakeTx();
    const r = await recordSettlementBooks(tx, { obligationId: "ob1", bunz: 80, tables: { ledger: {} } });
    expect(r.ok).toBe(true);
    const rows = tx.calls[0]!.rows as Array<{ account: string }>;
    expect(rows.map((x) => x.account)).toEqual(["commission_reserved", "treasury_bunz"]);
  });

  it("con el flag apagado, emisión y liquidación son no-op", async () => {
    const tx = fakeTx();
    await recordEmissionBooks(tx, { orderId: "o1", bunz: 50, tables: { ledger: {} } });
    await recordSettlementBooks(tx, { obligationId: "ob1", bunz: 10, tables: { ledger: {} } });
    expect(tx.calls).toHaveLength(0);
  });
});

describe("reversión por reembolso", () => {
  it("invierte débito/crédito con ids rv- y grupo rv-", () => {
    const original = buildRedemptionLedger({ orderId: "o1", bunz: 100 });
    const rev = buildReversalLedger({ original });
    expect(rev.map((r) => r.direction)).toEqual(["credit", "debit"]);
    expect(rev.map((r) => r.id)).toEqual(["rv-rd-o1-d", "rv-rd-o1-c"]);
    expect(rev.every((r) => r.groupId.startsWith("rv-"))).toBe(true);
    expect(rev.every((r) => r.refType === "reversal")).toBe(true);
  });

  it("no revierte una reversión (evita bucles)", () => {
    const original = buildRedemptionLedger({ orderId: "o1", bunz: 100 });
    const rev = buildReversalLedger({ original }).map((r) => ({ ...r, id: `rv-${r.id}` }));
    const tx = fakeTx();
    // rows = [] porque todos los originales empiezan por rv-
    return recordReversalBooks(tx, { original: rev, tables: { ledger: {} } }).then((r) => {
      expect(r.ok).toBe(true);
      expect(tx.calls).toHaveLength(0);
    });
  });
});
