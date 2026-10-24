import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affiliateCampaigns, campaignRedemptions, users, transactions, ownedBusinesses } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { recordLedgerTransaction, findLedgerEntry } from "@/lib/ledgerHelper";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { z } from "zod";

const redeemSchema = z.object({
  campaignId: z.string().min(1),
  userId: z.string().min(1),
  businessId: z.string().min(1),
  transactionId: z.string().min(1),
  fiatAmount: z.number().positive(),
  idempotencyKey: z.string().min(1),
});

/**
 * POST /api/business/campaigns/redemption
 * Authoritative campaign reward engine:
 * 1. Requires authenticated user (caller must be business owner/staff or the target user presenting receipt).
 * 2. Verifies transactionId matches a real, COMPLETED transaction for this user, business, and fiat amount.
 * 3. Atomic database transaction: locks campaign row, verifies ACTIVE status, expiry, and budget.
 * 4. Issues Bunz reward atomically via `recordLedgerTransaction` with idempotency.
 * 5. Updates campaign budgetSpent, increments redemptionCount, and logs campaignRedemptions.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = redeemSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de redención inválidos", issues: parsed.error.issues }, { status: 400 });
    }

    const { campaignId, userId, businessId, transactionId, fiatAmount, idempotencyKey } = parsed.data;

    // Caller must be either:
    // a) The business owner / admin
    // b) Or the consumer themselves redeeming their verified completed transaction
    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId),
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    const isOwner = business.ownerId === caller.id;
    const isTargetUser = caller.id === userId;
    const isAdmin = caller.role === "ADMIN";

    if (!isOwner && !isTargetUser && !isAdmin) {
      return NextResponse.json({ error: "No autorizado para procesar esta redención" }, { status: 403 });
    }

    // 1. Verify transactionId matches a real, verified COMPLETED transaction
    const [realTx] = await db.select().from(transactions)
      .where(and(
        eq(transactions.id, transactionId),
        eq(transactions.businessId, businessId),
        eq(transactions.userId, userId),
        eq(transactions.status, "COMPLETED")
      ))
      .limit(1);

    if (!realTx) {
      return NextResponse.json({
        error: "Transacción inválida o no completada. El cashback de campaña solo aplica sobre consumos verificados en el POS."
      }, { status: 400 });
    }

    // Ensure fiat amount matches transaction fiat amount (within minor float tolerance)
    if (Math.abs(realTx.fiatAmount - fiatAmount) > 0.05) {
      return NextResponse.json({
        error: `El monto reportado ($${fiatAmount}) no coincide con el consumo registrado en la orden ($${realTx.fiatAmount})`
      }, { status: 400 });
    }

    // 2. Check existing redemption by idempotencyKey to prevent duplicate execution
    const existingRedemption = await db.query.campaignRedemptions.findFirst({
      where: eq(campaignRedemptions.idempotencyKey, idempotencyKey),
    });

    if (existingRedemption) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        bunzAwarded: existingRedemption.bunzAwarded,
        redemptionId: existingRedemption.id,
      });
    }

    // Check if this transaction has already been redeemed for this campaign
    const priorTxRedemption = await db.query.campaignRedemptions.findFirst({
      where: and(
        eq(campaignRedemptions.campaignId, campaignId),
        eq(campaignRedemptions.transactionId, transactionId)
      ),
    });

    if (priorTxRedemption) {
      return NextResponse.json({
        error: "Esta orden de consumo ya redimió una bonificación para esta campaña.",
      }, { status: 409 });
    }

    // 3. Atomic transaction with row lock to eliminate race conditions on campaign budget
    const ledgerKey = `cmp_rdm_${campaignId}_${idempotencyKey}`;

    const result = await db.transaction(async (tx) => {
      // Short circuit if ledger entry already exists
      const priorLedger = await findLedgerEntry(ledgerKey, tx);
      if (priorLedger) {
        return { bunzAwarded: priorLedger.amount, idempotent: true, redemptionId: null };
      }

      // Lock campaign row for update
      const [campaign] = await tx.select().from(affiliateCampaigns)
        .where(and(
          eq(affiliateCampaigns.id, campaignId),
          eq(affiliateCampaigns.businessId, businessId)
        ))
        .for("update")
        .limit(1);

      if (!campaign) {
        throw new Error("CAMPAIGN_NOT_FOUND");
      }

      if (campaign.status !== "ACTIVE") {
        throw new Error(`CAMPAIGN_NOT_ACTIVE:${campaign.status}`);
      }

      const now = new Date();
      if (campaign.expiresAt < now) {
        await tx.update(affiliateCampaigns)
          .set({ status: "EXPIRED", updatedAt: now })
          .where(eq(affiliateCampaigns.id, campaign.id));
        throw new Error("CAMPAIGN_EXPIRED");
      }

      const remainingBudget = campaign.budgetBunz - campaign.budgetSpent;
      if (remainingBudget <= 0) {
        await tx.update(affiliateCampaigns)
          .set({ status: "EXHAUSTED", updatedAt: now })
          .where(eq(affiliateCampaigns.id, campaign.id));
        throw new Error("CAMPAIGN_BUDGET_EXHAUSTED");
      }

      // Calculate reward amount bounded by per-user cap and remaining budget
      const rawReward = Math.round((fiatAmount * campaign.rewardPercentage) / 100);
      const bunzAwarded = Math.min(rawReward, campaign.maxRewardPerUser, remainingBudget);

      if (bunzAwarded <= 0) {
        throw new Error("INELIGIBLE_REWARD_AMOUNT");
      }

      // Authoritative Ledger Entry
      await recordLedgerTransaction(
        {
          payerSubjectId: `biz_${businessId}`,
          payeeSubjectId: `usr_${userId}`,
          amount: bunzAwarded,
          type: "EARN",
          referenceId: transactionId,
          idempotencyKey: ledgerKey,
          metadata: {
            campaignId,
            fiatSpent: fiatAmount,
            rewardPercentage: campaign.rewardPercentage,
            concept: `Campaña comercial: ${campaign.title}`,
          },
        },
        tx
      );

      // Credit user's Bunz balance
      await tx.update(users)
        .set({
          totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzAwarded}`,
          updatedAt: now,
        })
        .where(eq(users.id, userId));

      // Update campaign spent budget atomically
      const willExhaust = campaign.budgetSpent + bunzAwarded >= campaign.budgetBunz;
      await tx.update(affiliateCampaigns)
        .set({
          budgetSpent: sql`${affiliateCampaigns.budgetSpent} + ${bunzAwarded}`,
          redemptionCount: sql`${affiliateCampaigns.redemptionCount} + 1`,
          status: willExhaust ? "EXHAUSTED" : campaign.status,
          updatedAt: now,
        })
        .where(eq(affiliateCampaigns.id, campaignId));

      // Insert audit record in campaignRedemptions
      const [redemption] = await tx.insert(campaignRedemptions).values({
        campaignId,
        userId,
        businessId,
        transactionId,
        bunzAwarded,
        fiatSpent: fiatAmount,
        idempotencyKey,
      }).returning();

      return { bunzAwarded, redemptionId: redemption.id, idempotent: false };
    });

    return NextResponse.json({
      success: true,
      bunzAwarded: result.bunzAwarded,
      campaignId,
      redemptionId: result.redemptionId,
    });
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[CAMPAIGN_REDEMPTION_ERROR]", err);

    if (err.message === "CAMPAIGN_NOT_FOUND") {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }
    if (err.message?.startsWith("CAMPAIGN_NOT_ACTIVE")) {
      return NextResponse.json({ error: "La campaña no está activa" }, { status: 400 });
    }
    if (err.message === "CAMPAIGN_EXPIRED") {
      return NextResponse.json({ error: "La campaña ha expirado" }, { status: 400 });
    }
    if (err.message === "CAMPAIGN_BUDGET_EXHAUSTED") {
      return NextResponse.json({ error: "Presupuesto de campaña agotado" }, { status: 400 });
    }
    if (
      err.message?.includes("campaign_tx_redemption_idx") ||
      err.message?.includes("duplicate key value violates unique constraint") ||
      (err as { code?: string }).code === "23505"
    ) {
      return NextResponse.json({
        error: "Esta orden de consumo ya redimió una bonificación para esta campaña.",
      }, { status: 409 });
    }

    return NextResponse.json({ error: "Error al procesar redención de campaña" }, { status: 500 });
  }
}
