import type { SettlementProvider, SettlementOperation, SettlementResult } from "../types";

/**
 * STUB: Blockchain Provider
 * This provider will eventually interface with a Relayer to execute
 * the settlement on an EVM-compatible blockchain (e.g., Base).
 * 
 * IMPORTANT: This does NOT contain custodial private keys directly.
 * It acts as an API client to a secure Relayer infrastructure.
 */
export class BlockchainSettlementProvider implements SettlementProvider {
  readonly name = "BLOCKCHAIN_EVM_RELAYER";

  async settle(operation: SettlementOperation): Promise<SettlementResult> {
    // 1. TODO: Map originSubjectId to a known Blockchain Wallet (or Treasury)
    // 2. TODO: Call Relayer API (POST /v1/relay/transaction)
    // 3. TODO: Wait for ACK or Return PENDING state for async polling

    throw new Error("Blockchain Relayer integration not implemented yet. Phase 2D is abstraction-only.");
  }
}
