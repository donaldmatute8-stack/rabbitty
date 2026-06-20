"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { BranchSelector } from "./BranchSelector";
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

  useEffect(() => {
    if (isFetched && !twoFaChecked) {
      if (twoFa?.requireTotpForLogin) {
        router.replace("/auth/2fa");
      }
      setTwoFaChecked(true);
    }
  }, [isFetched, twoFa, twoFaChecked, router]);

  return (
    <BranchContext.Provider value={{ branchId, setBranchId }}>
      <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
        <div className="relative flex h-screen w-screen overflow-hidden bg-black text-[var(--text-primary)]">
          <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute top-[30%] left-[20%] h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

          <AdminSidebar />
          <main className="relative z-10 flex-1 overflow-y-auto p-8 transition-all duration-300">
            <div className="mx-auto max-w-7xl">
              {children}
            </div>
          </main>
        </div>
      </SidebarContext.Provider>
    </BranchContext.Provider>
  );
}
