import { router, publicProcedure, protectedProcedure, tenantProcedure, adminProcedure } from "./routers/trpc";
import { createContext } from "./context/request-context";

// Example stub router
const appRouter = router({
  health: publicProcedure.query(() => ({ status: "ok" })),
  
  getProfile: protectedProcedure.query(({ ctx }) => {
    return { id: ctx.principal.subjectId, roles: ctx.principal.roles };
  }),
  
  getTenantData: tenantProcedure.query(({ ctx }) => {
    return { data: `Data for tenant ${ctx.principal.tenantId}` };
  }),
  
  adminAction: adminProcedure.mutation(({ ctx }) => {
    return { success: true, executedBy: ctx.principal.subjectId };
  })
});

export type AppRouter = typeof appRouter;

// Simple Node HTTP server mock for now (or Fastify)
import { createServer } from "http";

const server = createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: "Rabbitty Modular Monolith is starting..." }));
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`[API-SERVER] Listening on port ${PORT}`);
});
