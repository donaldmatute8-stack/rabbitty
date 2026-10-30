"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@rabbitty/ui";
import { 
  LayoutDashboard, 
  Banknote,
  Store, 
  Users, 
  Settings, 
  ChefHat, 
  ClipboardList, 
  Package, 
  Printer, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Sparkles, 
  Clock, 
  Salad, 
  Truck, 
  Receipt,
  CreditCard,
  ReceiptText, 
  CalendarCheck, 
  DollarSign, 
  Monitor, 
  Award, 
  Gift, 
  Megaphone, 
  Cake, 
  Repeat, 
  QrCode, 
  BookUser, 
  Table2, 
  Webhook, 
  UserRound, 
  LogOut,
  Zap,
  UtensilsCrossed,
  TrendingUp,
  TabletSmartphone,
  TerminalSquare,
  Crown,
  Scale,
  Rocket,
  Gamepad2,
  ShieldCheck,
  Activity,
  Brain,
  FlaskConical,
  Compass,
  BookOpen,
  MessageSquarePlus,
  Ticket,
} from "lucide-react";
import { useSidebar } from "./DashboardClientWrapper";
import { AdminFeedbackModal } from "./AdminFeedbackModal";

type MenuItem = {
  href: string;
  label: string;
  icon: any;
  badge?: string;
};

type MenuPillar = {
  id: string;
  title: string;
  icon: any;
  items: MenuItem[];
};

// Mapeo de href de menú → módulo de negocio (settings). Los href sin módulo
// (Dashboard, Settings, Sucursales, etc.) siempre se muestran para no dejar al
// usuario sin forma de re-activar módulos desde Configuración.
const MODULE_BY_HREF: Record<string, string> = {
  "/sandbox": "sandbox",
  "/kitchen": "kitchen",
  "/staff/shifts": "staff",
  "/table-layout": "table_layout",
  "/reservations": "reservations",
  "/menu": "menu",
  "/recipes": "recipes",
  "/inventory": "inventory",
  "/suppliers": "suppliers",
  "/expenses": "expenses",
  "/pricing": "pricing",
  "/menu-boards": "menu_boards",
  "/loyalty": "loyalty",
  "/marketing/audiences": "customers",
  "/marketing/referrals": "referrals",
  "/marketing/campaigns": "campaigns",
  "/marketing/mood": "campaigns",
  "/marketing/atmosphere": "campaigns",
  "/marketing/automations/birthdays": "birthdays",
  "/catering": "catering",
  "/staff": "staff",
  "/hardware": "hardware",
  "/marketing/qr": "qr",
};

const MODULES_STORAGE_KEY = "rabbitty_active_modules";
const MODULES_CHANGED_EVENT = "rabbitty-modules-changed";

const readActiveModules = (): Set<string> | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MODULES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed);
  } catch {
    // localStorage corrupto o bloqueado — mostrar todo el menú
  }
  return null;
};


// ── GOD MODE: navegación adaptada al God Admin (solo si la sesión es allowlist + 2FA) ──
const godPillars: MenuPillar[] = [
  {
    id: "god_platform",
    title: "👑 God · Plataforma",
    icon: Crown,
    items: [
      { href: "/", label: "Resumen Operativo", icon: LayoutDashboard },
      { href: "/god", label: "Centro de Mando God", icon: Crown, badge: "Hub" },
      { href: "/god/tenants", label: "Tenants & Vista Prueba", icon: Store },
    ],
  },
  {
    id: "god_treasury",
    title: "🏦 God · Tesorería",
    icon: Banknote,
    items: [
      { href: "/loyalty", label: "Split & Deuda Bunz", icon: Award },
      { href: "/god/conciliaciones", label: "Conciliaciones", icon: Scale },
      { href: "/god/economia", label: "Economía & Ledger", icon: Scale },
    ],
  },
  {
    id: "god_growth",
    title: "📊 God · Ecosistema",
    icon: TrendingUp,
    items: [
      { href: "/god/ecosistema", label: "Métricas Investor", icon: Activity },
      { href: "/god/escalado", label: "Estado de Escalado", icon: Rocket },
      { href: "/god/gamificacion", label: "Gamificación Global", icon: Gamepad2 },
    ],
  },
  {
    id: "god_settings",
    title: "⚙️ God · Sistema",
    icon: Settings,
    items: [
      { href: "/settings", label: "Ajustes & Seguridad", icon: Settings },
    ],
  },
];

// Detecta (en cliente) si la sesión actual es God Admin con 2FA verificada
function useGodMode() {
  const [godMode, setGodMode] = useState<{ isGod: boolean; impersonating: string | null }>({ isGod: false, impersonating: null });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [twoFa, imp] = await Promise.all([
          fetch("/api/auth/2fa/verify").then((r) => r.json()),
          fetch("/api/admin/impersonate").then((r) => r.json()),
        ]);
        if (cancelled) return;
        setGodMode({
          isGod: Boolean(twoFa?.required && twoFa?.verified),
          impersonating: imp?.impersonating?.businessName ?? null,
        });
      } catch {
        // sin sesión / sin red — vista normal
      }
    })();
    return () => { cancelled = true; };
  }, []);
  return godMode;
}

const menuPillars: MenuPillar[] = [
  {
    id: "operation",
    title: "Operación En Vivo",
    icon: Zap,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/demo", label: "Recorrido Virtual", icon: Compass, badge: "Tour" },
      { href: "/sandbox", label: "Modo Sandbox", icon: FlaskConical, badge: "Test" },
      { href: "/strategy", label: "Estrategia Bunzy", icon: Brain, badge: "IA" },
      { href: "/kitchen", label: "Cocina / KDS", icon: ChefHat },
      { href: "/staff/shifts", label: "Turnos y Reloj", icon: Clock },
      { href: "/table-layout", label: "Mapa de Mesas", icon: Table2 },
      { href: "/reservations", label: "Reservaciones", icon: BookUser },
      { href: "/reports", label: "Reportes & Ingresos", icon: TrendingUp },
      { href: "/reports/audit", label: "Cuadre & Auditoría", icon: ReceiptText, badge: "PDF" },
      { href: "/cash-shifts", label: "Turnos de Caja", icon: Banknote },
      { href: "/refunds", label: "Reembolsos & Pagos", icon: Repeat },
    ],
  },
  {
    id: "menu_stock",
    title: "Carta & Productos",
    icon: UtensilsCrossed,
    items: [
      { href: "/menu", label: "Platillos & Menú", icon: ClipboardList },
      { href: "/recipes", label: "Recetas & Costos", icon: Salad },
      { href: "/inventory", label: "Inventario & Stock", icon: Package },
      { href: "/suppliers", label: "Proveedores", icon: Truck },
      { href: "/expenses", label: "Gastos Operativos", icon: Receipt },
      { href: "/pricing", label: "Precios Dinámicos", icon: DollarSign },
      { href: "/menu-boards", label: "Menú Digital TV", icon: Monitor },
    ],
  },
  {
    id: "growth",
    title: "Lealtad & Membresías",
    icon: Award,
    items: [
      { href: "/loyalty", label: "Cashback Bunz", icon: Award },
      { href: "/memberships", label: "Membresías & Planes", icon: Ticket, badge: "Nuevo" },
      { href: "/conciliaciones", label: "Conciliaciones", icon: Scale },
      { href: "/catering", label: "Eventos & Catering", icon: CalendarCheck },
      { href: "/academy", label: "Guías & Academy", icon: BookOpen, badge: "Docs" },
      { href: "/operations-manual", label: "Manual Operativo & Caja", icon: BookOpen, badge: "PDF" },
    ],
  },
  {
    id: "settings",
    title: "Configuración",
    icon: Settings,
    items: [
      { href: "/restaurants", label: "Mis Sucursales & Afiliados", icon: Store },
      { href: "/settings?tab=payments", label: "Pasarela & Stripe Connect", icon: CreditCard, badge: "Pay" },
      { href: "/staff", label: "Personal & Roles", icon: Users },
      { href: "/hardware", label: "Impresoras & Hardware", icon: Printer },
      { href: "/restaurant-sync", label: "Sincronización POS", icon: Webhook },
      { href: "/settings", label: "Ajustes del Sistema", icon: Settings },
    ],
  },
];

// ── MARKETING STUDIO: Espacio dedicado de crecimiento, contenido y audiencias ──
const marketingPillars: MenuPillar[] = [
  {
    id: "mkt_overview",
    title: "🚀 Marketing Studio",
    icon: Megaphone,
    items: [
      { href: "/marketing", label: "Overview de Marketing", icon: LayoutDashboard, badge: "Hub" },
      { href: "/marketing/campaigns", label: "Campañas & Promociones", icon: Megaphone },
      { href: "/marketing/referrals", label: "Red de Referidos & Hops", icon: Gift },
    ],
  },
  {
    id: "mkt_content",
    title: "✨ Content & Mood Studio",
    icon: Sparkles,
    items: [
      { href: "/marketing/mood", label: "Rabbitty Mood & Telemetría", icon: Sparkles, badge: "IA" },
      { href: "/marketing/atmosphere", label: "Atmósfera & PoA", icon: Compass, badge: "V2.0" },
    ],
  },
  {
    id: "mkt_audience",
    title: "🎯 Audiencias & Automatización",
    icon: UserRound,
    items: [
      { href: "/marketing/audiences", label: "Audiencias & Rabbitters", icon: UserRound },
      { href: "/marketing/automations/birthdays", label: "Cumpleaños Automáticos", icon: Cake },
    ],
  },
  {
    id: "mkt_presence",
    title: "🖨️ Presencia Digital & Print",
    icon: QrCode,
    items: [
      { href: "/marketing/qr", label: "Códigos QR & Mesas", icon: QrCode },
      { href: "https://www.rabbitty.me/impresos", label: "Print Center · Impresos", icon: Printer, badge: "PDF" },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();
  const { isGod, impersonating } = useGodMode();
  // En God Mode el sidebar muestra la navegación God; con 1 clic alterna a la vista afiliado.
  const [sidebarView, setSidebarView] = useState<"god" | "affiliate">("god");
  const [workspaceArea, setWorkspaceArea] = useState<"operation" | "marketing">(() =>
    pathname.startsWith("/marketing") ? "marketing" : "operation"
  );

  useEffect(() => {
    if (pathname.startsWith("/marketing")) {
      setWorkspaceArea("marketing");
    }
  }, [pathname]);

  const effectiveView: "god" | "affiliate" = impersonating ? "affiliate" : isGod ? sidebarView : "affiliate";
  const pillarsToRender =
    effectiveView === "god"
      ? godPillars
      : workspaceArea === "marketing"
      ? marketingPillars
      : menuPillars;

  // Módulos activos desde settings. null = sin configuración previa → todo visible.
  const [activeModules, setActiveModules] = useState<Set<string> | null>(readActiveModules);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { modules?: string[] } | undefined;
      if (detail?.modules) setActiveModules(new Set(detail.modules));
    };
    window.addEventListener(MODULES_CHANGED_EVENT, handler);
    return () => window.removeEventListener(MODULES_CHANGED_EVENT, handler);
  }, []);

  const visibleItems = (pillar: MenuPillar) =>
    activeModules
      ? pillar.items.filter((i) => {
          const mod = MODULE_BY_HREF[i.href];
          return !mod || activeModules.has(mod);
        })
      : pillar.items;

  // Keep all pillars open by default for quick access, user can toggle
  const [openPillars, setOpenPillars] = useState<Record<string, boolean>>({
    operation: true,
    menu_stock: true,
    growth: true,
    settings: false,
    mkt_overview: true,
    mkt_content: true,
    mkt_audience: true,
    mkt_presence: true,
    god_platform: true,
    god_treasury: true,
    god_growth: true,
    god_settings: false,
  });

  // Auto-expand pillar if current pathname is inside it
  useEffect(() => {
    setOpenPillars((prev) => {
      let newState = { ...prev };
      let changed = false;
      for (const pillar of [...menuPillars, ...marketingPillars]) {
        if (pillar.items.some((i) => pathname.startsWith(i.href))) {
          if (!newState[pillar.id]) {
            newState[pillar.id] = true;
            changed = true;
          }
        }
      }
      return changed ? newState : prev;
    });
  }, [pathname]);

  const togglePillar = (id: string) => {
    if (isCollapsed) return;
    setOpenPillars((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<"BUG" | "FEEDBACK">("BUG");

  const openFeedback = (type: "BUG" | "FEEDBACK") => {
    setFeedbackType(type);
    setFeedbackOpen(true);
  };

  // Toggle God Mode ↔ Vista Afiliado (solo para God Admin, fuera de impersonación)
  const showGodToggle = isGod && !impersonating;
  const godToggle = (
    <button
      type="button"
      onClick={() => setSidebarView((v) => (v === "god" ? "affiliate" : "god"))}
      className={cn(
        "w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer border",
        effectiveView === "god"
          ? "bg-linear-to-r from-amber-500/20 to-pink-500/20 border-amber-500/40 text-amber-300 hover:from-amber-500/30 hover:to-pink-500/30"
          : "bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
      )}
      title={effectiveView === "god" ? "Cambiar a Vista Afiliado (Ka13 y páginas operativas)" : "Volver a God Mode"}
    >
      <Crown className="h-3.5 w-3.5" />
      {effectiveView === "god" ? "God Mode" : "Vista Afiliado"}
    </button>
  );

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
    } catch {
      // ignore
    }
    window.location.href = "/login";
  };

  return (
    <aside className={cn(
      "relative flex h-screen flex-col border-r border-white/5 bg-black/80 backdrop-blur-2xl text-white z-20 transition-all duration-300 ease-in-out select-none shrink-0",
      // Desktop: inline, collapses to icon rail
      // Tablet/Drawer: always w-72, controlled by parent translate
      "lg:relative lg:translate-x-0",
      isCollapsed ? "w-20" : "w-72"
    )}>
      {/* Brand Section */}
      <div className={cn(
        "flex items-center border-b border-white/5 py-5 transition-all duration-300",
        isCollapsed ? "px-3 flex-col gap-3 justify-center" : "px-5 justify-between"
      )}>
        <div className="flex items-center gap-3">
          <img 
            src="/Ra.png" 
            alt="Rabbitty Logo" 
            className="h-9 w-9 object-contain drop-shadow-[0_0_12px_rgba(236,72,153,0.4)] shrink-0" 
          />
          {!isCollapsed && (
            <div>
              <h1 className="text-base font-black tracking-wider bg-clip-text text-transparent bg-linear-to-r from-white via-gray-200 to-gray-400">
                RABBITTY
              </h1>
              <p className="text-[9px] uppercase tracking-widest text-pink-500 font-extrabold">
                Admin Portal
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-400 hover:bg-pink-500/20 hover:text-pink-400 hover:border-pink-500/30 transition-all cursor-pointer"
          title={isCollapsed ? "Expandir Menú" : "Colapsar Menú"}
        >
          {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {showGodToggle && !isCollapsed && (
        <div className="px-3 pt-3">{godToggle}</div>
      )}
      {showGodToggle && isCollapsed && (
        <div className="flex justify-center pt-3">
          <button
            type="button"
            onClick={() => setSidebarView((v) => (v === "god" ? "affiliate" : "god"))}
            className={cn(
              "rounded-xl p-2 border transition-all cursor-pointer",
              effectiveView === "god"
                ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                : "bg-white/5 border-white/10 text-gray-300"
            )}
            title={effectiveView === "god" ? "God Mode (clic: Vista Afiliado)" : "Vista Afiliado (clic: God Mode)"}
          >
            <Crown className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Workspace Switcher: Operación (Affiliates) ↔ Marketing Studio */}
      {effectiveView === "affiliate" && !isCollapsed && (
        <div className="px-3 pt-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/5 p-1 border border-white/10">
            <Link
              href="/"
              onClick={() => setWorkspaceArea("operation")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-extrabold transition-all no-underline",
                workspaceArea === "operation"
                  ? "bg-white/15 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              <Store className="h-3.5 w-3.5" />
              Operación
            </Link>
            <Link
              href="/marketing"
              onClick={() => setWorkspaceArea("marketing")}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-extrabold transition-all no-underline",
                workspaceArea === "marketing"
                  ? "bg-linear-to-r from-pink-500/30 to-purple-500/30 text-pink-200 border border-pink-500/30 shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              )}
            >
              <Megaphone className="h-3.5 w-3.5" />
              Marketing
            </Link>
          </div>
        </div>
      )}
      {effectiveView === "affiliate" && isCollapsed && (
        <div className="flex justify-center pt-3">
          <Link
            href={workspaceArea === "marketing" ? "/" : "/marketing"}
            onClick={() => setWorkspaceArea((w) => (w === "marketing" ? "operation" : "marketing"))}
            className={cn(
              "rounded-xl p-2 border transition-all no-underline",
              workspaceArea === "marketing"
                ? "bg-pink-500/20 border-pink-500/40 text-pink-300"
                : "bg-white/5 border-white/10 text-gray-300"
            )}
            title={workspaceArea === "marketing" ? "Marketing Studio (clic: ir a Operación)" : "Operación (clic: ir a Marketing Studio)"}
          >
            {workspaceArea === "marketing" ? <Megaphone className="h-4 w-4" /> : <Store className="h-4 w-4" />}
          </Link>
        </div>
      )}

      {/* Navigation Pillars */}
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto custom-scrollbar">
        {pillarsToRender.map((pillar) => {
          const items = visibleItems(pillar);
          if (items.length === 0) return null;
          const PillarIcon = pillar.icon;
          const isOpen = openPillars[pillar.id];
          const hasActiveItem = items.some((i) => i.href === pathname);

          return (
            <div key={pillar.id} className="space-y-1">
              {/* Pillar Header (Hidden when collapsed) */}
              {!isCollapsed ? (
                <button
                  onClick={() => togglePillar(pillar.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer",
                    hasActiveItem ? "text-pink-400 bg-pink-500/10" : "text-gray-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <PillarIcon className={cn("h-4 w-4", hasActiveItem ? "text-pink-400" : "text-gray-400")} />
                    <span>{pillar.title}</span>
                  </div>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen ? "transform rotate-0" : "transform -rotate-90")} />
                </button>
              ) : (
                <div className="h-px bg-white/10 my-2" />
              )}

              {/* Pillar Sub-items */}
              {(isOpen || isCollapsed) && (
                <div className="space-y-1 pl-1">
                  {pillar.items.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname.startsWith(href);
                    const mod = MODULE_BY_HREF[href];
                    if (activeModules && mod && !activeModules.has(mod)) return null;
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "group flex items-center rounded-xl py-2.5 text-xs font-semibold transition-all duration-200 relative border-l-2",
                          isCollapsed ? "justify-center px-0 border-l-0" : "px-3.5 border-l-2",
                          isActive
                            ? isCollapsed
                              ? "bg-linear-to-r from-pink-500/20 to-purple-500/10 text-pink-400 shadow-[inset_0_0_12px_rgba(236,72,153,0.15)]"
                              : "bg-linear-to-r from-pink-500/20 to-purple-500/10 text-pink-300 border-pink-500 shadow-[inset_0_0_12px_rgba(236,72,153,0.15)] font-bold"
                            : "text-gray-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/20"
                        )}
                      >
                        <Icon className={cn(
                          "h-4 w-4 transition-transform duration-200 group-hover:scale-110 shrink-0", 
                          isActive ? "text-pink-400" : "text-gray-400 group-hover:text-white"
                        )} />

                        {!isCollapsed && <span className="ml-3 truncate">{label}</span>}

                        {!isCollapsed && isActive && (
                          <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899]" />
                        )}

                        {/* Hover Tooltip when Collapsed */}
                        {isCollapsed && (
                          <span className="absolute left-16 scale-0 group-hover:scale-100 rounded-xl bg-neutral-900 border border-white/10 px-3 py-2 text-xs font-bold text-white shadow-2xl backdrop-blur-md transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
                            {label}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer & Logout */}
      <div className="border-t border-white/5 p-3 space-y-1.5 bg-black/40">
        {/* Support & Feedback Section (Unificado) */}
        <button
          onClick={() => openFeedback("FEEDBACK")}
          className={cn(
            "group flex w-full items-center rounded-xl py-2 text-xs font-semibold text-purple-300/90 hover:text-purple-200 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all duration-200 cursor-pointer relative",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110 text-purple-400" />
          {!isCollapsed && <span className="ml-3 truncate">Report a bug / Feedback</span>}
          {isCollapsed && (
            <span className="absolute left-16 scale-0 group-hover:scale-100 rounded-xl bg-neutral-900 border border-purple-500/30 px-3 py-2 text-xs font-bold text-purple-200 shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
              Report a bug / Feedback
            </span>
          )}
        </button>

        <div className="h-px bg-white/5 my-1" />

        <button
          onClick={handleLogout}
          className={cn(
            "group flex w-full items-center rounded-xl py-2 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200 cursor-pointer relative",
            isCollapsed ? "justify-center px-0" : "px-3"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-x-0.5" />
          {!isCollapsed && <span className="ml-3 whitespace-nowrap">Cerrar Sesión</span>}
          {isCollapsed && (
            <span className="absolute left-16 scale-0 group-hover:scale-100 rounded-xl bg-red-950 border border-red-500/20 px-3 py-2 text-xs font-bold text-red-300 shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
              Cerrar Sesión
            </span>
          )}
        </button>

        <div className="text-center text-[10px] tracking-wider text-gray-500 font-semibold uppercase whitespace-nowrap overflow-hidden">
          {isCollapsed ? "v1.0" : "Rabbitty OS v1.0"}
        </div>
      </div>

      <AdminFeedbackModal
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        initialType={feedbackType}
      />
    </aside>
  );
}
