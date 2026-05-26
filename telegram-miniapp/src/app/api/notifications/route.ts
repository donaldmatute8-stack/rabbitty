import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet) {
      return NextResponse.json({ error: "Missing wallet address" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { smart_wallet_address: wallet },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const notifications = await prisma.notification.findMany({
      where: { profileId: profile.id },
      orderBy: { created_at: "desc" },
      take: 50
    });

    return NextResponse.json({ success: true, notifications });
  } catch (error) {
    console.error("[GET_NOTIFICATIONS]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Mark as read
  try {
    const { notificationId } = await req.json();
    
    if (!notificationId) {
      return NextResponse.json({ error: "Missing notificationId" }, { status: 400 });
    }

    await prisma.notification.update({
      where: { id: notificationId },
      data: { is_read: true }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[MARK_NOTIFICATION_READ]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
