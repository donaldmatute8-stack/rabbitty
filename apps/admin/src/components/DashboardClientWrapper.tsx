"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { BranchSelector } from "./BranchSelector";
import { CommandMenu } from "./CommandMenu";
import { SandboxBanner } from "./SandboxBanner";
import { trpc } from "../lib/trpc-client";
import Link from "next/link";
import { TerminalSquare, TabletSmartphone, Smartphone, MessageSquare, X } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { ScannerPairModal } from "./ScannerPairModal";

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
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);

  useEffect(() => {
    // Si corre en Capacitor nativo (iOS / Android / Desktop nativo) o standalone PWA
    const isCapNative = Capacitor.isNativePlatform();
    const isStandalone = typeof window !== "undefined" && (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
    setIsNativeApp(isCapNative || isStandalone);
  }, []);
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false);
  const [activeCustomerChat, setActiveCustomerChat] = useState<string | null>(null);
  const [chatReply, setChatReply] = useState("");

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

  const {
    data: conversations,
    isLoading: conversationsLoading,
    refetch: refetchConversations,
  } = trpc.customerChat.listConversations.useQuery(undefined, {
    enabled: chatDrawerOpen,
    refetchInterval: chatDrawerOpen ? 8000 : false,
    retry: false,
  });

  const {
    data: thread,
    isLoading: threadLoading,
    refetch: refetchThread,
  } = trpc.customerChat.getMessages.useQuery(
    { conversationId: activeCustomerChat ?? "" },
    {
      enabled: !!activeCustomerChat,
      refetchInterval: activeCustomerChat ? 5000 : false,
      retry: false,
    }
  );

  const sendMessage = trpc.customerChat.sendMessage.useMutation({
    onSuccess: () => {
      setChatReply("");
      refetchThread();
      refetchConversations();
    },
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
        <div className="relative flex h-screen w-full overflow-hidden bg-black text-(--text-primary)">
          {/* Neon Glow Accents */}
          <div className="absolute top-[-10%] right-[-10%] h-125 w-125 rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute bottom-[-10%] left-[-10%] h-125 w-125 rounded-full bg-purple-500/10 blur-[120px] pointer-events-none" />
          <div className="absolute top-[30%] left-[20%] h-75 w-75 rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

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
              <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-3 shrink-0">
                <button
                  onClick={() => setChatDrawerOpen(true)}
                  className="relative flex items-center gap-1.5 sm:gap-2 rounded-xl bg-pink-500/10 px-2.5 sm:px-3 py-2 text-xs font-bold text-pink-400 hover:bg-pink-500/20 active:scale-95 transition-all border border-pink-500/20 cursor-pointer"
                  title="Mensajes de clientes B2C"
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-pink-400" />
                  <span className="hidden md:inline whitespace-nowrap">Chats Clientes</span>
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500"></span>
                  </span>
                </button>
                <button
                  onClick={() => setPairModalOpen(true)}
                  className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-pink-500/10 px-2.5 sm:px-3 py-2 text-xs font-bold text-pink-400 hover:bg-pink-500/20 active:scale-95 transition-all border border-pink-500/20 cursor-pointer"
                  title="Vincular teléfono móvil como terminal de escaneo"
                >
                  <Smartphone className="h-4 w-4 shrink-0 text-pink-400" />
                  <span className="hidden lg:inline whitespace-nowrap">Vincular Celular</span>
                </button>
                <Link
                  href="/pos"
                  target={isNativeApp ? undefined : "_blank"}
                  rel={isNativeApp ? undefined : "noopener noreferrer"}
                  className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-cyan-500/10 px-2.5 sm:px-3 py-2 text-xs font-bold text-cyan-400 hover:bg-cyan-500/20 active:scale-95 transition-all border border-cyan-500/20"
                >
                  <TerminalSquare className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Caja POS</span>
                </Link>
                <Link
                  href="/kiosk"
                  target={isNativeApp ? undefined : "_blank"}
                  rel={isNativeApp ? undefined : "noopener noreferrer"}
                  className="flex items-center gap-1.5 sm:gap-2 rounded-xl bg-purple-500/10 px-2.5 sm:px-3 py-2 text-xs font-bold text-purple-400 hover:bg-purple-500/20 active:scale-95 transition-all border border-purple-500/20"
                >
                  <TabletSmartphone className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline whitespace-nowrap">Kiosko</span>
                </Link>
                <div className="w-px h-6 bg-white/10 mx-0.5 hidden sm:block" />
                <BranchSelector />
              </div>
            </header>

            {/* Scrollable Content View */}
            <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:p-8">
              <div className="mx-auto max-w-7xl w-full min-w-0">
                {children}
              </div>
            </main>

            {/* Slide-over Customer Chat Drawer (B2C) */}
            {chatDrawerOpen && (
              <div className="fixed inset-0 z-50 flex justify-end">
                {/* Backdrop */}
                <div 
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                  onClick={() => setChatDrawerOpen(false)}
                />

                {/* Panel lateral */}
                <aside className="relative z-50 w-full max-w-md h-full bg-[#111113] border-l border-white/10 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
                  {/* Header */}
                  <div className="flex items-center justify-between p-4 border-b border-white/10">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-pink-400">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white m-0">Atención a Clientes (B2C)</h3>
                        <p className="text-[11px] text-gray-400 m-0">Mensajes de usuarios de la MiniApp</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setChatDrawerOpen(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Body: Customer Conversations List or Thread */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {!activeCustomerChat && (
                      <>
                        {conversationsLoading && (
                          <p className="text-xs text-gray-400 text-center py-6">Cargando conversaciones…</p>
                        )}
                        {!conversationsLoading && (!conversations || conversations.length === 0) && (
                          <div className="text-center py-10 px-4">
                            <p className="text-xs text-gray-400 m-0">
                              Aún no hay mensajes de clientes.
                            </p>
                            <p className="text-[11px] text-gray-500 mt-2 m-0">
                              Cuando un usuario te escriba desde la MiniApp, aparecerá aquí.
                            </p>
                          </div>
                        )}
                        {conversations?.map((conv) => (
                          <div
                            key={conv.id}
                            onClick={() => setActiveCustomerChat(conv.id)}
                            className="p-3.5 rounded-2xl bg-white/3 border border-white/10 hover:border-pink-500/40 transition-all cursor-pointer"
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-white">{conv.customerName}</span>
                              <span className="text-[10px] text-gray-500">
                                {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </div>
                            <p className="text-[10px] text-pink-400 mb-1 m-0">{conv.businessName}</p>
                            <p className="text-xs text-gray-300 m-0 line-clamp-2">{conv.lastMessage || "Sin mensajes"}</p>
                          </div>
                        ))}
                      </>
                    )}

                    {activeCustomerChat && (
                      <>
                        <button
                          onClick={() => {
                            setActiveCustomerChat(null);
                            setChatReply("");
                          }}
                          className="text-[11px] text-gray-400 hover:text-white bg-transparent border-0 cursor-pointer p-0 mb-2"
                        >
                          ← Volver a conversaciones
                        </button>

                        {threadLoading && (
                          <p className="text-xs text-gray-400 text-center py-6">Cargando mensajes…</p>
                        )}

                        {thread?.messages.map((msg) => {
                          const mine = msg.senderId === thread.businessId;
                          return (
                            <div key={msg.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 ${mine ? "bg-pink-600 text-white" : "bg-white/6 text-gray-100 border border-white/10"}`}>
                                <p className="text-xs m-0 whitespace-pre-wrap wrap-break-word">{msg.content}</p>
                                <span className={`text-[9px] mt-1 block ${mine ? "text-pink-100/80" : "text-gray-500"}`}>
                                  {msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : ""}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>

                  {/* Quick Reply Bar */}
                  {activeCustomerChat && (
                    <div className="p-3 border-t border-white/10 bg-black/40">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Responder al cliente..."
                          value={chatReply}
                          onChange={(e) => setChatReply(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && chatReply.trim() && !sendMessage.isPending) {
                              sendMessage.mutate({ conversationId: activeCustomerChat, content: chatReply.trim() });
                            }
                          }}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500"
                        />
                        <button
                          onClick={() => {
                            if (!chatReply.trim() || sendMessage.isPending) return;
                            sendMessage.mutate({ conversationId: activeCustomerChat, content: chatReply.trim() });
                          }}
                          disabled={sendMessage.isPending}
                          className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl border-none cursor-pointer active:scale-95 transition-transform"
                        >
                          {sendMessage.isPending ? "..." : "Enviar"}
                        </button>
                      </div>
                    </div>
                  )}
                </aside>
              </div>
            )}

            <ScannerPairModal
              isOpen={pairModalOpen}
              onClose={() => setPairModalOpen(false)}
            />
          </div>
        </div>
      </SidebarContext.Provider>
    </BranchContext.Provider>
  );
}
