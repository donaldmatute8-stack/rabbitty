import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  cancelStripePaymentIntent: vi.fn(),
}));

vi.mock("../services/stripeConnect", () => ({
  cancelStripePaymentIntent: mocks.cancelStripePaymentIntent,
}));

import { releasePaymentIntentHold } from "../services/paymentCore";

type AnyRecord = Record<string, unknown>;

function buildDb(intent: AnyRecord, reserve: AnyRecord | null = null) {
  let selectCount = 0;
  const updates: AnyRecord[] = [];

  const tx = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockReturnValue({
          for: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) return Promise.resolve([intent]);
            return Promise.resolve(reserve ? [reserve] : []);
          }),
        }),
      })),
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockImplementation((value: AnyRecord) => {
        updates.push(value);
        return { where: vi.fn().mockResolvedValue(true) };
      }),
    }),
  };

  const db = { transaction: async (cb: (t: unknown) => unknown) => cb(tx) };
  return { db, updates };
}

const intentBase = {
  id: "pi_1",
  orderId: "ord_1",
  status: "PENDING_PAYMENT",
  provider: "STRIPE",
  externalIntentId: "pi_stripe_123",
  payerSubjectId: null,
};

describe("P0-1 — cancelar también el PaymentIntent en Stripe", () => {
  beforeEach(() => {
    mocks.cancelStripePaymentIntent.mockReset();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
    delete process.env.RABBITTY_PAY_CANCEL_STRIPE;
  });

  it("anula en Stripe y libera el hold local", async () => {
    mocks.cancelStripePaymentIntent.mockResolvedValue("canceled");
    const reserve = { id: "res_1", userId: "usr_1", amount: 50, status: "RESERVED" };
    const { db, updates } = buildDb(intentBase, reserve);

    const res = await releasePaymentIntentHold(db as never, {
      paymentIntentId: "pi_1",
      reason: "CASHIER_CANCELLED",
    });

    expect(mocks.cancelStripePaymentIntent).toHaveBeenCalledWith("pi_stripe_123");
    expect(res.released).toBe(true);
    expect(updates.some((u) => u.status === "CANCELLED")).toBe(true);
  });

  it("rechaza la cancelación si Stripe dice que ya se cobró (doble cobro)", async () => {
    mocks.cancelStripePaymentIntent.mockResolvedValue("succeeded");
    const { db, updates } = buildDb(intentBase);

    await expect(
      releasePaymentIntentHold(db as never, {
        paymentIntentId: "pi_1",
        reason: "CASHIER_CANCELLED",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });

    expect(updates.some((u) => u.status === "CANCELLED")).toBe(false);
  });

  it("no llama a Stripe si el intent no tiene externalIntentId", async () => {
    const { db } = buildDb({ ...intentBase, externalIntentId: null });

    const res = await releasePaymentIntentHold(db as never, {
      paymentIntentId: "pi_1",
      reason: "TIP_UPDATED",
    });

    expect(mocks.cancelStripePaymentIntent).not.toHaveBeenCalled();
    expect(res.released).toBe(true);
  });

  it("se puede desactivar con RABBITTY_PAY_CANCEL_STRIPE=0", async () => {
    process.env.RABBITTY_PAY_CANCEL_STRIPE = "0";
    const { db } = buildDb(intentBase);

    await releasePaymentIntentHold(db as never, {
      paymentIntentId: "pi_1",
      reason: "EMERGENCY_FLAG_OFF",
    });

    expect(mocks.cancelStripePaymentIntent).not.toHaveBeenCalled();
  });
});
