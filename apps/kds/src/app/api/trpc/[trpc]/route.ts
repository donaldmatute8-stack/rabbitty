import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@rabbitty/api";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { validateBranchMembership } from "@rabbitty/api/services/branchMembership";

const handler = async (req: Request) => {
  const session = await auth();
  const branchId = (() => { if (!process.env.BRANCH_ID) throw new Error("BRANCH_ID env var is required"); return process.env.BRANCH_ID; })();
  // Anti-IDOR: la sesión DEBE pertenecer a la branch configurada (owner o staff activo)
  const validatedUserId = await validateBranchMembership({
    userId: session?.user?.id ?? null,
    branchId,
    restaurantDb: getRestaurantDb(),
    coreDb: getCoreDb(),
  });

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      userId: validatedUserId,
      user: session?.user ?? null,
      restaurantDb: getRestaurantDb(),
      coreDb: getCoreDb(),
      branchId,
    }),
  });
};

export { handler as GET, handler as POST };
