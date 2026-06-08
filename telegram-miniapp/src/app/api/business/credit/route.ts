// credit/route.ts — minting_credit field does not exist in current Drizzle schema.
// Returning graceful stub until minting credit system is migrated.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "Credit system not yet available." }, { status: 503 });
}
