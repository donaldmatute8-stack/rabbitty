"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@rabbitty/ui";
import { LayoutDashboard, Store, Users, Settings, ChefHat, ClipboardList, Package, Printer, ChevronLeft, ChevronRight } from "lucide-react";
import { useSidebar } from "./DashboardClientWrapper";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/restaurants", label: "Restaurantes", icon: Store },
  { href: "/menu", label: "Menú", icon: ClipboardList },
  { href: "/staff", label: "Personal", icon: Users },
  { href: "/kitchen", label: "Cocina", icon: ChefHat },
  { href: "/inventory", label: "Inventario", icon: Package },
  { href: "/hardware", label: "Hardware y Guías", icon: Printer },
  { href: "/settings", label: "Configuración", icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  return (
    <aside className={cn(
      "relative flex h-screen flex-col border-r border-white/5 bg-black/45 backdrop-blur-xl text-white z-20 transition-all duration-300 ease-in-out",
      isCollapsed ? "w-20" : "w-64"
    )}>
      {/* Brand Section */}
      <div className={cn(
        "flex items-center border-b border-white/5 py-6 transition-all duration-300",
        isCollapsed ? "px-4 flex-col gap-4 justify-center" : "px-6 justify-between"
      )}>
        <div className="flex items-center gap-3">
          <img 
            src="/Ra.png" 
            alt="Rabbitty Logo" 
            className="h-10 w-10 object-contain drop-shadow-[0_0_10px_rgba(236,72,153,0.3)] shrink-0" 
          />
          {!isCollapsed && (
            <div>
              <h1 className="text-lg font-black tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
                RABBITTY
              </h1>
              <p className="text-[10px] uppercase tracking-widest text-pink-500 font-bold">
                Admin Portal
              </p>
            </div>
          )}
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
        >
          {isCollapsed ? <ChevronRight className="h-4.5 w-4.5" /> : <ChevronLeft className="h-4.5 w-4.5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1.5 px-3 py-6 overflow-y-auto">
        {links.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center rounded-xl py-3 text-sm font-semibold transition-all duration-300 relative border-l-4",
                isCollapsed ? "justify-center px-0 border-l-0" : "px-4 border-l-4",
                isActive
                  ? isCollapsed 
                    ? "bg-gradient-to-r from-pink-500/10 to-purple-500/5 text-pink-400 shadow-[inset_0_0_12px_rgba(236,72,153,0.08)]"
                    : "bg-gradient-to-r from-pink-500/10 to-purple-500/5 text-pink-400 border-pink-500 shadow-[inset_0_0_12px_rgba(236,72,153,0.08)]"
                  : "text-gray-400 hover:text-white hover:bg-white/5 border-transparent hover:border-white/10"
              )}
            >
              <Icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110 shrink-0", isActive ? "text-pink-500" : "text-gray-400 group-hover:text-white")} />
              
              {!isCollapsed && <span className="ml-3 transition-opacity duration-300 whitespace-nowrap">{label}</span>}
              
              {!isCollapsed && isActive && (
                <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899]" />
              )}

              {/* Custom CSS Hover Tooltip for collapsed state */}
              {isCollapsed && (
                <span className="absolute left-20 scale-0 group-hover:scale-100 rounded-xl bg-neutral-900 border border-white/10 px-3 py-2 text-xs font-bold text-white shadow-xl backdrop-blur-md transition-all duration-200 pointer-events-none z-50 whitespace-nowrap">
                  {label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer Branding */}
      <div className="border-t border-white/5 p-4 text-center text-[10px] tracking-wider text-gray-500 font-semibold uppercase whitespace-nowrap overflow-hidden">
        {isCollapsed ? "v1.0" : "Rabbitty v1.0"}
      </div>
    </aside>
  );
}
