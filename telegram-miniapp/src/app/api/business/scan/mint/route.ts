import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses, transactions, levels } from "@/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { processReferralAndNotifications } from '@/lib/referralLogic';
import { awardHops, evaluateHatTricks } from '@/lib/gamificationLogic';
import { sendToOracle } from '@/lib/oracle-client';
import { parseTelegramUser, validateTelegramInitData } from '@/lib/telegramAuth';
import { recordLedgerTransaction, findLedgerEntry } from '@/lib/ledgerHelper';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import crypto from 'crypto';
import { z } from 'zod';

const mintSchema = z.object({
  telegramId: z.string().min(1),
  businessId: z.string().uuid(),
  fiatAmount: z.number().positive(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = mintSchema.safeParse(body);
    
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de entrada inválidos.", details: parsed.error.format() }, { status: 400 });
    }
    
    const { telegramId, businessId, fiatAmount } = parsed.data;

    const business = await db.query.ownedBusinesses.findFirst({
      where: eq(ownedBusinesses.id, businessId)
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado o no autorizado." }, { status: 403 });
    }

    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.RABBITTY_API_SECRET;
    const serverAuthed = !!expectedSecret && authHeader === `Bearer ${expectedSecret}`;

    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!serverAuthed) {
      const sessionCaller = await getAuthenticatedUser(req);
      let callerUserId: string | null = sessionCaller?.id ?? null;

      if (!callerUserId) {
        const initData = typeof body.initData === "string" ? body.initData : "";
        if (initData && botToken) {
          if (!validateTelegramInitData(initData, botToken)) {
            return NextResponse.json({ error: "Credenciales de Telegram inválidas." }, { status: 401 });
          }
          const tgUser = parseTelegramUser(initData);
          if (tgUser?.id) {
            const caller = await db.query.users.findFirst({ where: eq(users.telegramId, tgUser.id.toString()) });
            if (caller) callerUserId = caller.id;
          }
        } else {
          return NextResponse.json({ error: "Autenticación requerida." }, { status: 401 });
        }
      }

      if (!callerUserId) {
        return NextResponse.json({ error: "No autorizado: identidad no registrada." }, { status: 401 });
      }

      if (business.ownerId !== callerUserId) {
        return NextResponse.json({ error: "No autorizado para operar este negocio." }, { status: 403 });
      }
    }

    const conditions = [
      eq(users.telegramId, telegramId),
      eq(users.tonWalletAddress, telegramId)
    ];
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(telegramId)) {
      conditions.push(eq(users.id, telegramId));
    }

    const customer = await db.query.users.findFirst({
      where: or(...conditions)
    });

    if (!customer) {
      return NextResponse.json({ error: "El usuario no existe o no está registrado." }, { status: 404 });
    }

    // Check multiplier based on user level
    let multiplier = 1.0;
    if (customer.levelId) {
      const level = await db.query.levels.findFirst({ where: eq(levels.id, customer.levelId) });
      if (level) multiplier = level.bunzMultiplier;
    }

    const bunzReward = Math.floor(fiatAmount * (business.rewardPercentage / 100) * multiplier);

    if (bunzReward <= 0) {
      return NextResponse.json({ error: "El monto es muy bajo para generar una recompensa en Bunz." }, { status: 400 });
    }

    // Check credit limit
    if (business.creditLimit > 0 && (business.creditUsed + bunzReward) > business.creditLimit) {
      return NextResponse.json({
        error: `El negocio ha alcanzado su límite de crédito de minting (${business.creditLimit.toLocaleString()} Bunz). Contacta a soporte para aumentarlo.`
      }, { status: 400 });
    }

    // Determine if it's a new business for the user
    const previousTransaction = await db.query.transactions.findFirst({
      where: and(eq(transactions.userId, customer.id), eq(transactions.businessId, business.id))
    });
    const isNewBusiness = !previousTransaction;

    const clientKey = typeof body.idempotency_key === 'string'
      ? body.idempotency_key
      : (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined);
    const idempotencyKey = `mnt_${clientKey || crypto.randomUUID()}`;

    // Atomic SQL transaction with pessimistic row lock and authoritative Ledger entry
    const result = await db.transaction(async (tx) => {
      // Row lock on customer
      const [lockedCustomer] = await tx
        .select()
        .from(users)
        .where(eq(users.id, customer.id))
        .for('update');

      if (!lockedCustomer) {
        throw new Error('CUSTOMER_NOT_FOUND');
      }

      // Idempotent replay: do not double-mint on a re-delivered request.
      const prior = await findLedgerEntry(idempotencyKey, tx);
      if (prior) {
        return { idempotent: true };
      }

      // Insert transaction record
      const [appTx] = await tx
        .insert(transactions)
        .values({
          userId: customer.id,
          businessId: business.id,
          fiatAmount,
          bunzMinted: bunzReward,
          status: "MINTED",
        })
        .returning();

      // Update customer balance
      await tx.update(users)
        .set({ totalBunzEarned: sql`COALESCE(${users.totalBunzEarned}, 0) + ${bunzReward}` })
        .where(eq(users.id, lockedCustomer.id));

      // Deduct from business credit limit
      if (business.creditLimit > 0) {
        await tx.update(ownedBusinesses)
          .set({ creditUsed: sql`${ownedBusinesses.creditUsed} + ${bunzReward}` })
          .where(eq(ownedBusinesses.id, business.id));
      }

      // Record authoritative Ledger entry
      await recordLedgerTransaction(
        {
          payerSubjectId: business.id,
          payeeSubjectId: `usr_${customer.id}`,
          amount: bunzReward,
          type: "EARN",
          referenceId: appTx.id,
          idempotencyKey,
          metadata: { fiatAmount, businessId: business.id, customerTelegramId: customer.telegramId },
        },
        tx
      );

      return { idempotent: false };
    });

    if (result.idempotent) {
      return NextResponse.json({
        success: true,
        message: "Recompensa ya otorgada previamente.",
        bunzRewarded: bunzReward
      });
    }

    // Trigger referral and notifications (EARN event)
    await processReferralAndNotifications(customer.id, 'EARN');

    // Gamification Engine
    await awardHops(customer.id, isNewBusiness);
    await evaluateHatTricks(customer.id, { type: 'TOTAL_VISITS', value: 1, category: business.category });

    // Oracle on-chain mint (fire-and-forget)
    const receiptHash = crypto.createHash('sha256').update(`${businessId}-${customer.id}-${fiatAmount}-${Date.now()}`).digest('hex');
    sendToOracle({
      businessAddress: businessId,
      userAddress: customer.id,
      purchaseAmount: fiatAmount,
      receiptHash,
    });

    // Telegram Bot Push Notification (EARN Event)
    const activeBotToken = process.env.TELEGRAM_BOT_TOKEN;
    if (activeBotToken) {
      if (customer.telegramId) {
        try {
          const earnMsg =
            `🎉 *¡Ganaste ${bunzReward.toLocaleString()} Bunz!* 🐰\n\n` +
            `Tu consumo de *$${fiatAmount.toLocaleString()} MXN* en *${business.name}* ha sido validado exitosamente.\n\n` +
            `_¡Sigue acumulando Bunz y sube de nivel en la comunidad!_`;

          await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: customer.telegramId,
              text: earnMsg,
              parse_mode: 'Markdown',
            }),
          });
        } catch (tgErr) {
          console.error('[TG_NOTIFICATION_ERROR]', tgErr);
        }
      }

      // Check if business credit limit is running low (< 15% remaining)
      if (business.creditLimit > 0) {
        const remainingCredit = business.creditLimit - ((business.creditUsed || 0) + bunzReward);
        const ratio = remainingCredit / business.creditLimit;
        if (ratio <= 0.15 && business.ownerId) {
          try {
            const owner = await db.query.users.findFirst({ where: eq(users.id, business.ownerId) });
            if (owner?.telegramId) {
              const alertMsg =
                `⚠️ *Alerta de Bunz Bajos - ${business.name}*\n\n` +
                `Te quedan solo *${remainingCredit.toLocaleString()} Bunz* disponibles para recompensar a tus clientes.\n\n` +
                `Ingresa a tu panel de administración para recargar y seguir entregando beneficios.`;

              await fetch(`https://api.telegram.org/bot${activeBotToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: owner.telegramId,
                  text: alertMsg,
                  parse_mode: 'Markdown',
                }),
              });
            }
          } catch (creditAlertErr) {
            console.error('[CREDIT_ALERT_ERROR]', creditAlertErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Recompensa otorgada exitosamente.",
      bunzRewarded: bunzReward
    });

  } catch (error: unknown) {
    console.error("[MINT_ERROR]", error);
    const msg = error instanceof Error ? error.message : "Error procesando la recompensa";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
