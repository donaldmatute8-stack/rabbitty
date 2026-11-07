import { NextRequest, NextResponse } from "next/server";
import { getCoreDb } from "@rabbitty/api/db";
import {
  expireStaleProposals,
  listRecoveryCandidates,
  proposeRecoveryForAffiliate,
} from "@rabbitty/api/services/mcceRecovery";
import {
  recoveryProposalEmailHtml,
  sendOwnerEmail,
  sendOwnerPush,
} from "@rabbitty/api/services/ownerNotify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * ── /api/cron/recovery-proposals ── Cierre de ciclo de recuperación dinámica.
 *
 * Calcula la capacidad generada del mes anterior y crea una propuesta por
 * afiliado. No aplica retenciones: el afiliado debe aceptar en el modal.
 *
 * Autorización: CRON_SECRET.
 */
function authorized(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET || "";
  if (!expected) return false;
  const provided =
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "") ||
    (req.headers.get("x-cron-secret") || "") ||
    new URL(req.url).searchParams.get("secret") ||
    "";
  return provided === expected;
}

function previousMonth(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const label = start.toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { start, end, label: `Ciclo ${label}` };
}

async function run(dryRun = false) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET no configurado" }, { status: 401 });
  }

  const coreDb = getCoreDb();
  const { auditEntries } = await import("@rabbitty/database-core/schema");
  const adminUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.ADMIN_APP_URL || "https://admin.rabbitty.me";

  const { start, end, label } = previousMonth();
  const expired = dryRun ? 0 : await expireStaleProposals(coreDb);
  const candidates = await listRecoveryCandidates(coreDb);

  let proposed = 0;
  let notified = 0;
  let skipped = 0;
  const preview: Array<Record<string, unknown>> = [];

  for (const candidate of candidates) {
    const result = await proposeRecoveryForAffiliate(coreDb, {
      affiliateId: candidate.affiliateId,
      periodStart: start,
      periodEnd: end,
    });

    if (!result.proposal) {
      skipped++;
      preview.push({
        affiliateId: candidate.affiliateId,
        business: result.businessName,
        gross: result.gross,
        skipped: result.skipped,
      });
      continue;
    }

    proposed++;
    preview.push({
      affiliateId: candidate.affiliateId,
      business: result.businessName,
      gross: result.gross,
      proposedAmount: result.proposal.proposedAmount,
      proposedRate: result.proposal.proposedRate,
    });

    if (dryRun) continue;

    const p = result.proposal;
    const title = "Propuesta de recuperación disponible";
    const body = `Se propone retener ${p.proposedAmount.toLocaleString("es-MX")} Bunz (${Math.round(
      p.proposedRate * 1000
    ) / 10}%). No se descontará nada sin tu aceptación.`;

    const [pushOk, emailOk] = await Promise.all([
      result.ownerId ? sendOwnerPush(result.ownerId, title, body, "/settings/recovery") : false,
      result.ownerEmail
        ? sendOwnerEmail(
            result.ownerEmail,
            `${result.businessName}: propuesta de recuperación`,
            recoveryProposalEmailHtml({
              businessName: result.businessName ?? "tu negocio",
              proposedAmount: p.proposedAmount,
              proposedRate: p.proposedRate,
              outstandingBefore: p.outstandingBefore,
              outstandingAfter: p.outstandingAfter,
              availableBefore: p.availableBefore,
              availableAfter: p.availableAfter,
              coverageBefore: p.coverageBefore,
              coverageAfter: p.coverageAfter,
              periodLabel: label,
              adminUrl,
            })
          )
        : Promise.resolve(false),
    ]);

    if (pushOk || emailOk) notified++;

    await coreDb.insert(auditEntries).values({
      userId: result.ownerId ?? null,
      action: "MCCE_RECOVERY_PROPOSED",
      resource: "merchantRecoveryProposals",
      resourceId: p.id,
      details: JSON.stringify({
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
        gross: p.grossGenerated,
        rate: p.proposedRate,
        amount: p.proposedAmount,
        channels: { push: pushOk, email: emailOk },
      }),
    });
  }

  return NextResponse.json({
    ok: true,
    date: new Date().toISOString().slice(0, 10),
    dryRun,
    period: { start: start.toISOString(), end: end.toISOString(), label },
    candidates: candidates.length,
    proposed,
    notified,
    skipped,
    expired,
    ...(dryRun ? { preview } : {}),
  });
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run(new URL(req.url).searchParams.get("dryRun") === "1");
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  return run(new URL(req.url).searchParams.get("dryRun") === "1");
}
