import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { sessionId, walletAddress } = await req.json();

    if (!sessionId || !walletAddress) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const session = await prisma.qRLoginSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.status !== "PENDING" || new Date() > session.expires_at) {
      return NextResponse.json({ error: "Session expired or already processed" }, { status: 400 });
    }

    // Approve the session
    await prisma.qRLoginSession.update({
      where: { id: sessionId },
      data: {
        status: "APPROVED",
        wallet_address: walletAddress
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error approving QR session:", error);
    return NextResponse.json({ error: "Failed to approve session" }, { status: 500 });
  }
}
