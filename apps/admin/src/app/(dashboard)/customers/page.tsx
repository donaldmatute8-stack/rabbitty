"use client";

import { trpc } from "../../../lib/trpc-client";
import { useState, useMemo } from "react";
import { Users, ShoppingBag, TrendingUp, ChevronDown, ChevronUp, Award, Phone, Calendar, Search, ShieldCheck } from "lucide-react";
import { Card, Input } from "@rabbitty/ui";

interface Customer {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  lastVisit: string;
  tier: "Bronce" | "Plata" | "Oro" | "Diamante";
  tierColor: string;
  avatar: string;
}

export default function CustomerHistoryPage() {
  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const { data: tables } = trpc.pos.getTables.useQuery();
  const [searchTerm, setSearchTerm] = useState("");

  const customers = useMemo<Customer[]>(() => {
    if (!orders || !tables) return [];

    const customerMap = new Map<string, Customer>();

    orders.forEach((order) => {
      if (!order.customerName && !order.customerPhone) return;

      const key = (order.customerPhone || order.customerName || "") as string;
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          id: key,
          name: order.customerName || "Cliente Registrado",
          phone: order.customerPhone || "N/A",
          totalOrders: 0,
          totalSpent: 0,
          lastVisit: "",
          tier: "Bronce",
          tierColor: "text-amber-700 border-amber-700/30 bg-amber-900/20",
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${key}`,
        });
      }

      const customer = customerMap.get(key)!;
      customer.totalOrders += 1;
      customer.totalSpent += order.total;
      if (order.createdAt) {
        customer.lastVisit = new Date(order.createdAt).toLocaleDateString("es-MX");
      }

      // Assign dynamic tier based on spent / frequency
      if (customer.totalSpent > 3000) {
        customer.tier = "Diamante";
        customer.tierColor = "text-cyan-400 border-cyan-500/30 bg-cyan-950/40";
      } else if (customer.totalSpent > 1500) {
        customer.tier = "Oro";
        customer.tierColor = "text-amber-400 border-amber-500/30 bg-amber-950/40";
      } else if (customer.totalSpent > 500) {
        customer.tier = "Plata";
        customer.tierColor = "text-slate-300 border-slate-400/30 bg-slate-800/40";
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [orders, tables]);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;
    const q = searchTerm.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q) || c.tier.toLowerCase().includes(q)
    );
  }, [customers, searchTerm]);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const totalSpent = customers.reduce((sum, c) => sum + c.totalSpent, 0);
    const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
    const avgOrder = totalOrders > 0 ? totalSpent / totalOrders : 0;

    return { totalCustomers, totalSpent, totalOrders, avgOrder };
  }, [customers]);

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
            <Users className="h-3.5 w-3.5" /> Rabbitter CRM
          </span>
          <h1 className="text-3xl font-black text-white mt-1">Directorio de Clientes & Rabbitters</h1>
          <p className="text-sm text-gray-400">Consulta el historial de consumos, nivel de lealtad y frecuencia de tus comensales.</p>
        </div>
      </div>

      {/* Stats Header */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{stats.totalCustomers}</p>
              <p className="text-xs font-semibold text-gray-400">Clientes Identificados</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-emerald-400">${stats.totalSpent.toFixed(2)}</p>
              <p className="text-xs font-semibold text-gray-400">Consumo Acumulado</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShoppingBag className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{stats.totalOrders}</p>
              <p className="text-xs font-semibold text-gray-400">Visitas Totales</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Award className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">${stats.avgOrder.toFixed(2)}</p>
              <p className="text-xs font-semibold text-gray-400">Ticket Promedio</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Table */}
      <Card className="border border-white/5 bg-white/5 p-6 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o nivel (ej. Oro, Diamante)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/40 pl-10 pr-4 py-2.5 text-xs text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
            />
          </div>
          <span className="text-xs font-bold text-gray-400">{filteredCustomers.length} Rabbitters</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/40">
          <div className="grid grid-cols-12 gap-4 border-b border-white/10 bg-white/5 px-6 py-3.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
            <div className="col-span-4">Cliente / Rabbitter</div>
            <div className="col-span-2">Nivel de Lealtad</div>
            <div className="col-span-2 text-center">Visitas</div>
            <div className="col-span-2 text-right">Consumo Total</div>
            <div className="col-span-2 text-right">Última Visita</div>
          </div>

          <div className="divide-y divide-white/5">
            {filteredCustomers.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-500">
                No se encontraron clientes registrados con los datos ingresados.
              </div>
            ) : (
              filteredCustomers.map((customer) => (
                <div key={customer.id} className="transition-all hover:bg-white/5">
                  <div
                    onClick={() => setExpandedId(expandedId === customer.id ? null : customer.id)}
                    className="grid grid-cols-12 gap-4 items-center px-6 py-4 cursor-pointer text-xs"
                  >
                    <div className="col-span-4 flex items-center gap-3">
                      <img src={customer.avatar} alt={customer.name} className="h-9 w-9 rounded-xl bg-pink-500/10 border border-white/10 p-1 shrink-0" />
                      <div>
                        <p className="font-bold text-white text-sm">{customer.name}</p>
                        <p className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-pink-500" /> {customer.phone || "Sin teléfono"}
                        </p>
                      </div>
                    </div>

                    <div className="col-span-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold border ${customer.tierColor}`}>
                        <ShieldCheck className="h-3 w-3" /> {customer.tier}
                      </span>
                    </div>

                    <div className="col-span-2 text-center font-bold text-white">
                      {customer.totalOrders} {customer.totalOrders === 1 ? "visita" : "visitas"}
                    </div>

                    <div className="col-span-2 text-right font-black text-emerald-400 text-sm">
                      ${customer.totalSpent.toFixed(2)}
                    </div>

                    <div className="col-span-2 text-right flex items-center justify-end gap-2 text-gray-400">
                      <span>{customer.lastVisit || "Hoy"}</span>
                      {expandedId === customer.id ? <ChevronUp className="h-4 w-4 text-pink-400" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
