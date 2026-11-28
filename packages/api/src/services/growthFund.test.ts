import { describe, expect, it } from "vitest";
import {
  GrowthFundError,
  assertFundHealthy,
  consecutiveMonths,
  getFundBalance,
  getFundContributionsSummary,
  getMadrigueraLevel,
  growthFundFlags,
  coopAmount,
  matchAmount,
  levelFromContribution,
  monthPeriod,
  periodKey,
  fundCoop,
  fundMatch,
} from "./growthFund";

function fakeLedger(row: {
  incoming: number;
  outgoing: number;
  invalid_entries?: number;
}) {
  return {
    execute: async () => ({
      rows: [
        {
          incoming: row.incoming,
          outgoing: row.outgoing,
          invalid_entries: row.invalid_entries ?? 0,
        },
      ],
    }),
  } as never;
}

describe("La Madriguera · Fase 1 (solo lectura)", () => {
  it("calcula el saldo del fondo desde el ledger", async () => {
    const balance = await getFundBalance(
      fakeLedger({ incoming: 150, outgoing: 11 }),
    );
    expect(balance.incoming).toBe(150);
    expect(balance.outgoing).toBe(11);
    expect(balance.balance).toBe(139);
    expect(balance.healthy).toBe(true);
  });

  it("marca un fondo sobregirado como no sano", async () => {
    const balance = await getFundBalance(
      fakeLedger({ incoming: 5, outgoing: 50 }),
    );
    expect(balance.balance).toBe(-45);
    expect(balance.healthy).toBe(false);
  });

  it("detecta asientos con forma no permitida", async () => {
    const balance = await getFundBalance(
      fakeLedger({ incoming: 10, outgoing: 1, invalid_entries: 1 }),
    );
    expect(balance.invalidEntries).toBe(1);
    expect(balance.healthy).toBe(false);
  });

  it("assertFundHealthy lanza si el fondo está negativo", async () => {
    await expect(
      assertFundHealthy(fakeLedger({ incoming: 0, outgoing: 10 })),
    ).rejects.toBeInstanceOf(GrowthFundError);
  });

  it("assertFundHealthy lanza si hay asientos inválidos", async () => {
    await expect(
      assertFundHealthy(fakeLedger({ incoming: 10, outgoing: 1, invalid_entries: 2 })),
    ).rejects.toMatchObject({ code: "INVALID_ENTRY" });
  });

  it("cuenta meses consecutivos desde el más reciente", () => {
    expect(consecutiveMonths(["2026-01", "2026-02", "2026-03"])).toBe(3);
    expect(consecutiveMonths(["2026-01", "2026-03"])).toBe(1);
    expect(consecutiveMonths(["2026-01", "2026-02", "2026-04"])).toBe(1);
    expect(consecutiveMonths([])).toBe(0);
  });

  it("calcula el nivel por aportación y por meses consecutivos", () => {
    expect(levelFromContribution({ total: 0, consecutiveMonths: 0 })).toBe("APRENDIZ");
    expect(levelFromContribution({ total: 99, consecutiveMonths: 0 })).toBe("APRENDIZ");
    expect(levelFromContribution({ total: 100, consecutiveMonths: 0 })).toBe("COMPA");
    expect(levelFromContribution({ total: 499, consecutiveMonths: 0 })).toBe("COMPA");
    expect(levelFromContribution({ total: 500, consecutiveMonths: 0 })).toBe("GUARDIAN");
    expect(levelFromContribution({ total: 0, consecutiveMonths: 3 })).toBe("GUARDIAN");
  });

  it("calcula el nivel desde los aportes de 12 meses", async () => {
    const db = {
      execute: async () => ({
        rows: [
          { month: "2026-09", amount: 40 },
          { month: "2026-10", amount: 40 },
          { month: "2026-11", amount: 40 },
        ],
      }),
    } as never;

    const level = await getMadrigueraLevel(db, "user-1");
    expect(level.totalContributed).toBe(120);
    expect(level.consecutiveMonths).toBe(3);
    expect(level.tier).toBe("GUARDIAN");
    expect(level.label).toBe("Guardián");
  });

  it("resume aportes por fuente", async () => {
    const db = {
      execute: async () => ({
        rows: [
          { source: "coop", amount: 150, entries: 1 },
          { source: "user", amount: 5, entries: 1 },
        ],
      }),
    } as never;

    const summary = await getFundContributionsSummary(db);
    expect(summary).toEqual([
      { source: "coop", amount: 150, entries: 1 },
      { source: "user", amount: 5, entries: 1 },
    ]);
  });

  it("calcula co-op y match sin escribir", () => {
    expect(coopAmount(1500, 0.1)).toBe(150);
    expect(coopAmount(0, 0.1)).toBe(0);
    expect(matchAmount(150, 0)).toBe(150);
    expect(matchAmount(150, 40)).toBe(110);
    expect(matchAmount(150, 40, 500)).toBe(110);
    expect(matchAmount(150, 150)).toBe(0);
  });

  it("todos los flags arrancan apagados", () => {
    const flags = growthFundFlags({} as NodeJS.ProcessEnv);
    expect(flags.enabled).toBe(false);
    expect(flags.userContributions).toBe(false);
    expect(flags.referralPayouts).toBe(false);
    expect(flags.affiliateCoop).toBe(false);
    expect(flags.match).toBe(false);
  });
});

describe("Fondeo co-op + match (ADR-CORE-011)", () => {
  it("el periodo es el mes calendario en UTC", () => {
    const period = monthPeriod(new Date("2026-11-27T05:00:00.000Z"));
    expect(period.start.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(period.end.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(periodKey(period.start)).toBe("2026-11-01");
  });

  /** Executor falso: guarda las escrituras y responde como Postgres. */
  function fakeExecutor(seed: {
    contribution?: boolean;
    account?: { promoAuthorized: number; status: string; sandbox: boolean } | null;
    budget?: { id: string; budgeted: number; spent: number } | null;
  }) {
    const writes: string[] = [];
    const executor = {
      execute: async (query: any) => {
        const text = (Array.isArray(query?.queryChunks) ? query.queryChunks : [])
          .map((chunk: any) => {
            if (typeof chunk === "string") return chunk;
            if (Array.isArray(chunk?.value)) return chunk.value.join("");
            return "";
          })
          .join(" ");
        if (text.includes('FROM "fund_contributions"')) {
          return { rows: seed.contribution ? [{ id: "c1", amount: 150, ledgerEntryId: "l1" }] : [] };
        }
        if (text.includes('FROM "merchant_capacity_accounts"')) {
          return { rows: seed.account ? [seed.account] : [] };
        }
        if (text.includes('FROM "platform_budgets"')) {
          return { rows: seed.budget ? [seed.budget] : [] };
        }
        if (text.includes('SELECT "id", "committed"')) return { rows: [] };
        writes.push(text);
        if (text.includes("RETURNING \"id\"")) return { rows: [{ id: "c-new" }] };
        return { rows: [] };
      },
      insert: () => ({
        values: () => ({
          onConflictDoNothing: () => ({ returning: async () => [{ id: "l-new" }] }),
        }),
      }),
    };
    return { executor, writes };
  }

  it("co-op es MINT biz_ → fondo y no toca el saldo del negocio", async () => {
    const { executor, writes } = fakeExecutor({
      account: { promoAuthorized: 1500, status: "ACTIVE", sandbox: false },
    });
    const res = await fundCoop(executor as never, {
      businessId: "fb7f4847-920f-4482-8ae3-c810a20e75ad",
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
      periodEnd: new Date("2026-12-01T00:00:00.000Z"),
    });
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(150);
    expect(res.idempotencyKey).toBe("coop:fb7f4847-920f-4482-8ae3-c810a20e75ad:2026-11-01");
    expect(writes.join(" ")).not.toContain("bunzBalance");
  });

  it("co-op se salta si el mes ya se fondeó (idempotente)", async () => {
    const { executor } = fakeExecutor({ contribution: true });
    const res = await fundCoop(executor as never, {
      businessId: "biz-1",
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
      periodEnd: new Date("2026-12-01T00:00:00.000Z"),
    });
    expect(res.alreadyDone).toBe(true);
    expect(res.amount).toBe(150);
  });

  it("co-op no fondea afiliado suspendido ni sandbox", async () => {
    const { executor } = fakeExecutor({
      account: { promoAuthorized: 1500, status: "SUSPENDED", sandbox: false },
    });
    const res = await fundCoop(executor as never, {
      businessId: "biz-1",
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
      periodEnd: new Date("2026-12-01T00:00:00.000Z"),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("NOT_ACTIVE");
  });

  it("match se acota al presupuesto disponible", async () => {
    const { executor } = fakeExecutor({ budget: { id: "b1", budgeted: 150, spent: 40 } });
    const res = await fundMatch(executor as never, {
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
      requested: 500,
    });
    expect(res.ok).toBe(true);
    expect(res.amount).toBe(110);
  });

  it("match sin presupuesto no emite", async () => {
    const { executor } = fakeExecutor({});
    const res = await fundMatch(executor as never, {
      periodStart: new Date("2026-11-01T00:00:00.000Z"),
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe("NO_BUDGET");
  });
});
