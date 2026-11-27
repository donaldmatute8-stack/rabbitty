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
