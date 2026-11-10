import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { membershipSubscriptions } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

/**
 * Apple Wallet: punto de integración listo.
 *
 * Para emitir un .pkpass real se necesita:
 *   APPLE_WALLET_PASS_TYPE_ID
 *   APPLE_WALLET_TEAM_ID
 *   APPLE_WALLET_CERT_PEM
 *   APPLE_WALLET_KEY_PEM
 *   APPLE_WALLET_WWDR_PEM
 *
 * Sin esos secretos no se puede firmar el pase; devolvemos 501 con un mensaje
 * claro en vez de simular un wallet roto.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const [sub] = await db
      .select({ id: membershipSubscriptions.id })
      .from(membershipSubscriptions)
      .where(and(
        eq(membershipSubscriptions.id, id),
        eq(membershipSubscriptions.userId, caller.id),
        eq(membershipSubscriptions.status, "ACTIVE"),
      ))
      .limit(1);
    if (!sub) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

    const configured = Boolean(
      process.env.APPLE_WALLET_PASS_TYPE_ID &&
      process.env.APPLE_WALLET_TEAM_ID &&
      process.env.APPLE_WALLET_CERT_PEM &&
      process.env.APPLE_WALLET_KEY_PEM &&
      process.env.APPLE_WALLET_WWDR_PEM,
    );

    if (!configured) {
      return NextResponse.json(
        {
          error: "APPLE_WALLET_NOT_CONFIGURED",
          message: "Apple Wallet está listo en la app, pero falta el Pass Type ID y el certificado de Apple Developer.",
        },
        { status: 501 },
      );
    }

    return NextResponse.json(
      {
        error: "APPLE_WALLET_SIGNER_PENDING",
        message: "Certificados detectados. Falta conectar el firmador .pkpass con el template visual.",
      },
      { status: 501 },
    );
  } catch (error) {
    console.error("[MEMBERSHIP_WALLET]", error);
    return NextResponse.json({ error: "No se pudo generar el pase de Wallet" }, { status: 500 });
  }
}
