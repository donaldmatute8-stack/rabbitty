import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { restaurantDb } from "@/db/restaurant";
import { users, ownedBusinesses, transactions, affiliateCampaigns, campaignRedemptions, pendingVaults } from "@/db/schema";
import { orders, restaurants, branches } from "@rabbitty/database-restaurant/schema";
import { eq, and, desc, gt, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { recordLedgerTransaction, findLedgerEntry } from "@/lib/ledgerHelper";
import { sendEcosystemNotification } from "@/lib/push/notify";
import { checkRateLimit } from "@/lib/rateLimit";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "Autenticación requerida para reclamar recompensas." }, { status: 401 });
    }

    // Rate Limiting anti-bruteforce: Máx 12 reclamos de ticket por minuto por usuario
    const rate = await checkRateLimit(`claim_ticket:${caller.id}`, 12, 60);
    if (!rate.allowed) {
      return NextResponse.json({
        error: `Demasiados intentos de reclamo de ticket. Espera ${rate.retryAfterSeconds}s antes de reintentar.`
      }, { status: 429 });
    }

    const body = await req.json();
    const { claimToken } = body;

    if (!claimToken || typeof claimToken !== "string") {
      return NextResponse.json({ error: "Token de reclamo no proporcionado o inválido." }, { status: 400 });
    }

    // 1. Descomponer claimToken: orderId.exp.sig
    const parts = claimToken.split(".");
    if (parts.length !== 3) {
      return NextResponse.json({ error: "Formato de ticket no reconocido." }, { status: 400 });
    }

    const [orderId, expStr, sig] = parts;
    const exp = parseInt(expStr, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(exp) || now > exp) {
      return NextResponse.json({ error: "El tiempo para reclamar este ticket ha expirado (límite 48 horas)." }, { status: 400 });
    }

    // 2. Buscar la orden en restaurantDb
    const [order] = await restaurantDb
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!order) {
      return NextResponse.json({ error: "Orden o ticket no encontrado en el sistema." }, { status: 404 });
    }

    if (order.status !== "COMPLETED") {
      return NextResponse.json({ error: "La orden aún no ha sido cobrada y confirmada en caja." }, { status: 400 });
    }

    // 3. Validar firma criptográfica HMAC
    const secret = process.env.RABBITTY_API_SECRET;
    if (!secret) {
      console.error("[CLAIM_TICKET_CONFIG_ERROR] RABBITTY_API_SECRET is missing.");
      return NextResponse.json({ error: "Servicio de validación de tickets temporalmente no disponible (configuración de servidor)." }, { status: 503 });
    }
    const expectedPayload = `${orderId}:${order.total}:${order.branchId}:${exp}`;
    const expectedSig = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex").slice(0, 16);

    if (sig !== expectedSig) {
      return NextResponse.json({ error: "Firma de seguridad de ticket inválida." }, { status: 403 });
    }

    // 4. Protección estricta contra duplicados (Idempotencia)
    // a) Verificar si la orden ya registró bunzReward en la tabla orders
    if (order.bunzReward && order.bunzReward > 0) {
      return NextResponse.json({
        success: false,
        error: "Este ticket ya fue acreditado previamente al Rabbitter de la compra.",
        alreadyClaimed: true,
      }, { status: 400 });
    }

    // a2) Si existe una bóveda para esta orden ya reclamada por otro canal (bot) → doble pago bloqueado
    const [existingVault] = await db.select().from(pendingVaults)
      .where(eq(pendingVaults.orderId, orderId))
      .orderBy(desc(pendingVaults.createdAt))
      .limit(1);
    if (existingVault && existingVault.status !== 'PENDING') {
      return NextResponse.json({
        success: false,
        error: "Este ticket ya fue acreditado previamente (vía QR del bot).",
        alreadyClaimed: true,
      }, { status: 400 });
    }

    // b) Verificar si el Ledger ya procesó este orderId
    const idempotencyKey = `pos_rwd_${orderId}`;
    const priorLedger = await findLedgerEntry(idempotencyKey);
    if (priorLedger) {
      return NextResponse.json({
        success: false,
        error: "La recompensa de este ticket ya fue procesada.",
        alreadyClaimed: true,
      }, { status: 400 });
    }

    // 5. Determinar tasa de recompensa y negocio propietario
    const [branch] = await restaurantDb
      .select({ restaurantId: branches.restaurantId })
      .from(branches)
      .where(eq(branches.id, order.branchId))
      .limit(1);

    // Normalizador canónico de tasas para datos legacy (e.g. 0.2 -> 20)
    const normalizeToPercent = (v: number | null | undefined) =>
      typeof v === "number" && v > 0 && v < 1 ? v * 100 : v;

    let rewardPercentage = 20;
    let businessId: string | null = null;

    if (branch) {
      const [restaurant] = await restaurantDb
        .select({
          name: restaurants.name,
          defaultRewardRate: restaurants.defaultRewardRate,
          happyHourRewardRate: restaurants.happyHourRewardRate,
          happyHourStart: restaurants.happyHourStart,
          happyHourEnd: restaurants.happyHourEnd,
          businessId: restaurants.businessId
        })
        .from(restaurants)
        .where(eq(restaurants.id, branch.restaurantId))
        .limit(1);

      if (restaurant) {
        rewardPercentage = normalizeToPercent(restaurant.defaultRewardRate) ?? 20;
        let resolvedBizId: string | null = restaurant.businessId;

        // Validar si existe en ownedBusinesses (clave foránea estricta de transactions)
        if (resolvedBizId) {
          const [exists] = await db
            .select({ id: ownedBusinesses.id })
            .from(ownedBusinesses)
            .where(eq(ownedBusinesses.id, resolvedBizId))
            .limit(1);
          if (!exists) resolvedBizId = null;
        }

        // Sin fuzzy-match: si el restaurante no tiene un businessId válido en
        // ownedBusinesses, el reclamo se rechaza con un error accionable
        // (evita ligar Bunz al negocio equivocado por similitud de nombre).
        if (!resolvedBizId) {
          return NextResponse.json({
            success: false,
            error: `El restaurante "${restaurant.name}" no tiene un negocio afiliado vinculado en Rabbitty. Pide al dueño que complete su perfil de afiliado o contacta a soporte.`,
            code: "BUSINESS_LINK_MISSING",
          }, { status: 422 });
        }

        businessId = resolvedBizId;

        // Comprobar Happy Hour si aplica
        if (restaurant.happyHourStart && restaurant.happyHourEnd) {
          const now = new Date();
          const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
          if (timeString >= restaurant.happyHourStart && timeString <= restaurant.happyHourEnd) {
            rewardPercentage = normalizeToPercent(restaurant.happyHourRewardRate) ?? rewardPercentage;
          }
        }
      }
    }

    let rewardRate = rewardPercentage / 100;
    const baseBunzPos = Math.floor(order.total * rewardRate);
    let boostCampaignId: string | null = null;

    // Comprobar si existe campaña activa FLASH_OFFER boost con mayor % para este negocio
    if (businessId) {
      const now = new Date();
      const [activeBoost] = await db
        .select()
        .from(affiliateCampaigns)
        .where(
          and(
            eq(affiliateCampaigns.businessId, businessId),
            eq(affiliateCampaigns.campaignType, "FLASH_OFFER"),
            eq(affiliateCampaigns.status, "ACTIVE"),
            gt(affiliateCampaigns.expiresAt, now)
          )
        )
        .orderBy(desc(affiliateCampaigns.rewardPercentage))
        .limit(1);

      if (activeBoost && activeBoost.rewardPercentage > rewardPercentage) {
        rewardRate = activeBoost.rewardPercentage / 100;
        boostCampaignId = activeBoost.id;
      }
    }

    let bunzToMint = Math.floor(order.total * rewardRate);

    // Consumo atómico de presupuesto del Flash Boost si aplica
    if (businessId && boostCampaignId && bunzToMint > baseBunzPos) {
      let cappedBonus = 0;
      await db.transaction(async (btx) => {
        const [lockedCampaign] = await btx
          .select()
          .from(affiliateCampaigns)
          .where(eq(affiliateCampaigns.id, boostCampaignId))
          .for("update");

        const campaignValid =
          lockedCampaign &&
          lockedCampaign.status === "ACTIVE" &&
          lockedCampaign.expiresAt > new Date();

        if (campaignValid && lockedCampaign) {
          const remainingBudget = lockedCampaign.budgetBunz - lockedCampaign.budgetSpent;
          const [userRedeemed] = await btx
            .select({ total: sql<number>`coalesce(sum(${campaignRedemptions.bunzAwarded}), 0)` })
            .from(campaignRedemptions)
            .where(
              and(
                eq(campaignRedemptions.campaignId, lockedCampaign.id),
                eq(campaignRedemptions.userId, caller.id)
              )
            );

          const perUserRemaining = Math.max(
            0,
            lockedCampaign.maxRewardPerUser - Number(userRedeemed?.total ?? 0)
          );
          const rawBonus = bunzToMint - baseBunzPos;
          cappedBonus = Math.max(0, Math.min(rawBonus, remainingBudget, perUserRemaining));

          if (cappedBonus > 0) {
            const willExhaust = lockedCampaign.budgetSpent + cappedBonus >= lockedCampaign.budgetBunz;
            await btx
              .update(affiliateCampaigns)
              .set({
                budgetSpent: sql`${affiliateCampaigns.budgetSpent} + ${cappedBonus}`,
                redemptionCount: sql`${affiliateCampaigns.redemptionCount} + 1`,
                status: willExhaust ? "EXHAUSTED" : lockedCampaign.status,
                updatedAt: new Date(),
              })
              .where(eq(affiliateCampaigns.id, lockedCampaign.id));

            await btx
              .insert(campaignRedemptions)
              .values({
                campaignId: lockedCampaign.id,
                userId: caller.id,
                businessId: businessId,
                transactionId: orderId,
                bunzAwarded: cappedBonus,
                fiatSpent: order.total,
                idempotencyKey: `${idempotencyKey}:boost`,
              })
              .onConflictDoNothing();
          }
        }
        bunzToMint = baseBunzPos + cappedBonus;
      });
    }

    if (bunzToMint <= 0) {
      return NextResponse.json({ error: "El importe del ticket no genera Bunz suficientes." }, { status: 400 });
    }

    // 6. Transacción atómica en coreDb: Deducción de inventario de Bóveda y acreditación a usuario
    try {
    await db.transaction(async (tx) => {
      // a0) Si hay bóveda para esta orden: lock pesimista + unicidad del pago (canal bot o ticket, UNO solo)
      if (existingVault) {
        const [lockedVault] = await tx.select().from(pendingVaults)
          .where(eq(pendingVaults.id, existingVault.id))
          .for('update');
        if (!lockedVault || lockedVault.status !== 'PENDING') {
          throw new Error('VAULT_ALREADY_CLAIMED');
        }
        // Si la bóveda existe, el monto autorizado es el de la bóveda (fuente única)
        bunzToMint = lockedVault.bunzAmount;
      }
      // a0.1) Guard en-transacción de AMBAS claves de idempotencia (ticket + bot)
      const priorInTx = await findLedgerEntry(idempotencyKey, tx) ?? await findLedgerEntry(`claim_ticket_${orderId}`, tx);
      if (priorInTx) throw new Error('ALREADY_MINTED');
      // a) Si el restaurante está vinculado a un ownedBusiness, deducir de su bóveda
      if (businessId) {
        await tx.update(ownedBusinesses)
          .set({ bunzBalance: sql`GREATEST(0, "bunzBalance" - ${bunzToMint})` })
          .where(eq(ownedBusinesses.id, businessId));
      }

      // b) Bloqueo pesimista del usuario para saldo seguro
      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, caller.id))
        .for("update");

      if (!lockedUser) {
        throw new Error("USER_NOT_FOUND");
      }

      // c) Acreditar al usuario y saldar deuda pendiente si existía
      const debt = lockedUser.pendingDebtBunz ?? 0;
      const payoff = Math.min(debt, bunzToMint);
      const remainingMint = bunzToMint - payoff;

      await tx.update(users)
        .set({
          totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${remainingMint}`,
          pendingDebtBunz: sql`GREATEST(0, COALESCE(${users.pendingDebtBunz}, 0) - ${payoff})`,
        })
        .where(eq(users.id, lockedUser.id));

      // d) Registrar en el Ledger inmutable
      const txId = crypto.randomUUID();
      await tx.insert(transactions).values({
        id: txId,
        userId: caller.id,
        businessId: businessId || "unknown",
        fiatAmount: order.total,
        bunzMinted: bunzToMint,
        status: "MINTED",
      });

      await recordLedgerTransaction(
        {
          branchId: order.branchId,
          payerSubjectId: businessId || "POS_CLAIM",
          payeeSubjectId: `usr_${caller.id}`,
          amount: bunzToMint,
          type: "EARN",
          referenceId: orderId,
          idempotencyKey,
          metadata: { orderId, total: order.total, claimedViaTicket: true },
        },
        tx
      );

      // a1) Marcar la bóveda CLAIMED (bloquea el doble pago por el canal del bot)
      if (existingVault) {
        await tx.update(pendingVaults).set({ status: 'CLAIMED' })
          .where(and(eq(pendingVaults.id, existingVault.id), eq(pendingVaults.status, 'PENDING')));
      }
    });

    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : '';
      if (msg === 'VAULT_ALREADY_CLAIMED' || msg === 'ALREADY_MINTED') {
        return NextResponse.json({
          success: false,
          error: "Este ticket ya fue acreditado previamente.",
          alreadyClaimed: true,
        }, { status: 400 });
      }
      throw txErr;
    }

    // 7. Marcar la orden en restaurantDb con los Bunz acreditados y el customerId
    await restaurantDb.update(orders).set({
      bunzReward: bunzToMint,
      customerId: caller.id,
    }).where(eq(orders.id, orderId));

    // 8. Enviar notificación Push al Rabbitter
    await sendEcosystemNotification({
      userId: caller.id,
      title: `✨ ¡Ticket canjeado con éxito!`,
      message: `Has recibido +${bunzToMint} Bunz de recompensa por tu compra de $${order.total.toFixed(2)}.`,
      type: "REWARD",
      route: "/profile/wallet",
      pushData: { bunzAmount: bunzToMint, orderId },
      threadId: "rewards",
    });

    return NextResponse.json({
      success: true,
      message: "Recompensa acreditada correctamente.",
      bunzAwarded: bunzToMint,
      orderTotal: order.total,
      orderNumber: order.id.slice(-4).toUpperCase(),
    });
  } catch (error: any) {
    console.error("[CLAIM_TICKET_ERROR]", error);
    return NextResponse.json({ error: error.message || "Error interno al procesar el reclamo de ticket." }, { status: 500 });
  }
}
