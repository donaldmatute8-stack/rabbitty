import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { affiliateCampaigns, ownedBusinesses } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { z } from "zod";

const actionSchema = z.object({
  campaignId: z.string().min(1),
  action: z.enum(["APPROVE_AND_ACTIVATE", "PAUSE", "RESUME", "CANCEL"]),
  idempotencyKey: z.string().min(1).optional(),
});

/**
 * POST /api/business/campaigns/manage
 * Idempotent campaign lifecycle management with explicit merchant approval.
 * Actions:
 * - 'APPROVE_AND_ACTIVATE': Moves DRAFT -> ACTIVE, records approvedBy and approvedAt.
 * - 'PAUSE': Moves ACTIVE -> PAUSED.
 * - 'RESUME': Moves PAUSED -> ACTIVE (if not expired).
 * - 'CANCEL': Moves any non-terminal state -> CANCELLED.
 */
export async function POST(req: NextRequest) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const json = await req.json();
    const parsed = actionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Parámetros inválidos", issues: parsed.error.issues }, { status: 400 });
    }

    const { campaignId, action } = parsed.data;

    // Fetch campaign
    const [campaign] = await db.select().from(affiliateCampaigns)
      .where(eq(affiliateCampaigns.id, campaignId))
      .limit(1);

    if (!campaign) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    // Verify ownership of the business
    const business = await db.query.ownedBusinesses.findFirst({
      where: and(eq(ownedBusinesses.id, campaign.businessId), eq(ownedBusinesses.ownerId, caller.id)),
    });

    if (!business) {
      return NextResponse.json({ error: "No autorizado para modificar esta campaña" }, { status: 403 });
    }

    const now = new Date();

    // Check expiration
    if (campaign.expiresAt < now && campaign.status !== "EXPIRED" && campaign.status !== "CANCELLED") {
      await db.update(affiliateCampaigns)
        .set({ status: "EXPIRED", updatedAt: now })
        .where(eq(affiliateCampaigns.id, campaign.id));
      return NextResponse.json({ error: "La campaña ha expirado", status: "EXPIRED" }, { status: 400 });
    }

    let nextStatus: typeof campaign.status = campaign.status;
    const updateFields: Record<string, unknown> = { updatedAt: now };

    switch (action) {
      case "APPROVE_AND_ACTIVATE":
        if (campaign.status === "ACTIVE") {
          // Idempotent success if already active
          return NextResponse.json({ success: true, campaign, alreadyActive: true });
        }
        if (campaign.status !== "DRAFT" && campaign.status !== "PENDING_APPROVAL") {
          return NextResponse.json({ error: `No se puede activar una campaña en estado ${campaign.status}` }, { status: 400 });
        }
        nextStatus = "ACTIVE";
        updateFields.approvedBy = caller.id;
        updateFields.approvedAt = now;
        break;

      case "PAUSE":
        if (campaign.status === "PAUSED") {
          return NextResponse.json({ success: true, campaign, alreadyPaused: true });
        }
        if (campaign.status !== "ACTIVE") {
          return NextResponse.json({ error: `Solo se pueden pausar campañas activas` }, { status: 400 });
        }
        nextStatus = "PAUSED";
        break;

      case "RESUME":
        if (campaign.status === "ACTIVE") {
          return NextResponse.json({ success: true, campaign, alreadyActive: true });
        }
        if (campaign.status !== "PAUSED") {
          return NextResponse.json({ error: `Solo se pueden reanudar campañas pausadas` }, { status: 400 });
        }
        nextStatus = "ACTIVE";
        break;

      case "CANCEL":
        if (campaign.status === "CANCELLED") {
          return NextResponse.json({ success: true, campaign, alreadyCancelled: true });
        }
        nextStatus = "CANCELLED";
        break;
    }

    updateFields.status = nextStatus;

    const [updated] = await db.update(affiliateCampaigns)
      .set(updateFields)
      .where(eq(affiliateCampaigns.id, campaign.id))
      .returning();

    return NextResponse.json({ success: true, campaign: updated });
  } catch (error) {
    console.error("[CAMPAIGN_MANAGE_ERROR]", error);
    return NextResponse.json({ error: "Error al gestionar campaña" }, { status: 500 });
  }
}
