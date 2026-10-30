import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@rabbitty/api";
import { TRPCError } from "@trpc/server";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { getEnv } from "@/env";
import { staff, branches, restaurants } from "@rabbitty/database-restaurant/schema";
import { users, ownedBusinesses } from "@rabbitty/database-core/schema";
import { eq, and } from "drizzle-orm";
import { verifyGod2faCookieValue, verifyImpersonationCookieValue, GOD_IMP_COOKIE } from "@rabbitty/api/services/god2fa";

function readGodImpCookie(req: Request): string | undefined {
  return req.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${GOD_IMP_COOKIE}=`))
    ?.slice(GOD_IMP_COOKIE.length + 1);
}

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
        const [staffRecord] = await restaurantDb
          .select()
          .from(staff)
          .where(and(eq(staff.email, session.user.email), eq(staff.isActive, true)));
        if (staffRecord) {
          staffRole = staffRecord.role as "WAITER" | "CASHIER" | "KITCHEN" | "MANAGER" | "ADMIN" | null;
          staffBranchId = staffRecord.branchId;
        }
      }

      const headerBranchId = req.headers.get("x-branch-id");
      const headerCandidate = headerBranchId && headerBranchId !== "b1" ? headerBranchId : null;
      // ── Anti-IDOR: el header x-branch-id SOLO se acepta si pertenece al restaurante
      // del usuario (owner o staff). Sin ownership ni staff → sin contexto, 403. ──
      let activeBranchId: string | null = staffBranchId;

      // ── Vista Tenant (impersonación God): cookie firmada tiene prioridad absoluta
      // sobre staff-lock, header y owner-immunity. Solo God Admin con 2FA puede crearla. ──
      const impersonating = verifyImpersonationCookieValue(readGodImpCookie(req));
      if (impersonating) {
        activeBranchId = impersonating.branchId;
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
      if (!impersonating && effectiveUserId) {
        // ── Owner / Admin de negocio: SIEMPRE dentro de las branches activas de SU restaurante,
        // permitiendo alternar limpiamente entre sucursal de Producción y sucursal Sandbox ──
        const ownerBiz = await coreDb
          .select({ id: ownedBusinesses.id })
          .from(ownedBusinesses)
          .where(eq(ownedBusinesses.ownerId, effectiveUserId))
          .limit(1)
          .catch(() => []);
        const bizId = ownerBiz[0]?.id;
        let targetRestaurantId: string | null = null;
        if (bizId) {
          const ownRest = await restaurantDb.select({ id: restaurants.id }).from(restaurants).where(eq(restaurants.businessId, bizId));
          if (ownRest[0]?.id) targetRestaurantId = ownRest[0].id;
        }
        if (!targetRestaurantId && staffBranchId) {
          const [staffBranch] = await restaurantDb.select({ restaurantId: branches.restaurantId }).from(branches).where(eq(branches.id, staffBranchId)).limit(1);
          if (staffBranch?.restaurantId) targetRestaurantId = staffBranch.restaurantId;
        }
        if (targetRestaurantId) {
          let validOwnHeaderId: string | null = null;
          if (headerBranchId && headerBranchId !== "b1") {
            const ownHeader = await restaurantDb.select({ id: branches.id }).from(branches).where(and(
              eq(branches.restaurantId, targetRestaurantId),
              eq(branches.id, headerBranchId),
              eq(branches.isActive, true)
            )).limit(1);
            if (ownHeader[0]?.id) { validOwnHeaderId = ownHeader[0].id; }
          }
          if (validOwnHeaderId) {
            activeBranchId = validOwnHeaderId;
          } else if (!staffBranchId) {
            // Owner sin header válido → priorizar sucursal de PRODUCCIÓN (no sandbox)
            const ownBranches = await restaurantDb.select({ id: branches.id, name: branches.name }).from(branches).where(and(
              eq(branches.restaurantId, targetRestaurantId),
              eq(branches.isActive, true)
            ));
            const prodBranch = ownBranches.find(
              (b) => !b.name.toLowerCase().includes("sandbox") && !b.name.toLowerCase().includes("entrenamiento")
            ) || ownBranches[0];
            if (prodBranch?.id) activeBranchId = prodBranch.id;
          }
          // Staff sin header → conserva su staffBranchId asignado
        }
      }

      // Sin owner, sin staff y sin impersonación → el usuario no tiene tenancy: rechazar
      if (!impersonating && !activeBranchId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Sin sucursal asignada para esta sesión" });
      }

      return {
        userId: effectiveUserId,
        user: session?.user ? { ...session.user, id: effectiveUserId || session.user.id } : null,
        staffRole,
        staffBranchId,
        restaurantDb,
        coreDb,
        branchId: activeBranchId || env.BRANCH_ID,
        god2faVerified: verifyGod2faCookieValue(
          req.headers.get("cookie")?.split(";").map((c) => c.trim()).find((c) => c.startsWith("god2fa="))?.slice(7)
        ),
        impersonating: impersonating ?? null,
      };
    },
  });
};

export { handler as GET, handler as POST };
