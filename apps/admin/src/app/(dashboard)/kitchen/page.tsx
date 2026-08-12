"use client";

import { useState, useMemo, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Button, cn } from "@rabbitty/ui";
import { Printer, Monitor, Clock, Wifi, RefreshCw, ChevronRight, CheckCircle2, Flame, Layers } from "lucide-react";

const STATUS_FLOW = ["PENDING", "IN_PROGRESS", "READY"] as const;

export default function KitchenPage() {
  const utils = trpc.useUtils();
  const { data: orders } = trpc.kds.getOrders.useQuery(undefined, { refetchInterval: 10000 });
  const updateStatus = trpc.kds.updateOrderItemStatus.useMutation({
    onSuccess: () => { utils.kds.getOrders.invalidate(); }
  });

  const [viewMode, setViewMode] = useState<"kanban" | "grouped">("kanban");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000); // refresh every 30s for timers
    return () => clearInterval(timer);
  }, []);

  const activeOrders = useMemo(() => {
    return orders?.filter((o) =>
      o.items.some((i) => i.status === "PENDING" || i.status === "IN_PROGRESS")
    ) || [];
  }, [orders]);

  // Thermic color calculation based on minutes passed
  const getThermicColor = (createdAt: string) => {
    const mins = (now - new Date(createdAt).getTime()) / 60000;
    if (mins < 5) return "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]"; // Green
    if (mins < 12) return "bg-orange-500/10 border-orange-500/30 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.1)]"; // Orange
    return "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)] animate-pulse"; // Red
  };

  const getTimeElapsed = (createdAt: string) => {
    const mins = Math.floor((now - new Date(createdAt).getTime()) / 60000);
    return `${mins}m`;
  };

  // Grouped items
  const groupedItems = useMemo(() => {
    const groups: Record<string, { count: number, name: string, oldest: string }> = {};
    activeOrders.forEach(o => {
      o.items.forEach(i => {
        if (i.status !== "READY") {
          if (!groups[i.menuItemId]) groups[i.menuItemId] = { count: 0, name: i.name || "Platillo", oldest: o.createdAt as string };
          groups[i.menuItemId].count += i.quantity;
          if (new Date(o.createdAt as string) < new Date(groups[i.menuItemId].oldest)) {
            groups[i.menuItemId].oldest = o.createdAt as string;
          }
        }
      });
    });
    return Object.values(groups).sort((a, b) => b.count - a.count);
  }, [activeOrders]);

  return (
    <div className="space-y-6 pb-10">
      
      {/* ── KDS Header ── */}
      <div className="relative overflow-hidden rounded-[2rem] border border-white/5 bg-gradient-to-br from-gray-900/80 to-black p-8 shadow-2xl backdrop-blur-2xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-orange-500/10 blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-orange-500/20 border border-orange-500/30 text-orange-400 shadow-[0_0_30px_rgba(249,115,22,0.2)]">
              <Flame className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tight text-white">Cocina KDS</h1>
              <p className="text-gray-400 mt-1 font-medium">Display térmico de órdenes en vivo</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* View Mode Toggle */}
            <div className="flex rounded-xl bg-black border border-white/10 p-1">
              <button 
                onClick={() => setViewMode("kanban")}
                className={cn("px-4 py-2 rounded-lg text-sm font-bold transition-all", viewMode === "kanban" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white")}
              >
                Tickets Kanban
              </button>
              <button 
                onClick={() => setViewMode("grouped")}
                className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all", viewMode === "grouped" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white")}
              >
                <Layers className="h-4 w-4" /> Agrupados
              </button>
            </div>

            <button onClick={() => utils.kds.getOrders.invalidate()} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-gray-300">
              <RefreshCw className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 text-sm font-bold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <Wifi className="h-4 w-4 animate-pulse" /> Sincronizado
            </div>
          </div>
        </div>
      </div>

      {/* ── View: Grouped by Item ── */}
      {viewMode === "grouped" && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {groupedItems.map((group, i) => (
            <div key={i} className="flex flex-col items-center justify-center gap-3 rounded-[2rem] bg-gray-900 border border-white/5 p-6 shadow-xl">
              <div className="text-6xl font-black text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">{group.count}</div>
              <div className="text-center font-bold text-gray-300 leading-tight">{group.name}</div>
              <div className={cn("mt-2 rounded-full px-3 py-1 text-xs font-bold border", getThermicColor(group.oldest))}>
                <Clock className="inline-block h-3 w-3 mr-1 mb-0.5" />
                Más antiguo: {getTimeElapsed(group.oldest)}
              </div>
            </div>
          ))}
          {groupedItems.length === 0 && (
            <div className="col-span-full py-20 text-center text-gray-500 font-bold text-xl">No hay platillos pendientes.</div>
          )}
        </div>
      )}

      {/* ── View: Kanban Tickets ── */}
      {viewMode === "kanban" && (
        <div className="flex gap-6 overflow-x-auto pb-4 custom-scrollbar">
          {activeOrders.map((order) => {
            const thermicClass = getThermicColor(order.createdAt as string);
            
            return (
              <div key={order.id} className={cn("flex w-80 shrink-0 flex-col rounded-[2rem] border bg-gray-950 shadow-2xl overflow-hidden transition-all", thermicClass)}>
                {/* Ticket Header */}
                <div className="flex items-center justify-between border-b border-inherit bg-black/40 p-5">
                  <div>
                    <h3 className="text-xl font-black">
                      Mesa {order.tableNumber || order.tableId || "Llevar"}
                    </h3>
                    <p className="text-xs font-bold opacity-70 uppercase tracking-widest mt-1">Ticket #{order.id.slice(0,4)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg bg-black/50 px-2.5 py-1.5 text-sm font-black border border-inherit">
                    <Clock className="h-4 w-4" /> {getTimeElapsed(order.createdAt as string)}
                  </div>
                </div>

                {/* Ticket Items */}
                <div className="flex-1 p-5 space-y-4">
                  {order.items.map((item) => {
                    const isDone = item.status === "READY";
                    return (
                      <div key={item.id} className={cn("group flex items-start gap-3 rounded-xl p-3 transition-all", isDone ? "opacity-30" : "bg-black/30 border border-white/5 hover:border-white/20")}>
                        <div className="mt-0.5 text-lg font-black">{item.quantity}</div>
                        <div className="flex-1">
                          <div className={cn("font-bold text-white", isDone && "line-through")}>{item.name}</div>
                          {!!item.modifiers && Object.keys(item.modifiers as object).length > 0 && (
                            <div className="mt-1 text-xs font-bold text-orange-300">
                              Modificadores aplicados
                            </div>
                          )}
                          {item.notes && (
                            <div className="mt-1 text-xs italic text-gray-400">"{item.notes}"</div>
                          )}
                        </div>
                        {!isDone && (
                          <button 
                            onClick={() => updateStatus.mutate({ orderItemId: item.id, status: "READY" })}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 hover:bg-emerald-500 hover:text-black transition-all"
                          >
                            <CheckCircle2 className="h-6 w-6" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {/* Mark All Ready */}
                <button 
                  onClick={() => {
                    order.items.forEach(i => {
                      if (i.status !== "READY") updateStatus.mutate({ orderItemId: i.id, status: "READY" });
                    });
                  }}
                  className="w-full bg-black/50 p-4 text-sm font-bold uppercase tracking-widest hover:bg-white/10 transition-all border-t border-inherit"
                >
                  Marcar Ticket Listo
                </button>
              </div>
            );
          })}
          {activeOrders.length === 0 && (
            <div className="flex w-full items-center justify-center py-32 text-gray-500 font-bold text-2xl">
              ¡La cocina está limpia! No hay órdenes activas.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
