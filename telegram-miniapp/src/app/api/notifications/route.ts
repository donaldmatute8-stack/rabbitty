// Notifications are not yet in the Drizzle schema — return empty list gracefully
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  return NextResponse.json({ success: true, notifications: [] });
}

export async function POST(req: NextRequest) {
  return NextResponse.json({ success: true });
}
