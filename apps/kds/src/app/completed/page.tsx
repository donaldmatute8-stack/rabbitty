"use client";

import { trpc } from "../../lib/trpc-client";
import { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, Calendar } from "lucide-react";

export default function CompletedOrdersPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const { data: orders } = trpc.kds.getOrders.useQuery();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ from: todayStr, to: todayStr });

  const completedOrders = useMemo(() => {
    const completed = (orders ?? []).filter((order) =>
      order.items.every((item) => item.status === "SERVED")
    );

    return completed;
  }, [orders]);

  const todayOrders = useMemo(() => {
    return (orders ?? []).filter((order) => {
      if (!order.createdAt) return false;
      const createdAt = new Date(order.createdAt).toISOString().slice(0, 10);
      return createdAt === todayStr && order.items.every((i) => i.status === "SERVED");
    });
  }, [orders, todayStr]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-600 text-lg font-black">
            R
          </div>
          <h1 className="text-xl font-bold">Órdenes Completadas</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-white/5 px-4 py-2 text-right">
            <p className="text-xs text-gray-400">Hoy</p>
            <p className="text-lg font-bold">{todayOrders.length} completadas</p>
          </div>
        </div>
      </header>

      <div className="flex items-center gap-3 border-b border-white/10 px-6 py-3">
        <Calendar className="h-4 w-4 text-gray-400" />
        <input
          type="date"
          value={dateRange.from}
          onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
        />
        <span className="text-gray-500">a</span>
        <input
          type="date"
          value={dateRange.to}
          onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
        />
        <span className="text-sm text-gray-400">
          {completedOrders.length} resultados
        </span>
      </div>

      <main className="flex-1 overflow-y-auto p-6">
        {completedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-gray-400">Sin resultados</p>
            <p className="mt-1 text-sm text-gray-500">
              No hay órdenes completadas en este rango
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-2">
            {completedOrders.map((order) => (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                <button
                  onClick={() =>
                    setExpandedId(expandedId === order.id ? null : order.id)
                  }
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-semibold text-gray-200">
                        Mesa {order.tableNumber}
                      </span>
                      <p className="text-xs text-gray-500">
                        {order.createdAt && new Date(order.createdAt).toLocaleString("es-MX", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-gray-400">
                      {order.items.length} items
                    </span>
                    {expandedId === order.id ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </button>

                {expandedId === order.id && (
                  <div className="border-t border-white/10 px-5 py-3">
                    <div className="space-y-1.5">
                      {order.items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-300">
                              {item.quantity}x
                            </span>
                            <span className="text-gray-400">{item.name}</span>
                          </div>
                          <span className="text-xs text-green-400">
                            {item.status === "served" ? "Servido" : item.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
