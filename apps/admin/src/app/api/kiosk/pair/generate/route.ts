import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export const runtime = "nodejs";

/** POST /api/kiosk/pair/generate — el kiosko crea una sesión de identificación (10 min). */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const token = crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const label = String(body.restaurantName || "Kiosko Rabbitty").slice(0, 60);

    const db = getCoreDb();
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, "kiosk_pair_sessions")).limit(1);
    let sessions: Record<string, { label: string; expiresAt: string; customerId: null; customerName: null }> = {};
    try { if (rows[0]?.value) sessions = JSON.parse(rows[0].value); } catch { sessions = {}; }
    const now = Date.now();
    for (const [k, v] of Object.entries(sessions)) {
      if (new Date(v.expiresAt).getTime() < now) delete sessions[k];
    }
    sessions[token] = { label, expiresAt, customerId: null, customerName: null };
    if (rows.length) {
      await db.update(systemSettings).set({ value: JSON.stringify(sessions), updatedAt: new Date() }).where(eq(systemSettings.key, "kiosk_pair_sessions"));
    } else {
      await db.insert(systemSettings).values({ key: "kiosk_pair_sessions", value: JSON.stringify(sessions) });
    }

    return NextResponse.json({ success: true, token, expiresAt });
  } catch (err) {
    console.error("[KIOSK_PAIR_GENERATE]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
