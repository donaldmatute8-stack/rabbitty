import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { ledgerEntries, ownedBusinesses, transactions } from "@/db/schema";
import { restaurantDb } from "@/db/restaurant";
import {
  orders as rOrders,
  payments as rPayments,
  branches as rBranches,
  restaurants as rRestaurants,
} from "@rabbitty/database-restaurant/schema";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";
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
  /** Bunz = moneda de rewards; MXN = pago fiat (tarjeta, Mercado Pago, caja). */
  currency: "BUNZ" | "MXN";
  detail?: string | null;
}

function fiatMethodMeta(method: string, verification?: string | null) {
  const m = String(method || "").toUpperCase();
  if (m === "BUNZ") return { label: "Bunz", icon: "🐰" };
  if (String(verification || "").includes("MERCADO_PAGO")) return { label: "Mercado Pago", icon: "💙" };
  if (m === "CASH") return { label: "Efectivo", icon: "💵" };
  if (m.includes("CARD")) return { label: "Tarjeta / Apple Pay", icon: "💳" };
  return { label: method || "Pago", icon: "💳" };
}

export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // El ledger histórico usa dos convenciones: `usr_<uuid>` (motor nuevo) y
    // el UUID crudo (motor legacy / Telegram). Se consultan AMBAS o los
    // movimientos viejos desaparecen del historial.
    const subjectId = `usr_${caller.id}`;
    const subjects = [subjectId, caller.id];

    const ledgerRows = await db
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
          inArray(ledgerEntries.payeeSubjectId, subjects),
          inArray(ledgerEntries.payerSubjectId, subjects)
        )
      )
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(60);

    // Pagos fiat del cliente (tarjeta, Mercado Pago, caja). Los pagos con Bunz
    // ya vienen del ledger; se excluyen aquí para no duplicar.
    let fiatRows: Array<{
      id: string;
      orderId: string | null;
      method: string;
      amount: number;
      tipAmount: number;
      verificationMethod: string | null;
      createdAt: Date | null;
      businessName: string | null;
      branchName: string | null;
    }> = [];
    try {
      fiatRows = await restaurantDb
        .select({
          id: rPayments.id,
          orderId: rPayments.orderId,
          method: rPayments.method,
          amount: rPayments.amount,
          tipAmount: rPayments.tipAmount,
          verificationMethod: rPayments.verificationMethod,
          createdAt: rPayments.createdAt,
          businessName: rRestaurants.name,
          branchName: rBranches.name,
        })
        .from(rPayments)
        .innerJoin(rOrders, eq(rOrders.id, rPayments.orderId))
        .innerJoin(rBranches, eq(rBranches.id, rOrders.branchId))
        .leftJoin(rRestaurants, eq(rRestaurants.id, rBranches.restaurantId))
        .where(
          and(
            eq(rOrders.customerId, caller.id),
            eq(rPayments.status, "COMPLETED"),
            ne(rPayments.method, "BUNZ")
          )
        )
        .orderBy(desc(rPayments.createdAt))
        .limit(60);
    } catch (fiatErr) {
      // No bloquear el historial Bunz si la DB restaurante falla.
      console.error("[GET_HISTORY] fiat:", fiatErr);
    }

    const bunzHistory: AuthoritativeHistoryItem[] = ledgerRows
      .filter((entry) => Math.round(Number(entry.amount)) !== 0)
      .map((entry) => {
      const isPayee = entry.payeeSubjectId === subjectId || entry.payeeSubjectId === caller.id;
      const meta = (entry.metadata as Record<string, unknown>) || {};
      const amountNum = Math.round(Number(entry.amount));

      let name = "Transacción Bunz";
      let category = "Ledger";
      let icon = "🐰";
      const type: "earned" | "spent" = isPayee ? "earned" : "spent";
      const amountStr = isPayee ? `+${amountNum}` : `-${amountNum}`;

      if (entry.type === "TRANSFER") {
        if (isPayee) {
          name = meta.senderUsername ? `Transferencia de @${meta.senderUsername}` : "Bunz Recibidos";
          category = "P2P Wallet";
          icon = "📥";
        } else {
          name = meta.recipientUsername ? `Transferencia a @${meta.recipientUsername}` : "Bunz Enviados";
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
        currency: "BUNZ",
        detail: null,
      };
    });

    const fiatHistory: AuthoritativeHistoryItem[] = fiatRows.map((pay) => {
      const meta = fiatMethodMeta(pay.method, pay.verificationMethod);
      const amount = Number(pay.amount || 0);
      return {
        id: `pay_${pay.id}`,
        name: pay.businessName || pay.branchName || "Pago en local",
        category: "Pago en local",
        amount: `-${amount.toFixed(2)}`,
        type: "spent",
        date: pay.createdAt ? pay.createdAt.toISOString() : new Date().toISOString(),
        icon: meta.icon,
        referenceId: pay.orderId || null,
        idempotencyKey: `pay_${pay.id}`,
        ledgerType: "FIAT",
        currency: "MXN",
        detail: meta.label,
      };
    });

    const merged = [...bunzHistory, ...fiatHistory]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 80);

    if (merged.length > 0) {
      return NextResponse.json({
        success: true,
        source: "merged_ledger_payments",
        history: merged,
      });
    }

    // Fallback: usuarios antiguos sin ledger ni pagos vinculados.
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
      .where(eq(transactions.userId, caller.id))
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
      currency: "BUNZ",
      detail: null,
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
