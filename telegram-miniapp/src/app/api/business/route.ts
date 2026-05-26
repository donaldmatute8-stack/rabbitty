import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { 
      walletAddress, 
      name, 
      description, 
      category, 
      schedule,
      locationLat,
      locationLng,
      logoBase64,
      rewardPercentage 
    } = await req.json();

    if (!walletAddress || !name || !description || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (rewardPercentage < 10 || rewardPercentage > 100) {
      return NextResponse.json({ error: "Reward percentage must be between 10 and 100" }, { status: 400 });
    }

    // Find the profile
    const profile = await prisma.profile.findUnique({
      where: { smart_wallet_address: walletAddress }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Upsert Business
    const business = await prisma.business.upsert({
      where: { profileId: profile.id },
      update: {
        name,
        description,
        category,
        schedule,
        location_lat: locationLat,
        location_lng: locationLng,
        logo_base64: logoBase64,
        reward_percentage: rewardPercentage,
      },
      create: {
        profileId: profile.id,
        name,
        description,
        category,
        schedule,
        location_lat: locationLat,
        location_lng: locationLng,
        logo_base64: logoBase64,
        reward_percentage: rewardPercentage,
      }
    });

    return NextResponse.json({ success: true, business });
  } catch (error: any) {
    console.error("Error saving business:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('wallet');

    if (!walletAddress) {
      return NextResponse.json({ error: "Wallet address is required" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({
      where: { smart_wallet_address: walletAddress },
      include: { business: true }
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json({ business: profile.business });
  } catch (error: any) {
    console.error("Error fetching business:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
