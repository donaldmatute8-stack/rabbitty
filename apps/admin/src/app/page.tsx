"use client";

import { trpc } from "../lib/trpc-client";
import { AdminSidebar } from "../components/AdminSidebar";
import { Card, cn } from "@rabbitty/ui";
import { TrendingUp, DollarSign, ShoppingCart, Users, UtensilsCrossed, Clock } from "lucide-react";

export default function AdminPage() {
  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const { data: tables } = trpc.pos.getTables.useQuery();

  const openOrders = orders?.filter((o) => o.status === "PENDING" || o.status === "OPEN") ?? [];
  const paidOrders = orders?.filter((o) => o.status === "PAID") ?? [];
  const occupiedTables = tables ?? [];
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);

  const stats = [
    { label: "Ventas hoy", value: `$${totalRevenue.toFixed(2)}`, icon: DollarSign, color: "bg-emerald-500" },
    { label: "Órdenes activas", value: openOrders.length, icon: ShoppingCart, color: "bg-amber-500" },
    { label: "Mesas ocupadas", value: `${occupiedTables.length}/${tables?.length ?? 0}`, icon: UtensilsCrossed, color: "bg-blue-500" },
    { label: "Órdenes pagadas", value: paidOrders.length, icon: TrendingUp, color: "bg-pink-500" },
  ];

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex flex-1 flex-col">
        <div className="border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500">Resumen del {new Date().toLocaleDateString("es-MX")}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="flex items-center gap-4 p-5">
                  <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", stat.color)}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                    <p className="text-sm text-gray-500">{stat.label}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Órdenes activas</h3>
              {openOrders.length === 0 ? (
                <p className="text-sm text-gray-400">Sin órdenes activas</p>
              ) : (
                <div className="space-y-3">
                  {openOrders.slice(0, 5).map((order) => (
                    <div key={order.id} className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-gray-900">                    Mesa #{order.id.slice(0, 8)}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(order.createdAt ?? new Date()).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <span className="font-bold text-amber-700">${order.total.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="mb-4 font-semibold text-gray-900">Resumen de mesas</h3>
              {!tables ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-10 animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {tables.map((table) => (
                    <div
                      key={table.id}
                       className={cn(
                         "rounded-xl p-3 text-center text-sm font-semibold bg-gray-50 text-gray-700"
                      )}
                    >
                      {table.number}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
