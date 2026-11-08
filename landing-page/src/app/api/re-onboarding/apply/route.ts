import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import postgres from "postgres";
import { estimateCapacity, roundCapacity } from "@/lib/capacity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function str(value: unknown) {
  return typeof value === "string" ? value.trim() : typeof value === "number" ? String(value) : "";
}

export async function POST(req: NextRequest) {
  const url = process.env.CORE_DATABASE_URL;
  if (!url) {
    return NextResponse.json({ ok: false, error: "db_unavailable" }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const token = str(body.token);
  const legalName = str(body.legalName);
  const rfc = str(body.rfc).toUpperCase();
  const representative = str(body.representative);
  const representativePosition = str(body.representativePosition);
  const businessName = str(body.businessName);
  const address = str(body.address);
  const email = str(body.email).toLowerCase();
  const phone = str(body.phone);
  const signature = str(body.signature);
  const contractVersion = str(body.contractVersion) || "2026.11-v1.2-draft";
  const acceptedTerms = body.acceptedTerms === true;
  const monthlySales = Number(body.monthlySales) || 0;
  const rewardPct = Number(body.rewardPercentage) || 0;
  const coverageMonths = Number(body.coverageMonths) || 0;
  const acceptedAt = new Date();

  const errors: Record<string, string> = {};
  if (!token) errors.token = "required";
  if (legalName.length < 2) errors.legalName = "required";
  if (rfc.length < 10) errors.rfc = "invalid";
  if (representative.length < 3) errors.representative = "required";
  if (businessName.length < 2) errors.businessName = "required";
  if (address.length < 4) errors.address = "required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "invalid";
  if (phone.replace(/\D/g, "").length < 10) errors.phone = "invalid";
  if (signature.length < 3) errors.signature = "required";
  if (!acceptedTerms) errors.terms = "required";
  if (monthlySales < 0) errors.monthlySales = "invalid";
  if (rewardPct < 10 || rewardPct > 50) errors.rewardPercentage = "invalid";
  if (coverageMonths < 0.5 || coverageMonths > 3) errors.coverageMonths = "invalid";

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ ok: false, error: "validation_failed", fields: errors }, { status: 400 });
  }

  const capacity = estimateCapacity({ monthlySales, rewardPct, months: coverageMonths });
  const promo = roundCapacity(capacity * 0.4);
  const credit = Math.max(0, capacity - promo);

  const contractHash = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        contractVersion,
        businessName,
        legalName,
        rfc,
        representative,
        capacity,
        coverageMonths,
        acceptedAt: acceptedAt.toISOString(),
        signature,
      })
    )
    .digest("hex");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const sql = postgres(url, { ssl: "require", max: 1 });

  try {
    const result = await sql.begin(async (tx) => {
        const [tokenRow] = await tx`
          SELECT id, "affiliateId", "expiresAt", "usedAt"
          FROM "affiliate_reonboarding_tokens"
          WHERE "tokenHash" = ${hashToken(token)}
          FOR UPDATE
        `;
        if (!tokenRow) throw new Error("token_not_found");
        if (tokenRow.usedAt) throw new Error("token_used");
        if (new Date(tokenRow.expiresAt).getTime() < Date.now()) throw new Error("token_expired");

        const [biz] = await tx`
          SELECT id, "ownerId", name, category, niche, address, "rewardPercentage", "verificationData"
          FROM "ownedBusinesses"
          WHERE id = ${tokenRow.affiliateId}
          FOR UPDATE
        `;
        if (!biz) throw new Error("business_not_found");

        let verification: Record<string, unknown> = {};
        try {
          verification = JSON.parse(biz.verificationData || "{}");
        } catch {
          verification = {};
        }

        const legalProfile = {
          legalName,
          rfc,
          representative,
          representativePosition: representativePosition || null,
          address,
          phone,
          email,
          updatedAt: acceptedAt.toISOString(),
        };

        const contractSignature = {
          contractVersion,
          contractStatus: "draft",
          contractHash,
          signedBy: signature,
          signatureMethod: "name_checkbox",
          acceptedAt: acceptedAt.toISOString(),
          acceptedIp: ip,
          acceptedUserAgent: userAgent,
          legalName,
          rfc,
          representative,
          representativePosition: representativePosition || null,
          capacity,
          coverageMonths,
          copyDelivered: true,
        };

        const nextVerification = {
          ...verification,
          legalProfile,
          contractSignature,
          reonboardedAt: acceptedAt.toISOString(),
          reonboardingSource: "token_link",
        };

        await tx`
          UPDATE "ownedBusinesses"
          SET name = ${businessName},
              category = COALESCE(NULLIF(${str(body.category)}, ''), category),
              address = ${address},
              "rewardPercentage" = ${Math.round(rewardPct)},
              package = 'DYNAMIC',
              "creditLimit" = ${capacity},
              "creditUsed" = 0,
              "bunzBalance" = ${capacity},
              status = 'APPROVED',
              "verificationData" = ${JSON.stringify(nextVerification)},
              "onboardingCompletedAt" = COALESCE("onboardingCompletedAt", now()),
              "updatedAt" = now()
          WHERE id = ${biz.id}
        `;

        await tx`
          INSERT INTO "merchant_capacity_accounts" (
            "affiliateId", status, "authorizedTotal", "promoAuthorized", "creditAuthorized",
            provisioned, generated, committed, available, "creditOutstanding",
            "creditDisbursed", "creditRepaid", "retainShare", "coverageDays", sandbox, notes,
            "createdAt", "updatedAt"
          ) VALUES (
            ${biz.id}, 'ACTIVE', ${capacity}, ${promo}, ${credit},
            ${capacity}, 0, 0, ${capacity}, ${credit},
            ${credit}, 0, 0.4, ${Math.round(coverageMonths * 30)}, false,
            ${`Re-onboarding ${acceptedAt.toISOString()}`}, now(), now()
          )
          ON CONFLICT ("affiliateId") DO UPDATE SET
            status = 'ACTIVE',
            "authorizedTotal" = EXCLUDED."authorizedTotal",
            "promoAuthorized" = EXCLUDED."promoAuthorized",
            "creditAuthorized" = EXCLUDED."creditAuthorized",
            provisioned = EXCLUDED.provisioned,
            generated = 0,
            committed = 0,
            available = EXCLUDED.available,
            "creditOutstanding" = EXCLUDED."creditOutstanding",
            "creditDisbursed" = EXCLUDED."creditDisbursed",
            "creditRepaid" = 0,
            "retainShare" = 0.4,
            "coverageDays" = EXCLUDED."coverageDays",
            sandbox = false,
            notes = EXCLUDED.notes,
            "updatedAt" = now()
        `;

        await tx`
          INSERT INTO "merchant_recovery_terms" (
            "affiliateId", "targetMonths", "minCoverageDays", "rateMin", "rateMax",
            status, "acceptedAt", "acceptedBy", "createdAt", "updatedAt"
          ) VALUES (
            ${biz.id}, 18, 7, 0.2, 0.6, 'ACTIVE', ${acceptedAt}, ${signature}, now(), now()
          )
          ON CONFLICT ("affiliateId") DO UPDATE SET
            "targetMonths" = 18,
            "minCoverageDays" = 7,
            "rateMin" = 0.2,
            "rateMax" = 0.6,
            status = 'ACTIVE',
            "acceptedAt" = EXCLUDED."acceptedAt",
            "acceptedBy" = EXCLUDED."acceptedBy",
            "updatedAt" = now()
        `;

        await tx`
          INSERT INTO "bunz_economic_limits" (
            "affiliateId", "pilotEnabled", "periodDays",
            "maxEmissionBunz", "maxRedemptionBunz", "maxSettlementBunz", notes,
            "createdAt", "updatedAt"
          ) VALUES (
            ${biz.id}, true, 7, 5000, 5000, 2000, 'Re-onboarding', now(), now()
          )
          ON CONFLICT ("affiliateId") DO UPDATE SET
            "pilotEnabled" = true,
            "periodDays" = 7,
            "maxEmissionBunz" = GREATEST("maxEmissionBunz", 5000),
            "maxRedemptionBunz" = GREATEST("maxRedemptionBunz", 5000),
            "maxSettlementBunz" = GREATEST("maxSettlementBunz", 2000),
            notes = EXCLUDED.notes,
            "updatedAt" = now()
        `;

        await tx`
          UPDATE "affiliate_reonboarding_tokens"
          SET "usedAt" = ${acceptedAt},
              metadata = COALESCE(metadata, '{}'::jsonb) || ${JSON.stringify({
                usedAt: acceptedAt.toISOString(),
                businessId: biz.id,
                capacity,
              })}::jsonb
          WHERE id = ${tokenRow.id}
        `;

        await tx`
          INSERT INTO "merchant_capacity_events" (
            id, "affiliateId", type, actor, amount, metadata, "createdAt"
          ) VALUES (
            ${`mce-reonboarding-${biz.id}-${Date.now()}`},
            ${biz.id}, 'CAPACITY_REONBOARDED', 'affiliate', ${capacity},
            ${JSON.stringify({
              capacity,
              promo,
              credit,
              coverageMonths,
              contractVersion,
              contractHash,
            })}::jsonb,
            now()
          )
        `;

        await tx`
          INSERT INTO "auditEntries" (id, "userId", action, resource, "resourceId", details)
          VALUES (
            gen_random_uuid(), NULL, 'AFFILIATE_REONBOARDED', 'ownedBusinesses', ${biz.id},
            ${JSON.stringify({
              businessName,
              capacity,
              coverageMonths,
              contractVersion,
              contractHash,
              acceptedAt: acceptedAt.toISOString(),
              ip,
              userAgent,
            })}
          )
        `;

        return { businessId: biz.id, capacity, promo, credit };
      });

    return NextResponse.json({
      ok: true,
      ...result,
      adminUrl: process.env.NEXT_PUBLIC_BUSINESS_LOGIN_URL || "https://admin.rabbitty.me/login",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal_error";
    const status =
      message === "token_not_found" || message === "business_not_found"
        ? 404
        : message === "token_used" || message === "token_expired"
          ? 410
          : 500;
    if (status === 500) console.error("[Re-onboarding apply]", error);
    return NextResponse.json({ ok: false, error: message }, { status });
  } finally {
    await sql.end({ timeout: 5 });
  }
}
