import { NextResponse } from "next/server";
import { getRestaurantDb } from "../../../../../../../packages/api/src/db";
import { inventoryItems, inventoryMovements } from "@rabbitty/database-restaurant/schema";
import { eq, sql } from "drizzle-orm";

// Este endpoint debería ser invocado por Vercel Cron o similar
export async function GET(req: Request) {
  try {
    const db = await getRestaurantDb(); // Mock injection

    // 1. Obtener items con bajo inventario o proyectados a agotarse
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.isActive, true));

    // 2. Calcular consumo promedio de los últimos 30 días con SQL real
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const movements = await db.select({
      itemId: inventoryMovements.itemId,
      totalUsage: sql<number>`SUM(ABS(${inventoryMovements.quantity}))`
    })
    .from(inventoryMovements)
    .where(
      sql`${inventoryMovements.type} = 'OUT' AND ${inventoryMovements.createdAt} >= ${thirtyDaysAgo.toISOString()}`
    )
    .groupBy(inventoryMovements.itemId);

    const usageMap = new Map(movements.map(m => [m.itemId, Number(m.totalUsage)]));

    const recommendations = [];

    for (const item of items) {
      const totalUsage30d = usageMap.get(item.id) || 0;
      // Real Math: daily average
      const dailyAverageConsumption = totalUsage30d / 30; 
      
      const safeDailyAverage = dailyAverageConsumption > 0 ? dailyAverageConsumption : 0.1; // fallback to avoid infinity
      const daysUntilEmpty = item.stock / safeDailyAverage;

      if (daysUntilEmpty < 3) {
        recommendations.push({
          itemId: item.id,
          name: item.name,
          currentStock: item.stock,
          projectedDaysLeft: Math.round(daysUntilEmpty),
          recommendation: `El stock actual durará menos de 3 días (${Math.round(daysUntilEmpty)} días). Sugerimos pedir ${Math.round(safeDailyAverage * 7)} ${item.unit} para cubrir la próxima semana.`
        });
      }
    }

    // Opcional: Podríamos insertar estas recomendaciones en una tabla `purchase_recommendations`
    // o enviarlas por email/telegram al gerente de la sucursal.

    return NextResponse.json({ 
      success: true, 
      scannedItems: items.length,
      recommendationsGenerated: recommendations.length,
      recommendations 
    });

  } catch (error: any) {
    console.error("Inventory Forecast Cron Error:", error);
    return NextResponse.json({ error: "Failed to run inventory forecast" }, { status: 500 });
  }
}
