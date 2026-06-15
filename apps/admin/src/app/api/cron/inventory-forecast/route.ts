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

    const recommendations = [];

    for (const item of items) {
      // Mock AI/Predictive logic: 
      // En un entorno real, calcularíamos la media de ventas por día cruzando `orders` -> `orderItems` -> `menuItemIngredients`
      // y cruzaríamos con el clima (API externa).
      const dailyAverageConsumption = Math.random() * 5; // Dummy: Consume entre 0 y 5 unidades por día
      const daysUntilEmpty = item.stock / (dailyAverageConsumption || 1);

      if (daysUntilEmpty < 3) {
        recommendations.push({
          itemId: item.id,
          name: item.name,
          currentStock: item.stock,
          projectedDaysLeft: Math.round(daysUntilEmpty),
          recommendation: `El stock actual durará menos de 3 días (${Math.round(daysUntilEmpty)} días). Sugerimos pedir ${Math.round(dailyAverageConsumption * 7)} ${item.unit} para cubrir la semana.`
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
