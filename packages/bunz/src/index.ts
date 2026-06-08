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
