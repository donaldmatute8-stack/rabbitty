import { describe, it, expect, beforeEach } from "vitest";

export const DEFAULT_REWARD_RATE = 20;

export function calculateBunzReward(
  amountUsd: number,
  rate: number = DEFAULT_REWARD_RATE,
  multiplier: number = 1.0
): number {
  return Math.floor(amountUsd * (rate / 100) * multiplier);
}

export function calculateBunzCost(
  amountUsd: number,
  exchangeRate: number = 1.0
): number {
  return Math.ceil(amountUsd / exchangeRate);
}

describe("bunz calculations", () => {
  describe("calculateBunzReward", () => {
    it("calculates reward with default rate", () => {
      expect(calculateBunzReward(100)).toBe(20);
    });

    it("calculates reward with custom rate", () => {
      expect(calculateBunzReward(100, 25)).toBe(25);
    });

    it("calculates reward with multiplier", () => {
      expect(calculateBunzReward(100, 20, 1.5)).toBe(30);
    });

    it("returns floor value", () => {
      expect(calculateBunzReward(99.99, 20)).toBe(19);
    });
  });

  describe("calculateBunzCost", () => {
    it("calculates cost with default rate", () => {
      expect(calculateBunzCost(100)).toBe(100);
    });

    it("calculates cost with custom exchange rate", () => {
      expect(calculateBunzCost(100, 2.0)).toBe(50);
    });

    it("returns ceil value", () => {
      expect(calculateBunzCost(99.99)).toBe(100);
    });
  });
});
