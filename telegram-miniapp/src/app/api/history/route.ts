import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ledgerEntries, ownedBusinesses, transactions } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export interface AuthoritativeHistoryItem {
  id: string;
  name: string;
  category: string;
  amount: string;
  type: "earned" | "spent";
  date: string;
  icon: string;
  referenceId: string | null;
  idempotencyKey: string;
  ledgerType: string;
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const subjectId = `usr_${caller.id}`;

    // Query immutable ledger entries for this user (both earned as payee and spent as payer)
    const entries = await db
      .select({
        id: ledgerEntries.id,
        payerSubjectId: ledgerEntries.payerSubjectId,
        payeeSubjectId: ledgerEntries.payeeSubjectId,
        amount: ledgerEntries.amount,
        type: ledgerEntries.type,
        referenceId: ledgerEntries.referenceId,
        idempotencyKey: ledgerEntries.idempotencyKey,
        metadata: ledgerEntries.metadata,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .where(
        or(
          eq(ledgerEntries.payeeSubjectId, subjectId),
          eq(ledgerEntries.payerSubjectId, subjectId)
        )
      )
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(60);

    // If user has ledger entries, map them authoritatively
    if (entries.length > 0) {
      const formattedHistory: AuthoritativeHistoryItem[] = entries.map((entry) => {
        const isPayee = entry.payeeSubjectId === subjectId;
        const meta = (entry.metadata as Record<string, unknown>) || {};
        const amountNum = Math.round(Number(entry.amount));

        let name = "Transacción Bunz";
        let category = "Ledger";
        let icon = "🐰";
        const type: "earned" | "spent" = isPayee ? "earned" : "spent";
        const amountStr = isPayee ? `+${amountNum}` : `-${amountNum}`;

        if (entry.type === "TRANSFER") {
          if (isPayee) {
            name = meta.senderUsername
              ? `Transferencia de @${meta.senderUsername}`
              : "Bunz Recibidos";
            category = "P2P Wallet";
            icon = "📥";
          } else {
            name = meta.recipientUsername
              ? `Transferencia a @${meta.recipientUsername}`
              : "Bunz Enviados";
            category = "P2P Wallet";
            icon = "📤";
          }
        } else if (entry.type === "EARN") {
          if (entry.payerSubjectId === "sys_referrals" || meta.source === "referral_program") {
            name = "Recompensa por Referido";
            category = "Comunidad";
            icon = "👥";
          } else if (entry.payerSubjectId === "sys_gamification" || meta.source === "gamification_trick") {
            name = meta.trickTitle ? String(meta.trickTitle) : "Misión Completada";
            category = "Gamificación";
            icon = "🎩";
          } else if (entry.payerSubjectId === "sys_telegram_link") {
            name = "Vinculación Telegram";
            category = "Bienvenida";
            icon = "✈️";
          } else {
            name = "Cashback en Negocio";
            category = "Consumo";
            icon = "🍔";
          }
        } else if (entry.type === "SPEND") {
          name = meta.businessName ? String(meta.businessName) : "Canje en Comercio";
          category = "Canje";
          icon = "🏷️";
        } else if (entry.type === "REFUND") {
          name = "Reembolso de Bunz";
          category = "Reembolso";
          icon = "↩️";
        }

        return {
          id: entry.id,
          name,
          category,
          amount: amountStr,
          type,
          date: entry.createdAt ? entry.createdAt.toISOString() : new Date().toISOString(),
          icon,
          referenceId: entry.referenceId || null,
          idempotencyKey: entry.idempotencyKey,
          ledgerType: entry.type,
        };
      });

      return NextResponse.json({
        success: true,
        source: "authoritative_ledger",
        history: formattedHistory,
      });
    }

    // Fallback: If no ledger records exist yet for this legacy user, query transactions
    const rows = await db
      .select({
        id: transactions.id,
        fiatAmount: transactions.fiatAmount,
        bunzMinted: transactions.bunzMinted,
        status: transactions.status,
        createdAt: transactions.createdAt,
        businessName: ownedBusinesses.name,
        businessCategory: ownedBusinesses.category,
      })
      .from(transactions)
      .innerJoin(ownedBusinesses, eq(transactions.businessId, ownedBusinesses.id))
      .where(
        eq(transactions.userId, caller.id)
      )
      .orderBy(desc(transactions.createdAt))
      .limit(50);

    const fallbackHistory: AuthoritativeHistoryItem[] = rows.map((tx) => ({
      id: tx.id,
      name: tx.businessName,
      category: tx.businessCategory,
      amount: `+${tx.bunzMinted}`,
      type: "earned",
      date: tx.createdAt?.toISOString() ?? new Date().toISOString(),
      icon: getCategoryIcon(tx.businessCategory),
      referenceId: tx.id,
      idempotencyKey: `legacy_tx_${tx.id}`,
      ledgerType: "EARN",
    }));

    return NextResponse.json({
      success: true,
      source: "legacy_transactions",
      history: fallbackHistory,
    });
  } catch (error) {
    console.error("[GET_HISTORY]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getCategoryIcon(category: string) {
  const cat = category.toLowerCase();
  if (cat.includes("comida") || cat.includes("caf") || cat.includes("restaurante")) return "🍔";
  if (cat.includes("fit") || cat.includes("gym")) return "💪";
  if (cat.includes("tech") || cat.includes("tecno")) return "💻";
  if (cat.includes("belleza") || cat.includes("spa")) return "✨";
  return "🏷️";
}
