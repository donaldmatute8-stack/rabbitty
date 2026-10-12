import type { SettlementProvider, SettlementOperation, SettlementResult } from "../types";

/**
 * The Internal Provider simply acknowledges that the settlement 
 * is considered complete by internal fiat (e.g., relying entirely on the Ledger).
 * It simulates an instantaneous, gas-less settlement layer.
 */
export class InternalSettlementProvider implements SettlementProvider {
  readonly name = "INTERNAL_FIAT";

  async settle(operation: SettlementOperation): Promise<SettlementResult> {
    // In a purely internal system, if it reached this point, 
    // the Ledger has already accounted for it, so settlement is an automatic ACK.
    
    return {
      success: true,
      status: "SETTLED",
      providerReference: `int_ref_${Date.now()}`
    };
  }
}
