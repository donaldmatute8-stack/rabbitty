import { describe, it, expect, vi } from "vitest";
import {
  confirmPaymentIntentSettled,
  markProviderWebhookEventDiscrepancy,
  resolveProviderWebhookDiscrepancy,
} from "../services/paymentCore";

type Row = Record<string, unknown>;

function buildDb(params: {
  intent: Row;
  order?: Row;
  reserve?: Row | null;
  payments?: Row[];
}) {
  const { intent, order = {}, reserve = null, payments = [] } = params;
  let step = 0;

  const tx = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => {
        step++;
        const current = step;
        return {
          where: vi.fn().mockImplementation(() => {
            if (current === 1) return { for: vi.fn().mockResolvedValue([intent]) };
            if (current === 2) return { for: vi.fn().mockResolvedValue([order]) };
            if (current === 3) return { for: vi.fn().mockResolvedValue(reserve ? [reserve] : []) };
            if (current === 4) return Promise.resolve(payments);
            return Promise.resolve([]);
          }),
        };
      }),
    })),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(true) }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(true) }),
    }),
    execute: vi.fn().mockResolvedValue(true),
  };

  return { transaction: async (cb: (t: unknown) => unknown) => cb(tx) };
}

const baseIntent: Row = {
  id: "pi_1",
  orderId: "ord_1",
  merchantId: "b1",
  netFiatCents: 0,
  bunzAmount: 0,
  currency: "MXN",
  status: "PENDING_PAYMENT",
  idempotencyKey: "key_1",
};

const baseOrder: Row = {
  id: "ord_1",
  branchId: "b1",
  status: "PENDING_PAYMENT",
  total: 0,
  bunzPaid: 0,
};

describe("P0-2 — solo se liquidan intents vigentes y órdenes abiertas", () => {
  it("rechaza un intent CANCELLED", async () => {
    const db = buildDb({ intent: { ...baseIntent, status: "CANCELLED" }, order: baseOrder });

    await expect(
      confirmPaymentIntentSettled(db as never, {
        paymentIntentId: "pi_1",
        verifiedMethod: "STRIPE_CARD",
      })
    ).rejects.toThrow(/SETTLEMENT_NOT_ALLOWED.*CANCELLED/);
  });

  it("rechaza un intent EXPIRED", async () => {
    const db = buildDb({ intent: { ...baseIntent, status: "EXPIRED" }, order: baseOrder });

    await expect(
      confirmPaymentIntentSettled(db as never, {
        paymentIntentId: "pi_1",
        verifiedMethod: "STRIPE_CARD",
      })
    ).rejects.toThrow(/SETTLEMENT_NOT_ALLOWED.*EXPIRED/);
  });

  it("rechaza un intent que expiró fuera de la gracia de 5 min", async () => {
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const db = buildDb({ intent: { ...baseIntent, expiresAt: old }, order: baseOrder });

    await expect(
      confirmPaymentIntentSettled(db as never, {
        paymentIntentId: "pi_1",
        verifiedMethod: "STRIPE_CARD",
      })
    ).rejects.toThrow(/SETTLEMENT_NOT_ALLOWED.*expiró/);
  });

  it("rechaza una orden COMPLETED", async () => {
    const db = buildDb({ intent: baseIntent, order: { ...baseOrder, status: "COMPLETED" } });

    await expect(
      confirmPaymentIntentSettled(db as never, {
        paymentIntentId: "pi_1",
        verifiedMethod: "STRIPE_CARD",
      })
    ).rejects.toThrow(/SETTLEMENT_NOT_ALLOWED.*COMPLETED/);
  });

  it("rechaza una orden PAID", async () => {
    const db = buildDb({ intent: baseIntent, order: { ...baseOrder, status: "PAID" } });

    await expect(
      confirmPaymentIntentSettled(db as never, {
        paymentIntentId: "pi_1",
        verifiedMethod: "STRIPE_CARD",
      })
    ).rejects.toThrow(/SETTLEMENT_NOT_ALLOWED.*PAID/);
  });

  it("rechaza si la orden es de otra sucursal", async () => {
    const db = buildDb({ intent: baseIntent, order: { ...baseOrder, branchId: "b2" } });

    await expect(
      confirmPaymentIntentSettled(db as never, {
        paymentIntentId: "pi_1",
        verifiedMethod: "STRIPE_CARD",
      })
    ).rejects.toThrow(/SETTLEMENT_NOT_ALLOWED.*sucursal/);
  });

  it("liquida un intent vigente con orden abierta", async () => {
    const db = buildDb({ intent: baseIntent, order: baseOrder });

    const res = await confirmPaymentIntentSettled(db as never, {
      paymentIntentId: "pi_1",
      verifiedMethod: "STRIPE_CARD",
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("SUCCEEDED");
  });

  it("dos liquidaciones seguidas: la segunda no vuelve a insertar pagos", async () => {
    const intent: Row = { ...baseIntent, netFiatCents: 100 };
    const order: Row = { ...baseOrder, total: 1 };
    let inserts = 0;

    let step = 0;
    const tx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          step++;
          const current = step;
          return {
            where: vi.fn().mockImplementation(() => {
              if (current === 1) return { for: vi.fn().mockResolvedValue([intent]) };
              if (current === 2) return { for: vi.fn().mockResolvedValue([order]) };
              if (current === 3) return { for: vi.fn().mockResolvedValue([]) };
              if (current === 4) return Promise.resolve([]);
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation(() => {
          inserts++;
          return Promise.resolve(true);
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(true) }),
      }),
      execute: vi.fn().mockResolvedValue(true),
    };
    const db = {
      transaction: async (cb: (t: unknown) => unknown) => {
        step = 0; // cada transacción reinicia el orden de selects
        return cb(tx);
      },
    };

    await confirmPaymentIntentSettled(db as never, {
      paymentIntentId: "pi_1",
      verifiedMethod: "STRIPE_CARD",
    });
    const first = inserts;

    // La primera liquidación dejó el intent SUCCEEDED (como haría la DB real)
    intent.status = "SUCCEEDED";

    const res = await confirmPaymentIntentSettled(db as never, {
      paymentIntentId: "pi_1",
      verifiedMethod: "STRIPE_CARD",
    });

    expect(first).toBeGreaterThan(0);
    expect(inserts).toBe(first); // no hubo segundo insert
    expect(res.success).toBe(true);
  });

  it("usa el momento financiero de Stripe para la gracia (no el de procesamiento)", async () => {
    const expiredLongAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const paidInTime = new Date(Date.now() - 11 * 60 * 1000).toISOString();
    const db = buildDb({
      intent: { ...baseIntent, expiresAt: expiredLongAgo },
      order: baseOrder,
    });

    const res = await confirmPaymentIntentSettled(db as never, {
      paymentIntentId: "pi_1",
      verifiedMethod: "STRIPE_CARD",
      paidAtExternal: paidInTime,
    });

    expect(res.success).toBe(true);
  });

  it("rechaza si la cuenta Connect del cargo no es la de la sucursal", async () => {
    let step = 0;
    const tx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          step++;
          const current = step;
          return {
            where: vi.fn().mockImplementation(() => {
              if (current === 1) return { for: vi.fn().mockResolvedValue([baseIntent]) };
              if (current === 2) return { for: vi.fn().mockResolvedValue([baseOrder]) };
              if (current === 3) {
                return {
                  limit: vi.fn().mockResolvedValue([{ stripeAccountId: "acct_otra" }]),
                };
              }
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(true) }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(true) }),
      }),
      execute: vi.fn().mockResolvedValue(true),
    };
    const db = { transaction: async (cb: (t: unknown) => unknown) => cb(tx) };

    await expect(
      confirmPaymentIntentSettled(db as never, {
        paymentIntentId: "pi_1",
        verifiedMethod: "STRIPE_CARD",
        expectedStripeAccountId: "acct_esperada",
      })
    ).rejects.toThrow(/cuenta Connect/);
  });

  it("si el afiliado no tiene stock, libera el hold y marca RECOVERY_HOLD", async () => {
    const updates: Record<string, unknown>[] = [];
    let step = 0;

    const tx = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => {
          step++;
          const current = step;
          return {
            where: vi.fn().mockImplementation(() => {
              if (current === 1) {
                return { for: vi.fn().mockResolvedValue([{ ...baseIntent, bunzAmount: 10 }]) };
              }
              if (current === 2) return { for: vi.fn().mockResolvedValue([baseOrder]) };
              if (current === 3) {
                return {
                  for: vi.fn().mockResolvedValue([
                    { id: "res_1", userId: "usr_1", amount: 10, status: "RESERVED" },
                  ]),
                };
              }
              if (current === 4) return { limit: vi.fn().mockResolvedValue([{ restaurantId: "rest_1" }]) };
              if (current === 5) return { limit: vi.fn().mockResolvedValue([{ businessId: "biz_1" }]) };
              if (current === 6) return Promise.resolve([]);
              return Promise.resolve([]);
            }),
          };
        }),
      })),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((value: Record<string, unknown>) => {
          updates.push(value);
          if ("bunzBalance" in value) {
            return {
              where: vi.fn().mockReturnValue({
                returning: vi.fn().mockResolvedValue([]), // sin stock
              }),
            };
          }
          return { where: vi.fn().mockResolvedValue(true) };
        }),
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(true) }),
      execute: vi.fn().mockResolvedValue(true),
    };
    const db = { transaction: async (cb: (t: unknown) => unknown) => cb(tx) };

    const res = await confirmPaymentIntentSettled(db as never, {
      paymentIntentId: "pi_1",
      verifiedMethod: "STRIPE_CARD",
    });

    expect(res.recoveryHold).toBe(true);
    expect(updates.some((u) => u.status === "RECOVERY_HOLD")).toBe(true);
  });

  it("es idempotente si el intent ya está SUCCEEDED", async () => {
    const db = buildDb({ intent: { ...baseIntent, status: "SUCCEEDED" }, order: baseOrder });

    const res = await confirmPaymentIntentSettled(db as never, {
      paymentIntentId: "pi_1",
      verifiedMethod: "STRIPE_CARD",
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("SUCCEEDED");
  });
});
