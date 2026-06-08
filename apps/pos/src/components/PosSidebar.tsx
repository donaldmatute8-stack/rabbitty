"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@rabbitty/ui";
import { LayoutGrid, UtensilsCrossed, ClipboardList, Clock, LogOut } from "lucide-react";

const links = [
  { href: "/", label: "Mesas", icon: LayoutGrid },
  { href: "/menu", label: "Menú", icon: UtensilsCrossed },
  { href: "/orders", label: "Órdenes", icon: ClipboardList },
  { href: "/history", label: "Historial", icon: Clock },
];

export function PosSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white">
      <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-lg font-black text-white">
          R
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Rabbitty</h1>
          <p className="text-xs text-gray-500">POS Restaurante</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
              pathname === href
                ? "bg-pink-50 text-pink-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-100 p-3">
        <button className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700">
          <LogOut className="h-5 w-5" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
