import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, webSessions, verificationTokens, auditEntries } from "@/db/schema";
import { and, eq, gt, sql } from "drizzle-orm";
import { recordLedgerTransaction } from "@/lib/ledgerHelper";
import { archiveAccountToPandorasIpfs } from "@/lib/ipfsPandoras";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const customHeader = req.headers.get("x-session-token");
    let token: string | null = null;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.replace("Bearer ", "").trim();
    } else if (customHeader) {
      token = customHeader.trim();
    }

    if (!token) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1. Validar sesión viva
    const session = await db.query.webSessions.findFirst({
      where: and(
        eq(webSessions.jwtToken, token),
        gt(webSessions.expiresAt, new Date())
      ),
    });

    if (!session || !session.userId) {
      return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
    }

    const userId = session.userId;

    // 2. Body de confirmación estricta
    const body = await req.json().catch(() => ({}));
    if (body.confirmation !== "ELIMINAR") {
      return NextResponse.json(
        { error: 'Para confirmar debes escribir "ELIMINAR" exactamente.' },
        { status: 400 }
      );
    }

    // 3. Ejecutar transacción atómica de eliminación y traspaso a Tesorería
    const result = await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
        .for("update");

      if (!lockedUser) {
        throw new Error("USER_NOT_FOUND");
      }

      const availableBunz = Math.max(
        0,
        (lockedUser.totalBunzEarned || 0) - (lockedUser.totalBunzSpent || 0)
      );

      // Si tiene Bunz, pasan irrevocablemente a la Tesorería de Rabbitty
      let treasuryTxId: string | null = null;
      if (availableBunz > 0) {
        const treasuryIdempotencyKey = `treasury_forfeit_del_${userId}_${Date.now()}`;
        const ledgerEntry = await recordLedgerTransaction(
          {
            payerSubjectId: `usr_${userId}`,
            payeeSubjectId: "sys_rabbitty_treasury",
            amount: availableBunz,
            type: "ALLOCATION",
            idempotencyKey: treasuryIdempotencyKey,
            metadata: {
              action: "ACCOUNT_DELETION_FORFEIT",
              forfeitedAmount: availableBunz,
              reason: "Cláusula de términos y condiciones: Bunz acumulados cedidos a tesorería por baja definitiva.",
              userHops: lockedUser.hops,
              deletedAt: new Date().toISOString(),
            },
          },
          tx
        );
        treasuryTxId = ledgerEntry?.idempotencyKey || treasuryIdempotencyKey;

        // Registrar incremento de Bunz gastados para dejar el saldo neto en 0
        await tx
          .update(users)
          .set({
            totalBunzSpent: sql`${users.totalBunzSpent} + ${availableBunz}`,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userId));
      }

      // 4. Generar snapshot contable y anclarlo en el Nodo IPFS de Pandoras
      const ipfsResult = await archiveAccountToPandorasIpfs({
        userSubjectId: `usr_${userId}`,
        pseudonym: `del_${userId.slice(0, 8)}`,
        forfeitedBunz: availableBunz,
        totalHops: lockedUser.hops,
        visitedCount: lockedUser.visitedBusinesses,
        deletionTimestamp: new Date().toISOString(),
        jurisdictionCompliance: "LFPDPPP_MX_SAT_5YR_RETENTION",
        ledgerProofSummary: {
          action: "ACCOUNT_CLOSED_AND_FORFEITED_TO_TREASURY",
          treasurySubjectId: "sys_rabbitty_treasury",
        },
      });

      // 5. Registrar entrada de auditoría inmutable
      await tx.insert(auditEntries).values({
        userId: userId,
        action: "ACCOUNT_PERMANENT_DELETION",
        resource: "users",
        resourceId: userId,
        details: JSON.stringify({
          forfeitedBunz: availableBunz,
          treasuryTxId,
          ipfsAuditCid: ipfsResult.cid,
          pinnedToPandorasNode: ipfsResult.pinnedToPandorasNode,
          timestamp: new Date().toISOString(),
        }),
      });

      // 6. Eliminar sesiones y tokens del usuario
      await tx.delete(webSessions).where(eq(webSessions.userId, userId));
      if (lockedUser.phoneNumber) {
        await tx
          .delete(verificationTokens)
          .where(eq(verificationTokens.identifier, lockedUser.phoneNumber));
      }
      if (lockedUser.email) {
        await tx
          .delete(verificationTokens)
          .where(eq(verificationTokens.identifier, lockedUser.email));
      }

      // 7. Anonimizar el registro del usuario (Derechos ARCO + Preservación de FK para historial de restaurantes)
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      await tx
        .update(users)
        .set({
          firstName: "Usuario",
          lastName: "Eliminado",
          username: `deleted_${userId.slice(0, 8)}_${randomSuffix}`,
          email: null,
          phoneNumber: null,
          telegramId: null,
          tonWalletAddress: null,
          supportWhatsApp: null,
          totpSecret: null,
          totpEnabled: false,
          requireTotpForLogin: false,
          twoFactorMethods: "[]",
          role: "DELETED",
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return {
        forfeitedBunz: availableBunz,
        ipfsCid: ipfsResult.cid,
        pinnedToPandoras: ipfsResult.pinnedToPandorasNode,
      };
    });

    return NextResponse.json({
      success: true,
      message: "Tu cuenta ha sido eliminada permanentemente.",
      forfeitedBunz: result.forfeitedBunz,
      ipfsAuditCid: result.ipfsCid,
    });
  } catch (error) {
    console.error("[DELETE_ACCOUNT_ERROR]", error);
    return NextResponse.json(
      { error: "Ocurrió un error al procesar la eliminación de la cuenta." },
      { status: 500 }
    );
  }
}
