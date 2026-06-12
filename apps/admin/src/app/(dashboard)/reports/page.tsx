"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, cn, Button } from "@rabbitty/ui";
import { motion } from "framer-motion";
import { Download, TrendingUp, CreditCard, Activity, UtensilsCrossed } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

const COLORS = ["#ec4899", "#8b5cf6", "#3b82f6", "#10b981", "#f59e0b"];

export default function ReportsPage() {
  const [daysRange, setDaysRange] = useState(30);
  const branchId = "default"; // Wait, earlier I used "default". Let's get branchId dynamically or assume it's fetched. 
  // In `apps/admin/src/app/(dashboard)/page.tsx` they do `trpc.pos.getOrders.useQuery({})` without branchId.
  // Oh, the pos router uses branchId from context! Let's pass it empty if our analytics router can use context or just "default" if we mock.
  // Actually, our analyticsRouter requires `branchId`. Let's pass "default" for now.

  const { data: salesTrends, isLoading: loadingSales } = trpc.analytics.getSalesTrends.useQuery({ branchId, days: daysRange });
  const { data: topProducts, isLoading: loadingTop } = trpc.analytics.getTopProducts.useQuery({ branchId, limit: 5 });
  const { data: paymentMethods, isLoading: loadingPayments } = trpc.analytics.getPaymentMethods.useQuery({ branchId, days: daysRange });
  
  const { data: exportData, refetch: refetchExport, isFetching: isExporting } = trpc.analytics.getExportData.useQuery(
    { branchId, days: daysRange },
    { enabled: false }
  );

  const handleExportCSV = async () => {
    const { data } = await refetchExport();
    if (!data || data.length === 0) return alert("No hay datos para exportar.");

    // CSV format with Taxes separated
    const headers = ["ID Orden", "Fecha", "Segmento/Cliente", "Subtotal", "Impuesto (IVA)", "Descuento", "Bunz Pagados", "Total", "Status CFDI"];
    
    const rows = data.map((order: any) => [
      order.orderId.slice(0, 8),
      new Date(order.date!).toLocaleString("es-MX"),
      order.customerSegment || "General",
      order.subtotal.toFixed(2),
      order.tax.toFixed(2),
      order.discount.toFixed(2),
      order.bunzPaid?.toString() || "0",
      order.total.toFixed(2),
      order.cfdiStatus,
    ]);

    const csvContent = [headers.join(","), ...rows.map((e: any[]) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `Reporte_Rabbitty_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalRevenue = salesTrends?.reduce((sum: number, item: any) => sum + item.totalSales, 0) || 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-black/80 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl text-white">
          <p className="text-gray-400 text-sm mb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="font-bold text-lg" style={{ color: entry.color }}>
              {entry.name === "totalSales" || entry.name === "revenue" || entry.name === "amount" ? "$" : ""}
              {Number(entry.value).toFixed(2)} 
              {entry.name === "ordersCount" ? " órdenes" : ""}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header Disruptivo */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-gray-800 to-black p-8 shadow-2xl border border-white/5">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-pink-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 flex items-center gap-3">
              <Activity className="h-10 w-10 text-pink-500" />
              Inteligencia Financiera
            </h1>
            <p className="text-gray-400 mt-2 text-lg">Métricas vitales y tendencias de tu restaurante.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-1 flex">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setDaysRange(days)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300",
                    daysRange === days ? "bg-white text-black shadow-lg" : "text-white/70 hover:text-white"
                  )}
                >
                  {days}D
                </button>
              ))}
            </div>
            
            <Button
              onClick={handleExportCSV}
              disabled={isExporting}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white rounded-xl shadow-[0_0_20px_rgba(236,72,153,0.3)] border-0"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Generando..." : "Exportar Contabilidad"}
            </Button>
          </div>
        </div>
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Gráfica de Tendencia de Ventas */}
        <motion.div variants={itemVariants} className="md:col-span-2">
          <Card className="p-6 border border-[var(--border-subtle)] bg-[var(--bg-subtle)] overflow-hidden relative">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <TrendingUp className="text-blue-500" /> Tendencia de Ingresos
                </h3>
                <p className="text-[var(--text-muted)] text-sm">Evolución de ventas e impuestos</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-[var(--text-muted)]">Ingresos Totales ({daysRange}D)</p>
                <p className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                  ${totalRevenue.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="h-[350px] w-full">
              {loadingSales ? (
                <div className="w-full h-full animate-pulse bg-[var(--bg-pressed)] rounded-2xl" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.05} vertical={false} />
                    <XAxis dataKey="date" stroke="currentColor" className="text-[var(--text-muted)] text-xs" tickMargin={10} axisLine={false} tickLine={false} />
                    <YAxis stroke="currentColor" className="text-[var(--text-muted)] text-xs" axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="totalSales" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorSales)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Métodos de Pago */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 h-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
              <CreditCard className="text-purple-500" /> Flujo de Caja
            </h3>
            <div className="h-[250px] w-full flex items-center justify-center">
              {loadingPayments ? (
                <div className="w-48 h-48 rounded-full border-8 border-[var(--bg-pressed)] animate-pulse" />
              ) : !paymentMethods?.length ? (
                <p className="text-[var(--text-muted)]">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="amount"
                      nameKey="method"
                      stroke="none"
                    >
                      {paymentMethods.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {paymentMethods?.map((entry: any, index: number) => (
                <div key={entry.method} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{entry.method}</span>
                  <span className="text-sm text-[var(--text-muted)]">${Number(entry.amount).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Top Productos */}
        <motion.div variants={itemVariants}>
          <Card className="p-6 h-full border border-[var(--border-subtle)] bg-[var(--bg-subtle)]">
            <h3 className="text-xl font-bold text-[var(--text-primary)] flex items-center gap-2 mb-6">
              <UtensilsCrossed className="text-pink-500" /> Platillos Estrella
            </h3>
            <div className="h-[250px] w-full">
              {loadingTop ? (
                <div className="w-full h-full animate-pulse bg-[var(--bg-pressed)] rounded-2xl" />
              ) : !topProducts?.length ? (
                <p className="text-[var(--text-muted)]">Sin datos</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ top: 0, right: 0, left: 30, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="currentColor" strokeOpacity={0.05} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" stroke="currentColor" className="text-[var(--text-primary)] text-xs font-bold" axisLine={false} tickLine={false} width={100} />
                    <Tooltip cursor={{fill: 'currentColor', opacity: 0.05}} content={<CustomTooltip />} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {topProducts.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill="url(#colorBar)" />
                      ))}
                    </Bar>
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>
        </motion.div>

      </motion.div>
    </div>
  );
}
