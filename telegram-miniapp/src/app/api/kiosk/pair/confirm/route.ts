import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemSettings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

interface KioskSession { label: string; expiresAt: string; customerId: string | null; customerName: string | null }

/** POST /api/kiosk/pair/confirm { token } — el cliente confirma su identidad para el kiosko. */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const { token } = await req.json().catch(() => ({}));
    if (!token || typeof token !== "string") {
      return NextResponse.json({ success: false, error: "Token requerido" }, { status: 400 });
    }

    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, "kiosk_pair_sessions")).limit(1);
    let sessions: Record<string, KioskSession> = {};
    try { if (rows[0]?.value) sessions = JSON.parse(rows[0].value); } catch { sessions = {}; }
    const entry = sessions[token];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ success: false, error: "Sesión del kiosko inválida o expirada" }, { status: 401 });
    }
    if (entry.customerId) {
      return NextResponse.json({ success: false, error: "Sesión ya reclamada" }, { status: 409 });
    }

    const [me] = await db.select({ id: users.id, username: users.username, firstName: users.firstName, phoneNumber: users.phoneNumber }).from(users).where(eq(users.id, caller.id)).limit(1);
    if (!me) return NextResponse.json({ success: false, error: "Usuario no encontrado" }, { status: 404 });

    entry.customerId = me.id;
    entry.customerName = me.firstName || me.username || "Rabbitter";
    await db.update(systemSettings).set({ value: JSON.stringify(sessions), updatedAt: new Date() }).where(eq(systemSettings.key, "kiosk_pair_sessions"));

    return NextResponse.json({ success: true, customerName: entry.customerName, label: entry.label });
  } catch (err) {
    console.error("[KIOSK_PAIR_CONFIRM]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
