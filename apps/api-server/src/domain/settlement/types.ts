export type SettlementStatus = "PENDING" | "PROCESSING" | "SETTLED" | "FAILED" | "RETRYING";

export interface SettlementOperation {
  id: string;
  tenantId: string;
  ledgerEntryId: string; // Traceability from Ledger
  amount: number;
  asset: string; // e.g. 'BUNZ'
  originSubjectId: string;
  destinationSubjectId: string;
  status: SettlementStatus;
  idempotencyKey: string;
  createdAt: Date;
  settledAt?: Date;
  providerMetadata?: Record<string, any>;
}

export interface SettlementResult {
  success: boolean;
  status: SettlementStatus;
  providerReference?: string; // e.g. transaction hash if blockchain
  error?: string;
  retryable?: boolean;
}

export interface SettlementProvider {
  /**
   * Identifies the provider (e.g. "INTERNAL", "BLOCKCHAIN_BASE")
   */
  readonly name: string;

  /**
   * Attempts to settle an operation through this provider.
   */
  settle(operation: SettlementOperation): Promise<SettlementResult>;
}
