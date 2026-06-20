import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@rabbitty/api";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { getEnv } from "@/env";

const handler = async (req: Request) => {
  const env = getEnv();
  const session = await auth();
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      userId: session?.user?.id ?? null,
      user: session?.user ?? null,
      restaurantDb: getRestaurantDb(),
      coreDb: getCoreDb(),
      branchId: env.BRANCH_ID,
    }),
  });
};

export { handler as GET, handler as POST };
