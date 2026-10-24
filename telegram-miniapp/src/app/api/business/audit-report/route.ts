import { NextResponse } from 'next/server';
import { db } from '@/db';
import { ownedBusinesses } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import crypto from 'crypto';

export async function GET(req: Request) {
  try {
    const caller = await getAuthenticatedUser(req);
    if (!caller) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const shiftId = searchParams.get('shiftId');
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    let business = null;
    if (businessId) {
      business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.id, businessId),
      });
      if (business && business.ownerId !== caller.id && caller.role !== 'ADMIN') {
        return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
      }
    } else {
      business = await db.query.ownedBusinesses.findFirst({
        where: eq(ownedBusinesses.ownerId, caller.id),
      });
    }

    if (!business) {
      return NextResponse.json({ error: 'Comercio no encontrado' }, { status: 404 });
    }

    // 1. Resolve date filters & shifts
    let fromDate: Date | null = null;
    let toDate: Date | null = null;
    let shiftInfo: Record<string, unknown> | null = null;

    if (shiftId) {
      const shiftRes = await db.execute(sql`
        SELECT id, "branchId", "openedAt", "closedAt", status, "openingFloat", "expectedCash", "countedCash", "difference"
        FROM cash_shifts
        WHERE id = ${shiftId}
        LIMIT 1
      `);
      const shiftRows = ((shiftRes as unknown as { rows?: Record<string, unknown>[] }).rows || (shiftRes as unknown as Record<string, unknown>[]) || []) as Record<string, unknown>[];
      if (shiftRows.length > 0) {
        shiftInfo = shiftRows[0];
        fromDate = shiftInfo.openedAt ? new Date(shiftInfo.openedAt as string) : null;
        toDate = shiftInfo.closedAt ? new Date(shiftInfo.closedAt as string) : new Date();
      }
    } else {
      if (fromParam) {
        const parsedFrom = new Date(fromParam);
        if (!isNaN(parsedFrom.getTime())) fromDate = parsedFrom;
      }
      if (toParam) {
        const parsedTo = new Date(toParam);
        if (!isNaN(parsedTo.getTime())) toDate = parsedTo;
      }
    }

    // 2. Resolve matching branch via clean restaurant link
    const branchRes = await db.execute(sql`
      SELECT 
        b.id as "branchId",
        b.name as "branchName",
        b.address as "branchAddress",
        r.id as "restaurantId",
        r.name as "restaurantName"
      FROM branches b
      JOIN restaurants r ON b."restaurantId" = r.id
      WHERE r."businessId" = ${business.id} OR r.name ILIKE '%' || ${business.name} || '%'
      LIMIT 1
    `);

    interface BranchRow {
      branchId: string;
      branchName: string;
      branchAddress: string | null;
      restaurantId: string;
      restaurantName: string;
    }

    const branchRows = ((branchRes as unknown as { rows?: BranchRow[] }).rows || (branchRes as unknown as BranchRow[]) || []) as BranchRow[];
    const branch = branchRows.length > 0 ? branchRows[0] : null;
    const branchId = branch?.branchId;

    // 3. Query Orders independently (GROUP BY o.id ONLY — prevents duplicate rows on split payments)
    const validStatuses = ['COMPLETED', 'PAID'];

    const ordersRes = await db.execute(sql`
      SELECT 
        o.id as order_id,
        o."orderType",
        o.status as order_status,
        o.subtotal,
        o.tax,
        o.discount,
        o.tip,
        o.total,
        o."bunzReward",
        o."bunzPaid",
        o."createdAt" as order_date,
        COALESCE(
          json_agg(
            json_build_object(
              'item_id', oi.id,
              'name', COALESCE(mi.name, oi.notes, 'Producto'),
              'quantity', oi.quantity,
              'unit_price', oi."unitPrice",
              'total_price', oi."totalPrice",
              'notes', oi.notes
            )
          ) FILTER (WHERE oi.id IS NOT NULL),
          '[]'
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON oi."orderId" = o.id
      LEFT JOIN menu_items mi ON mi.id = oi."menuItemId"
      WHERE o.status IN ('COMPLETED', 'PAID')
        AND (${branchId}::text IS NULL OR o."branchId" = ${branchId})
        AND (${fromDate ? fromDate.toISOString() : null}::text IS NULL OR o."createdAt" >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        AND (${toDate ? toDate.toISOString() : null}::text IS NULL OR o."createdAt" <= ${toDate ? toDate.toISOString() : null}::timestamptz)
      GROUP BY o.id
      ORDER BY o."createdAt" ASC
    `);

    const ordersList = ((ordersRes as unknown as { rows?: Record<string, unknown>[] }).rows || (ordersRes as unknown as Record<string, unknown>[]) || []) as Record<string, unknown>[];

    // 4. Query Payments independently (prevents cartesian product with split payments)
    const paymentsRes = await db.execute(sql`
      SELECT 
        p.id as payment_id,
        p."orderId" as order_id,
        p.method as payment_method,
        p.amount as payment_amount,
        p.status as payment_status,
        p."createdAt" as payment_date
      FROM payments p
      JOIN orders o ON p."orderId" = o.id
      WHERE o.status IN ('COMPLETED', 'PAID')
        AND p.status = 'COMPLETED'
        AND (${branchId}::text IS NULL OR o."branchId" = ${branchId})
        AND (${fromDate ? fromDate.toISOString() : null}::text IS NULL OR o."createdAt" >= ${fromDate ? fromDate.toISOString() : null}::timestamptz)
        AND (${toDate ? toDate.toISOString() : null}::text IS NULL OR o."createdAt" <= ${toDate ? toDate.toISOString() : null}::timestamptz)
      ORDER BY p."createdAt" ASC
    `);

    const paymentsList = ((paymentsRes as unknown as { rows?: Record<string, unknown>[] }).rows || (paymentsRes as unknown as Record<string, unknown>[]) || []) as Record<string, unknown>[];

    // Group payments by orderId for order breakdown display
    const paymentsByOrder = new Map<string, Array<{ id: string; method: string; amount: number }>>();
    for (const p of paymentsList) {
      const oId = String(p.order_id);
      const list = paymentsByOrder.get(oId) || [];
      list.push({
        id: String(p.payment_id),
        method: String(p.payment_method || 'CASH'),
        amount: Number(p.payment_amount) || 0,
      });
      paymentsByOrder.set(oId, list);
    }

    // 5. Aggregate metrics
    let totalGross = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalBunzPaid = 0;
    let totalBunzReward = 0;
    const productBreakdown: Record<string, { quantity: number; revenue: number }> = {};

    for (const ord of ordersList) {
      totalGross += Number(ord.total) || 0;
      totalSubtotal += Number(ord.subtotal) || 0;
      totalTax += Number(ord.tax) || 0;
      totalBunzPaid += Number(ord.bunzPaid) || 0;
      totalBunzReward += Number(ord.bunzReward) || 0;

      const items = Array.isArray(ord.items) ? (ord.items as Array<Record<string, unknown>>) : [];
      for (const it of items) {
        const name = String(it.name || 'Producto');
        if (!productBreakdown[name]) {
          productBreakdown[name] = { quantity: 0, revenue: 0 };
        }
        productBreakdown[name].quantity += Number(it.quantity) || 1;
        productBreakdown[name].revenue += Number(it.total_price) || 0;
      }

      const ordId = String(ord.order_id);
      const matchedPayments = paymentsByOrder.get(ordId) || [];
      ord.payments = matchedPayments;
      ord.primary_method = matchedPayments.length > 0 ? matchedPayments[0].method : 'CASH';
    }

    // Aggregate payments breakdown accurately from payment rows
    const paymentBreakdown: Record<string, { count: number; total: number }> = {};
    for (const pay of paymentsList) {
      const method = String(pay.payment_method || 'CASH');
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = { count: 0, total: 0 };
      }
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].total += Number(pay.payment_amount) || 0;
    }

    const generatedAt = new Date().toISOString();

    // 6. Compute Cryptographic SHA-256 Digest of immutable report content
    const payloadForHashing = JSON.stringify({
      businessId: business.id,
      branchId: branch?.branchId,
      totalOrders: ordersList.length,
      totalGross: Math.round(totalGross * 100) / 100,
      totalSubtotal: Math.round(totalSubtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      orderIds: ordersList.map((o) => o.order_id),
      paymentsTotal: paymentsList.reduce((acc, p) => acc + (Number(p.payment_amount) || 0), 0),
      generatedAt,
    });

    const sha256Fingerprint = crypto.createHash('sha256').update(payloadForHashing).digest('hex');

    return NextResponse.json({
      success: true,
      business: {
        businessId: business.id,
        businessName: business.name,
        businessAddress: business.address,
        rewardPercentage: business.rewardPercentage,
        branchId: branch?.branchId,
        branchName: branch?.branchName,
      },
      shift: shiftInfo,
      filter: {
        from: fromDate ? fromDate.toISOString() : null,
        to: toDate ? toDate.toISOString() : null,
      },
      generatedAt,
      sha256Fingerprint,
      summary: {
        totalOrders: ordersList.length,
        totalGross: Math.round(totalGross * 100) / 100,
        totalSubtotal: Math.round(totalSubtotal * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalBunzPaid,
        totalBunzReward,
        paymentBreakdown,
        productBreakdown: Object.entries(productBreakdown)
          .map(([name, data]) => ({ name, ...data }))
          .sort((a, b) => b.revenue - a.revenue),
      },
      orders: ordersList,
    });
  } catch (error) {
    console.error('Audit Report API Mobile Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
