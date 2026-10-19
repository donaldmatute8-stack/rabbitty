import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, notifications } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { recordLedgerTransaction, findLedgerEntry } from "@/lib/ledgerHelper";
import { isApnsConfigured, sendPushToUsers } from "@/lib/push/apns";

const MAX_TRANSFER_BUNZ = 10_000_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { recipient, amount, note, idempotencyKey } = body;

    const bunzAmount = Number(amount);
    if (!Number.isInteger(bunzAmount) || bunzAmount <= 0) {
      return NextResponse.json({ error: "Cantidad de Bunz inválida" }, { status: 400 });
    }
    if (bunzAmount > MAX_TRANSFER_BUNZ) {
      return NextResponse.json({ error: `El máximo por transferencia es ${MAX_TRANSFER_BUNZ.toLocaleString("es-MX")} BUNZ` }, { status: 400 });
    }

    if (!recipient || typeof recipient !== "string") {
      return NextResponse.json({ error: "Debes especificar un destinatario (@usuario o ID)" }, { status: 400 });
    }

    const cleanRecipient = recipient.trim().replace(/^@/, "");
    if (!cleanRecipient) {
      return NextResponse.json({ error: "Destinatario inválido" }, { status: 400 });
    }

    const cleanNote = typeof note === "string" ? note.trim().slice(0, 140) : "";

    // Idempotency: a replay (client retry / network hiccup) must never charge twice.
    const key = typeof idempotencyKey === "string" && idempotencyKey.trim()
      ? idempotencyKey.trim().slice(0, 120)
      : `transfer_${caller.id}_${cleanRecipient}_${bunzAmount}_${cleanNote}`;

    const existing = await findLedgerEntry(key);
    if (existing) {
      return NextResponse.json({
        success: true,
        replayed: true,
        message: "Esta transferencia ya fue procesada.",
        data: { amount: Number(existing.amount) },
      });
    }

    // Look up recipient by @username, uuid id, telegramId or TON wallet address.
    const conditions = [
      eq(users.username, cleanRecipient),
      eq(users.telegramId, cleanRecipient),
      eq(users.tonWalletAddress, cleanRecipient),
    ];
    if (UUID_RE.test(cleanRecipient)) {
      conditions.push(eq(users.id, cleanRecipient));
    }

    const targetUser = await db.query.users.findFirst({ where: or(...conditions) });

    if (!targetUser) {
      return NextResponse.json({ error: "Usuario destinatario no encontrado" }, { status: 404 });
    }

    if (targetUser.id === caller.id) {
      return NextResponse.json({ error: "No puedes transferirte Bunz a ti mismo" }, { status: 400 });
    }

    const result = await db.transaction(async (tx) => {
      // Deterministic lock acquisition order (eliminates AB-BA deadlock risk in Postgres)
      const isCallerFirst = caller.id < targetUser.id;
      const firstId = isCallerFirst ? caller.id : targetUser.id;
      const secondId = isCallerFirst ? targetUser.id : caller.id;

      const [firstLocked] = await tx
        .select()
        .from(users)
        .where(eq(users.id, firstId))
        .limit(1)
        .for("update");

      const [secondLocked] = await tx
        .select()
        .from(users)
        .where(eq(users.id, secondId))
        .limit(1)
        .for("update");

      const sender = isCallerFirst ? firstLocked : secondLocked;
      const receiver = isCallerFirst ? secondLocked : firstLocked;

      if (!sender) throw new Error("SENDER_NOT_FOUND");
      if (!receiver) throw new Error("RECIPIENT_NOT_FOUND");

      const availableBalance = (sender.totalBunzEarned || 0) - (sender.totalBunzSpent || 0);
      if (availableBalance < bunzAmount) throw new Error("INSUFFICIENT_BUNZ");

      // 3. Debit sender
      await tx
        .update(users)
        .set({
          totalBunzSpent: sql`${users.totalBunzSpent} + ${bunzAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, sender.id));

      // 4. Credit recipient
      await tx
        .update(users)
        .set({
          totalBunzEarned: sql`${users.totalBunzEarned} + ${bunzAmount}`,
          updatedAt: new Date(),
        })
        .where(eq(users.id, receiver.id));

      // 5. Authoritative ledger entry (conflict-safe on idempotencyKey)
      await recordLedgerTransaction(
        {
          payerSubjectId: `usr_${sender.id}`,
          payeeSubjectId: `usr_${receiver.id}`,
          amount: bunzAmount,
          type: "TRANSFER",
          idempotencyKey: key,
          metadata: {
            note: cleanNote || "Transferencia P2P Ra Wallet",
            senderUsername: sender.username || sender.firstName || "Amigo",
            recipientUsername: receiver.username || receiver.firstName || "Amigo",
            source: "ra_wallet",
          },
        },
        tx
      );

      // 6. In-app notifications for both parties
      await tx.insert(notifications).values([
        {
          userId: receiver.id,
          title: "¡Recibiste Bunz! 🐰✨",
          message: `${sender.firstName || sender.username || "Un amigo"} te envió ${bunzAmount} BUNZ${cleanNote ? `: "${cleanNote}"` : "."}`,
          type: "TRANSFER",
        },
        {
          userId: sender.id,
          title: "Transferencia enviada",
          message: `Enviaste ${bunzAmount} BUNZ a @${receiver.username || receiver.firstName || "usuario"}.`,
          type: "TRANSFER",
        },
      ]);

      return {
        senderNewBalance: availableBalance - bunzAmount,
        recipientName: receiver.username || receiver.firstName || "Usuario",
      };
    });

    // Best-effort native push to the recipient (never blocks or fails the transfer).
    if (isApnsConfigured()) {
      try {
        await sendPushToUsers([targetUser.id], {
          title: "¡Recibiste Bunz! 🐰✨",
          body: `${caller.username ? `@${caller.username}` : "Un amigo"} te envió ${bunzAmount} BUNZ${cleanNote ? `: "${cleanNote}"` : "."}`,
          data: { type: "TRANSFER", amount: bunzAmount },
          threadId: "transfers",
        });
      } catch (pushError) {
        console.error("[WALLET_TRANSFER_PUSH]", pushError);
      }
    }

    return NextResponse.json({
      success: true,
      message: `¡Transferencia exitosa de ${bunzAmount} Bunz!`,
      data: result,
    });
  } catch (error) {
    console.error("[WALLET_TRANSFER_POST]", error);
    const code = error instanceof Error ? error.message : "";
    if (code === "INSUFFICIENT_BUNZ") {
      return NextResponse.json({ error: "Saldo insuficiente de Bunz para completar la transferencia" }, { status: 400 });
    }
    if (code === "SENDER_NOT_FOUND") {
      return NextResponse.json({ error: "Cuenta no encontrada" }, { status: 404 });
    }
    if (code === "RECIPIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Destinatario no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ error: "Error al procesar la transferencia" }, { status: 500 });
  }
}
