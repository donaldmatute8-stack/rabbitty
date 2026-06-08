import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@rabbitty/api";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";

const handler = async (req: Request) => {
  const session = await auth();
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => ({
      userId: process.env.LOAD_TEST_USER_ID ?? session?.user?.id ?? null,
      user: session?.user ?? null,
      restaurantDb: getRestaurantDb(),
      coreDb: getCoreDb(),
      branchId: (() => { if (!process.env.BRANCH_ID) throw new Error("BRANCH_ID env var is required"); return process.env.BRANCH_ID; })(),
    }),
  });
};

export { handler as GET, handler as POST };
