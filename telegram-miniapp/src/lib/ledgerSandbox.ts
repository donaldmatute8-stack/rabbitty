import { eq } from 'drizzle-orm';
import { orders } from '@rabbitty/database-restaurant/schema';
import { ownedBusinesses } from '@rabbitty/database-core/schema';

/**
 * ── ¿Este asiento es de prueba/demo? ───────────────────────────────────────
 *
 * El ancla (epoch) hashea solo asientos reales. Un asiento derivado de una
 * operación de prueba (`orders.isTest`) o de un negocio sandbox NO puede nacer
 * con `sandbox = false`: entraría al ancla y ensuciaría el respaldo.
 *
 * Se resuelve en un solo lugar para que reward, mint, claim y checkout usen la
 * misma regla. Si no se puede determinar, se asume real (nunca se esconde
 * dinero verdadero por un fallo de lectura).
 */
export async function resolveLedgerSandbox(
  restaurantDb: any,
  input: { orderId?: string | null; businessId?: string | null },
): Promise<boolean> {
  try {
    if (input.orderId) {
      const [order] = await restaurantDb
        .select({ isTest: orders.isTest })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (order?.isTest) return true;
    }

    if (input.businessId) {
      const [biz] = await restaurantDb
        .select({ sandbox: ownedBusinesses.sandbox })
        .from(ownedBusinesses)
        .where(eq(ownedBusinesses.id, input.businessId))
        .limit(1);
      return Boolean(biz?.sandbox);
    }
  } catch {
    // Sin respuesta no se bloquea el asiento: se trata como real.
  }
  return false;
}
