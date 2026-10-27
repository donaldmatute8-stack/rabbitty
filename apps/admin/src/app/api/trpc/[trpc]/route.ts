import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@rabbitty/api";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { getEnv } from "@/env";
import { staff, branches, restaurants } from "@rabbitty/database-restaurant/schema";
import { users } from "@rabbitty/database-core/schema";
import { eq, and } from "drizzle-orm";

const handler = async (req: Request) => {
  const env = getEnv();
  const session = await auth();
  
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const restaurantDb = getRestaurantDb();
      let staffRole: "WAITER" | "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN" | null = null;
      let staffBranchId = null;

      if (session?.user?.email) {
        const [staffRecord] = await restaurantDb.select().from(staff).where(eq(staff.email, session.user.email));
        if (staffRecord) {
          staffRole = staffRecord.role as "WAITER" | "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN" | null;
          staffBranchId = staffRecord.branchId;
        }
      }

      const headerBranchId = req.headers.get("x-branch-id");
      let activeBranchId = (headerBranchId && headerBranchId !== "b1" ? headerBranchId : null) || staffBranchId;

      if (!activeBranchId) {
        const [firstBranch] = await restaurantDb.select({ id: branches.id }).from(branches).limit(1);
        activeBranchId = firstBranch?.id || env.BRANCH_ID;
      }

      const coreDb = getCoreDb();
      let effectiveUserId = session?.user?.id ?? null;

      if (session?.user?.email) {
        // Mapear adminAuthUsers.email a core users.id para enlazar la propiedad de negocios y saldo de Bunz
        const [coreUser] = await coreDb
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, session.user.email))
          .limit(1);
        if (coreUser) {
          effectiveUserId = coreUser.id;
        }
      }
      if (effectiveUserId && !staffRole) {
        // ── Owner de negocio (no staff): SIEMPRE su branch, inmunidad al header
        // x-branch-id (localStorage heredado de otra sucursal/tenant) y al fallback global ──
        const coreSchema = await import("@rabbitty/database-core/schema");
        const ownerBiz = await coreDb.select().from(coreSchema.ownedBusinesses)
          .where(eq(coreSchema.ownedBusinesses.ownerId, effectiveUserId)).limit(1)
          .catch(() => []);
        const bizId = ownerBiz[0]?.id;
        if (bizId) {
          const ownRest = await restaurantDb.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.businessId, bizId));
          if (ownRest[0]?.id) {
            if (headerBranchId) {
              const ownHeader = await restaurantDb.select({ id: branches.id }).from(branches).where(and(
                eq(branches.restaurantId, ownRest[0].id),
                eq(branches.id, headerBranchId)
              )).limit(1);
              if (ownHeader[0]?.id) { activeBranchId = ownHeader[0].id; }
            }
            if (!headerBranchId || !activeBranchId) {
              const [anyOwn] = await restaurantDb.select({ id: branches.id }).from(branches).where(eq(branches.restaurantId, ownRest[0].id)).limit(1);
              if (anyOwn?.id) activeBranchId = anyOwn.id;
            }
          }
        }
      }

      return {
        userId: effectiveUserId,
        user: session?.user ? { ...session.user, id: effectiveUserId || session.user.id } : null,
        staffRole,
        staffBranchId,
        restaurantDb,
        coreDb,
        branchId: activeBranchId,
      };
    },
  });
};

export { handler as GET, handler as POST };
