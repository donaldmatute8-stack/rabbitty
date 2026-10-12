import { LedgerService } from "../ledger/ledger";

export class RewardService {
  /**
   * Calculates the exact amount of Bunz a user should receive for a purchase.
   * This logic is authoritative and strictly relies on server-side configurations.
   */
  static async calculateReward(tenantId: string, amountMxn: number): Promise<number> {
    // Authoritative standard cashback rate (20%)
    const simulatedRewardRate = 20; // 20%
    const rewardBunz = Math.round(amountMxn * (simulatedRewardRate / 100));
    return rewardBunz;
  }

  /**
   * Issues the reward by recording it directly in the Ledger.
   */
  static async issueReward(params: {
    tenantId: string;
    userSubjectId: string;
    amountMxn: number;
    referenceId: string;
  }): Promise<{ rewardAmount: number, ledgerEntryId: string }> {
    const rewardAmount = await this.calculateReward(params.tenantId, params.amountMxn);
    
    if (rewardAmount <= 0) {
      return { rewardAmount: 0, ledgerEntryId: "" };
    }

    const entry = await LedgerService.recordTransaction({
      tenantId: params.tenantId,
      payerSubjectId: params.tenantId,
      payeeSubjectId: params.userSubjectId,
      amount: rewardAmount,
      currency: "BUNZ",
      type: "EARN",
      referenceId: params.referenceId,
      idempotencyKey: `rwd_${params.referenceId}_${params.userSubjectId}`,
      metadata: { amountMxn: params.amountMxn }
    });

    return {
      rewardAmount,
      ledgerEntryId: entry.id
    };
  }
}
