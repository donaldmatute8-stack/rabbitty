"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { useState } from "react";
import { trpc } from "./trpc-client";

import { resolveApiUrl } from "./api-config";

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
