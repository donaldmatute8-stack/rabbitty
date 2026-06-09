"use client";

import { trpc } from "../../lib/trpc-client";
import { Card, cn } from "@rabbitty/ui";
import { TrendingUp, DollarSign, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { motion, type Variants } from "framer-motion";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

export default function AdminPage() {
  const { data: orders } = trpc.pos.getOrders.useQuery({});
  const { data: tables } = trpc.pos.getTables.useQuery();

  const openOrders = orders?.filter((o) => o.status === "PENDING" || o.status === "OPEN") ?? [];
  const paidOrders = orders?.filter((o) => o.status === "PAID") ?? [];
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);

  const stats = [
    {
      label: "Ventas hoy",
      value: `$${totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      bg: "bg-emerald-500",
      glow: "rgba(16,185,129,0.15)",
    },
    {
      label: "Órdenes activas",
      value: openOrders.length,
      icon: ShoppingCart,
      bg: "bg-amber-500",
      glow: "rgba(245,158,11,0.15)",
    },
    {
      label: "Mesas ocupadas",
      value: `${tables?.length ?? 0}/${tables?.length ?? 0}`,
      icon: UtensilsCrossed,
      bg: "bg-blue-500",
      glow: "rgba(59,130,246,0.15)",
    },
    {
      label: "Órdenes pagadas",
      value: paidOrders.length,
      icon: TrendingUp,
      bg: "bg-[var(--rabbitty-pink)]",
      glow: "rgba(233,30,99,0.15)",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-[var(--text-primary)]">Dashboard</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Resumen del {new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
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
              <Card className="flex items-center gap-4 p-5 hover:shadow-md transition-shadow duration-300">
                <div
                  className={cn("flex h-12 w-12 items-center justify-center rounded-xl shrink-0", stat.bg)}
                  style={{ boxShadow: `0 4px 14px ${stat.glow}` }}
                >
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="text-2xl font-black text-[var(--text-primary)]">{stat.value}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{stat.label}</p>
                </div>
              </Card>
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
        {/* Active Orders */}
        <motion.div variants={itemVariants}>
          <Card className="p-5">
            <h3 className="mb-4 font-bold text-[var(--text-primary)]">Órdenes activas</h3>
            {openOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <ShoppingCart className="h-10 w-10 text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-muted)]">Sin órdenes activas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openOrders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-xl px-4 py-3 bg-[var(--bg-subtle)] border border-[var(--border-subtle)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="font-semibold text-sm text-[var(--text-primary)]">
                        Mesa #{order.id.slice(0, 6)}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(order.createdAt ?? new Date()).toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <span className="font-bold text-sm text-amber-600">${order.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>

        {/* Tables Overview */}
        <motion.div variants={itemVariants}>
          <Card className="p-5">
            <h3 className="mb-4 font-bold text-[var(--text-primary)]">Mapa de mesas</h3>
            {!tables ? (
              <div className="grid grid-cols-4 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-[var(--bg-pressed)]" />
                ))}
              </div>
            ) : tables.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <UtensilsCrossed className="h-10 w-10 text-[var(--text-muted)] mb-2" />
                <p className="text-sm text-[var(--text-muted)]">Sin mesas configuradas</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {tables.map((table) => (
                  <div
                    key={table.id}
                    className="rounded-xl p-3 text-center text-sm font-bold border border-[var(--border-subtle)] bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:border-[var(--rabbitty-pink)] hover:text-[var(--rabbitty-pink)] transition-colors duration-200 cursor-default"
                  >
                    {table.number}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
