"use client";

import React, { useState, createContext, useContext } from "react";
import { AdminSidebar } from "./AdminSidebar";
import { BranchSelector } from "./BranchSelector";

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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [branchId, setBranchId] = useState("b1");

  return (
    <BranchContext.Provider value={{ branchId, setBranchId }}>
      <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
        <div className="relative flex h-screen w-screen overflow-hidden bg-black text-[var(--text-primary)]">
          {/* Decorative blurred background blobs */}
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
