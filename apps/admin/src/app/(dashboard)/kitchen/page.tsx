"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Input, toast } from "@rabbitty/ui";
import { Printer, Monitor, Clock, Wifi, RefreshCw, ChevronRight } from "lucide-react";

const STATUS_FLOW = ["PENDING", "IN_PROGRESS", "READY"] as const;

export default function KitchenPage() {
  const utils = trpc.useUtils();
  const { data: orders } = trpc.kds.getOrders.useQuery();
  const updateStatus = trpc.kds.updateOrderItemStatus.useMutation({
    onSuccess: () => { utils.kds.getOrders.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [sla, setSla] = useState({ drinks: 5, food: 15, desserts: 8 });
  const [autoCancel, setAutoCancel] = useState(30);

  const activeOrders = orders?.filter((o) =>
    o.items.some((i) => i.status === "PENDING" || i.status === "IN_PROGRESS")
  );

  const nextStatus = (current: string): (typeof STATUS_FLOW)[number] | null => {
    const idx = STATUS_FLOW.indexOf(current as typeof STATUS_FLOW[number]);
    return idx < STATUS_FLOW.length - 1 ? STATUS_FLOW[idx + 1] : null;
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Cocina
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Configuración del KDS y monitoreo de órdenes activas</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => utils.kds.getOrders.invalidate()}>
              <RefreshCw className="h-4 w-4 animate-spin-slow" />
              Refrescar
            </Button>
            <div className="flex items-center gap-2 rounded-xl bg-green-500/10 border border-green-500/20 px-3.5 py-2 text-xs font-bold text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
              <Wifi className="h-4 w-4 animate-pulse" />
              Conectado
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] shrink-0">
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Pantalla KDS</h3>
              <p className="text-xs text-gray-400 mt-0.5">Visualización de órdenes</p>
            </div>
          </div>
          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Órdenes activas</span>
              <span className="font-bold text-white bg-white/5 px-2 py-0.5 rounded border border-white/5 text-xs">{activeOrders?.length ?? 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Items pendientes</span>
              <span className="font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded text-xs">
                {orders?.reduce((s, o) => s + o.items.filter((i) => i.status === "PENDING" || i.status === "pending").length, 0) ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Auto-cancelar después</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={autoCancel}
                  onChange={(e) => setAutoCancel(Number(e.target.value))}
                  className="w-16 text-center rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-sm font-bold text-white focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all duration-300"
                />
                <span className="text-gray-500 text-xs font-semibold">min</span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.15)] shrink-0">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Impresora Virtual</h3>
              <p className="text-xs text-gray-400 mt-0.5">Comandas y tickets</p>
            </div>
          </div>
          <div className="space-y-3.5 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Estado</span>
              <Badge variant="success">En línea</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Formato</span>
              <span className="font-bold text-white">80mm</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Imprimir automático</span>
              <span className="font-bold text-white">Sí</span>
            </div>
          </div>
        </Card>

        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.15)] shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">SLA de Órdenes</h3>
              <p className="text-xs text-gray-400 mt-0.5">Tiempos de preparación</p>
            </div>
          </div>
          <div className="space-y-3.5 text-sm">
            {(["drinks", "food", "desserts"] as const).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-gray-400 capitalize">
                  Meta {key === "drinks" ? "Bebidas" : key === "food" ? "Platillos" : "Postres"}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={sla[key]}
                    onChange={(e) => setSla((s) => ({ ...s, [key]: Number(e.target.value) }))}
                    className="w-16 text-center rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-sm font-bold text-white focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all duration-300"
                  />
                  <span className="text-gray-500 text-xs font-semibold">min</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
        <h3 className="mb-6 font-bold text-xl text-white">Órdenes en preparación</h3>
        {!activeOrders?.length ? (
          <div className="py-10 text-center flex flex-col items-center justify-center">
            <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/5 text-gray-500 flex items-center justify-center mb-3">
              <Monitor className="h-6 w-6" />
            </div>
            <p className="text-sm font-semibold text-gray-400">No hay órdenes activas en cocina</p>
            <p className="text-xs text-gray-600 mt-1">Los pedidos de los meseros o el POS aparecerán aquí.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {activeOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-white/5 bg-white/5 p-5 hover:border-white/10 hover:bg-white/10 transition-all duration-300">
                <div className="mb-4 pb-3 border-b border-white/5 flex items-center justify-between">
                  <span className="font-black text-lg text-white">Mesa {order.tableNumber}</span>
                  <span className="text-xs text-gray-400 bg-white/5 px-2 py-0.5 rounded font-mono">
                    {order.createdAt && new Date(order.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="space-y-3">
                  {order.items.map((item) => {
                    const next = nextStatus(item.status);
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm py-0.5 border-b border-white/5 last:border-b-0 last:pb-0 pb-2">
                        <span className="text-gray-200 font-semibold">
                          {item.quantity}x {item.name}
                        </span>
                        <button
                          onClick={() => {
                            if (!next) return;
                            updateStatus.mutate({ orderItemId: item.id, status: next });
                          }}
                          disabled={!next}
                          className="flex items-center gap-1.5 group hover:scale-105 active:scale-95 transition-all duration-200"
                        >
                          <Badge
                            variant={
                              item.status === "READY" || item.status === "ready"
                                ? "success"
                                : item.status === "IN_PROGRESS" || item.status === "preparing"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {item.status === "READY" || item.status === "ready"
                              ? "Listo"
                              : item.status === "IN_PROGRESS" || item.status === "preparing"
                                ? "Preparando"
                                : "Pendiente"}
                          </Badge>
                          {next && <ChevronRight className="h-4 w-4 text-gray-500 group-hover:text-white transition-colors" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
