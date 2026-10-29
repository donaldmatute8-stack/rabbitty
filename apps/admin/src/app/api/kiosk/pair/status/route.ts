import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import { systemSettings } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

/** GET /api/kiosk/pair/status?token= — el kiosko consulta si el cliente ya se identificó. */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") || "";
    const db = getCoreDb();
    const rows = await db.select().from(systemSettings).where(eq(systemSettings.key, "kiosk_pair_sessions")).limit(1);
    let sessions: Record<string, { label: string; expiresAt: string; customerId: string | null; customerName: string | null }> = {};
    try { if (rows[0]?.value) sessions = JSON.parse(rows[0].value); } catch { sessions = {}; }
    const entry = sessions[token];
    if (!entry || new Date(entry.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ success: true, linked: false, expired: true });
    }
    return NextResponse.json({
      success: true,
      linked: Boolean(entry.customerId),
      customerId: entry.customerId,
      customerName: entry.customerName,
    });
  } catch (err) {
    console.error("[KIOSK_PAIR_STATUS]", err);
    return NextResponse.json({ success: false, linked: false }, { status: 500 });
  }
}
