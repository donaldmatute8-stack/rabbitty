import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  try {
    const { smart_wallet_address, role } = await req.json();

    if (!smart_wallet_address || !role) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (role !== "RABBITTER" && role !== "AFFILIATE") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const profile = await prisma.profile.update({
      where: { smart_wallet_address },
      data: { role },
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (error) {
    console.error("[SET_ROLE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
