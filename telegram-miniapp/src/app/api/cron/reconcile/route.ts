import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, ledgerEntries } from '@/db/schema';
import { sql } from 'drizzle-orm';

const ADMIN_TELEGRAM_IDS = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',');
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * GET /api/cron/reconcile
 * Automated background reconciliation cron worker.
 * Compares cached user balances against ledger entries, logs metrics,
 * and notifies admins via Telegram if any deviation or drift is detected.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Secure cron trigger via Bearer CRON_SECRET or verified admin header
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      const adminHeader = req.headers.get('x-telegram-id');
      if (!adminHeader || !ADMIN_TELEGRAM_IDS.includes(adminHeader)) {
        return NextResponse.json({ error: 'Unauthorized cron access' }, { status: 401 });
      }
    }

    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      firstName: users.firstName,
      totalBunzEarned: users.totalBunzEarned,
      totalBunzSpent: users.totalBunzSpent,
    }).from(users);

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

    let totalCached = 0;
    let totalLedger = 0;
    const discrepancies: Array<{
      userId: string;
      username: string;
      cached: number;
      ledger: number;
      diff: number;
    }> = [];

    for (const u of allUsers) {
      const cached = (u.totalBunzEarned || 0) - (u.totalBunzSpent || 0);
      const subjectId = `usr_${u.id}`;
      const credits = creditMap.get(subjectId) || 0;
      const debits = debitMap.get(subjectId) || 0;
      const ledgerNet = credits - debits;

      totalCached += cached;
      totalLedger += ledgerNet;

      if (cached !== ledgerNet) {
        discrepancies.push({
          userId: u.id,
          username: u.username || u.firstName || 'Usuario',
          cached,
          ledger: ledgerNet,
          diff: cached - ledgerNet,
        });
      }
    }

    const netSystemDiff = totalCached - totalLedger;
    const isHealthy = netSystemDiff === 0 && discrepancies.length === 0;

    // Send proactive alert to admins if drift detected
    if (!isHealthy && TELEGRAM_BOT_TOKEN) {
      const alertMessage = `⚠️ *Alerta Contable Rabbitty (Cron)*\n\nSe detectaron discrepancias entre balances y el Ledger:\n• Usuarios con error: ${discrepancies.length}\n• Diferencia neta: ${netSystemDiff} BUNZ\n• Circulación Ledger: ${totalLedger} BUNZ\n\nIngresa al panel God Mode para auto-sanar.`;
      
      for (const adminId of ADMIN_TELEGRAM_IDS) {
        try {
          await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: adminId.trim(),
              text: alertMessage,
              parse_mode: 'Markdown',
            }),
          });
        } catch {}
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      status: isHealthy ? 'HEALTHY' : 'DEVIATION_DETECTED',
      checkedUsers: allUsers.length,
      balancedUsers: allUsers.length - discrepancies.length,
      discrepanciesCount: discrepancies.length,
      totalCachedCirculation: totalCached,
      totalLedgerCirculation: totalLedger,
      systemDifference: netSystemDiff,
      discrepancies: discrepancies.slice(0, 20),
    });
  } catch (error) {
    console.error('[CRON_RECONCILE_ERROR]', error);
    return NextResponse.json({ error: 'Internal cron error' }, { status: 500 });
  }
}
