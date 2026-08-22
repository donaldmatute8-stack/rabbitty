"use client";

import { useState } from "react";
import { trpc } from "../lib/trpc-client";
import { useBranch } from "./DashboardClientWrapper";
import { Button, Dialog, toast } from "@rabbitty/ui";
import { FlaskConical, RefreshCw, Sparkles, LogOut, ShieldAlert, ArrowRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export function SandboxBanner() {
  const utils = trpc.useUtils();
  const { branchId, setBranchId } = useBranch();
  const [resetModal, setResetModal] = useState(false);
  const [seedModal, setSeedModal] = useState(false);

  const { data: status } = trpc.sandbox.getSandboxStatus.useQuery();
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
      toast.success("¡Entorno Sandbox inicializado y activado!");
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
      toast.success("Entorno de prueba reiniciado (todas las mesas libres)");
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
      toast.success("¡Comandas y mesas demo generadas exitosamente!");
    },
    onError: (e) => toast.error(e.message),
  });

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

  if (isSandboxActive) {
    return (
      <>
        <div className="relative z-30 flex items-center justify-between border-b border-amber-500/30 bg-gradient-to-r from-amber-950/90 via-black to-amber-950/90 px-6 py-2 backdrop-blur-xl shadow-[0_4px_25px_rgba(245,158,11,0.15)]">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
              <FlaskConical className="h-4 w-4" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-amber-400">
                🧪 Modo Entrenamiento Activo (Sandbox)
              </span>
              <span className="hidden md:inline-block text-[11px] text-amber-200/70 ml-2 font-medium">
                Las ventas y gastos aquí son simulados y no afectan la contabilidad real.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/sandbox"
              className="text-xs font-bold text-amber-300 hover:text-white px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all hidden sm:inline-flex items-center gap-1"
            >
              Guía de Prácticas <ArrowRight className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={() => setSeedModal(true)}
              className="text-xs font-bold text-cyan-300 hover:text-white px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 transition-all flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="h-3 w-3 text-cyan-400" /> Sembrar Demo
            </button>
            <button
              type="button"
              onClick={() => setResetModal(true)}
              className="text-xs font-bold text-gray-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="h-3 w-3 text-gray-400" /> Reiniciar
            </button>
            <button
              type="button"
              onClick={exitSandbox}
              className="text-xs font-black text-amber-400 hover:text-amber-300 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 transition-all flex items-center gap-1 cursor-pointer"
            >
              <LogOut className="h-3 w-3" /> Salir
            </button>
          </div>
        </div>

        {/* Modal de Confirmación para Reiniciar Sandbox */}
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

        {/* Modal de Confirmación para Sembrar Demo */}
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
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={enterSandbox}
      disabled={initSandbox.isPending}
      className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all cursor-pointer shadow-sm"
      title="Entrar al entorno de prueba y capacitación"
    >
      <FlaskConical className="h-3.5 w-3.5" />
      <span>{initSandbox.isPending ? "Cargando Sandbox..." : "🧪 Modo Sandbox"}</span>
    </button>
  );
}
