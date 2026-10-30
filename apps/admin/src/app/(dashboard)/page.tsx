"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { trpc } from "../../lib/trpc-client";
import { Card, Dialog, Button, Input, toast, cn } from "@rabbitty/ui";
import { TrendingUp, DollarSign, ShoppingCart, UtensilsCrossed, ArrowUpRight, Activity, Building2, Lock, ArrowRight, ShieldAlert, Trash2 } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { useBranch } from "../../components/DashboardClientWrapper";
import { BranchSelector } from "../../components/BranchSelector";
import { OnboardingWizard } from "../../components/OnboardingWizard";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

export default function AdminPage() {
  const { branchId } = useBranch();
  const [currentDateStr, setCurrentDateStr] = useState<string>("");

  useEffect(() => {
    setCurrentDateStr(new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }));
  }, []);
  const { data: orders } = trpc.pos.getOrders.useQuery({}, { retry: false });
  const { data: tables } = trpc.pos.getTables.useQuery(undefined, { retry: false });
  const { data: crossStore } = trpc.admin.getCrossStoreKpis.useQuery(undefined, { retry: false });
  const { data: pinStatus } = trpc.staff.getAdminPinStatus.useQuery(undefined, { retry: false });

  const utils = trpc.useUtils();
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null);
  const [voidModalOrder, setVoidModalOrder] = useState<{ id: string; title: string; total: number } | null>(null);
  const [voidAdminPin, setVoidAdminPin] = useState("");
  const verifyPinMutation = trpc.staff.verifyAdminPin.useMutation();

  const voidOrderMutation = trpc.pos.voidOrder.useMutation({
    onSuccess: () => {
      utils.pos.getOrders.invalidate();
      setCancellingOrderId(null);
    },
    onError: (err) => {
      toast.error(`Error al cancelar orden: ${err.message}`);
      setCancellingOrderId(null);
    },
  });

  const handleVoidOrder = (orderId: string, orderTitle: string, total: number) => {
    setVoidAdminPin("");
    setVoidModalOrder({ id: orderId, title: orderTitle, total });
  };

  const handleConfirmVoidWithPin = async () => {
    if (!voidModalOrder) return;
    if (pinStatus?.hasAdminPin && voidAdminPin.length !== 4) {
      toast.error("Ingresa los 4 dígitos del PIN de Administrador");
      return;
    }

    try {
      if (pinStatus?.hasAdminPin) {
        await verifyPinMutation.mutateAsync({ pin: voidAdminPin });
      }
      setCancellingOrderId(voidModalOrder.id);
      await voidOrderMutation.mutateAsync({
        orderId: voidModalOrder.id,
        reason: "Anulada por administrador desde el Dashboard",
      });
      toast.success(`🐰 Orden "${voidModalOrder.title}" anulada correctamente`);
      setVoidModalOrder(null);
      setVoidAdminPin("");
    } catch (err: any) {
      toast.error(err?.message || "PIN no autorizado o error al anular comanda");
    }
  };

  const openOrders = orders?.filter((o) => o.status === "PENDING" || o.status === "OPEN") ?? [];
  const paidOrders = orders?.filter((o) => o.status === "PAID" || o.status === "COMPLETED") ?? [];
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total, 0);

  const { data: bunzInventory } = trpc.admin.getAffiliateBunzInventory.useQuery(undefined, { retry: false });
  const { data: dwell } = trpc.dwellAnalytics.getDwellStats.useQuery(undefined, { refetchInterval: 60000, retry: false });

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
      {/* 0. Alerta de PIN de Administrador no configurado */}
      {pinStatus && !pinStatus.hasAdminPin && (
        <div className="relative overflow-hidden rounded-3xl border border-amber-500/30 bg-linear-to-r from-amber-500/15 via-orange-500/10 to-black/60 p-6 backdrop-blur-xl shadow-[0_0_40px_rgba(245,158,11,0.12)] animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 shrink-0">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  Aún no se ha generado un PIN de Administrador
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/20 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                    Seguridad Requerida
                  </span>
                </h3>
                <p className="text-sm text-gray-300 mt-1 max-w-2xl leading-relaxed">
                  Para proteger la operación de tu negocio, autorizar cancelaciones (Voids) en el POS y autorizar la eliminación de gastos u operaciones críticas, es indispensable configurar un PIN de 4 dígitos antes de operar.
                </p>
              </div>
            </div>
            <Link
              href="/settings?tab=security"
              className="flex items-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black px-5 py-3 text-sm transition-all shrink-0 active:scale-95 shadow-[0_0_20px_rgba(245,158,11,0.3)]"
            >
              Configurar PIN Ahora
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* 1. Top Banner Disruptivo */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-linear-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
              <Activity className="h-3.5 w-3.5" /> En Vivo
            </span>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-linear-to-r from-white via-gray-200 to-gray-500 mt-2">
              Resumen Operativo
            </h1>
            <p className="text-gray-400 mt-1 text-sm font-medium">
              Dashboard ejecutivo para la sucursal {currentDateStr ? `de ${currentDateStr}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Indicador de Bóveda y Aprovisionamiento Bunz */}
            <div className="rounded-2xl border border-pink-500/20 bg-linear-to-r from-pink-500/10 via-purple-500/10 to-transparent px-4 py-2.5 backdrop-blur-md flex items-center gap-3 shadow-[0_0_20px_rgba(233,30,99,0.1)]">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-500/20 border border-pink-500/30 text-pink-400 font-black text-sm">
                🐰
              </div>
              <div className="flex items-center gap-4 divide-x divide-white/10">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-pink-300 font-black">Bóveda Bunz</span>
                    <span className="text-[9px] font-bold text-gray-400 bg-white/5 border border-white/10 px-1.5 py-0.2 rounded-full">
                      {bunzInventory?.package || "Inventario"}
                    </span>
                  </div>
                  <p className="text-base font-black text-white leading-none mt-0.5">
                    {(bunzInventory?.bunzBalance ?? 0).toLocaleString()} <span className="text-xs font-bold text-pink-400">BZ</span>
                  </p>
                </div>
                <div className="pl-4">
                  <span className="text-[10px] uppercase tracking-wider text-amber-300 font-black block">Entregados</span>
                  <p className="text-base font-black text-white leading-none mt-0.5">
                    {((bunzInventory as any)?.totalBunzMinted ?? 0).toLocaleString()} <span className="text-xs font-bold text-amber-400">BZ</span>
                  </p>
                  <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-black block mt-1.5">Redimidos</span>
                  <p className="text-base font-black text-white leading-none mt-0.5">
                    {((bunzInventory as any)?.totalBunzRedimido ?? 0).toLocaleString()} <span className="text-xs font-bold text-emerald-400">BZ</span>
                  </p>
                </div>
              </div>
            </div>

            <BranchSelector />
            <div className="rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 backdrop-blur-md">
              <span className="text-[10px] uppercase tracking-wider text-gray-500 font-bold">Estado del Servidor</span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-gray-200">Sincronizado</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Stats Grid (Ventas hoy, Órdenes activas, Mesas ocupadas, Órdenes pagadas) */}
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

      {/* 3. Multi-Store Section (Si aplica) */}
      {crossStore && crossStore.branchCount > 1 && (
        <motion.div variants={containerVariants} initial="hidden" animate="show">
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Multi-Sucursal</h3>
                <p className="text-xs text-gray-400">{crossStore.branchCount} sucursales activas</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                <p className="text-2xl font-black text-white">{crossStore.totals.totalOrders}</p>
                <p className="text-xs text-gray-400 mt-1">Órdenes totales</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                <p className="text-2xl font-black text-emerald-400">${crossStore.totals.totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-gray-400 mt-1">Ingresos totales</p>
              </div>
              <div className="rounded-xl border border-white/5 bg-white/5 p-4 text-center">
                <p className="text-2xl font-black text-blue-400">{crossStore.totals.totalCustomers}</p>
                <p className="text-xs text-gray-400 mt-1">Clientes únicos</p>
              </div>
            </div>
            <div className="space-y-2">
              {crossStore.branches.map((b) => (
                <div key={b.branchId} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-3 hover:border-white/10 transition-all">
                  <p className="text-sm font-bold text-white">{b.branchName}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{b.totalOrders} órdenes</span>
                    <span className="text-emerald-400 font-bold">${b.totalRevenue.toFixed(2)}</span>
                    <span>{b.totalCustomers} clientes</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}

      {/* 4. Bottom Grid (Órdenes Activas & Estado de Mesas) */}
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
              <div className="space-y-3 flex-1 overflow-y-auto max-h-87.5 pr-1">
                {openOrders.map((order) => {
                  const title = order.tableId ? `Mesa #${order.id.slice(0, 6)}` : "Para Llevar";
                  const isPending = order.status === "PENDING" || order.status === "OPEN";
                  return (
                    <div
                      key={order.id}
                      className="flex items-center justify-between rounded-xl px-4 py-3.5 bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all duration-300"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        <div>
                          <span className="font-bold text-sm text-gray-200">
                            {title}
                          </span>
                          <p className="text-[10px] text-gray-500 font-semibold mt-0.5">
                            Iniciada: {new Date(order.createdAt ?? new Date()).toLocaleTimeString("es-MX", {
                              timeZone: "America/Mexico_City",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-extrabold text-sm text-amber-500">${order.total.toFixed(2)}</span>
                          <p className="text-[9px] uppercase tracking-wider text-gray-500 font-bold mt-0.5">{order.status}</p>
                        </div>
                        {isPending && (
                          <button
                            type="button"
                            onClick={() => handleVoidOrder(order.id, title, order.total)}
                            disabled={cancellingOrderId === order.id}
                            title="Anular y quitar orden"
                            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      {/* 5. Guía General / Onboarding Wizard AL FINAL DEL DASHBOARD */}
      <OnboardingWizard />

      {/* Modal de Anulación de Orden con PIN de Administrador */}
      <Dialog
        open={!!voidModalOrder}
        onClose={() => {
          setVoidModalOrder(null);
          setVoidAdminPin("");
        }}
        title="Anular Comanda Activa"
        className="max-w-sm w-full"
      >
        <div className="space-y-4 p-1">
          <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-start gap-2.5">
            <Trash2 className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
            <div>
              <p className="font-bold text-white mb-0.5">
                {voidModalOrder?.title} (${voidModalOrder?.total.toFixed(2)} MXN)
              </p>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                Esta acción cancelará la comanda y liberará la mesa o mostrador en el POS de inmediato.
              </p>
            </div>
          </div>

          {pinStatus?.hasAdminPin ? (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300">
                PIN de Administrador / Gerente (4 dígitos)
              </label>
              <Input
                type="password"
                maxLength={4}
                value={voidAdminPin}
                onChange={(e) => setVoidAdminPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
                className="text-center text-lg tracking-widest font-black py-2.5"
                autoFocus
              />
            </div>
          ) : (
            <p className="text-xs text-gray-400">
              ¿Confirmas la anulación de esta orden activa?
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setVoidModalOrder(null);
                setVoidAdminPin("");
              }}
              className="flex-1 py-2 font-bold text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmVoidWithPin}
              disabled={
                (pinStatus?.hasAdminPin && voidAdminPin.length !== 4) ||
                verifyPinMutation.isPending ||
                voidOrderMutation.isPending
              }
              className="flex-1 py-2 font-black text-xs bg-red-600 hover:bg-red-500 text-white disabled:opacity-40"
            >
              {verifyPinMutation.isPending || voidOrderMutation.isPending
                ? "Anulando..."
                : "Autorizar Anulación"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* ── ⏱️ Permanencia de Rabbitters (presencia GPS + check-in) ── */}
      <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm font-black uppercase tracking-wider text-gray-400">Permanencia de Rabbitters</h2>
          </div>
          <span className="text-[10px] text-gray-500">GPS + check-in · sesión cerrada a los 90 min sin señal</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-emerald-300 font-black">En el local ahora</p>
            <p className="text-xl font-black text-white mt-0.5">{dwell?.liveNow ?? 0}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Visitas hoy</p>
            <p className="text-xl font-black text-white mt-0.5">{dwell?.sessionsToday ?? 0}</p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Estancia promedio 7d</p>
            <p className="text-xl font-black text-white mt-0.5">{dwell?.avgDwell7d ?? 0} <span className="text-xs text-gray-400">min</span></p>
          </div>
          <div className="rounded-xl bg-white/5 border border-white/5 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-black">Recurrentes 7d</p>
            <p className="text-xl font-black text-white mt-0.5">{dwell?.repeatUsers7d ?? 0}</p>
          </div>
        </div>
        {(dwell?.lastSessions?.length ?? 0) > 0 && (
          <div className="space-y-1.5">
            {dwell!.lastSessions.slice(0, 5).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between text-[12px] rounded-lg bg-white/[0.03] px-3 py-1.5">
                <span className="text-gray-300 font-bold">
                  {s.businessName || "Negocio"} · @{s.username || [s.firstName, s.lastName].filter(Boolean).join(" ") || "rabbitter"}
                </span>
                <span className="text-gray-500">
                  {s.source === "gps" ? "📍" : "📷"} {s.dwellMin} min · {new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
