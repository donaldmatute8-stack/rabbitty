import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { membershipSubscriptions } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { buildQrToken, QR_WINDOW_SECONDS } from "@/lib/membershipQr";

/** Token QR dinámico (rota cada 30s) de una membresía del usuario autenticado. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;
    const [sub] = await db
      .select()
      .from(membershipSubscriptions)
      .where(and(eq(membershipSubscriptions.id, id), eq(membershipSubscriptions.userId, caller.id)))
      .limit(1);
    if (!sub) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });
    if (sub.status !== "ACTIVE" || (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date())) {
      return NextResponse.json({ error: "Membresía no vigente" }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      qrToken: buildQrToken(sub.id, sub.qrPassSecret),
      expiresInSeconds: QR_WINDOW_SECONDS - (Math.floor(Date.now() / 1000) % QR_WINDOW_SECONDS),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("[memberships] pass error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

