import { initTRPC, TRPCError } from "@trpc/server";
import type { RequestContext } from "../context/request-context";

const t = initTRPC.context<RequestContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.principal.subjectType === "ANONYMOUS") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Missing valid session or token." });
  }
  return next({ ctx });
});

export const tenantProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.principal.tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Operation requires an active tenant context." });
  }
  return next({ ctx });
});

export const adminProcedure = tenantProcedure.use(({ ctx, next }) => {
  if (!ctx.principal.roles.includes("ADMIN") && !ctx.principal.roles.includes("MANAGER")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Insufficient privileges for this tenant." });
  }
  return next({ ctx });
});

export const deviceProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.principal.subjectType !== "DEVICE") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Operation restricted to devices." });
  }
  return next({ ctx });
});
