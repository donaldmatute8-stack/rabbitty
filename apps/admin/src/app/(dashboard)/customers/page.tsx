"use client";

import { trpc } from "../../../lib/trpc-client";
import { useState, useMemo } from "react";
import { Users, ShoppingBag, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastVisit: string;
  avatar: string;
}

export default function CustomerHistoryPage() {
  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const { data: tables } = trpc.pos.getTables.useQuery();

  const customers = useMemo<Customer[]>(() => {
    if (!orders || !tables) return [];

    const customerMap = new Map<string, Customer>();

    orders.forEach((order) => {
      if (!order.customerName && !order.customerPhone) return;

      const key = (order.customerPhone || order.customerName || "") as string;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: key,
          name: order.customerName || "Sin nombre",
          phone: order.customerPhone || "",
          totalOrders: 0,
          totalSpent: 0,
          lastVisit: "",
          avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${key}`,
        });
      }

      const customer = customerMap.get(key)!;
      customer.totalOrders += 1;
      customer.totalSpent += order.total;
      if (order.createdAt) {
        customer.lastVisit = new Date(order.createdAt).toLocaleDateString("es-MX");
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders, tables]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
    const avgOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;

    return { totalCustomers, totalSpent, totalOrders, avgOrder };
  }, [customers]);

  const tableMap = useMemo(() => {
    if (!tables) return new Map<string, any>();
    return new Map(tables.map((t) => [t.id, t]));
  }, [tables]);

  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-gray-200 bg-white px-6 py-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Historial de Clientes</h2>
          <p className="text-sm text-gray-500">
            Visitas, compras y gastos por Rabbitter
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Total Clientes</span>
                <Users className="h-5 w-5 text-pink-500" />
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalCustomers}
              </div>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Total Vendido</span>
                <ShoppingBag className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-2xl font-bold text-green-600">
                ${stats.totalSpent.toFixed(2)}
              </div>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Órdenes Totales</span>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalOrders}
              </div>
            </div>

            <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">Promedio Orden</span>
                <ShoppingBag className="h-5 w-5 text-yellow-500" />
              </div>
              <div className="text-2xl font-bold text-yellow-600">
                ${stats.avgOrder.toFixed(2)}
              </div>
            </div>
          </div>

          {/* Customers List */}
          <div className="space-y-2">
            {customers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Users className="mb-4 h-16 w-16 text-gray-300" />
                <p className="text-lg font-medium text-gray-500">
                  Sin clientes registrados
                </p>
                <p className="mt-1 text-sm text-gray-400">
                  Las compras aparecerán aquí
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-6 py-3">
                  <span className="text-sm font-semibold text-gray-600">
                    {customers.length} clientes
                  </span>
                  <span className="text-sm text-gray-400">|</span>
                  <span className="text-sm text-gray-500">
                    ${stats.totalSpent.toFixed(2)} vendidos
                  </span>
                </div>

                <div className="divide-y divide-gray-100">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <button
                        onClick={() =>
                          setExpandedId(
                            expandedId === customer.id ? null : customer.id
                          )
                        }
                        className="flex w-full items-center justify-between px-6 py-4 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-lg">
                            {customer.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900">
                              {customer.name}
                            </p>
                            <p className="text-sm text-gray-500">
                              {customer.phone}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm font-bold text-gray-900">
                              ${customer.totalSpent.toFixed(2)}
                            </p>
                            <p className="text-xs text-gray-500">
                              {customer.totalOrders} órdenes
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-500">
                              Última: {customer.lastVisit}
                            </p>
                          </div>
                          {expandedId === customer.id ? (
                            <ChevronUp className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {expandedId === customer.id && (
                        <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-4">
                          <p className="mb-3 text-xs font-semibold text-gray-400 uppercase">
                            Historial de Órdenes
                          </p>
                          <div className="space-y-2">
                            {orders?.filter(
                              (o) =>
                                o.customerName === customer.name ||
                                o.customerPhone === customer.phone
                            )
                              .slice(0, 5)
                              .map((order) => {
                                const table = tableMap.get(order.tableId || "");
                                return (
                                  <div
                                    key={order.id}
                                    className="flex items-center justify-between rounded-lg bg-white px-4 py-2 shadow-sm"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center">
                                        <span className="text-sm font-bold text-gray-600">
                                          {table?.number || "Takeout"}
                                        </span>
                                      </div>
                                      <div>
                                        <p className="text-sm font-medium text-gray-900">
                                          {order.orderType === "DINE_IN"
                                            ? "Mesa"
                                            : order.orderType === "TAKEOUT"
                                            ? "Para llevar"
                                            : "Delivery"}
                                        </p>
                                         <p className="text-xs text-gray-500">
                                           {order.createdAt && new Date(order.createdAt).toLocaleString(
                                             "es-MX",
                                             { hour: "2-digit", minute: "2-digit" }
                                           )}
                                         </p>
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-sm font-bold text-gray-900">
                                        ${order.total.toFixed(2)}
                                      </p>
                                      <span
                                        className={`text-xs ${
                                          order.status === "PAID"
                                            ? "text-green-500"
                                            : order.status === "CANCELLED"
                                            ? "text-red-500"
                                            : "text-yellow-500"
                                        }`}
                                      >
                                        {order.status}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                           </div>
                           {orders && orders.filter(
                             (o) =>
                               o.customerName === customer.name ||
                               o.customerPhone === customer.phone
                           ).length > 5 && (
                             <p className="mt-3 text-center text-sm text-gray-400">
                               ...y {orders.filter((o) => o.customerName === customer.name || o.customerPhone === customer.phone).length - 5} más
                             </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
