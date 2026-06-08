import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, protectedProcedure } from "../trpc";
import * as dbSchema from "@rabbitty/database-restaurant";
import { orders } from "@rabbitty/database-restaurant/schema";

export const customerRouter = router({
  lookupCustomer: protectedProcedure
    .input(z.object({ phone: z.string().optional(), email: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      if (input.phone) {
        const [customer] = await ctx.restaurantDb.select().from(orders).where(eq(orders.customerPhone, input.phone));
        return customer ? { found: true, ...customer } : { found: false };
      } else if (input.email) {
        const [customer] = await ctx.restaurantDb.select().from(orders).where(eq(orders.customerId, input.email));
        return customer ? { found: true, ...customer } : { found: false };
      }
      return { found: false };
    }),

  getCustomerHistory: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ ctx, input }) => {
      const result = await ctx.restaurantDb.select().from(orders).where(eq(orders.customerPhone, input.phone));
      return { phone: input.phone, orders: result };
    }),
});
