// inventory/route.ts — PurchasedOffer and Reservation tables are not in the current
// Drizzle schema. Returning graceful empty arrays until those features are re-designed.
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({ success: true, coupons: [], reservations: [] });
}
