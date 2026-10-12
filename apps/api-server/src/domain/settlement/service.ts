import type { SettlementOperation, SettlementProvider, SettlementResult } from "./types";
import { InternalSettlementProvider } from "./providers/internal";

export class SettlementService {
  private static operationsDB = new Map<string, SettlementOperation>();
  
  // Inject the chosen provider (Hybrid or Internal)
  // For Phase 2D, we default to Internal.
  private static provider: SettlementProvider = new InternalSettlementProvider();

  static async initiateSettlement(params: {
    tenantId: string;
    ledgerEntryId: string;
    amount: number;
    asset: string;
    originSubjectId: string;
    destinationSubjectId: string;
    idempotencyKey: string;
  }): Promise<SettlementOperation> {
    
    // Idempotency check
    const existing = Array.from(this.operationsDB.values()).find(
      (op) => op.idempotencyKey === params.idempotencyKey && op.ledgerEntryId === params.ledgerEntryId
    );
    if (existing) return existing;

    const operation: SettlementOperation = {
      id: `stl_${Math.random().toString(36).substring(2, 15)}`,
      tenantId: params.tenantId,
      ledgerEntryId: params.ledgerEntryId,
      amount: params.amount,
      asset: params.asset,
      originSubjectId: params.originSubjectId,
      destinationSubjectId: params.destinationSubjectId,
      status: "PENDING",
      idempotencyKey: params.idempotencyKey,
      createdAt: new Date(),
    };

    this.operationsDB.set(operation.id, operation);

    // In a real async system, this would be pushed to a Queue (e.g. SQS, Redis)
    // For now, we synchronously trigger processing to demonstrate the flow
    this.processOperation(operation.id).catch(console.error);

    return operation;
  }

  static async processOperation(operationId: string): Promise<SettlementResult> {
    const op = this.operationsDB.get(operationId);
    if (!op) throw new Error("SETTLEMENT_OPERATION_NOT_FOUND");

    if (op.status === "SETTLED") {
      return { success: true, status: "SETTLED" }; // Already settled
    }

    op.status = "PROCESSING";
    this.operationsDB.set(op.id, op);

    try {
      const result = await this.provider.settle(op);
      
      op.status = result.status;
      if (result.status === "SETTLED") {
        op.settledAt = new Date();
      }
      if (result.providerReference) {
        op.providerMetadata = { reference: result.providerReference };
      }
      
      this.operationsDB.set(op.id, op);
      return result;
    } catch (error: any) {
      op.status = "FAILED";
      this.operationsDB.set(op.id, op);
      return {
        success: false,
        status: "FAILED",
        error: error.message,
        retryable: true
      };
    }
  }

  /**
   * Authoritative DB processor: Settles pending operations recorded in settlement_operations
   */
  static async processPendingDbOperations(): Promise<number> {
    const { eq } = await import("drizzle-orm");
    const { getRestaurantDb } = await import("@rabbitty/api");
    const { settlementOperations } = await import("@rabbitty/database-restaurant");

    const restaurantDb = getRestaurantDb();
    const pendings = await restaurantDb
      .select()
      .from(settlementOperations)
      .where(eq(settlementOperations.status, "PENDING"));

    let settledCount = 0;
    for (const op of pendings) {
      await restaurantDb
        .update(settlementOperations)
        .set({ 
          status: "SETTLED", 
          txHash: `int_${Date.now()}_${Math.random().toString(36).substring(7)}`, 
          settledAt: new Date() 
        })
        .where(eq(settlementOperations.id, op.id));
      settledCount++;
    }

    return settledCount;
  }
}
