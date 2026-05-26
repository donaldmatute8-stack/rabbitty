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

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("[GET_PROFILE]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
