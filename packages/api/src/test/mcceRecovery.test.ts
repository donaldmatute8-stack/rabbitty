import { afterEach, describe, expect, it } from "vitest";
import {
  MCCE_ENABLED_FLAG,
  MCCE_MODE_FLAG,
  MCCE_RECOVERY_MODE_FLAG,
  recognizeActivity,
} from "../services/mcce";
import {
  acceptRecoveryProposal,
  computeRecoveryRate,
  rejectRecoveryProposal,
} from "../services/mcceRecovery";
import {
  merchantCapacityAccounts,
  merchantCapacityEvents,
  merchantRecoveryProposals,
} from "@rabbitty/database-core";

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

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "rec-a1-2026-10-31",
    affiliateId: "a1",
    periodStart: new Date("2026-10-01"),
    periodEnd: new Date("2026-11-01"),
    grossGenerated: 100,
    proposedRate: 0.4,
    proposedAmount: 100,
    outstandingBefore: 1200,
    outstandingAfter: 1100,
    availableBefore: 2000,
    availableAfter: 1900,
    coverageBefore: 30,
    coverageAfter: 28.5,
    status: "PENDING",
    createdAt: new Date(Date.now() - 86_400_000),
    ...overrides,
  };
}

function fakeDb(row: any, account: any = { ...ACCOUNT }) {
  const tables = new Map<any, any[]>([
    [merchantRecoveryProposals, [row]],
    [merchantCapacityAccounts, account ? [account] : []],
  ]);
  const updates: any[] = [];
  const inserts: any[] = [];

  const db: any = {
    select() {
      let table: any;
      const chain: any = {
        from(t: any) {
          table = t;
          return chain;
        },
        where() {
          const rows = tables.get(table) ?? [];
          const p: any = Promise.resolve(rows);
          p.for = async () => rows;
          p.limit = async () => rows;
          return p;
        },
        limit() {
          return Promise.resolve(tables.get(table) ?? []);
        },
      };
      return chain;
    },
    update(t: any) {
      return {
        set(patch: any) {
          return {
            where: async () => {
              updates.push({ table: t, patch });
              for (const r of tables.get(t) ?? []) Object.assign(r, patch);
              return [];
            },
          };
        },
      };
    },
    insert(t: any) {
      return {
        values(v: any) {
          inserts.push({ table: t, value: v });
          return { onConflictDoNothing: async () => undefined };
        },
      };
    },
  };
  db.transaction = async (cb: any) => cb(db);
  return { db, updates, inserts, tables };
}

afterEach(() => {
  delete process.env[MCCE_ENABLED_FLAG];
  delete process.env[MCCE_MODE_FLAG];
  delete process.env[MCCE_RECOVERY_MODE_FLAG];
});

describe("Recuperación dinámica — fórmula", () => {
  it("sin pendiente no hay tasa", () => {
    expect(
      computeRecoveryRate({ outstanding: 0, expectedMonthlyGenerated: 100, coverageDays: 30 })
    ).toBe(0);
  });

  it("acota al máximo cuando el pendiente es alto", () => {
    const rate = computeRecoveryRate({
      outstanding: 1200,
      expectedMonthlyGenerated: 60,
      coverageDays: 30,
      targetMonths: 18,
      minCoverageDays: 7,
      rateMin: 0.2,
      rateMax: 0.6,
      repaidRatio: 0,
    });
    expect(rate).toBe(0.6);
  });

  it("si la cobertura está por debajo del mínimo no acelera: usa el mínimo", () => {
    const rate = computeRecoveryRate({
      outstanding: 1200,
      expectedMonthlyGenerated: 60,
      coverageDays: 3,
      targetMonths: 18,
      minCoverageDays: 7,
      rateMin: 0.2,
      rateMax: 0.6,
    });
    expect(rate).toBe(0.2);
  });

  it("redondea al 5% y respeta el rango", () => {
    const rate = computeRecoveryRate({
      outstanding: 900,
      expectedMonthlyGenerated: 100,
      coverageDays: 7,
      targetMonths: 18,
      minCoverageDays: 7,
      rateMin: 0.2,
      rateMax: 0.6,
      repaidRatio: 0,
    });
    expect(rate).toBe(0.4);
  });

  it("el progreso alto sube el factor y el bajo lo baja", () => {
    const low = computeRecoveryRate({
      outstanding: 900,
      expectedMonthlyGenerated: 100,
      coverageDays: 7,
      repaidRatio: 0,
      rateMin: 0.2,
      rateMax: 0.6,
    });
    const high = computeRecoveryRate({
      outstanding: 900,
      expectedMonthlyGenerated: 100,
      coverageDays: 7,
      repaidRatio: 1,
      rateMin: 0.2,
      rateMax: 0.6,
    });
    expect(high).toBeGreaterThan(low);
  });
});

describe("Recuperación dinámica — modo proposal", () => {
  it("no retiene en el evento: registra toda la capacidad generada", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    process.env[MCCE_RECOVERY_MODE_FLAG] = "proposal";

    const tx: any = fakeDb(proposal()).db;
    // adaptar fakeDb al contrato de recognizeActivity (select/update/insert)
    const result = await recognizeActivity(tx, {
      affiliateId: "a1",
      reward: 100,
      orderId: "o-proposal",
    });

    expect(result.recoveryMode).toBe("proposal");
    expect(result.retained).toBe(0);
    expect(result.generatedNet).toBe(100);
    expect(result.creditOutstandingAfter).toBe(1200);
  });

  it("per_event conserva el comportamiento anterior", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    process.env[MCCE_RECOVERY_MODE_FLAG] = "per_event";

    const tx: any = fakeDb(proposal()).db;
    const result = await recognizeActivity(tx, {
      affiliateId: "a1",
      reward: 100,
      orderId: "o-per-event",
    });
    expect(result.recoveryMode).toBe("per_event");
    expect(result.retained).toBe(40);
    expect(result.generatedNet).toBe(60);
  });
});

describe("Recuperación dinámica — aceptación y rechazo", () => {
  it("shadow: acepta y registra conformidad sin mover saldos", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "shadow";
    const { db, updates, inserts } = fakeDb(proposal());

    const result = await acceptRecoveryProposal(db, {
      id: "rec-a1-2026-10-31",
      affiliateId: "a1",
      actor: "user-1",
      evidence: { method: "name_checkbox" },
    });

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(false);
    expect(result.status).toBe("ACCEPTED");
    // la cuenta no se actualiza
    expect(updates.filter((u) => u.table === merchantCapacityAccounts)).toHaveLength(0);
    expect(inserts.some((i) => i.value.type === "RECOVERY_ACCEPTED")).toBe(true);
  });

  it("dual: aplica retención sin tocar capacidad comprometida", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const { db, tables } = fakeDb(proposal());
    const account = tables.get(merchantCapacityAccounts)![0];

    const result = await acceptRecoveryProposal(db, {
      id: "rec-a1-2026-10-31",
      affiliateId: "a1",
      actor: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(true);
    expect(result.status).toBe("APPLIED");
    expect(account.available).toBe(1900);
    expect(account.provisioned).toBe(1900);
    expect(account.creditOutstanding).toBe(1100);
    expect(account.creditRepaid).toBe(100);
    expect(account.committed).toBe(0);
  });

  it("rechazo: no descuenta nada", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const { db, tables } = fakeDb(proposal());

    const result = await rejectRecoveryProposal(db, {
      id: "rec-a1-2026-10-31",
      affiliateId: "a1",
      actor: "user-1",
    });

    expect(result.ok).toBe(true);
    expect(tables.get(merchantRecoveryProposals)![0].status).toBe("REJECTED");
    expect(tables.get(merchantCapacityAccounts)![0].available).toBe(2000);
  });

  it("expira a los 15 días y no aplica", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const { db, tables } = fakeDb(
      proposal({ createdAt: new Date(Date.now() - 16 * 86_400_000) })
    );

    const result = await acceptRecoveryProposal(db, {
      id: "rec-a1-2026-10-31",
      affiliateId: "a1",
      actor: "user-1",
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expirada/i);
    expect(tables.get(merchantRecoveryProposals)![0].status).toBe("EXPIRED");
    expect(tables.get(merchantCapacityAccounts)![0].available).toBe(2000);
  });

  it("no acepta una propuesta ya aplicada", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const { db } = fakeDb(proposal({ status: "APPLIED" }));

    const result = await acceptRecoveryProposal(db, {
      id: "rec-a1-2026-10-31",
      affiliateId: "a1",
      actor: "user-1",
    });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("APPLIED");
  });

  it("registra el evento de propuesta y aplicación", async () => {
    process.env[MCCE_ENABLED_FLAG] = "true";
    process.env[MCCE_MODE_FLAG] = "dual";
    const { db, inserts } = fakeDb(proposal());

    await acceptRecoveryProposal(db, {
      id: "rec-a1-2026-10-31",
      affiliateId: "a1",
      actor: "user-1",
    });

    const applied = inserts.find((i) => i.value.type === "RECOVERY_APPLIED");
    expect(applied).toBeTruthy();
    expect(applied!.value.metadata.proposalId).toBe("rec-a1-2026-10-31");
    expect(inserts.some((i) => i.table === merchantCapacityEvents)).toBe(true);
  });
});
