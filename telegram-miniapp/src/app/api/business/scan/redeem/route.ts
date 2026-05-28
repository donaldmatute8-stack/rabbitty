// scan/redeem — PurchasedOffer table not in current Drizzle schema.
// Returning graceful stub.
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json({ error: "Coupon redemption not yet available." }, { status: 503 });
}
