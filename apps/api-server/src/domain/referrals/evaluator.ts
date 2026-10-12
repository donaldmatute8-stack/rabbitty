export class ReferralService {
  /**
   * Evaluates if a user is eligible for a referral reward.
   * This logic now lives securely on the server instead of the Telegram Mini App.
   */
  static async evaluateReferralReward(params: {
    tenantId: string;
    referredSubjectId: string;
    actionType: "EARN" | "SPEND";
  }): Promise<{ eligible: boolean, rewardAmount: number }> {
    // 1. TODO: Check DB to see if the user was referred by someone
    // 2. TODO: Check if the referrer has already received a reward for this action
    // 3. TODO: Verify if the user `hasEarnedFirstBunz` globally
    
    // Stub implementation
    return {
      eligible: false,
      rewardAmount: 0
    };
  }
}
