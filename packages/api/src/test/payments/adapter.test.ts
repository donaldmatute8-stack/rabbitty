import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  createIntent: vi.fn(),
  getIntent: vi.fn(),
  approveIntent: vi.fn(),
}));

vi.mock("../../services/paymentIntentDomain", () => ({
  PaymentIntentService: {
    createIntent: mocks.createIntent,
    getIntent: mocks.getIntent,
    approveIntent: mocks.approveIntent,
  },
}));

import {
  createPaymentIntentDomainAdapter,
  toCanonicalIntent,
} from "../../services/payments/adapters/paymentIntentDomainAdapter";

const domainIntent = {
  id: "pi_1",
  tenantId: "b1",
  orderId: "o1",
  creatorSubjectId: "staff_1",
  payerSubjectId: "usr_1",
  amountMxn: 300,
  bunzAmount: 120,
  currency: "MXN",
  status: "SETTLED",
  idempotencyKey: "key_1",
  expiresAt: new Date("2026-01-01T00:00:00Z"),
  createdAt: new Date("2026-01-01T00:00:00Z"),
  paidAt: new Date("2026-01-01T00:00:00Z"),
};

describe("RP-0.1 — adapter de paymentIntentDomain", () => {
  beforeEach(() => {
    mocks.createIntent.mockReset();
    mocks.getIntent.mockReset();
    mocks.approveIntent.mockReset();
  });

  it("mapea el intent legacy al canónico", () => {
    const canonical = toCanonicalIntent(domainIntent as never);

    expect(canonical.id).toBe("pi_1");
    expect(canonical.ids.branchId).toBe("b1");
    expect(canonical.ids.orderId).toBe("o1");
    expect(canonical.ids.customerId).toBe("usr_1");
    expect(canonical.status).toBe("SUCCEEDED");
    expect(canonical.method).toBe("BUNZ");
    expect(canonical.amounts.total.amountMinor).toBe(30000);
    expect(canonical.amounts.bunz).toBe(120);
    expect(canonical.amounts.fiat.amountMinor).toBe(18000);
  });

  it("getIntent delega y mapea", async () => {
    mocks.getIntent.mockResolvedValue(domainIntent);
    const adapter = createPaymentIntentDomainAdapter();

    const result = await adapter.getIntent("pi_1");

    expect(mocks.getIntent).toHaveBeenCalledWith("pi_1");
    expect(result?.status).toBe("SUCCEEDED");
  });

  it("settleIntent delega en approveIntent (misma autoridad)", async () => {
    mocks.approveIntent.mockResolvedValue(domainIntent);
    const adapter = createPaymentIntentDomainAdapter();

    const result = await adapter.settleIntent("pi_1", "usr_1");

    expect(mocks.approveIntent).toHaveBeenCalledWith("pi_1", "usr_1");
    expect(result).toMatchObject({ ok: true, status: "SUCCEEDED", orderState: "PAID" });
  });

  it("createIntent traduce el monto a MXN y delega", async () => {
    mocks.createIntent.mockResolvedValue(domainIntent);
    const adapter = createPaymentIntentDomainAdapter();

    const result = await adapter.createIntent({
      ids: { branchId: "b1", orderId: "o1", creatorId: "staff_1" },
      amounts: {
        total: { amountMinor: 30000, currency: "MXN" },
        fiat: { amountMinor: 18000, currency: "MXN" },
        bunz: 120,
        tip: { amountMinor: 0, currency: "MXN" },
        platformFee: { amountMinor: 0, currency: "MXN" },
      },
      method: "BUNZ",
      creatorId: "staff_1",
      idempotencyKey: "key_1",
    });

    expect(mocks.createIntent).toHaveBeenCalledWith({
      tenantId: "b1",
      creatorSubjectId: "staff_1",
      amountMxn: 300,
      orderId: "o1",
      idempotencyKey: "key_1",
    });
    expect(result.id).toBe("pi_1");
  });

  it("cancelIntent no está soportado por el motor legacy", async () => {
    const adapter = createPaymentIntentDomainAdapter();
    await expect(adapter.cancelIntent("pi_1")).rejects.toThrow(/PAYMENT_ENGINE_UNSUPPORTED/);
  });
});
