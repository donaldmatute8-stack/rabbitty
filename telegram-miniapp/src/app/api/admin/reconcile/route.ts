import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ledgerEntries } from '@/db/schema';
import { sql, eq } from 'drizzle-orm';
import { getVerifiedAdminId, isAdminAllowed } from '@/lib/adminAuth';

export interface UserReconciliationReport {
  userId: string;
  username: string | null;
  cachedBalance: number;
  ledgerEarned: number;
  ledgerSpent: number;
  ledgerNet: number;
  discrepancy: number;
  isBalanced: boolean;
}

export interface SystemReconciliationSummary {
  timestamp: string;
  totalUsersChecked: number;
  balancedUsers: number;
  discrepantUsers: number;
  totalCachedCirculation: number;
  totalLedgerCirculation: number;
  systemDifference: number;
  status: 'HEALTHY' | 'DEVIATION_DETECTED';
  details: UserReconciliationReport[];
}

/**
 * GET /api/admin/reconcile
 * Checks the mathematical consistency between the high-speed cached balances
 * (users.totalBunzEarned - users.totalBunzSpent) and the append-only Ledger (`ledger_entries`).
 */
export async function GET(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const url = new URL(req.url);
    const filterDiscrepanciesOnly = url.searchParams.get('discrepanciesOnly') === 'true';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 1000);

    // 1. Fetch user accounts
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      totalBunzEarned: users.totalBunzEarned,
      totalBunzSpent: users.totalBunzSpent,
    }).from(users).limit(limit);

    // 2. Aggregate ledger amounts for payee (credits) and payer (debits)
    const ledgerCredits = await db.select({
      subjectId: ledgerEntries.payeeSubjectId,
      totalCredits: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)`,
    })
      .from(ledgerEntries)
      .groupBy(ledgerEntries.payeeSubjectId);

    const ledgerDebits = await db.select({
      subjectId: ledgerEntries.payerSubjectId,
      totalDebits: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)`,
    })
      .from(ledgerEntries)
      .groupBy(ledgerEntries.payerSubjectId);

    const creditMap = new Map<string, number>();
    for (const row of ledgerCredits) {
      creditMap.set(row.subjectId, Number(row.totalCredits));
    }

    const debitMap = new Map<string, number>();
    for (const row of ledgerDebits) {
      debitMap.set(row.subjectId, Number(row.totalDebits));
    }

    // 3. Reconcile user by user
    const reports: UserReconciliationReport[] = [];
    let totalCachedCirculation = 0;
    let totalLedgerCirculation = 0;
    let discrepantUsersCount = 0;

    for (const u of allUsers) {
      const cachedEarned = u.totalBunzEarned || 0;
      const cachedSpent = u.totalBunzSpent || 0;
      const cachedBalance = cachedEarned - cachedSpent;

      const subjectId = `usr_${u.id}`;
      const lCredits = creditMap.get(subjectId) || 0;
      const lDebits = debitMap.get(subjectId) || 0;
      const ledgerNet = lCredits - lDebits;

      const diff = cachedBalance - ledgerNet;
      const isBalanced = diff === 0;

      if (!isBalanced) {
        discrepantUsersCount++;
      }

      totalCachedCirculation += cachedBalance;
      totalLedgerCirculation += ledgerNet;

      const report: UserReconciliationReport = {
        userId: u.id,
        username: u.username || u.firstName || 'Sin nombre',
        cachedBalance,
        ledgerEarned: lCredits,
        ledgerSpent: lDebits,
        ledgerNet,
        discrepancy: diff,
        isBalanced,
      };

      if (!filterDiscrepanciesOnly || !isBalanced) {
        reports.push(report);
      }
    }

    const systemDiff = totalCachedCirculation - totalLedgerCirculation;

    const summary: SystemReconciliationSummary = {
      timestamp: new Date().toISOString(),
      totalUsersChecked: allUsers.length,
      balancedUsers: allUsers.length - discrepantUsersCount,
      discrepantUsers: discrepantUsersCount,
      totalCachedCirculation,
      totalLedgerCirculation,
      systemDifference: systemDiff,
      status: systemDiff === 0 && discrepantUsersCount === 0 ? 'HEALTHY' : 'DEVIATION_DETECTED',
      details: reports,
    };

    return NextResponse.json({ success: true, reconciliation: summary });
  } catch (error) {
    console.error('[ADMIN_RECONCILE_GET]', error);
    return NextResponse.json({ error: 'Error during reconciliation calculation' }, { status: 500 });
  }
}

/**
 * POST /api/admin/reconcile
 * Self-healing / alignment endpoint: allows an authorized admin to align the cached
 * balances to match the ledger entries for a specific user ID or discrepancy.
 */
export async function POST(req: NextRequest) {
  if (!isAdminAllowed(getVerifiedAdminId(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { userId, syncDirection } = body;

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Falta userId a reconciliar' }, { status: 400 });
    }

    const targetUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
    }

    const subjectId = `usr_${targetUser.id}`;

    // Get exact ledger balance
    const [creditsRow] = await db.select({
      total: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)`,
    }).from(ledgerEntries).where(eq(ledgerEntries.payeeSubjectId, subjectId));

    const [debitsRow] = await db.select({
      total: sql<number>`COALESCE(SUM(${ledgerEntries.amount}), 0)`,
    }).from(ledgerEntries).where(eq(ledgerEntries.payerSubjectId, subjectId));

    const actualLedgerCredits = Number(creditsRow?.total || 0);
    const actualLedgerDebits = Number(debitsRow?.total || 0);

    // By default: align cache to match the immutable ledger
    if (syncDirection === 'LEDGER_TO_CACHE' || !syncDirection) {
      await db.update(users).set({
        totalBunzEarned: actualLedgerCredits,
        totalBunzSpent: actualLedgerDebits,
        updatedAt: new Date(),
      }).where(eq(users.id, targetUser.id));

      return NextResponse.json({
        success: true,
        action: 'CACHE_ALIGNED_TO_LEDGER',
        userId: targetUser.id,
        newEarned: actualLedgerCredits,
        newSpent: actualLedgerDebits,
        newBalance: actualLedgerCredits - actualLedgerDebits,
      });
    }

    return NextResponse.json({ error: 'Acción de reconciliación no reconocida' }, { status: 400 });
  } catch (error) {
    console.error('[ADMIN_RECONCILE_POST]', error);
    return NextResponse.json({ error: 'Error al aplicar reconciliación' }, { status: 500 });
  }
}
