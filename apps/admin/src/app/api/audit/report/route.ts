import { NextRequest, NextResponse } from "next/server";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb } from "@rabbitty/api/db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId");
    const restaurantId = searchParams.get("restaurantId");
    const shiftId = searchParams.get("shiftId");
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    const db = getRestaurantDb();

    // 1. Resolve date range: optional from/to or cash shift
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

    // 2. Resolve Business & Branch metadata (clean join via restaurantId / businessId)
    let businessInfo: Record<string, unknown> | null = null;
    if (branchId) {
      const branchRes = await db.execute(sql`
        SELECT 
          b.id as "branchId",
          b.name as "branchName",
          b.address as "branchAddress",
          r.id as "restaurantId",
          r.name as "restaurantName",
          COALESCE(r."logoUrl", ob."logoUrl") as "logoUrl",
          ob.id as "businessId",
          ob.name as "businessName",
          ob.address as "businessAddress",
          ob."rewardPercentage"
        FROM branches b
        JOIN restaurants r ON b."restaurantId" = r.id
        LEFT JOIN "ownedBusinesses" ob ON ob.id = r."businessId" OR ob.name ILIKE '%' || r.name || '%'
        WHERE b.id = ${branchId}
        LIMIT 1
      `);
      const branchRows = ((branchRes as unknown as { rows?: Record<string, unknown>[] }).rows || (branchRes as unknown as Record<string, unknown>[]) || []) as Record<string, unknown>[];
      if (branchRows.length > 0) businessInfo = branchRows[0];
    } else if (restaurantId) {
      const restRes = await db.execute(sql`
        SELECT 
          r.id as "restaurantId",
          r.name as "restaurantName",
          COALESCE(r."logoUrl", ob."logoUrl") as "logoUrl",
          ob.id as "businessId",
          ob.name as "businessName",
          ob.address as "businessAddress",
          ob."rewardPercentage"
        FROM restaurants r
        LEFT JOIN "ownedBusinesses" ob ON ob.id = r."businessId" OR ob.name ILIKE '%' || r.name || '%'
        WHERE r.id = ${restaurantId}
        LIMIT 1
      `);
      const restRows = ((restRes as unknown as { rows?: Record<string, unknown>[] }).rows || (restRes as unknown as Record<string, unknown>[]) || []) as Record<string, unknown>[];
      if (restRows.length > 0) businessInfo = restRows[0];
    }

    // 3. Query Orders independently (GROUP BY o.id ONLY — prevents duplicate rows on split payments)
    const validStatuses = ["COMPLETED", "PAID"];
    
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

    // 4. Query Payments independently (prevents cartesian product with order_items / split payments)
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
        method: String(p.payment_method || "CASH"),
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
        const name = String(it.name || "Producto");
        if (!productBreakdown[name]) {
          productBreakdown[name] = { quantity: 0, revenue: 0 };
        }
        productBreakdown[name].quantity += Number(it.quantity) || 1;
        productBreakdown[name].revenue += Number(it.total_price) || 0;
      }

      // Attach payments array to order item for UI display
      const ordId = String(ord.order_id);
      const matchedPayments = paymentsByOrder.get(ordId) || [];
      ord.payments = matchedPayments;
      ord.primary_method = matchedPayments.length > 0 ? matchedPayments[0].method : "CASH";
    }

    // Aggregate payments breakdown accurately from payment rows
    const paymentBreakdown: Record<string, { count: number; total: number }> = {};
    for (const pay of paymentsList) {
      const method = String(pay.payment_method || "CASH");
      if (!paymentBreakdown[method]) {
        paymentBreakdown[method] = { count: 0, total: 0 };
      }
      paymentBreakdown[method].count += 1;
      paymentBreakdown[method].total += Number(pay.payment_amount) || 0;
    }

    const generatedAt = new Date().toISOString();

    // 6. Compute Cryptographic SHA-256 Digest of immutable report content
    const payloadForHashing = JSON.stringify({
      businessId: businessInfo?.businessId || businessInfo?.restaurantId,
      branchId: businessInfo?.branchId,
      totalOrders: ordersList.length,
      totalGross: Math.round(totalGross * 100) / 100,
      totalSubtotal: Math.round(totalSubtotal * 100) / 100,
      totalTax: Math.round(totalTax * 100) / 100,
      orderIds: ordersList.map((o) => o.order_id),
      paymentsTotal: paymentsList.reduce((acc, p) => acc + (Number(p.payment_amount) || 0), 0),
      generatedAt,
    });

    const sha256Fingerprint = crypto.createHash("sha256").update(payloadForHashing).digest("hex");

    return NextResponse.json({
      success: true,
      business: businessInfo,
      shift: shiftInfo,
      filter: {
        branchId: branchId || null,
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
    console.error("Audit Report API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
