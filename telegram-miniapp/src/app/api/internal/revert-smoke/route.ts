import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEntries, businessOffers, offerRedemptions, ownedBusinesses, users } from "@/db/schema";
import { recordLedgerTransaction } from "@/lib/ledgerHelper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN = "9df2b6acc25db78b9a69da8eaf1129d200ace54b5d1ae482";
const REDEMPTION_ID = "61815482-3112-43c4-b378-0ede6440a570";
const OFFER_ID = "9a198210-5f8c-4e55-8e0b-5a8493d1f6bb";
const USER_ID = "daffee99-0c55-4975-a9ea-f167f95a2093";
const BUSINESS_ID = "fb7f4847-920f-4482-8ae3-c810a20e75ad";
const IDEMPOTENCY_KEY = `smoke_revert_${REDEMPTION_ID}`;

export async function GET(req: NextRequest) {
  if (new URL(req.url).searchParams.get("k") !== TOKEN) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const result = await db.transaction(async (tx) => {
    const [prior] = await tx
      .select()
      .from(offerRedemptions)
      .where(eq(offerRedemptions.id, REDEMPTION_ID))
      .limit(1)
      .for("update");
    if (!prior) throw new Error("REDEMPTION_NOT_FOUND");

    const [already] = await tx
      .select({ id: auditEntries.id })
      .from(auditEntries)
      .where(eq(auditEntries.resourceId, REDEMPTION_ID))
      .limit(50)
      .then((rows) => rows.filter((r) => r.id && false)); // no-op type guard
    void already;

    // Idempotencia real: si el asiento de reverso ya existe, no se vuelve a aplicar.
    const { findLedgerEntry } = await import("@/lib/ledgerHelper");
    const existing = await findLedgerEntry(IDEMPOTENCY_KEY, tx);
    if (existing) {
      return { already: true as const };
    }

    if (prior.status !== "VALIDATED") throw new Error(`REDEMPTION_STATUS_${prior.status}`);

    await tx
      .update(users)
      .set({ totalBunzSpent: sql`GREATEST(0, COALESCE(${users.totalBunzSpent}, 0) - 1)` })
      .where(eq(users.id, USER_ID));

    await tx
      .update(ownedBusinesses)
      .set({ bunzBalance: sql`COALESCE(${ownedBusinesses.bunzBalance}, 0) + 1` })
      .where(eq(ownedBusinesses.id, BUSINESS_ID));

    await tx
      .update(businessOffers)
      .set({ stockUsed: sql`GREATEST(0, ${businessOffers.stockUsed} - 1)`, updatedAt: new Date() })
      .where(eq(businessOffers.id, OFFER_ID));

    await tx
      .update(offerRedemptions)
      .set({ status: "CANCELLED", updatedAt: new Date() })
      .where(eq(offerRedemptions.id, REDEMPTION_ID));

    await recordLedgerTransaction(
      {
        payerSubjectId: `biz_${BUSINESS_ID}`,
        payeeSubjectId: `usr_${USER_ID}`,
        amount: 1,
        type: "REFUND",
        referenceId: REDEMPTION_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        sandbox: false,
        metadata: { reason: "SMOKE_TEST_REVERTED", offerId: OFFER_ID, source: "OPS" },
      },
      tx,
    );

    return { already: false as const };
  });

  const [u] = await db
    .select({ spent: users.totalBunzSpent })
    .from(users)
    .where(eq(users.id, USER_ID));
  const [b] = await db
    .select({ balance: ownedBusinesses.bunzBalance })
    .from(ownedBusinesses)
    .where(eq(ownedBusinesses.id, BUSINESS_ID));

  try {
    await db.insert(auditEntries).values({
      userId: null,
      action: "SMOKE_TEST_REVERTED",
      resource: "offer_redemptions",
      resourceId: REDEMPTION_ID,
      details: JSON.stringify({
        offerId: OFFER_ID,
        businessId: BUSINESS_ID,
        amount: 1,
        reason: "Prueba de canje revertida; oferta de prueba queda pausada",
      }),
    });
  } catch {
    /* auditoría best-effort */
  }

  return NextResponse.json({
    ok: true,
    already: result.already,
    userSpent: Number(u?.spent ?? 0),
    businessBalance: Number(b?.balance ?? 0),
  });
}
