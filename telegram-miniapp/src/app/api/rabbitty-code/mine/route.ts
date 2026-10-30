import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export const runtime = "nodejs";

function degenerate(code: number): boolean {
  const d: number[] = [];
  for (let i = 11; i >= 0; i--) d.push(Math.floor(code / Math.pow(3, i)) % 3);
  return new Set(d).size < 2; // todas las barras al mismo nivel = ilegible
}

/** GET /api/rabbitty-code/mine — código óptico asignado del usuario (asigna si falta). */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });

    const [me] = await db.select({ scanCode: users.scanCode }).from(users).where(eq(users.id, caller.id)).limit(1);
    if (me?.scanCode) {
      return NextResponse.json({ success: true, code: me.scanCode });
    }

    const [userRows, bizRows] = await Promise.all([
      db.select({ c: users.scanCode }).from(users),
      db.select({ c: ownedBusinesses.scanCode }).from(ownedBusinesses),
    ]);
    const used = new Set([...userRows, ...bizRows].map((r) => r.c).filter(Boolean) as number[]);
    let code = 100000 + Math.floor(Math.random() * 431441);
    for (let tries = 0; tries < 50 && (used.has(code) || degenerate(code)); tries++) {
      code = 100000 + Math.floor(Math.random() * 431441);
    }
    await db.update(users).set({ scanCode: code }).where(eq(users.id, caller.id));
    return NextResponse.json({ success: true, code });
  } catch (err) {
    console.error("[RABBITTY_CODE_MINE]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
