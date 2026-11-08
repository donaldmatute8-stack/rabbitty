import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import postgres from "postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) {
    return NextResponse.json({ ok: false, error: "token_required" }, { status: 400 });
  }

  const url = process.env.CORE_DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 500 });
  }

  const sql = postgres(url, { ssl: "require", max: 1 });

  try {
    const [row] = await sql`
      SELECT "affiliateId", "expiresAt", "usedAt"
      FROM "affiliate_reonboarding_tokens"
      WHERE "tokenHash" = ${hashToken(token)}
      LIMIT 1
    `;

    if (!row) {
      return NextResponse.json({ ok: false, error: "token_not_found" }, { status: 404 });
    }
    if (row.usedAt) {
      return NextResponse.json({ ok: false, error: "token_used" }, { status: 410 });
    }
    if (new Date(row.expiresAt).getTime() < Date.now()) {
      return NextResponse.json({ ok: false, error: "token_expired" }, { status: 410 });
    }

    const [biz] = await sql`
      SELECT id, "ownerId", name, category, niche, address, "rewardPercentage", "verificationData"
      FROM "ownedBusinesses"
      WHERE id = ${row.affiliateId}
      LIMIT 1
    `;
    if (!biz) {
      return NextResponse.json({ ok: false, error: "business_not_found" }, { status: 404 });
    }

    const [owner] = await sql`
      SELECT id, "firstName", email, "phoneNumber"
      FROM "users"
      WHERE id = ${biz.ownerId}
      LIMIT 1
    `;

    let verification: Record<string, any> = {};
    try {
      verification = JSON.parse(biz.verificationData || "{}");
    } catch {
      verification = {};
    }

    return NextResponse.json({
      ok: true,
      business: {
        id: biz.id,
        name: biz.name,
        category: biz.category,
        niche: biz.niche,
        address: biz.address,
        rewardPercentage: biz.rewardPercentage,
      },
      owner: {
        name: owner?.firstName ?? "",
        email: owner?.email ?? "",
        phone: owner?.phoneNumber ?? "",
      },
      legalProfile: verification.legalProfile ?? null,
      expiresAt: row.expiresAt,
    });
  } catch (error) {
    console.error("[Re-onboarding validate]", error);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
