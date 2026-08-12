"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { BranchSelector } from "./BranchSelector";
import { CommandMenu } from "./CommandMenu";
import { trpc } from "../lib/trpc-client";

const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}>({ isCollapsed: false, setIsCollapsed: () => {} });

const BranchContext = createContext<{
  branchId: string;
  setBranchId: React.Dispatch<React.SetStateAction<string>>;
}>({ branchId: "b1", setBranchId: () => {} });

export const useSidebar = () => useContext(SidebarContext);
export const useBranch = () => useContext(BranchContext);

export function DashboardClientWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [branchId, setBranchId] = useState("b1");
  const [twoFaChecked, setTwoFaChecked] = useState(false);

  const { data: twoFa, isFetched } = trpc.totp.checkRequirement.useQuery(undefined, {
    retry: false,
    enabled: !twoFaChecked && pathname !== "/auth/2fa",
  });

  const { data: branches } = trpc.admin.getBranches.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  const { data: profile } = trpc.admin.getProfile.useQuery(undefined, {
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (branches && branches.length > 0 && !branches.some((b) => b.id === branchId)) {
      setBranchId(branches[0].id);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("activeBranchId", branchId);
    }
  }, [branches, branchId]);

  useEffect(() => {
    if (isFetched && !twoFaChecked) {
      if (twoFa?.requireTotpForLogin) {
        router.replace("/auth/2fa");
      }
      setTwoFaChecked(true);
    }
  }, [isFetched, twoFa, twoFaChecked, router]);

  useEffect(() => {
    if (profile) {
      if (profile.role === "CASHIER" && !pathname.startsWith("/pos")) {
        router.replace("/pos");
      } else if (profile.role === "WAITER" && !pathname.startsWith("/pos")) {
        router.replace("/pos");
      } else if (profile.role === "KITCHEN" && !pathname.startsWith("/kitchen")) {
        router.replace("/kitchen");
      }
    }
  }, [profile, pathname, router]);

  return (
    <BranchContext.Provider value={{ branchId, setBranchId }}>
      <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
        <div className="relative flex h-screen w-screen overflow-hidden bg-black text-[var(--text-primary)]">
          {/* Neon Glow Accents */}
          <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute top-[30%] left-[20%] h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

          {/* Sidebar Navigation */}
          <AdminSidebar />

          {/* Main Layout Area */}
          <div className="relative z-10 flex-1 flex flex-col h-screen overflow-hidden">
            {/* Executive Top Bar */}
            <header className="flex h-16 items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl px-8 z-10">
              <div className="flex items-center gap-4">
                <CommandMenu />
              </div>
              <div className="flex items-center gap-4">
                <BranchSelector />
              </div>
            </header>

            {/* Scrollable Content View */}
            <main className="flex-1 overflow-y-auto p-8">
              <div className="mx-auto max-w-7xl">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarContext.Provider>
    </BranchContext.Provider>
  );
}
