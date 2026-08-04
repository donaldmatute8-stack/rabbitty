"use client";

import { use, useEffect, useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Utensils, Sparkles, Clock, MapPin } from "lucide-react";

export default function TVMenuBoardPage({ params }: { params: Promise<{ branchId: string }> }) {
  const resolvedParams = use(params);
  const branchId = resolvedParams.branchId ?? "b1";

  const [currentTime, setCurrentTime] = useState("");
  const { data: categories } = trpc.pos.getCategories.useQuery(undefined, { retry: false });
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery({}, { retry: false });

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white p-8 flex flex-col justify-between select-none overflow-hidden relative font-sans">
      {/* Background Neon Glow Effects */}
      <div className="absolute top-[-20%] left-[-10%] h-[600px] w-[600px] rounded-full bg-pink-600/15 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-purple-600/15 blur-[140px] pointer-events-none" />

      {/* Header TV */}
      <header className="relative z-10 flex items-center justify-between border-b border-white/10 pb-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 shadow-[0_0_25px_rgba(236,72,153,0.4)]">
            <Utensils className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-100 to-pink-400">
              Menú Digital
            </h1>
            <p className="text-sm font-semibold text-gray-400 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pink-400 animate-pulse" />
              Precios y Platillos en Tiempo Real
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 backdrop-blur-xl flex items-center gap-3">
            <Clock className="h-5 w-5 text-pink-400" />
            <span className="text-2xl font-black tracking-wider text-white">{currentTime || "12:00"}</span>
          </div>
        </div>
      </header>

      {/* Main Grid Categories & Items */}
      <main className="relative z-10 flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 overflow-hidden">
        {(!categories || categories.length === 0) ? (
          <div className="col-span-full flex flex-col items-center justify-center py-24 text-center border border-white/5 rounded-3xl bg-white/5 backdrop-blur-md">
            <Utensils className="h-16 w-16 text-pink-500/40 mb-4 animate-bounce" />
            <h2 className="text-2xl font-bold text-white">Menú en Configuración</h2>
            <p className="text-sm text-gray-400 mt-2">Agrega platillos desde tu panel de administración para desplegarlos en pantalla.</p>
          </div>
        ) : (
          categories.map((cat) => {
            const items = menuItems?.filter((item) => item.categoryId === cat.id) ?? [];
            if (items.length === 0) return null;

            return (
              <div key={cat.id} className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl flex flex-col justify-start">
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 border-b border-white/10 pb-3 mb-4 flex items-center justify-between">
                  <span>{cat.name}</span>
                  <span className="text-xs font-bold text-gray-400 bg-white/10 px-2.5 py-1 rounded-full">{items.length} items</span>
                </h3>

                <div className="space-y-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div>
                        <p className="font-bold text-white text-base">{item.name}</p>
                        {item.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{item.description}</p>}
                      </div>
                      <span className="text-lg font-black text-emerald-400 ml-4 font-mono">${Number(item.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* TV Footer Bar */}
      <footer className="relative z-10 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-semibold text-gray-400">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Sincronizado con Rabbitty Protocol</span>
        </div>
        <div>
          <span>Escanea y gana Bunz en cada consumo</span>
        </div>
      </footer>
    </div>
  );
}
