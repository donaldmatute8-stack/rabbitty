"use client";

import { trpc } from "../../lib/trpc-client";
import { Card, cn } from "@rabbitty/ui";
import { TrendingUp, DollarSign, ShoppingCart, UtensilsCrossed, ArrowUpRight, Activity } from "lucide-react";
import { motion, type Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function AdminPage() {
  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const { data: tables } = trpc.pos.getTables.useQuery();

  const openOrders = orders?.filter((o) => o.status === "PENDING" || o.status === "OPEN") ?? [];
  const paidOrders = orders?.filter((o) => o.status === "PAID" || o.status === "COMPLETED") ?? [];
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);

  const stats = [
    {
      label: "Ventas hoy",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      colorClass: "text-emerald-400",
      bgClass: "bg-emerald-500/10 border-emerald-500/20",
      glow: "rgba(16,185,129,0.15)",
      hoverGlow: "hover:border-emerald-500/30 hover:shadow-[0_0_25px_rgba(16,185,129,0.1)]",
    },
    {
      label: "Órdenes activas",
      value: openOrders.length,
      icon: ShoppingCart,
      colorClass: "text-amber-400",
      bgClass: "bg-amber-500/10 border-amber-500/20",
      glow: "rgba(245,158,11,0.15)",
      hoverGlow: "hover:border-amber-500/30 hover:shadow-[0_0_25px_rgba(245,158,11,0.1)]",
    },
    {
      label: "Mesas ocupadas",
      value: `${tables?.filter(t => t.isActive).length ?? 0}/${tables?.length ?? 0}`,
      icon: UtensilsCrossed,
      colorClass: "text-blue-400",
      bgClass: "bg-blue-500/10 border-blue-500/20",
      glow: "rgba(59,130,246,0.15)",
      hoverGlow: "hover:border-blue-500/30 hover:shadow-[0_0_25px_rgba(59,130,246,0.1)]",
    },
    {
      label: "Órdenes pagadas",
      value: paidOrders.length,
      icon: TrendingUp,
      colorClass: "text-pink-400",
      bgClass: "bg-pink-500/10 border-pink-500/20",
      glow: "rgba(233,30,99,0.15)",
      hoverGlow: "hover:border-pink-500/30 hover:shadow-[0_0_25px_rgba(233,30,99,0.1)]",
    },
  ];

  return (
    <div className="space-y-8 pb-10">
      {/* Top Banner Disruptivo */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
              <Activity className="h-3.5 w-3.5" /> En Vivo
            </span>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 mt-2">
              Resumen Operativo
            </h1>
            <p className="text-gray-400 mt-1 text-sm font-medium">
              Dashboard ejecutivo para la sucursal de {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/5 px-5 py-3 backdrop-blur-md">
            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Estado del Servidor</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs font-bold text-gray-200">Sincronizado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <motion.div key={stat.label} variants={itemVariants}>
              <div
                className={cn(
                  "flex items-center gap-4 rounded-2xl border border-white/5 bg-white/5 p-6 backdrop-blur-md transition-all duration-300 cursor-default",
                  stat.hoverGlow
                )}
              >
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl border shrink-0", stat.bgClass)}>
                  <Icon className={cn("h-6 w-6", stat.colorClass)} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-black tracking-tight text-white">{stat.value}</p>
                  <p className="text-xs font-semibold text-gray-400 mt-0.5">{stat.label}</p>
                </div>
                <ArrowUpRight className="h-4 w-4 text-gray-600 self-start mt-0.5" />
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Bottom Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 gap-6 lg:grid-cols-2"
      >
        {/* Active Orders Widget */}
        <motion.div variants={itemVariants}>
          <div className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-md shadow-xl h-full flex flex-col">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              Órdenes Activas
            </h3>
            {openOrders.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-gray-500 mb-3">
                  <ShoppingCart className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-400">Sin órdenes en curso</p>
                <p className="text-xs text-gray-600 mt-1">Los pedidos aparecerán aquí tan pronto se generen en el POS.</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto max-h-[350px] pr-1">
                {openOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      <div>
                        <span className="font-bold text-sm text-gray-200">
                          {order.tableId ? `Mesa #${order.id.slice(0, 6)}` : "Para Llevar"}
                        </span>
                        <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                          Iniciada: {new Date(order.createdAt ?? new Date()).toLocaleTimeString("es-MX", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-extrabold text-sm text-amber-500">${order.total.toFixed(2)}</span>
                      <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mt-0.5">{order.status}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Table Map Widget */}
        <motion.div variants={itemVariants}>
          <div className="rounded-3xl border border-white/5 bg-white/5 p-6 backdrop-blur-md shadow-xl h-full flex flex-col">
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              Estado de Mesas
            </h3>
            {!tables ? (
              <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5 border border-white/5" />
                ))}
              </div>
            ) : tables.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-gray-500 mb-3">
                  <UtensilsCrossed className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold text-gray-400">Sin mesas configuradas</p>
                <p className="text-xs text-gray-600 mt-1">Configura el diseño de tu salón desde el POS.</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-3">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className="rounded-2xl p-4 text-center text-sm font-bold border border-white/5 bg-white/5 text-gray-300 hover:border-pink-500/50 hover:bg-pink-500/5 hover:text-pink-400 transition-all duration-300 cursor-default shadow-sm hover:shadow-[0_0_15px_rgba(236,72,153,0.1)]"
                  >
                    <span className="block text-lg font-black">{table.number}</span>
                    <span className="text-[9px] uppercase tracking-wider text-gray-500 block mt-0.5">Mesa</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
