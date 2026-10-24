import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affiliateCampaigns, ownedBusinesses } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { z } from "zod";

const createCampaignSchema = z.object({
  businessId: z.string().min(1),
  title: z.string().min(3).max(80),
  headline: z.string().min(3).max(120),
  message: z.string().min(10).max(500),
  campaignType: z.enum(["WINBACK_INACTIVE", "OFF_PEAK_BOOST", "VIP_LOYALTY", "FLASH_OFFER"]),
  targetSegment: z.enum(["INACTIVE_25D", "VIP_5_VISITS", "ALL_CUSTOMERS"]),
  rewardPercentage: z.number().int().min(5).max(50),
  maxRewardPerUser: z.number().int().min(5).max(200).default(50),
  budgetBunz: z.number().int().min(50).max(5000),
  validityHours: z.number().int().min(1).max(168).default(48), // 1 hour to 7 days
  metadata: z.record(z.unknown()).optional(),
});

/**
 * GET /api/business/campaigns
 * Lists affiliate campaigns for the authenticated merchant's business.
 */
export async function GET(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get("businessId");

    // Verify ownership
    const business = await db.query.ownedBusinesses.findFirst({
      where: businessId
        ? and(eq(ownedBusinesses.id, businessId), eq(ownedBusinesses.ownerId, caller.id))
        : eq(ownedBusinesses.ownerId, caller.id),
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no encontrado o sin permisos" }, { status: 403 });
    }

    const rows = await db.select().from(affiliateCampaigns)
      .where(eq(affiliateCampaigns.businessId, business.id))
      .orderBy(desc(affiliateCampaigns.createdAt))
      .limit(50);

    return NextResponse.json({ success: true, campaigns: rows });
  } catch (error) {
    console.error("[AFFILIATE_CAMPAIGNS_GET]", error);
    return NextResponse.json({ error: "Error al obtener campañas" }, { status: 500 });
  }
}

/**
 * POST /api/business/campaigns
 * Creates a new merchant campaign in DRAFT or PENDING_APPROVAL status.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = createCampaignSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Datos de campaña inválidos", issues: parsed.error.issues }, { status: 400 });
    }

    const {
      businessId,
      title,
      headline,
      message,
      campaignType,
      targetSegment,
      rewardPercentage,
      maxRewardPerUser,
      budgetBunz,
      validityHours,
      metadata,
    } = parsed.data;

    // Verify ownership
    const business = await db.query.ownedBusinesses.findFirst({
      where: and(eq(ownedBusinesses.id, businessId), eq(ownedBusinesses.ownerId, caller.id)),
    });

    if (!business) {
      return NextResponse.json({ error: "Negocio no autorizado" }, { status: 403 });
    }

    const startsAt = new Date();
    const expiresAt = new Date(startsAt.getTime() + validityHours * 60 * 60 * 1000);

    const [campaign] = await db.insert(affiliateCampaigns).values({
      businessId: business.id,
      createdBy: caller.id,
      title,
      headline,
      message,
      campaignType,
      targetSegment,
      rewardPercentage,
      maxRewardPerUser,
      budgetBunz,
      budgetSpent: 0,
      redemptionCount: 0,
      startsAt,
      expiresAt,
      status: "DRAFT",
      metadata: metadata || null,
    }).returning();

    return NextResponse.json({ success: true, campaign });
  } catch (error) {
    console.error("[AFFILIATE_CAMPAIGNS_POST]", error);
    return NextResponse.json({ error: "Error al crear campaña" }, { status: 500 });
  }
}
