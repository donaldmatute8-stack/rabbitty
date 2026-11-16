"use client";

/**
 * ── Conmutador multi-restaurante ────────────────────────────────────────────
 *
 * Un negocio puede tener varios restaurantes (conceptos) con sus sucursales.
 * El contexto del admin es por sucursal, así que cambiar de restaurante cambia
 * a su primera sucursal activa y se persiste en localStorage.
 *
 * Si solo hay un restaurante, se muestra como etiqueta (sin ruido).
 */

import { useMemo } from "react";
import { trpc } from "../lib/trpc-client";
import { useBranch } from "./DashboardClientWrapper";
import { Store } from "lucide-react";
import { toast } from "@rabbitty/ui";

export default function RestaurantSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const utils = trpc.useUtils();
  const { branchId, setBranchId } = useBranch();
  const { data: restaurants } = trpc.admin.getBusinessRestaurants.useQuery(undefined, { retry: false });

  const active = useMemo(() => {
    if (!restaurants?.length) return null;
    return restaurants.find((r) => r.branches.some((b) => b.id === branchId)) ?? restaurants[0];
  }, [restaurants, branchId]);

  if (!restaurants?.length || !active) return null;

  // Elegir sucursal de operación: quedarse en la actual si pertenece al
  // restaurante; si no, la primera que NO sea de entrenamiento. Las sandbox se
  // excluyen porque el plan de membresía no las cubre y las ventas se registran
  // ahí: cambiar a una de ellas hacía que el POS cobrara sin beneficios.
  const isSandbox = (b: { name: string; isSandbox?: boolean }) =>
    b.isSandbox ?? /sandbox|entrenamiento/i.test(b.name);

  const switchTo = (restaurantId: string) => {
    const next = restaurants.find((r) => r.id === restaurantId);
    const current = next?.branches.find((b) => b.id === branchId);
    const firstBranch =
      (current && !isSandbox(current) ? current : undefined) ??
      next?.branches.find((b) => !isSandbox(b)) ??
      next?.branches[0];
    if (!next || !firstBranch) {
      toast.error("Ese restaurante no tiene sucursales activas");
      return;
    }
    if (isSandbox(firstBranch)) {
      toast.error("Ese restaurante solo tiene sucursales de entrenamiento. No se cambió.");
      return;
    }
    try {
      localStorage.setItem("activeBranchId", firstBranch.id);
      localStorage.setItem("activeRestaurantId", next.id);
    } catch { /* noop */ }
    setBranchId(firstBranch.id);
    utils.invalidate();
    toast.success(`Cambiaste a ${next.name}`);
  };

  // Un solo restaurante: etiqueta discreta.
  if (restaurants.length === 1) {
    if (collapsed) return null;
    return (
      <div className="px-3 pt-3">
        <p className="m-0 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">
          <Store className="h-3 w-3" />
          {active.name}
        </p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex justify-center pt-3">
        <div
          className="rounded-xl border border-white/10 bg-white/5 p-2 text-gray-300"
          title={`Restaurante: ${active.name}`}
        >
          <Store className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 pt-3">
      <label className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-[0.14em] text-gray-500">
        <Store className="h-3 w-3" /> Restaurante
      </label>
      <select
        value={active.id}
        onChange={(e) => switchTo(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-[11.5px] font-bold text-gray-200 outline-none focus:border-pink-500/40"
      >
        {restaurants.map((r) => (
          <option key={r.id} value={r.id} className="text-gray-900">
            {r.name}
          </option>
        ))}
      </select>
    </div>
  );
}
