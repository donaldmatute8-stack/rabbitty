"use client";

import React, { useState, createContext, useContext, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { BranchSelector } from "./BranchSelector";
import { CommandMenu } from "./CommandMenu";
import { SandboxBanner } from "./SandboxBanner";
import { trpc } from "../lib/trpc-client";
import Link from "next/link";
import { TerminalSquare, TabletSmartphone, Smartphone, MessageSquare, X, Bot, Sparkles, Send, RotateCw, CreditCard } from "lucide-react";
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

  const createStripeLink = trpc.payments.createStripeConnectLink.useMutation({
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      }
    },
    onError: (err) => {
      alert(`Error al generar enlace de Stripe: ${err.message}`);
    },
  });

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
  const [drawerTab, setDrawerTab] = useState<"bunzy" | "customers">("bunzy");
  const [activeCustomerChat, setActiveCustomerChat] = useState<string | null>(null);
  const [chatReply, setChatReply] = useState("");

  // Bunzy Co-Pilot conversation state
  const [bunzyInput, setBunzyInput] = useState("");
  const [bunzyMessages, setBunzyMessages] = useState<Array<{ role: "assistant" | "user"; text: string; modelUsed?: string }>>([
    {
      role: "assistant",
      text: "¡Hola! 🐰 Soy Bunzy Co-Pilot. Estoy conectado a los datos en vivo de tu sucursal (caja, ventas y lealtad). ¿En qué te puedo asesorar hoy?",
    },
  ]);

  const [branchId, setBranchId] = useState("b1");
  const [twoFaChecked, setTwoFaChecked] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const utils = trpc.useUtils();

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

  const bunzyChat = trpc.bunzy.chat.useMutation({
    onSuccess: (res) => {
      setBunzyMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.reply,
          modelUsed: res.metadata?.modelUsed,
        },
      ]);
    },
    onError: (err) => {
      const isSecurityReject = err.message.includes("políticas de seguridad");
      setBunzyMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: isSecurityReject
            ? "⚠️ Tu consulta no pudo ser procesada por contener términos no permitidos o exceder el límite de seguridad."
            : "⚠️ En este momento no pude conectar con el asistente. Por favor intenta de nuevo en unos segundos.",
        },
      ]);
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
                  className="relative flex items-center gap-1.5 sm:gap-2 rounded-xl bg-pink-500/15 px-3 py-2 text-xs font-black text-pink-400 hover:bg-pink-500/25 active:scale-95 transition-all border border-pink-500/30 cursor-pointer shadow-[0_0_15px_rgba(236,72,153,0.15)]"
                  title="Bunzy Co-Pilot & Chats de Clientes"
                >
                  <span className="text-sm">🐰</span>
                  <span className="font-extrabold tracking-wide">Bunzy</span>
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
                <button
                  onClick={async () => {
                    if (isRefreshing) return;
                    setIsRefreshing(true);
                    try {
                      await utils.invalidate();
                      router.refresh();
                    } finally {
                      setTimeout(() => setIsRefreshing(false), 600);
                    }
                  }}
                  disabled={isRefreshing}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all cursor-pointer shrink-0 disabled:opacity-50"
                  title="Refrescar datos (Mac / iPad / Web)"
                  aria-label="Refrescar datos"
                >
                  <RotateCw className={`h-4 w-4 transition-transform ${isRefreshing ? "animate-spin text-pink-400" : ""}`} />
                </button>
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
                  {/* Header con tabs */}
                  <div className="p-4 border-b border-white/10 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/40 flex items-center justify-center text-sm shadow-[0_0_12px_rgba(236,72,153,0.3)]">
                          🐰
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-white m-0">Bunzy Workspace</h3>
                          <p className="text-[11px] text-gray-400 m-0">Co-Pilot Operativo & Mensajería B2C</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setChatDrawerOpen(false)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors border-0 bg-transparent cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Sub-tabs Bunzy Co-Pilot vs Chats Clientes */}
                    <div className="grid grid-cols-2 p-1 bg-black/60 rounded-xl border border-white/10">
                      <button
                        onClick={() => {
                          setDrawerTab("bunzy");
                          setActiveCustomerChat(null);
                        }}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          drawerTab === "bunzy"
                            ? "bg-pink-500 text-white shadow-md shadow-pink-500/25"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <Sparkles size={13} /> Bunzy Co-Pilot
                      </button>
                      <button
                        onClick={() => setDrawerTab("customers")}
                        className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          drawerTab === "customers"
                            ? "bg-pink-500 text-white shadow-md shadow-pink-500/25"
                            : "text-gray-400 hover:text-white"
                        }`}
                      >
                        <MessageSquare size={13} /> Chats Clientes
                      </button>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {drawerTab === "bunzy" && (
                      <div className="flex flex-col h-full justify-between space-y-4">
                        <div className="space-y-3">
                          {bunzyMessages.map((msg, i) => (
                            <div
                              key={i}
                              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                            >
                              <div
                                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                                  msg.role === "user"
                                    ? "bg-pink-600 text-white"
                                    : "bg-white/5 text-gray-200 border border-white/10"
                                }`}
                              >
                                {msg.role === "assistant" && (
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <span className="text-[10px] font-black uppercase text-pink-400 block">
                                      🐰 Bunzy Co-Pilot
                                    </span>
                                    {msg.modelUsed && (
                                      <span className="text-[9px] font-mono text-gray-500 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">
                                        {msg.modelUsed}
                                      </span>
                                    )}
                                  </div>
                                )}
                                <p className="m-0 whitespace-pre-wrap">{msg.text}</p>
                              </div>
                            </div>
                          ))}
                          {bunzyChat.isPending && (
                            <div className="flex justify-start">
                              <div className="rounded-2xl px-4 py-2.5 text-xs bg-white/5 border border-pink-500/30 text-pink-300 flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 animate-spin text-pink-400" />
                                <span>Bunzy está analizando los datos de tu sucursal...</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Quick Navigation Chips to Real Tools */}
                        <div className="pt-3 border-t border-white/10 space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Herramientas Operativas Activas:</p>
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const currentUrl = typeof window !== "undefined" ? window.location.href : "https://rabbitty.me/settings";
                                createStripeLink.mutate({
                                  refreshUrl: currentUrl,
                                  returnUrl: currentUrl,
                                });
                              }}
                              disabled={createStripeLink.isPending}
                              className="px-3 py-2 rounded-xl bg-linear-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 text-white border border-pink-500/30 text-xs font-bold transition-all flex items-center justify-between cursor-pointer"
                            >
                              <span className="flex items-center gap-1.5">
                                <CreditCard size={13} className="text-pink-400" />
                                <span>{createStripeLink.isPending ? "Generando link..." : "💳 Conectar Stripe & Pagos en Mesa"}</span>
                              </span>
                              <span className="text-[10px] text-pink-400 font-mono">Conectar →</span>
                            </button>
                            <Link
                              href="/reports/audit"
                              onClick={() => setChatDrawerOpen(false)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center justify-between no-underline"
                            >
                              <span>🧾 Cuadre de Caja & Auditoría</span>
                              <span className="text-[10px] text-pink-400 font-mono">Verificado →</span>
                            </Link>
                            <Link
                              href="/campaigns"
                              onClick={() => setChatDrawerOpen(false)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center justify-between no-underline"
                            >
                              <span>📍 Radar de Proximidad & Bunz'in</span>
                              <span className="text-[10px] text-emerald-400 font-mono">Abrir →</span>
                            </Link>
                            <Link
                              href="/marketing/mood"
                              onClick={() => setChatDrawerOpen(false)}
                              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 text-xs font-bold transition-all flex items-center justify-between no-underline"
                            >
                              <span>✨ Rabbitty Mood Telemetría</span>
                              <span className="text-[10px] text-purple-400 font-mono">En Vivo →</span>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )}

                    {drawerTab === "customers" && !activeCustomerChat && (
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

                  {/* Input Bar for Bunzy Co-Pilot */}
                  {drawerTab === "bunzy" && (
                    <div className="p-3 border-t border-white/10 bg-black/40">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Pregúntale a Bunzy sobre tu caja, ventas o lealtad..."
                          value={bunzyInput}
                          onChange={(e) => setBunzyInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && bunzyInput.trim() && !bunzyChat.isPending) {
                              const text = bunzyInput.trim();
                              setBunzyInput("");
                              setBunzyMessages((prev) => [...prev, { role: "user", text }]);
                              bunzyChat.mutate({
                                branchId,
                                message: text,
                                mode: "strategist",
                                history: bunzyMessages.slice(-4).map((m) => ({
                                  role: m.role,
                                  content: m.text,
                                })),
                              });
                            }
                          }}
                          disabled={bunzyChat.isPending}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-pink-500 disabled:opacity-50"
                        />
                        <button
                          onClick={() => {
                            if (!bunzyInput.trim() || bunzyChat.isPending) return;
                            const text = bunzyInput.trim();
                            setBunzyInput("");
                            setBunzyMessages((prev) => [...prev, { role: "user", text }]);
                            bunzyChat.mutate({
                              branchId,
                              message: text,
                              mode: "strategist",
                              history: bunzyMessages.slice(-4).map((m) => ({
                                role: m.role,
                                content: m.text,
                              })),
                            });
                          }}
                          disabled={bunzyChat.isPending || !bunzyInput.trim()}
                          className="bg-pink-600 hover:bg-pink-500 disabled:opacity-50 text-white font-bold text-xs px-3.5 py-2 rounded-xl border-none cursor-pointer active:scale-95 transition-transform flex items-center gap-1.5"
                        >
                          <Sparkles size={12} />
                          <span>{bunzyChat.isPending ? "..." : "Consultar"}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Quick Reply Bar for Customer Chat */}
                  {drawerTab === "customers" && activeCustomerChat && (
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
