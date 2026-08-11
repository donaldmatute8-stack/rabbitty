"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Search, 
  LayoutDashboard, 
  Store, 
  Users, 
  Settings, 
  ChefHat, 
  ClipboardList, 
  Package, 
  Printer, 
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
  Command,
  X
} from "lucide-react";
import { cn } from "@rabbitty/ui";

type CommandItem = {
  id: string;
  label: string;
  category: "⚡ Operación En Vivo" | "🍔 Carta & Productos" | "🚀 Crecimiento & Lealtad" | "⚙️ Configuración del Negocio";
  href: string;
  icon: any;
  keywords?: string[];
};

const commands: CommandItem[] = [
  // ⚡ Operación En Vivo
  { id: "dashboard", label: "Dashboard Principal", category: "⚡ Operación En Vivo", href: "/", icon: LayoutDashboard, keywords: ["inicio", "resumen", "ventas", "métricas"] },
  { id: "kitchen", label: "Cocina / KDS", category: "⚡ Operación En Vivo", href: "/kitchen", icon: ChefHat, keywords: ["comandas", "pedidos", "preparación"] },
  { id: "shifts", label: "Turnos y Asistencia", category: "⚡ Operación En Vivo", href: "/staff/shifts", icon: Clock, keywords: ["horarios", "reloj", "asistencia", "checkin"] },
  { id: "tables", label: "Mapa de Mesas", category: "⚡ Operación En Vivo", href: "/table-layout", icon: Table2, keywords: ["salón", "distribución", "mesas"] },
  { id: "reservations", label: "Reservaciones", category: "⚡ Operación En Vivo", href: "/reservations", icon: BookUser, keywords: ["citas", "reservas", "clientes"] },
  { id: "refunds", label: "Reembolsos", category: "⚡ Operación En Vivo", href: "/refunds", icon: Repeat, keywords: ["devolución", "cancelación"] },

  // 🍔 Carta & Productos
  { id: "menu", label: "Platillos y Menú", category: "🍔 Carta & Productos", href: "/menu", icon: ClipboardList, keywords: ["carta", "productos", "comida", "bebidas", "categorías"] },
  { id: "recipes", label: "Recetas y Escandallos", category: "🍔 Carta & Productos", href: "/recipes", icon: Salad, keywords: ["ingredientes", "costos", "escandallo"] },
  { id: "inventory", label: "Inventario y Stock", category: "🍔 Carta & Productos", href: "/inventory", icon: Package, keywords: ["insumos", "almacén", "existencias"] },
  { id: "suppliers", label: "Proveedores", category: "🍔 Carta & Productos", href: "/suppliers", icon: Truck, keywords: ["compras", "proveedor", "contactos"] },
  { id: "expenses", label: "Gastos Operativos", category: "🍔 Carta & Productos", href: "/expenses", icon: Receipt, keywords: ["egresos", "compras", "pagos"] },
  { id: "pricing", label: "Precios Dinámicos", category: "🍔 Carta & Productos", href: "/pricing", icon: DollarSign, keywords: ["descuentos", "happy hour", "tarifas"] },
  { id: "menu-boards", label: "Menú Digital TV", category: "🍔 Carta & Productos", href: "/menu-boards", icon: Monitor, keywords: ["pantalla", "tv", "cartelera"] },

  // 🚀 Crecimiento & Lealtad
  { id: "loyalty", label: "Cashback Bunz & Lealtad", category: "🚀 Crecimiento & Lealtad", href: "/loyalty", icon: Award, keywords: ["puntos", "recompensas", "regalos"] },
  { id: "customers", label: "Directorio de Clientes", category: "🚀 Crecimiento & Lealtad", href: "/customers", icon: UserRound, keywords: ["rabbitters", "usuarios", "crm"] },
  { id: "referrals", label: "Red de Referidos", category: "🚀 Crecimiento & Lealtad", href: "/referrals", icon: Gift, keywords: ["invitaciones", "comisiones", "hops"] },
  { id: "campaigns", label: "Campañas de Marketing", category: "🚀 Crecimiento & Lealtad", href: "/campaigns", icon: Megaphone, keywords: ["anuncios", "promociones", "push"] },
  { id: "birthdays", label: "Cumpleaños", category: "🚀 Crecimiento & Lealtad", href: "/birthdays", icon: Cake, keywords: ["festejos", "promos"] },
  { id: "catering", label: "Eventos & Catering", category: "🚀 Crecimiento & Lealtad", href: "/catering", icon: CalendarCheck, keywords: ["banquetes", "privados"] },

  // ⚙️ Configuración del Negocio
  { id: "restaurants", label: "Mis Sucursales", category: "⚙️ Configuración del Negocio", href: "/restaurants", icon: Store, keywords: ["locales", "dirección"] },
  { id: "staff", label: "Personal y Roles", category: "⚙️ Configuración del Negocio", href: "/staff", icon: Users, keywords: ["equipo", "empleados", "permisos", "pin"] },
  { id: "hardware", label: "Impresoras & POS", category: "⚙️ Configuración del Negocio", href: "/hardware", icon: Printer, keywords: ["tickets", "impresora", "kds"] },
  { id: "qr-generator", label: "Generador de QR", category: "⚙️ Configuración del Negocio", href: "/qr-generator", icon: QrCode, keywords: ["mesa qr", "escaneo"] },
  { id: "sync", label: "Sincronización", category: "⚙️ Configuración del Negocio", href: "/restaurant-sync", icon: Webhook, keywords: ["integraciones", "api"] },
  { id: "settings", label: "Configuración General", category: "⚙️ Configuración del Negocio", href: "/settings", icon: Settings, keywords: ["ajustes", "perfil", "sistema"] },
];

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const filteredCommands = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q) ||
      cmd.keywords?.some((k) => k.toLowerCase().includes(q))
    );
  });

  const handleSelect = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDownModal = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        handleSelect(filteredCommands[selectedIndex].href);
      }
    }
  };

  return (
    <>
      {/* Search trigger button for top bar */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-gray-400 hover:border-pink-500/30 hover:bg-white/10 hover:text-white transition-all shadow-inner cursor-pointer"
      >
        <Search className="h-4 w-4 text-pink-500" />
        <span className="hidden md:inline font-medium">Buscar comando o sección...</span>
        <span className="inline md:hidden font-medium">Buscar...</span>
        <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-white/10 bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-gray-400">
          <Command className="h-3 w-3" /> K
        </kbd>
      </button>

      {/* Modal Backdrop & Dialog */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div 
            className="w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl shadow-pink-500/10 transition-all"
            onKeyDown={handleKeyDownModal}
          >
            {/* Header / Input */}
            <div className="flex items-center border-b border-white/10 px-4 py-3 bg-black/40">
              <Search className="h-5 w-5 text-pink-500 shrink-0 mr-3" />
              <input
                autoFocus
                type="text"
                placeholder="Escribe para buscar (ej. Inventario, Recetas, Turnos...)"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
              />
              <button 
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
              {filteredCommands.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-500">
                  No se encontraron resultados para "<span className="text-white">{query}</span>"
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      onClick={() => handleSelect(cmd.href)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        "w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-left text-sm transition-all cursor-pointer",
                        isSelected
                          ? "bg-gradient-to-r from-pink-500/20 to-purple-500/10 text-white border border-pink-500/30"
                          : "text-gray-300 hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-2 rounded-lg border", isSelected ? "border-pink-500/40 bg-pink-500/20 text-pink-400" : "border-white/5 bg-white/5 text-gray-400")}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{cmd.label}</p>
                          <p className="text-[11px] text-gray-400">{cmd.category}</p>
                        </div>
                      </div>
                      <span className="text-xs text-pink-400 font-semibold opacity-0 group-hover:opacity-100">
                        Ir ↵
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer tips */}
            <div className="flex items-center justify-between border-t border-white/5 bg-black/40 px-4 py-2 text-[11px] text-gray-500 font-medium">
              <div className="flex items-center gap-3">
                <span><kbd className="rounded bg-white/10 px-1 font-mono text-gray-300">↑↓</kbd> Navegar</span>
                <span><kbd className="rounded bg-white/10 px-1 font-mono text-gray-300">↵</kbd> Seleccionar</span>
                <span><kbd className="rounded bg-white/10 px-1 font-mono text-gray-300">esc</kbd> Cerrar</span>
              </div>
              <span className="text-pink-500/80 font-bold">Rabbitty Cmd+K</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
