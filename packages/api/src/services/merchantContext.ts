import { eq, inArray } from "drizzle-orm";
import { ownedBusinesses, users } from "@rabbitty/database-core/schema";
import * as dbSchema from "@rabbitty/database-restaurant";
import { isGodAdminIdentity } from "./god2fa";

/**
 * Resuelve los ids de NEGOCIO que la sesión puede ver (owner de negocios,
 * staff/cajero por branch, god global). Devuelve:
 *  - businessIds: ids de ownedBusinesses visibles
 *  - restaurantIds: ids de restaurants de esos negocios (para tablas del restaurant DB)
 *  - isGod: si la identidad es God Admin (scope global en consumers)
 */
export async function resolveMerchantContext(ctx: any): Promise<{
  businessIds: string[];
  restaurantIds: string[];
  isGod: boolean;
}> {
  const isGod = isGodAdminIdentity(ctx.user?.email, ctx.user?.name);

  const bizIds: string[] = [];
  // 1) Propiedad directa
  if (ctx.userId) {
    const owned = await ctx.coreDb.select({ id: ownedBusinesses.id })
      .from(ownedBusinesses).where(eq(ownedBusinesses.ownerId, ctx.userId));
    bizIds.push(...owned.map((b: { id: string }) => b.id));
  }
  // 2) Fallback por branch (staff/cajero/pairing con email distinto)
  if (bizIds.length === 0 && ctx.branchId) {
    const [br] = await ctx.restaurantDb.select({ restaurantId: dbSchema.branches.restaurantId })
      .from(dbSchema.branches).where(eq(dbSchema.branches.id, ctx.branchId)).limit(1);
    if (br?.restaurantId) {
      const [rest] = await ctx.restaurantDb.select({ businessId: dbSchema.restaurants.businessId })
        .from(dbSchema.restaurants).where(eq(dbSchema.restaurants.id, br.restaurantId)).limit(1);
      if (rest?.businessId) bizIds.push(rest.businessId);
    }
  }

  let restaurantIds: string[] = [];
  if (bizIds.length > 0) {
    const rests = await ctx.restaurantDb.select({ id: dbSchema.restaurants.id })
      .from(dbSchema.restaurants).where(inArray(dbSchema.restaurants.businessId, bizIds));
    restaurantIds = rests.map((r: { id: string }) => r.id);
  }

  return { businessIds: bizIds, restaurantIds, isGod };
}
