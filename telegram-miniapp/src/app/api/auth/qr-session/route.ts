import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    // Generate a new QR Login session
    const session = await prisma.qRLoginSession.create({
      data: {
        expires_at: new Date(Date.now() + 5 * 60 * 1000) // Expires in 5 minutes
      }
    });
    
    return NextResponse.json({ success: true, sessionId: session.id });
  } catch (error: any) {
    console.error("Error creating QR session:", error);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const session = await prisma.qRLoginSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Check expiration
    if (new Date() > session.expires_at) {
      await prisma.qRLoginSession.update({
        where: { id: sessionId },
        data: { status: "EXPIRED" }
      });
      return NextResponse.json({ status: "EXPIRED" });
    }

    return NextResponse.json({ 
      status: session.status, 
      wallet_address: session.wallet_address 
    });
  } catch (error: any) {
    console.error("Error fetching QR session:", error);
    return NextResponse.json({ error: "Failed to fetch session status" }, { status: 500 });
  }
}
