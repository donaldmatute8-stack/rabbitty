// reserve/route.ts — The Prisma version used fields (daily_bunz_cap, reservations)
// that don't exist in the current Drizzle schema. Returning a graceful stub until
// that feature is re-designed in the new schema.
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Reservations not yet available." }, { status: 503 });
}
