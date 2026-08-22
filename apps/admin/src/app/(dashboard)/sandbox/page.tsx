"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { useBranch } from "../../../components/DashboardClientWrapper";
import { Card, Badge, Button, Dialog, toast } from "@rabbitty/ui";
import {
  FlaskConical,
  Sparkles,
  RefreshCw,
  ChefHat,
  CreditCard,
  Receipt,
  Table2,
  Users,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  KeyRound,
  GraduationCap,
  Play,
  Monitor,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";

export default function SandboxPage() {
  const utils = trpc.useUtils();
  const { branchId, setBranchId } = useBranch();
  const [resetModal, setResetModal] = useState(false);
  const [seedModal, setSeedModal] = useState(false);

  const { data: status, isLoading } = trpc.sandbox.getSandboxStatus.useQuery();
  const { data: branches } = trpc.admin.getBranches.useQuery();

  const isSandboxActive =
    status?.hasSandbox &&
    status.sandboxBranch &&
    branchId === status.sandboxBranch.id;

  const initSandbox = trpc.sandbox.initSandbox.useMutation({
    onSuccess: (res) => {
      utils.sandbox.getSandboxStatus.invalidate();
      utils.admin.getBranches.invalidate();
      setBranchId(res.branchId);
      if (typeof window !== "undefined") {
        localStorage.setItem("activeBranchId", res.branchId);
      }
      toast.success("¡Entorno Sandbox inicializado con tu menú real!");
    },
    onError: (e) => toast.error(e.message),
  });

  const resetSandbox = trpc.sandbox.resetSandbox.useMutation({
    onSuccess: () => {
      utils.sandbox.getSandboxStatus.invalidate();
      utils.pos.getOrders.invalidate();
      utils.pos.getTables.invalidate();
      utils.expenses.list.invalidate();
      setResetModal(false);
      toast.success("Entorno de prueba reiniciado.");
    },
    onError: (e) => toast.error(e.message),
  });

  const seedDemoData = trpc.sandbox.seedDemoData.useMutation({
    onSuccess: () => {
      utils.sandbox.getSandboxStatus.invalidate();
      utils.pos.getOrders.invalidate();
      utils.pos.getTables.invalidate();
      utils.expenses.list.invalidate();
      setSeedModal(false);
      toast.success("¡Datos de prueba generados!");
    },
    onError: (e) => toast.error(e.message),
  });

  const enterSandbox = () => {
    if (status?.hasSandbox && status.sandboxBranch) {
      setBranchId(status.sandboxBranch.id);
      if (typeof window !== "undefined") {
        localStorage.setItem("activeBranchId", status.sandboxBranch.id);
      }
      toast.success("Modo Entrenamiento activado.");
    } else {
      initSandbox.mutate();
    }
  };

  const exitSandbox = () => {
    const mainBranch = branches?.find(
      (b) =>
        !b.name.toLowerCase().includes("sandbox") &&
        !b.name.toLowerCase().includes("entrenamiento")
    ) || branches?.[0];

    if (mainBranch) {
      setBranchId(mainBranch.id);
      if (typeof window !== "undefined") {
        localStorage.setItem("activeBranchId", mainBranch.id);
      }
      toast.info("Regresaste a la sucursal de producción.");
    }
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-gradient-to-br from-amber-950/40 via-gray-950/80 to-black p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-400">
              <FlaskConical className="h-3.5 w-3.5" />
              Entorno Seguro de Capacitación
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
              Modo Sandbox & Entrenamiento
            </h1>
            <p className="text-gray-400 text-sm max-w-2xl">
              Capacita a meseros, cajeros, cocineros y gerentes en un entorno 100% aislado. Puedes tomar órdenes, enviar comandas, cobrar con diferentes métodos, aplicar cancelaciones y registrar gastos sin alterar las finanzas reales.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {isSandboxActive ? (
              <Button variant="secondary" onClick={exitSandbox} className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
                Salir a Producción
              </Button>
            ) : (
              <Button onClick={enterSandbox} disabled={initSandbox.isPending} className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black hover:opacity-90">
                <FlaskConical className="h-4 w-4 mr-2" />
                {status?.hasSandbox ? "Activar Modo Sandbox" : "Inicializar Sandbox"}
              </Button>
            )}
            <Button variant="secondary" onClick={() => setSeedModal(true)} disabled={seedDemoData.isPending || !status?.hasSandbox}>
              <Sparkles className="h-4 w-4 mr-2 text-cyan-400" />
              Sembrar Demo
            </Button>
            <Button variant="secondary" onClick={() => setResetModal(true)} disabled={resetSandbox.isPending || !status?.hasSandbox}>
              <RefreshCw className="h-4 w-4 mr-2 text-gray-400" />
              Reiniciar
            </Button>
          </div>
        </div>
      </div>

      {/* Live Sandbox Status KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Estado del Sandbox</span>
            <div className="h-8 w-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <FlaskConical className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">
            {isSandboxActive ? "🟢 En Uso" : status?.hasSandbox ? "🟡 Disponible" : "⚪ No Creado"}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {isSandboxActive ? "Sesión activa en este dispositivo" : "Listo para iniciar capacitación"}
          </p>
        </Card>

        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Mesas de Prueba</span>
            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Table2 className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{status?.stats?.totalTables ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Mesas simuladas configuradas</p>
        </Card>

        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Platillos Disponibles</span>
            <div className="h-8 w-8 rounded-xl bg-green-500/10 text-green-400 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{status?.stats?.totalMenuItems ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Clonados desde tu menú real</p>
        </Card>

        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Órdenes de Prueba</span>
            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-black text-white">{status?.stats?.totalOrders ?? 0}</p>
          <p className="text-xs text-gray-500 mt-1">Comandas generadas en práctica</p>
        </Card>
      </div>

      {/* Training Guides & Roles */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-amber-400" />
          Rutas de Capacitación por Puesto
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Waiters / Cashiers Guide */}
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md rounded-3xl space-y-4 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                  📱
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Meseros y Cajeros</h3>
                  <p className="text-xs text-gray-400">Punto de Venta Táctil & Cobros</p>
                </div>
              </div>
              <Link
                href="/pos"
                className="text-xs font-black text-cyan-400 hover:text-cyan-300 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-1"
              >
                Abrir POS <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>1. Toca platillos para agregarlos al ticket de la orden.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>2. Practica el desglose del IVA 16% incluido en el total.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>3. Prueba cobros con Efectivo, Tarjeta, QR Bunz o Dividir Cuenta.</span>
              </div>
            </div>
          </Card>

          {/* Kitchen / KDS Guide */}
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md rounded-3xl space-y-4 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                  🍳
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Cocina & Barra (KDS)</h3>
                  <p className="text-xs text-gray-400">Gestión de Comandas en Vivo</p>
                </div>
              </div>
              <Link
                href="/kitchen"
                className="text-xs font-black text-amber-400 hover:text-amber-300 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-1"
              >
                Abrir KDS <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>1. Observa cómo entran los tickets al ordenar desde el POS.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>2. Cambia el estado de los platillos de "En Preparación" a "Servido".</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>3. Gestiona notas especiales de preparación (ej. sin cebolla).</span>
              </div>
            </div>
          </Card>

          {/* Manager & Admin Guide */}
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md rounded-3xl space-y-4 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
                  🛡️
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Gerentes & Administradores</h3>
                  <p className="text-xs text-gray-400">Autorizaciones de Riesgo & PIN</p>
                </div>
              </div>
              <Link
                href="/expenses"
                className="text-xs font-black text-purple-400 hover:text-purple-300 px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center gap-1"
              >
                Ver Gastos <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>1. Practica anulaciones (Voids) en POS solicitando PIN de Gerente.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>2. Registra gastos operativos con el Buscador Inteligente de Proveedores.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>3. Edita y elimina gastos ingresando motivo de auditoría y PIN.</span>
              </div>
            </div>
          </Card>

          {/* Table Management Guide */}
          <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md rounded-3xl space-y-4 hover:border-white/10 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                  🪑
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">Control de Salón & Mesas</h3>
                  <p className="text-xs text-gray-400">Estados de Mesa en Tiempo Real</p>
                </div>
              </div>
              <Link
                href="/table-layout"
                className="text-xs font-black text-emerald-400 hover:text-emerald-300 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-1"
              >
                Ver Salón <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>1. Abre mesas asignando número de comensales.</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>2. Observa el cambio de color (Libre, Ocupada, Cuenta Pedida).</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-black/40 border border-white/5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>3. Cierra la sesión de mesa al finalizar el pago.</span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog for Reset Sandbox */}
      <Dialog open={resetModal} onClose={() => setResetModal(false)} title="¿Reiniciar Entorno Sandbox?">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
            <ShieldAlert className="h-5 w-5 shrink-0" />
            <span>Esta acción vaciará todas las órdenes de prueba, comensales y gastos simulados del Sandbox.</span>
          </div>
          <p className="text-sm text-gray-300">
            Las mesas volverán a quedar libres para que puedas iniciar una nueva sesión de práctica limpia. Los datos reales de producción permanecerán intactos.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => setResetModal(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => resetSandbox.mutate()}
              disabled={resetSandbox.isPending}
            >
              {resetSandbox.isPending ? "Reiniciando..." : "Sí, Reiniciar Datos de Prueba"}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog for Seed Demo */}
      <Dialog open={seedModal} onClose={() => setSeedModal(false)} title="Generar Comandas y Mesas Demo">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-sm">
            <Sparkles className="h-5 w-5 shrink-0" />
            <span>Se crearán 2 mesas ocupadas con órdenes activas listas para cobrar y enviar a cocina.</span>
          </div>
          <p className="text-sm text-gray-300">
            Ideal para capacitar a meseros en el POS táctil, cocineros en el KDS y cajeros en cobros y cancelaciones con PIN.
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => setSeedModal(false)}>Cancelar</Button>
            <Button
              onClick={() => seedDemoData.mutate()}
              disabled={seedDemoData.isPending}
            >
              {seedDemoData.isPending ? "Generando..." : "Generar Datos de Prueba"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
