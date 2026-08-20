"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@rabbitty/ui";
import { 
  LayoutDashboard, 
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
  Brain
} from "lucide-react";
import { useSidebar } from "./DashboardClientWrapper";

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
  "/customers": "customers",
  "/referrals": "referrals",
  "/campaigns": "campaigns",
  "/birthdays": "birthdays",
  "/catering": "catering",
  "/staff": "staff",
  "/hardware": "hardware",
  "/qr-generator": "qr",
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

const menuPillars: MenuPillar[] = [
  {
    id: "operation",
    title: "Operación En Vivo",
    icon: Zap,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/strategy", label: "Estrategia Hermes", icon: Brain, badge: "IA" },
      { href: "/kitchen", label: "Cocina / KDS", icon: ChefHat },
      { href: "/staff/shifts", label: "Turnos y Reloj", icon: Clock },
      { href: "/table-layout", label: "Mapa de Mesas", icon: Table2 },
      { href: "/reservations", label: "Reservaciones", icon: BookUser },
      { href: "/refunds", label: "Reembolsos", icon: Repeat },
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
    title: "Crecimiento & Lealtad",
    icon: TrendingUp,
    items: [
      { href: "/loyalty", label: "Cashback Bunz", icon: Award },
      { href: "/customers", label: "Clientes Rabbitters", icon: UserRound },
      { href: "/referrals", label: "Red de Referidos", icon: Gift },
      { href: "/campaigns", label: "Campañas", icon: Megaphone },
      { href: "/birthdays", label: "Cumpleaños", icon: Cake },
      { href: "/catering", label: "Eventos & Catering", icon: CalendarCheck },
    ],
  },
  {
    id: "settings",
    title: "Configuración",
    icon: Settings,
    items: [
      { href: "/restaurants", label: "Mis Sucursales", icon: Store },
      { href: "/staff", label: "Personal & Roles", icon: Users },
      { href: "/hardware", label: "Impresoras & Hardware", icon: Printer },
      { href: "/qr-generator", label: "Códigos QR", icon: QrCode },
      { href: "/restaurant-sync", label: "Sincronización POS", icon: Webhook },
      { href: "/settings", label: "Ajustes del Sistema", icon: Settings },
    ],
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();

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
  });

  const togglePillar = (id: string) => {
    if (isCollapsed) return;
    setOpenPillars((prev) => ({ ...prev, [id]: !prev[id] }));
  };

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
      "relative flex h-screen flex-col border-r border-white/5 bg-black/60 backdrop-blur-2xl text-white z-20 transition-all duration-300 ease-in-out select-none",
      isCollapsed ? "w-20" : "w-64"
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
              <h1 className="text-base font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-400">
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

      {/* Navigation Pillars */}
      <nav className="flex-1 space-y-4 px-3 py-4 overflow-y-auto custom-scrollbar">
        {menuPillars.map((pillar) => {
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
                    const isActive = pathname === href;
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
                              ? "bg-gradient-to-r from-pink-500/20 to-purple-500/10 text-pink-400 shadow-[inset_0_0_12px_rgba(236,72,153,0.15)]"
                              : "bg-gradient-to-r from-pink-500/20 to-purple-500/10 text-pink-300 border-pink-500 shadow-[inset_0_0_12px_rgba(236,72,153,0.15)] font-bold"
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
      <div className="border-t border-white/5 p-3 space-y-2 bg-black/40">
        
        {/* Quick Access Apps */}
        <Link
          href="/pos"
          target="_blank"
          className={cn(
            "group flex w-full items-center rounded-xl py-2.5 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-200 cursor-pointer relative",
            isCollapsed ? "justify-center px-0" : "px-3.5"
          )}
        >
          <TerminalSquare className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
          {!isCollapsed && <span className="ml-3 whitespace-nowrap">Caja POS</span>}
          {isCollapsed && (
            <span className="absolute left-16 scale-0 group-hover:scale-100 rounded-xl bg-cyan-950 border border-cyan-500/20 px-3 py-2 text-xs font-bold text-cyan-300 shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
              Abrir Caja POS
            </span>
          )}
        </Link>
        <Link
          href="/kiosk"
          target="_blank"
          className={cn(
            "group flex w-full items-center rounded-xl py-2.5 text-xs font-bold text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 border border-transparent hover:border-purple-500/20 transition-all duration-200 cursor-pointer relative",
            isCollapsed ? "justify-center px-0" : "px-3.5"
          )}
        >
          <TabletSmartphone className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110" />
          {!isCollapsed && <span className="ml-3 whitespace-nowrap">Kiosko iPad</span>}
          {isCollapsed && (
            <span className="absolute left-16 scale-0 group-hover:scale-100 rounded-xl bg-purple-950 border border-purple-500/20 px-3 py-2 text-xs font-bold text-purple-300 shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
              Abrir Kiosko iPad
            </span>
          )}
        </Link>

        <div className="h-px w-full bg-white/5 my-1" />

        <button
          onClick={handleLogout}
          className={cn(
            "group flex w-full items-center rounded-xl py-2.5 text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all duration-200 cursor-pointer relative",
            isCollapsed ? "justify-center px-0" : "px-3.5"
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
    </aside>
  );
}
