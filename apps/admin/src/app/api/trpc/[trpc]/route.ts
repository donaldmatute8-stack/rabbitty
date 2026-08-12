import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@rabbitty/api";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { getEnv } from "@/env";
import { staff } from "@rabbitty/database-restaurant/schema";
import { eq } from "drizzle-orm";

const handler = async (req: Request) => {
  const env = getEnv();
  const session = await auth();
  
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async () => {
      const restaurantDb = getRestaurantDb();
      let staffRole: "WAITER" | "CASHIER" | "MANAGER" | "ADMIN" | null = null;
      let staffBranchId = null;

      if (session?.user?.email) {
        const [staffRecord] = await restaurantDb.select().from(staff).where(eq(staff.email, session.user.email));
        if (staffRecord) {
          staffRole = staffRecord.role as "WAITER" | "CASHIER" | "MANAGER" | "ADMIN" | null;
          staffBranchId = staffRecord.branchId;
        }
      }

      const headerBranchId = req.headers.get("x-branch-id");

      return {
        userId: session?.user?.id ?? null,
        user: session?.user ?? null,
        staffRole,
        staffBranchId,
        restaurantDb,
        coreDb: getCoreDb(),
        branchId: staffBranchId || headerBranchId || env.BRANCH_ID,
      };
    },
  });
};

export { handler as GET, handler as POST };
