import { and, eq } from "drizzle-orm";
import { ownedBusinesses, users } from "@rabbitty/database-core/schema";
import * as dbSchema from "@rabbitty/database-restaurant";

/**
 * Valida que el usuario esté autorizado para operar la branch:
 * owner del negocio que la posee, staff activo de esa branch, o admin de plataforma.
 * Devuelve el userId validado o null (la branch NO es del usuario).
 */
export async function validateBranchMembership(params: {
  userId: string | null;
  branchId: string;
  restaurantDb: any;
  coreDb: any;
}): Promise<string | null> {
  const { userId, branchId, restaurantDb, coreDb } = params;
  if (!userId) return null;

  // 1) Staff activo de la branch
  try {
    const [staffRow] = await restaurantDb
      .select({ id: dbSchema.staff.id })
      .from(dbSchema.staff)
      .where(and(eq(dbSchema.staff.userId, userId), eq(dbSchema.staff.branchId, branchId), eq(dbSchema.staff.isActive, true)))
      .limit(1);
    if (staffRow) return userId;
  } catch { /* staff sin userId? continúa con owner */ }

  // 1b) Staff por email (auth de adminAuthUsers)
  try {
    const [br] = await restaurantDb
      .select({ restaurantId: dbSchema.branches.restaurantId })
      .from(dbSchema.branches)
      .where(eq(dbSchema.branches.id, branchId))
      .limit(1);
    if (br?.restaurantId) {
      const [rest] = await restaurantDb
        .select({ businessId: dbSchema.restaurants.businessId })
        .from(dbSchema.restaurants)
        .where(eq(dbSchema.restaurants.id, br.restaurantId))
        .limit(1);
      if (rest?.businessId) {
        const [biz] = await coreDb
          .select({ ownerId: ownedBusinesses.ownerId })
          .from(ownedBusinesses)
          .where(eq(ownedBusinesses.id, rest.businessId))
          .limit(1);
        if (biz?.ownerId === userId) return userId;
        // owner por email (sesión adminAuthUsers → core user)
        try {
          const [u] = await coreDb.select({ email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
          const [staffByEmail] = await restaurantDb
            .select({ id: dbSchema.staff.id })
            .from(dbSchema.staff)
            .where(and(eq(dbSchema.staff.email, u?.email || "__none__"), eq(dbSchema.staff.branchId, branchId), eq(dbSchema.staff.isActive, true)))
            .limit(1);
          if (staffByEmail) return userId;
        } catch { /* noop */ }
      }
    }
  } catch { /* noop */ }

  return null;
}
