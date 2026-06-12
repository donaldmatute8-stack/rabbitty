"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@rabbitty/ui";
import { LayoutDashboard, Store, Users, Settings, ChefHat, ClipboardList, Package, Printer } from "lucide-react";

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

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="flex items-center gap-3 border-b border-[var(--border-subtle)] px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--rabbitty-pink)] text-lg font-black text-white">
          R
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">Rabbitty</h1>
          <p className="text-xs text-[var(--text-muted)]">Admin Panel</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200",
              pathname === href
                ? "bg-[rgba(233,30,99,0.08)] text-[var(--rabbitty-pink)]"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-[var(--border-subtle)] p-3 text-center text-xs text-[var(--text-muted)]">
        Rabbitty v1.0
      </div>
    </aside>
  );
}
