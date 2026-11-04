"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "./trpc-client";

import { resolveApiUrl } from "./api-config";
import { getPosOperatorToken, getPosTerminalToken } from "./pos-terminal";

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: resolveApiUrl("/api/trpc"),
          headers() {
            if (typeof window !== "undefined") {
              const headers: Record<string, string> = {};
              const activeBranch = localStorage.getItem("activeBranchId");
              if (activeBranch) {
                headers["x-branch-id"] = activeBranch;
              }
              const token = localStorage.getItem("rabbitty_auth_token");
              if (token) {
                headers["Authorization"] = `Bearer ${token}`;
              }
              // ── Fase 2: sesión propia de la terminal POS ──
              // Solo en las rutas del POS/Kiosk: así una terminal vinculada no
              // condiciona la sucursal del admin en el resto del panel.
              const path = window.location.pathname;
              const isLinkPage = path.startsWith("/pos/link");
              if (!isLinkPage && (path.startsWith("/pos") || path.startsWith("/kiosk"))) {
                const terminalToken = getPosTerminalToken();
                if (terminalToken) {
                  headers["x-pos-terminal-token"] = terminalToken;
                }
                const operatorToken = getPosOperatorToken();
                if (operatorToken) {
                  headers["x-pos-operator-token"] = operatorToken;
                }
              }
              return headers;
            }
            return {};
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
