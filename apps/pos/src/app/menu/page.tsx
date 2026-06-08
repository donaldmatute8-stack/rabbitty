"use client";

import { trpc } from "../../lib/trpc-client";
import { PosSidebar } from "../../components/PosSidebar";
import { useState } from "react";
import { cn } from "@rabbitty/ui";
import { Search } from "lucide-react";

export default function MenuPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: categories } = trpc.pos.getCategories.useQuery();
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery(selectedCategory ? { categoryId: selectedCategory } : {});

  const filtered = menuItems?.filter(
    (item) => !search || item.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex h-screen">
      <PosSidebar />
      <main className="flex flex-1 flex-col">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Menú</h2>
              <p className="text-sm text-gray-500">Explora y administra el menú</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none focus:border-pink-300 focus:ring-2 focus:ring-pink-100"
              />
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                !selectedCategory ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              Todos
            </button>
            {categories?.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={cn(
                  "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                  selectedCategory === cat.name
                    ? "bg-pink-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
               >
                 {cat.name}
               </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!filtered ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-100 bg-white p-4 transition-all hover:shadow-sm"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-pink-50 text-2xl">
                    🍽
                  </div>
                  <h3 className="mt-3 font-semibold text-gray-900">{item.name}</h3>
                  {item.description && (
                    <p className="mt-1 text-xs text-gray-400 line-clamp-2">{item.description}</p>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-lg font-bold text-gray-900">${item.price.toFixed(2)}</span>
                    {!item.isAvailable && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                        Agotado
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
