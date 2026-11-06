import { describe, it, expect, vi } from "vitest";
import {
  markProviderWebhookEventDiscrepancy,
  resolveProviderWebhookDiscrepancy,
} from "../services/paymentCore";

function buildDb() {
  const updates: Record<string, unknown>[] = [];
  return {
    updates,
    db: {
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockImplementation((value: Record<string, unknown>) => {
          updates.push(value);
          return { where: vi.fn().mockResolvedValue(true) };
        }),
      }),
    },
  };
}

describe("P0-2 — ciclo de vida de discrepancias", () => {
  it("marca el evento como DISCREPANCY con código y mensaje", async () => {
    const { db, updates } = buildDb();

    await markProviderWebhookEventDiscrepancy(db as never, {
      eventId: "evt_1",
      paymentIntentId: "pi_1",
      code: "SETTLEMENT_NOT_ALLOWED",
      message: "la orden está COMPLETED",
    });

    expect(updates[0]).toMatchObject({
      status: "DISCREPANCY",
      paymentIntentId: "pi_1",
      errorMessage: "SETTLEMENT_NOT_ALLOWED: la orden está COMPLETED",
    });
  });

  it("permite resolver a REFUNDED / RECONCILED", async () => {
    const { db, updates } = buildDb();

    await resolveProviderWebhookDiscrepancy(db as never, {
      eventId: "evt_1",
      status: "REFUNDED",
      note: "reembolso manual",
    });

    expect(updates[0]).toMatchObject({
      status: "REFUNDED",
      errorMessage: "REFUNDED: reembolso manual",
    });
  });
});
