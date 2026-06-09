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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Cocina</h1>
          <p className="text-sm text-gray-500">Configuración del KDS y órdenes activas</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => utils.kds.getOrders.invalidate()}>
            <RefreshCw className="h-4 w-4" />
            Refrescar
          </Button>
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700">
            <Wifi className="h-4 w-4" />
            Conectado
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Monitor className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Pantalla KDS</h3>
              <p className="text-xs text-gray-500">Visualización de órdenes</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Órdenes activas</span>
              <span className="font-semibold text-gray-900">{activeOrders?.length ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Items pendientes</span>
              <span className="font-semibold text-amber-600">
                {orders?.reduce((s, o) => s + o.items.filter((i) => i.status === "pending").length, 0) ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">Auto-cancelar después</span>
              <Input
                type="number"
                value={autoCancel}
                onChange={(e) => setAutoCancel(Number(e.target.value))}
                className="!w-20 text-center"
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <Printer className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Impresora Virtual</h3>
              <p className="text-xs text-gray-500">Comandas y tickets</p>
            </div>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Estado</span>
              <Badge variant="success">En línea</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Formato</span>
              <span className="font-semibold text-gray-900">80mm</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Imprimir automático</span>
              <span className="font-semibold text-gray-900">Sí</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100">
              <Clock className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">SLA de Órdenes</h3>
              <p className="text-xs text-gray-500">Tiempos de preparación</p>
            </div>
          </div>
          <div className="space-y-3 text-sm">
            {(["drinks", "food", "desserts"] as const).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-gray-500 capitalize">
                  Meta {key === "drinks" ? "Bebidas" : key === "food" ? "Platillos" : "Postres"}
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={sla[key]}
                    onChange={(e) => setSla((s) => ({ ...s, [key]: Number(e.target.value) }))}
                    className="!w-20 text-center"
                  />
                  <span className="text-gray-400">min</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="mb-4 font-semibold text-gray-900">Órdenes en preparación</h3>
        {!activeOrders?.length ? (
          <p className="text-sm text-gray-400">No hay órdenes activas en cocina</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeOrders.map((order) => (
              <div key={order.id} className="rounded-xl border border-gray-200 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-bold text-gray-900">Mesa {order.tableNumber}</span>
                  <span className="text-xs text-gray-400">
                    {order.createdAt && new Date(order.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <div className="space-y-1">
                  {order.items.map((item) => {
                    const next = nextStatus(item.status);
                    return (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">
                          {item.quantity}x {item.name}
                        </span>
                        <button
                          onClick={() => {
                            if (!next) return;
                            updateStatus.mutate({ orderItemId: item.id, status: next });
                          }}
                          className="flex items-center gap-1"
                        >
                          <Badge
                            variant={
                              item.status === "ready"
                                ? "success"
                                : item.status === "preparing"
                                  ? "warning"
                                  : "default"
                            }
                          >
                            {item.status === "ready"
                              ? "Listo"
                              : item.status === "preparing"
                                ? "Preparando"
                                : "Pendiente"}
                          </Badge>
                          {next && <ChevronRight className="h-3 w-3 text-gray-300" />}
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
