import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getCoreDb } from "@rabbitty/api/db";
import { webSessions } from "@rabbitty/database-core";
import { eq } from "drizzle-orm";

// Estado de una vinculación móvil (emparejamiento por QR).
// - "pending": la sesión efímera sigue viva, el móvil todavía no escaneó.
// - "linked": la sesión efímera fue consumida por el móvil (se elimina al consumirse).
// - "expired": la sesión efímera caducó sin ser consumida.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const sid = req.nextUrl.searchParams.get("sid");
    if (!sid) {
      return NextResponse.json({ error: "Falta el parámetro sid" }, { status: 400 });
    }

    const db = getCoreDb();
    const [row] = await db.select().from(webSessions).where(eq(webSessions.id, sid));

    if (!row) {
      // La sesión efímera se elimina de inmediato al consumirse: su ausencia
      // significa que el móvil ya completó la vinculación.
      return NextResponse.json({ status: "linked" });
    }

    if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ status: "expired" });
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("[PAIRING STATUS ERROR]", error);
    return NextResponse.json({ error: "Error interno al consultar la vinculación" }, { status: 500 });
  }
}
