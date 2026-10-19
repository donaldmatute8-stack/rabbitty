import { NextResponse } from "next/server";
import { db } from "@/db";
import { users, ownedBusinesses, ledgerEntries } from "@/db/schema";
import { sql, desc } from "drizzle-orm";
import { getAuthenticatedUser } from "@/lib/serverAuth";

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    
    // Validar rol ADMIN o telegramId/username de control
    const adminTelegramIds = (process.env.ADMIN_TELEGRAM_IDS || '798431743').split(',').map(s => s.trim());
    const isAuthorized = 
      caller?.role === 'ADMIN' || 
      (caller?.telegramId && adminTelegramIds.includes(caller.telegramId)) ||
      caller?.username?.toLowerCase() === 'mardelbull' ||
      caller?.username?.toLowerCase() === 'marco';

    if (!isAuthorized) {
      return NextResponse.json({ error: "Acceso no autorizado al panel de métricas" }, { status: 403 });
    }

    // 1. Métricas Globales de Negocios
    const [bizStats] = await db
      .select({
        totalBusinesses: sql<number>`COUNT(*)`,
        activeBusinesses: sql<number>`COUNT(*) FILTER (WHERE status = 'ACTIVE' OR status = 'APPROVED')`,
        pendingBusinesses: sql<number>`COUNT(*) FILTER (WHERE status = 'PENDING' OR status = 'PENDING_VERIFICATION')`,
        totalCreditLimit: sql<number>`COALESCE(SUM(${ownedBusinesses.creditLimit}), 0)`,
        totalCreditUsed: sql<number>`COALESCE(SUM(${ownedBusinesses.creditUsed}), 0)`,
      })
      .from(ownedBusinesses);

    // 2. Métricas Globales de Usuarios (Rabbitters)
    const [userStats] = await db
      .select({
        totalUsers: sql<number>`COUNT(*)`,
        totalBunzEarned: sql<number>`COALESCE(SUM(${users.totalBunzEarned}), 0)`,
        totalBunzSpent: sql<number>`COALESCE(SUM(${users.totalBunzSpent}), 0)`,
      })
      .from(users);

    // 3. Métricas Inmutables del Ledger (Economía Real Circulante)
    const [ledgerStats] = await db
      .select({
        totalMintsEarned: sql<number>`COALESCE(SUM(${ledgerEntries.amount}) FILTER (WHERE ${ledgerEntries.type} = 'EARN'), 0)`,
        countMints: sql<number>`COUNT(*) FILTER (WHERE ${ledgerEntries.type} = 'EARN')`,
        totalSpendsRedeemed: sql<number>`COALESCE(SUM(${ledgerEntries.amount}) FILTER (WHERE ${ledgerEntries.type} = 'SPEND'), 0)`,
        countSpends: sql<number>`COUNT(*) FILTER (WHERE ${ledgerEntries.type} = 'SPEND')`,
        totalP2PTransfers: sql<number>`COALESCE(SUM(${ledgerEntries.amount}) FILTER (WHERE ${ledgerEntries.type} = 'TRANSFER'), 0)`,
        countTransfers: sql<number>`COUNT(*) FILTER (WHERE ${ledgerEntries.type} = 'TRANSFER')`,
      })
      .from(ledgerEntries);

    // 4. Desglose por Negocio Individual (Para ver 626 Café y futuros afiliados)
    const businessesBreakdown = await db
      .select({
        id: ownedBusinesses.id,
        name: ownedBusinesses.name,
        category: ownedBusinesses.category,
        status: ownedBusinesses.status,
        creditLimit: ownedBusinesses.creditLimit,
        creditUsed: ownedBusinesses.creditUsed,
        createdAt: ownedBusinesses.createdAt,
      })
      .from(ownedBusinesses)
      .orderBy(desc(ownedBusinesses.createdAt))
      .limit(50);

    // 5. Telemetría de Escaneos QR si existe la tabla
    let qrTelemetry: { campaignRef: string; totalScans: number; iosScans: number; androidScans: number }[] = [];
    try {
      const qrRows = await db.execute(sql`
        SELECT 
          campaign_ref as "campaignRef",
          COUNT(*)::int as "totalScans",
          COUNT(*) FILTER (WHERE device_type = 'ios')::int as "iosScans",
          COUNT(*) FILTER (WHERE device_type = 'android')::int as "androidScans"
        FROM qr_telemetry_events
        GROUP BY campaign_ref
        ORDER BY "totalScans" DESC
        LIMIT 20;
      `);
      qrTelemetry = qrRows.rows as unknown as typeof qrTelemetry;
    } catch {
      // Ignorar si aún no hay escaneos
    }

    // 6. Últimos movimientos económicos en tiempo real
    const recentLedger = await db
      .select({
        id: ledgerEntries.id,
        payer: ledgerEntries.payerSubjectId,
        payee: ledgerEntries.payeeSubjectId,
        amount: ledgerEntries.amount,
        type: ledgerEntries.type,
        createdAt: ledgerEntries.createdAt,
      })
      .from(ledgerEntries)
      .orderBy(desc(ledgerEntries.createdAt))
      .limit(15);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      ecosystem: {
        businesses: {
          total: Number(bizStats?.totalBusinesses || 0),
          active: Number(bizStats?.activeBusinesses || 0),
          pending: Number(bizStats?.pendingBusinesses || 0),
          totalCreditLimit: Number(bizStats?.totalCreditLimit || 0),
          totalCreditUsed: Number(bizStats?.totalCreditUsed || 0),
        },
        rabbitters: {
          total: Number(userStats?.totalUsers || 0),
          totalBunzEarned: Number(userStats?.totalBunzEarned || 0),
          totalBunzSpent: Number(userStats?.totalBunzSpent || 0),
          circulatingSupply: Number(userStats?.totalBunzEarned || 0) - Number(userStats?.totalBunzSpent || 0),
        },
        ledger: {
          rewardsGiven: Number(ledgerStats?.totalMintsEarned || 0),
          rewardsCount: Number(ledgerStats?.countMints || 0),
          redemptionsSpent: Number(ledgerStats?.totalSpendsRedeemed || 0),
          redemptionsCount: Number(ledgerStats?.countSpends || 0),
          transfersP2P: Number(ledgerStats?.totalP2PTransfers || 0),
          transfersCount: Number(ledgerStats?.countTransfers || 0),
        },
        qrTelemetry,
        businessesBreakdown,
        recentLedger,
      }
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Error consultando métricas del ecosistema';
    console.error('[Ecosystem Metrics Error]:', err);
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
