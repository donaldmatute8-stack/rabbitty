/**
 * ── Paridad Bunz V2 (RP-0.3/0.4) ──────────────────────────────────────────
 * Regla única y testeable para validar que el motor nuevo cobró exactamente
 * lo que correspondía y que el afiliado podía honrarlo.
 */

import { toMinorUnits } from "./contracts";

export type BunzCoreParityError = "INSUFFICIENT_BUNZ" | "INSUFFICIENT_STOCK";

export interface BunzCoreParityInput {
  owedMxn: number;
  netFiatCents: number;
  bunzApplied: number;
  recoveryHold?: boolean;
}

export function validateBunzCoreSettlement(
  input: BunzCoreParityInput
): { ok: boolean; error?: BunzCoreParityError } {
  if (input.recoveryHold) {
    return { ok: false, error: "INSUFFICIENT_STOCK" };
  }

  const owedMinor = toMinorUnits(Number(input.owedMxn || 0));
  const appliedMinor = Math.round(Number(input.bunzApplied || 0) * 100);

  if (Number(input.netFiatCents || 0) > 0 || appliedMinor < owedMinor) {
    return { ok: false, error: "INSUFFICIENT_BUNZ" };
  }

  return { ok: true };
}
