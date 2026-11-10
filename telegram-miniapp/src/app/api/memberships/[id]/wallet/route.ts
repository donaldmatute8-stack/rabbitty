import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  membershipPlans,
  membershipPlanVersions,
  membershipSubscriptions,
  ownedBusinesses,
  users,
} from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { buildPkpass, getWalletCredentials } from "@/lib/wallet/pkpass";

export const runtime = "nodejs";

/**
 * Emite el `.pkpass` de una membresía activa del usuario.
 *
 * Requiere certificado Pass Type ID + llave + WWDR en variables de entorno.
 * Si falta alguno, 501 con mensaje claro en vez de un pase que Wallet rechace.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const creds = getWalletCredentials();
    if (!creds) {
      // Nombres de variables que faltan (nunca sus valores): permite soporte
      // sin adivinar por qué Wallet responde 501.
      const required = [
        "APPLE_WALLET_PASS_TYPE_ID",
        "APPLE_WALLET_TEAM_ID",
        "APPLE_WALLET_CERT_PEM",
        "APPLE_WALLET_KEY_PEM",
        "APPLE_WALLET_WWDR_PEM",
      ];
      const missing = required.filter((k) => !process.env[k] || !String(process.env[k]).trim());
      return NextResponse.json(
        {
          error: "APPLE_WALLET_NOT_CONFIGURED",
          message: missing.length
            ? `Falta configurar: ${missing.join(", ")}`
            : "Las credenciales de Wallet están incompletas o mal formadas.",
          missing,
        },
        { status: 501 },
      );
    }

    const { id } = await params;
    const [row] = await db
      .select({
        sub: membershipSubscriptions,
        plan: membershipPlans,
        version: membershipPlanVersions,
        businessName: ownedBusinesses.name,
        badgeColor: membershipPlans.badgeColor,
        memberName: users.firstName,
        username: users.username,
      })
      .from(membershipSubscriptions)
      .leftJoin(membershipPlanVersions, eq(membershipPlanVersions.id, membershipSubscriptions.planVersionId))
      .leftJoin(membershipPlans, eq(membershipPlans.id, membershipPlanVersions.planId))
      .leftJoin(ownedBusinesses, eq(ownedBusinesses.id, membershipSubscriptions.businessId))
      .leftJoin(users, eq(users.id, membershipSubscriptions.userId))
      .where(
        and(
          eq(membershipSubscriptions.id, id),
          eq(membershipSubscriptions.userId, caller.id),
        ),
      )
      .limit(1);

    if (!row) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });
    if (row.sub.status !== "ACTIVE") {
      return NextResponse.json({ error: "La membresía no está activa" }, { status: 409 });
    }

    const planName = row.plan?.name || "Membresía";
    const businessName = row.businessName || "Rabbitty";

    const pkpass = await buildPkpass(
      {
        serialNumber: row.sub.id,
        description: `${planName} · ${businessName}`,
        organizationName: businessName,
        planName,
        businessName,
        memberName: row.memberName || row.username || null,
        memberSince: row.sub.currentPeriodStart ? new Date(row.sub.currentPeriodStart).toISOString() : null,
        status: "Activa",
        accentColor: row.badgeColor,
        memberIdShort: row.sub.id.slice(0, 8).toUpperCase(),
      },
      creds,
    );

    return new NextResponse(new Uint8Array(pkpass), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="rabbitty-${row.sub.id.slice(0, 8)}.pkpass"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[MEMBERSHIP_WALLET]", error);
    return NextResponse.json(
      {
        error: "APPLE_WALLET_BUILD_FAILED",
        message:
          error instanceof Error
            ? `No se pudo firmar el pase: ${error.message}`
            : "No se pudo generar el pase de Wallet",
      },
      { status: 500 },
    );
  }
}
