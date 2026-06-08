"use client";

import { trpc } from "../../lib/trpc-client";
import { PosSidebar } from "../../components/PosSidebar";
import { Badge } from "@rabbitty/ui";

export default function HistoryPage() {
  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const paidOrders = orders?.filter((o) => o.status === "paid") ?? [];
  const totalToday = paidOrders.reduce((sum, o) => sum + o.total, 0);

  return (
    <div className="flex h-screen">
      <PosSidebar />
      <main className="flex flex-1 flex-col">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Historial</h2>
              <p className="text-sm text-gray-500">Órdenes pagadas hoy</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-gray-900">${totalToday.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Total del día</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {paidOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-lg font-medium text-gray-500">Sin ventas hoy</p>
              <p className="mt-1 text-sm text-gray-400">Las órdenes pagadas aparecerán aquí</p>
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-2">
              {paidOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-5 py-4"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="font-semibold text-gray-900">Orden #{order.id.slice(0, 8)}</span>
                      <p className="text-xs text-gray-400">
                        {order.createdAt && new Date(order.createdAt).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant="success">Pagada</Badge>
                  </div>
                  <span className="text-lg font-bold text-gray-900">${order.total.toFixed(2)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between rounded-2xl bg-gray-900 px-5 py-4 text-white">
                <span className="font-semibold">Total del día</span>
                <span className="text-xl font-black">${totalToday.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
