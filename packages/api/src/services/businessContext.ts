/**
 * Resolución del negocio dueño de una sucursal.
 *
 * El canal de tiempo real incluye el `businessId` para aislar tenants, así que
 * cliente y publisher deben calcularlo con la MISMA función.
 */

import { eq } from "drizzle-orm";
import * as dbSchema from "@rabbitty/database-restaurant";

export async function resolveBusinessIdFromBranch(
  restaurantDb: any,
  branchId: string,
): Promise<string | null> {
  try {
    const [br] = await restaurantDb
      .select({ restaurantId: dbSchema.branches.restaurantId })
      .from(dbSchema.branches)
      .where(eq(dbSchema.branches.id, branchId))
      .limit(1);
    if (!br?.restaurantId) return null;

    const [rest] = await restaurantDb
      .select({ businessId: dbSchema.restaurants.businessId })
      .from(dbSchema.restaurants)
      .where(eq(dbSchema.restaurants.id, br.restaurantId))
      .limit(1);
    return rest?.businessId || null;
  } catch {
    return null;
  }
}
