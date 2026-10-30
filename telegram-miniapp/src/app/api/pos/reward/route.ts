import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, pendingVaults, transactions, ownedBusinesses, affiliateCampaigns, campaignRedemptions } from "@/db/schema";
import { eq, and, gte, sql, or, desc, gt } from "drizzle-orm";
import { recordLedgerTransaction, findLedgerEntry } from "@/lib/ledgerHelper";
import { sendEcosystemNotification } from "@/lib/push/notify";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    // 1. Validate API Secret
    const authHeader = request.headers.get("authorization");
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    
    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { phone, amount_usd, order_id, business_id } = body;

    if (!phone || !amount_usd) {
      return NextResponse.json({ error: "Missing phone or amount_usd" }, { status: 400 });
    }

    const idempotencyKey = `pos_rwd_${body.idempotency_key || body.idempotencyKey || order_id || crypto.randomUUID()}`;

    let rewardRate = 0.20;
    let baseBunzPos = 0;
    let boostCampaignId: string | null = null;
    // Compatibilidad: el caller pudo mandar un branchId (POS legacy) → resolver al negocio real
    let effectiveBusinessId: string | null = null;
    if (business_id) {
      effectiveBusinessId = business_id;
      const [bizCheck] = await db.select({ id: ownedBusinesses.id }).from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, business_id)).limit(1);
      if (!bizCheck) {
        try {
          const resolved = await db.execute(
            sql`SELECT r."businessId" FROM branches b JOIN restaurants r ON r.id = b."restaurantId" WHERE b.id = ${business_id} LIMIT 1`
          ).then((r: unknown) => (((r as { rows?: Array<{ businessId: string }> }).rows || (r as unknown as Array<{ businessId: string }>))[0]?.businessId));
          if (resolved) effectiveBusinessId = resolved as string;
        } catch { /* mantener el id original */ }
      }
      const candidateBizId: string = effectiveBusinessId ?? business_id;
      const [business] = await db.select({ rewardPercentage: ownedBusinesses.rewardPercentage })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, candidateBizId))
        .limit(1);
      if (business) {
        rewardRate = (business.rewardPercentage ?? 20) / 100;
        baseBunzPos = Math.floor(amount_usd * ((business.rewardPercentage ?? 20) / 100));

        // Check if an active FLASH_OFFER boost campaign exists for this business with higher %
        const now = new Date();
        const [activeBoost] = await db.select()
          .from(affiliateCampaigns)
          .where(
            and(
              eq(affiliateCampaigns.businessId, effectiveBusinessId ?? business_id),
              eq(affiliateCampaigns.campaignType, "FLASH_OFFER"),
              eq(affiliateCampaigns.status, "ACTIVE"),
              gt(affiliateCampaigns.expiresAt, now)
            )
          )
          .orderBy(desc(affiliateCampaigns.rewardPercentage))
          .limit(1);

        if (activeBoost && activeBoost.rewardPercentage > (business.rewardPercentage ?? 20)) {
          rewardRate = activeBoost.rewardPercentage / 100;
          boostCampaignId = activeBoost.id;
        }
      }
    }
    let bunzToMint = Math.floor(amount_usd * rewardRate);

    // Usuario existente (para tope por usuario del boost)
    const conditionsPos = [
      eq(users.phoneNumber, phone),
      eq(users.telegramId, phone)
    ];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(phone)) {
      conditionsPos.push(eq(users.id, phone));
    }
    const [existingUserEarly] = await db.select({ id: users.id }).from(users).where(or(...conditionsPos)).limit(1);
    const existingUserId = existingUserEarly?.id || null;

    // ── CONSUMO ATOMICO DE PRESUPUESTO DEL FLASH BOOST ──
    // La bonificación extra se paga del presupuesto de la campaña (budgetBunz),
    // respeta el tope por usuario (maxRewardPerUser) y registra la redención.
    if (effectiveBusinessId && boostCampaignId && bunzToMint > baseBunzPos) {
      let cappedBonus = 0;
      await db.transaction(async (btx) => {
        const [lockedCampaign] = await btx
          .select()
          .from(affiliateCampaigns)
          .where(eq(affiliateCampaigns.id, boostCampaignId))
          .for('update');

        const campaignValid = lockedCampaign
          && lockedCampaign.status === "ACTIVE"
          && lockedCampaign.expiresAt > new Date();

        if (campaignValid && lockedCampaign) {
          const remainingBudget = lockedCampaign.budgetBunz - lockedCampaign.budgetSpent;
          const [userRedeemed] = await btx
            .select({ total: sql<number>`coalesce(sum(${campaignRedemptions.bunzAwarded}), 0)` })
            .from(campaignRedemptions)
            .where(and(
              eq(campaignRedemptions.campaignId, lockedCampaign.id),
              eq(campaignRedemptions.userId, existingUserId as string)
            ));
          const perUserRemaining = existingUserId
            ? Math.max(0, lockedCampaign.maxRewardPerUser - Number(userRedeemed?.total ?? 0))
            : lockedCampaign.maxRewardPerUser;
          const rawBonus = bunzToMint - baseBunzPos;
          cappedBonus = Math.max(0, Math.min(rawBonus, remainingBudget, perUserRemaining));

          if (cappedBonus > 0) {
            const willExhaust = lockedCampaign.budgetSpent + cappedBonus >= lockedCampaign.budgetBunz;
            await btx.update(affiliateCampaigns)
              .set({
                budgetSpent: sql`${affiliateCampaigns.budgetSpent} + ${cappedBonus}`,
                redemptionCount: sql`${affiliateCampaigns.redemptionCount} + 1`,
                status: willExhaust ? "EXHAUSTED" : lockedCampaign.status,
                updatedAt: new Date(),
              })
              .where(eq(affiliateCampaigns.id, lockedCampaign.id));

            if (existingUserId) {
              await btx.insert(campaignRedemptions).values({
                campaignId: lockedCampaign.id,
                userId: existingUserId,
                businessId: effectiveBusinessId,
                transactionId: order_id || null,
                bunzAwarded: cappedBonus,
                fiatSpent: amount_usd,
                idempotencyKey: `${idempotencyKey}:boost`,
              }).onConflictDoNothing();
            }
          }
        }
        bunzToMint = baseBunzPos + cappedBonus;
      });
    }

    if (bunzToMint <= 0) {
      return NextResponse.json({ message: "Amount too low to generate Bunz" }, { status: 200 });
    }

    // Replay guard: never double-reserve inventory or double-queue a vault on retry.
    const replay = await findLedgerEntry(idempotencyKey);
    if (replay) {
      return NextResponse.json({ success: true, message: 'Reward already processed', bunz: replay.amount });
    }
    if (order_id) {
      const [queued] = await db.select({ id: pendingVaults.id }).from(pendingVaults).where(eq(pendingVaults.orderId, order_id)).limit(1);
      if (queued) {
        return NextResponse.json({ success: true, message: 'Reward already queued' });
      }
    }

    // 2. El débito de inventario vive DENTRO de la tx del usuario (atómico con ledger
    //    y crédito — nunca más débito huérfano). El vault path NO debita: el claim
    //    (claim-ticket / bot) debita al momento de acreditar al usuario.
    const businessId = effectiveBusinessId || business_id || "unknown";
    let hasEnoughInventory = true; // se re-evalúa dentro de la tx

    const expirationDate = new Date();
    expirationDate.setMonth(expirationDate.getMonth() + 3);

    // 3. Find User
    const conditions = [
      eq(users.phoneNumber, phone),
      eq(users.telegramId, phone)
    ];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(phone)) {
      conditions.push(eq(users.id, phone));
    }

    const existingUserArray = await db.select().from(users).where(or(...conditions)).limit(1);
    const existingUser = existingUserArray[0];

    if (existingUser) {
      // 4a. Existing User: Pay off offline debt first
      const currentDebt = existingUser.pendingDebtBunz ?? 0;
      let payoff = 0;
      let remainingMint = bunzToMint;

      if (currentDebt > 0) {
        payoff = Math.min(currentDebt, remainingMint);
        remainingMint -= payoff;
      }

      // Atomic SQL transaction with pessimistic row lock and authoritative Ledger entry
      await db.transaction(async (tx) => {
        const [lockedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, existingUser.id))
          .for('update');

        if (!lockedUser) {
          throw new Error('USER_NOT_FOUND');
        }

        const prior = await findLedgerEntry(idempotencyKey, tx);
        if (prior) {
          return;
        }

        // ── ECONOMÍA RABBITTY: la recompensa MINTEA bunz (única fuente de emisión) ──
        // El stock del comercio AUMENTA: 3500 + 8 = 3508 disponibles para aceptar
        // redenciones de quienes tengan bunz. El mint NO consume el paquete. ──
        if (effectiveBusinessId) {
          await tx.update(ownedBusinesses)
            .set({ bunzBalance: sql`COALESCE("bunzBalance", 0) + ${bunzToMint}` })
            .where(eq(ownedBusinesses.id, effectiveBusinessId));
        }

        await tx.update(users)
          .set({ 
            totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${remainingMint}`,
            pendingDebtBunz: sql`GREATEST(0, COALESCE(${users.pendingDebtBunz}, 0) - ${payoff})`
          })
          .where(eq(users.id, lockedUser.id));

        const txId = crypto.randomUUID();
        await tx.insert(transactions).values({
          id: txId,
          userId: existingUser.id,
          businessId: businessId,
          fiatAmount: amount_usd,
          bunzMinted: bunzToMint,
          status: 'MINTED',
        });

        await recordLedgerTransaction(
          {
            // branchId tiene FK a branches — aquí no hay branch confiable (businessId NO es branch)
            branchId: null,
            payerSubjectId: businessId !== 'unknown' ? businessId : 'POS',
            payeeSubjectId: `usr_${existingUser.id}`,
            amount: bunzToMint,
            type: 'EARN',
            referenceId: order_id || txId,
            idempotencyKey,
            metadata: { orderId: order_id, amountUsd: amount_usd },
          },
          tx
        );
      });

      // Push notification al usuario que recibió los Bunz en POS
      await sendEcosystemNotification({
        userId: existingUser.id,
        title: `✨ ¡Recibiste +${bunzToMint.toLocaleString()} Bunz!`,
        message: `Por tu compra de $${amount_usd} en caja se han acreditado ${bunzToMint.toLocaleString()} Bunz a tu cuenta.`,
        type: 'REWARD',
        route: '/profile/wallet',
        pushData: { bunzAmount: bunzToMint, orderId: order_id || '' },
        threadId: 'rewards',
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Bunz minted to existing user (Debt adjusted if applicable)', 
        bunz: bunzToMint,
        userId: existingUser.id,
      });

    } else {
      // 4b. New User: Create Temporary Vault
      if (order_id) {
        const [existingVault] = await db.select().from(pendingVaults).where(eq(pendingVaults.orderId, order_id)).limit(1);
        if (existingVault) {
          return NextResponse.json({ success: true, message: 'Bunz already saved to temporary vault', bunz: existingVault.bunzAmount, expiresAt: existingVault.expiresAt });
        }
      }
      await db.insert(pendingVaults).values({
        id: crypto.randomUUID(),
        phoneNumber: phone,
        bunzAmount: bunzToMint,
        orderId: order_id,
        businessId: businessId !== 'unknown' ? businessId : null,
        status: 'PENDING',
        expiresAt: expirationDate,
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Bunz saved to temporary vault', 
        bunz: bunzToMint,
        expiresAt: expirationDate
      });
    }

  } catch (error) {
    console.error('Error in /api/pos/reward:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
