"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { BranchSelector } from "./BranchSelector";
import { CommandMenu } from "./CommandMenu";
import { SandboxBanner } from "./SandboxBanner";
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
  // On tablet (<lg), sidebar starts collapsed (hidden). On desktop, expanded.
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [branchId, setBranchId] = useState("b1");
  const [twoFaChecked, setTwoFaChecked] = useState(false);
  const [isTablet, setIsTablet] = useState(false);

  // Detect breakpoint on mount and resize
  useEffect(() => {
    const checkTablet = () => {
      const tablet = window.innerWidth < 1024;
      setIsTablet(tablet);
      // Auto-collapse sidebar when on tablet
      if (tablet) setIsCollapsed(true);
    };
    checkTablet();
    window.addEventListener("resize", checkTablet);
    return () => window.removeEventListener("resize", checkTablet);
  }, []);

  // Auto-close drawer on navigation (tablet)
  useEffect(() => {
    if (isTablet) setIsCollapsed(true);
  }, [pathname, isTablet]);

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
    if (branches && branches.length > 0) {
      const currentValid = branches.some((b) => b.id === branchId);
      if (!currentValid || branchId === "b1") {
        setBranchId(branches[0].id);
        if (typeof window !== "undefined") {
          localStorage.setItem("activeBranchId", branches[0].id);
        }
      }
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

  const sidebarOpen = !isCollapsed;

  return (
    <BranchContext.Provider value={{ branchId, setBranchId }}>
      <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
        <div className="relative flex h-screen w-full overflow-hidden bg-black text-[var(--text-primary)]">
          {/* Neon Glow Accents */}
          <div className="absolute top-[-10%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[-10%] h-[500px] w-[500px] rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute top-[30%] left-[20%] h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

          {/*
            SIDEBAR STRATEGY:
            - Desktop (≥1024px): inline flex, pushes main content, can collapse to icon-only
            - Tablet/Phone (<1024px): fixed overlay drawer, floats over content
          */}

          {/* Tablet/Phone: overlay drawer mode */}
          {isTablet ? (
            <>
              {/* Backdrop */}
              {sidebarOpen && (
                <div
                  className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity"
                  onClick={() => setIsCollapsed(true)}
                />
              )}
              {/* Drawer */}
              <div
                className={`fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out ${
                  sidebarOpen ? "translate-x-0" : "-translate-x-full"
                }`}
              >
                <AdminSidebar />
              </div>
            </>
          ) : (
            /* Desktop: inline sidebar */
            <AdminSidebar />
          )}

          {/* Main Layout Area — always fills full width on tablet */}
          <div className="relative z-10 flex flex-col h-screen overflow-hidden min-w-0 w-full">
            {/* Executive Top Bar */}
            <SandboxBanner />
            <header className="flex h-14 lg:h-16 items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-xl px-3 sm:px-5 lg:px-8 z-10 gap-2 shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Hamburger — shown on tablet, hidden on desktop */}
                <button
                  onClick={() => setIsCollapsed(!isCollapsed)}
                  className="lg:hidden flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-gray-400 hover:bg-pink-500/20 hover:text-pink-400 shrink-0 transition-all cursor-pointer"
                  aria-label="Abrir menú de navegación"
                >
                  {sidebarOpen ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  )}
                </button>
                <CommandMenu />
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <BranchSelector />
              </div>
            </header>

            {/* Scrollable Content View */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8">
              <div className="mx-auto max-w-7xl w-full min-w-0">
                {children}
              </div>
            </main>
          </div>
        </div>
      </SidebarContext.Provider>
    </BranchContext.Provider>
  );
}
