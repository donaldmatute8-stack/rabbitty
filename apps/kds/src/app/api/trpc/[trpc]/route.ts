import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { TRPCError } from "@trpc/server";
import { appRouter } from "@rabbitty/api";
import { auth } from "@rabbitty/auth";
import { getRestaurantDb, getCoreDb } from "@rabbitty/api/db";
import { resolveKdsCaller, KdsAuthError } from "@rabbitty/api/services/kdsContext";
import { touchTerminalSession } from "@rabbitty/api/services/posTerminalAuth";

/**
 * ── tRPC del KDS ───────────────────────────────────────────────────────────
 *
 * Doble autenticación (terminal POS o sesión NextAuth) resuelta en
 * `resolveKdsCaller`, la misma que usa la emisión de tokens de Centrifugo.
 * Sin sucursal no hay contexto: se responde 403, nunca un `BRANCH_ID` implícito.
 */
const handler = async (req: Request) => {
  const session = await auth();
  const restaurantDb = getRestaurantDb();
  const coreDb = getCoreDb();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    onError: ({ error, path }) => {
      console.error(`[kds tRPC] ${req.method} ${path}:`, error.message);
    },
    // El contexto se resuelve aquí para que un rechazo salga como error tRPC
    // con su código (UNAUTHORIZED/FORBIDDEN) y no como un 500 opaco.
    createContext: async () => {
      let caller;
      try {
        caller = await resolveKdsCaller({ req, session, restaurantDb, coreDb });
      } catch (error) {
        if (error instanceof KdsAuthError) {
          throw new TRPCError({ code: error.code, message: error.message });
        }
        throw error;
      }

      if (caller.posTerminal) await touchTerminalSession(coreDb, caller.posTerminal);

      return {
        userId: caller.userId,
        user: session?.user ? { ...session.user, id: caller.userId ?? session.user.id } : null,
        staffRole: caller.staffRole,
        staffBranchId: caller.staffBranchId,
        restaurantDb,
        coreDb,
        branchId: caller.branchId,
        posAuth: caller.posAuth,
      };
    },
  });
};

export { handler as GET, handler as POST };
