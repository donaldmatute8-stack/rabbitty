import { describe, it, expect, vi, beforeEach } from "vitest";

// In-memory tables for unit tests
const mockPaymentIntents: any[] = [];
const mockUsers: any[] = [];
const mockOrders: any[] = [];
const mockPayments: any[] = [];
const mockLedgerEntries: any[] = [];

vi.mock("@rabbitty/database-core", () => ({
  users: { name: "users" },
}));

vi.mock("@rabbitty/database-restaurant", () => ({
  paymentIntents: { name: "payment_intents" },
  orders: { name: "orders" },
  payments: { name: "payments" },
  ledgerEntries: { name: "ledger_entries" },
  distributionRules: { name: "distribution_rules" },
  distributionAllocations: { name: "distribution_allocations" },
  settlementOperations: { name: "settlement_operations" },
}));

vi.mock("@rabbitty/api", () => {
  let txQueue: Promise<void> = Promise.resolve();
  const fakeDb: any = {
    select: () => ({
      from: (table: any) => ({
        where: (_condition: any) => {
          const isUsers = table?.name === "users";
          const isRules = table?.name === "distribution_rules";
          const data = isUsers ? [...mockUsers] : isRules ? [] : [...mockPaymentIntents];
          const res: any = [...data];
          res.limit = (_n: number) => [...data];
          res.for = (_mode: string) => [...data];
          return res;
        },
      }),
    }),
    insert: (table: any) => ({
      values: (val: any) => {
        const isLedger = table?.name === "ledger_entries";
        const isIntent = table?.name === "payment_intents";
        const row = { id: val.id || "gen_id", ...val };
        if (isIntent) mockPaymentIntents.push(row);
        if (isLedger) mockLedgerEntries.push(row);
        return {
          returning: () => [row],
        };
      },
    }),
    update: (table: any) => ({
      set: (updates: any) => ({
        where: () => {
          const isUsers = table?.name === "users";
          if (isUsers && mockUsers.length > 0) {
            Object.assign(mockUsers[0], updates);
          } else if (mockPaymentIntents.length > 0) {
            Object.assign(mockPaymentIntents[0], updates);
          }
          return [updates];
        },
      }),
    }),
    transaction: async (cb: any) => {
      // Models PostgreSQL row lock / transaction serialization queue
      const current = txQueue;
      let release: () => void = () => {};
      txQueue = new Promise((resolve) => { release = resolve; });
      await current;
      try {
        return await cb(fakeDb);
      } finally {
        release();
      }
    },
  };

  return {
    getRestaurantDb: () => fakeDb,
    getCoreDb: () => fakeDb,
  };
});

import { PaymentIntentService } from "./intent";

describe("PaymentIntent Invariants (Phase 3.5 Authority Lock)", () => {
  const tenantId = "branch_001";
  const posCreatorId = "pos_terminal_1";
  const userA = "telegram_user_A";
  const userB = "telegram_user_B";

  beforeEach(() => {
    mockPaymentIntents.length = 0;
    mockOrders.length = 0;
    mockPayments.length = 0;
    mockLedgerEntries.length = 0;
    mockUsers.length = 0;

    // Seed mock user with sufficient balance
    mockUsers.push({
      id: "usr_1",
      telegramId: userA,
      totalBunzEarned: 1000,
      totalBunzSpent: 0,
    });
  });

  it("Double Approval & Idempotency", async () => {
    const intent = await PaymentIntentService.createIntent({
      tenantId,
      creatorSubjectId: posCreatorId,
      amountMxn: 100,
      idempotencyKey: "test_idem_1",
    });

    expect(intent.amountMxn).toBe(100);
    expect(intent.bunzAmount).toBe(100);
    expect(intent.status).toBe("PENDING_PAYMENT");

    // 1. Approve once -> transitions directly to SETTLED
    const firstApproval = await PaymentIntentService.approveIntent(intent.id, userA);
    expect(firstApproval.status).toBe("SETTLED");
    expect(firstApproval.payerSubjectId).toBe(userA);

    // 2. Approve again with SAME user -> Idempotent response
    const secondApproval = await PaymentIntentService.approveIntent(intent.id, userA);
    expect(secondApproval.status).toBe("SETTLED");
    expect(secondApproval.payerSubjectId).toBe(userA);

    // 3. Try to approve with DIFFERENT user -> Forbidden
    await expect(PaymentIntentService.approveIntent(intent.id, userB))
      .rejects.toThrow("INTENT_ALREADY_SETTLED_BY_OTHER");
  });

  it("Rejects unauthenticated SYSTEM approval (Finding C1)", async () => {
    const intent = await PaymentIntentService.createIntent({
      tenantId,
      creatorSubjectId: posCreatorId,
      amountMxn: 100,
      idempotencyKey: "test_idem_sys",
    });

    await expect(PaymentIntentService.approveIntent(intent.id, "SYSTEM"))
      .rejects.toThrow("PAYER_REQUIRED_FOR_SETTLEMENT");
  });

  it("Enforces sufficient funds (Finding C2)", async () => {
    const intent = await PaymentIntentService.createIntent({
      tenantId,
      creatorSubjectId: posCreatorId,
      amountMxn: 5000, // Exceeds user balance of 1000
      idempotencyKey: "test_idem_funds",
    });

    await expect(PaymentIntentService.approveIntent(intent.id, userA))
      .rejects.toThrow("LEDGER_INSUFFICIENT_FUNDS");
  });

  it("Expiration Protection", async () => {
    const intent = await PaymentIntentService.createIntent({
      tenantId,
      creatorSubjectId: posCreatorId,
      amountMxn: 100,
      idempotencyKey: "test_idem_2",
    });

    // Simulate expiration
    mockPaymentIntents[0].expiresAt = new Date(Date.now() - 10000);

    await expect(PaymentIntentService.approveIntent(intent.id, userA))
      .rejects.toThrow("INTENT_EXPIRED");
  });

  it("Amount Tampering & QR Immutability", async () => {
    const intent = await PaymentIntentService.createIntent({
      tenantId,
      creatorSubjectId: posCreatorId,
      amountMxn: 500,
      idempotencyKey: "test_idem_3",
    });

    // The client only passes intentId to approveIntent, not amount
    const approved = await PaymentIntentService.approveIntent(intent.id, userA);
    expect(approved.amountMxn).toBe(500);
    expect(approved.bunzAmount).toBe(500);
  });

  it("Concurrency Race Protection (Finding A3)", async () => {
    const intent = await PaymentIntentService.createIntent({
      tenantId,
      creatorSubjectId: posCreatorId,
      amountMxn: 100,
      idempotencyKey: "test_idem_race",
    });

    // Seed mockUser for userB as well
    mockUsers.push({
      id: "usr_2",
      telegramId: userB,
      totalBunzEarned: 1000,
      totalBunzSpent: 0,
    });

    // Both userA and userB attempt to approve the exact same intent concurrently
    const results = await Promise.allSettled([
      PaymentIntentService.approveIntent(intent.id, userA),
      PaymentIntentService.approveIntent(intent.id, userB),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    // Exactly one must succeed, and one must be rejected
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);
  });
});

