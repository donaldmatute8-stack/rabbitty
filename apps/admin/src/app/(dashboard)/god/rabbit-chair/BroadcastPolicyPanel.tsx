"use client";

import { useState } from "react";
import { toast } from "@rabbitty/ui";
import { trpc } from "../../../../lib/trpc-client";

/**
 * ── God · política de avisos masivos de La Silla ────────────────────────────
 * Edita por negocio cuántos broadcasts permite al día y cuántos destinatarios
 * como máximo. Los planes están definidos pero NO activos (coming soon).
 */

type BusinessPolicy = {
  businessId: string;
  name: string;
  dailyLimit: number;
  recipientCap: number;
};

const PLANS = [
  {
    id: "STARTER",
    name: "Starter",
    dailyLimit: 1,
    recipientCap: 100,
    activations: "10 al mes",
    branches: "1 sucursal",
    features: ["Presencia y lista de espera", "Cobro en POS", "Reporte básico"],
  },
  {
    id: "GROWTH",
    name: "Growth",
    dailyLimit: 2,
    recipientCap: 500,
    activations: "30 al mes",
    branches: "Hasta 3 sucursales",
    features: ["Radio / proximidad", "Staff extra con costo", "Reporte + CSV"],
  },
  {
    id: "PRO",
    name: "Pro",
    dailyLimit: 3,
    recipientCap: 2_000,
    activations: "100 al mes",
    branches: "Sucursales ilimitadas",
    features: ["Audiencias de miembros", "Margen neto", "Exportación contable"],
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    dailyLimit: 10,
    recipientCap: 5_000,
    activations: "A medida",
    branches: "Multi-negocio",
    features: ["SLA y onboarding", "Política a medida", "API / integraciones"],
  },
] as const;

export function BroadcastPolicyPanel({ businesses }: { businesses: BusinessPolicy[] }) {
  const [draft, setDraft] = useState<Record<string, { dailyLimit: string; recipientCap: string }>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const save = trpc.rabbitChair.setBroadcastPolicy.useMutation({
    onSuccess: (_res, vars) => {
      toast.success("Política guardada");
      setSaved((prev) => ({ ...prev, [vars.businessId]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [vars.businessId]: false })), 2500);
    },
    onError: (error) => toast.error(error.message),
  });

  const valueFor = (business: BusinessPolicy) =>
    draft[business.businessId] ?? {
      dailyLimit: String(business.dailyLimit),
      recipientCap: String(business.recipientCap),
    };

  const update = (businessId: string, patch: Partial<{ dailyLimit: string; recipientCap: string }>) => {
    const business = businesses.find((item) => item.businessId === businessId);
    if (!business) return;
    const current = valueFor(business);
    setDraft((prev) => ({ ...prev, [businessId]: { ...current, ...patch } }));
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="m-0 text-xs font-black uppercase tracking-wider text-gray-400">
          Avisos masivos · por negocio
        </h2>
        <p className="m-0 mt-1 max-w-2xl text-[11px] text-gray-500">
          Hoy todos arrancan con <strong>1 masivo al día</strong> y <strong>100 destinatarios</strong>.
          Los ajustes aplican al instante y quedan auditados. Requiere 2FA de God.
        </p>
      </div>

      {businesses.length === 0 ? (
        <p className="rounded-xl border border-white/5 bg-white/5 p-4 text-xs text-gray-500">
          No hay negocios con restaurante configurado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/5">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-3 py-2">Negocio</th>
                <th className="px-3 py-2">Masivos / día</th>
                <th className="px-3 py-2">Tope de destinatarios</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-gray-300">
              {businesses.map((business) => {
                const value = valueFor(business);
                return (
                  <tr key={business.businessId}>
                    <td className="px-3 py-2">
                      <p className="m-0 font-bold text-white">{business.name}</p>
                      <p className="m-0 font-mono text-[9px] text-gray-500">{business.businessId}</p>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={10}
                        value={value.dailyLimit}
                        onChange={(event) => update(business.businessId, { dailyLimit: event.target.value })}
                        className="w-20 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-pink-500"
                      />
                      <span className="ml-2 text-[10px] text-gray-500">0 = sin límite</span>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={1}
                        max={5000}
                        value={value.recipientCap}
                        onChange={(event) => update(business.businessId, { recipientCap: event.target.value })}
                        className="w-24 rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-[11px] text-white outline-none focus:border-pink-500"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={save.isPending}
                        onClick={() =>
                          save.mutate({
                            businessId: business.businessId,
                            dailyLimit: Math.max(0, Math.min(10, Number(value.dailyLimit) || 0)),
                            recipientCap: Math.max(1, Math.min(5000, Number(value.recipientCap) || 100)),
                          })
                        }
                        className="rounded-lg bg-pink-500 px-3 py-1.5 text-[11px] font-black text-black hover:bg-pink-400 disabled:opacity-50"
                      >
                        {saved[business.businessId] ? "Guardado" : "Guardar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div>
        <h2 className="m-0 text-xs font-black uppercase tracking-wider text-gray-400">
          Planes de La Silla <span className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] text-amber-300">Coming soon</span>
        </h2>
        <p className="m-0 mt-1 max-w-2xl text-[11px] text-gray-500">
          Propuesta documentada, <strong>sin activar</strong>. Ningún negocio cambia de límites hasta que
          se habiliten los planes. La asignación se hará desde aquí, con el paquete del negocio.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 opacity-80">
              <div className="flex items-center justify-between gap-2">
                <p className="m-0 text-sm font-black text-white">{plan.name}</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-gray-400">
                  Pendiente
                </span>
              </div>
              <p className="m-0 mt-1 text-[10px] text-gray-500">
                {plan.dailyLimit} masivo{plan.dailyLimit === 1 ? "" : "s"}/día · {plan.recipientCap.toLocaleString("es-MX")} destinatarios
              </p>
              <p className="m-0 mt-1 text-[10px] text-gray-500">
                {plan.activations} · {plan.branches}
              </p>
              <ul className="mt-2 space-y-1 pl-4 text-[10px] text-gray-400">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                type="button"
                disabled
                title="Se habilita cuando existan los planes de tenant"
                className="mt-3 w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-black text-gray-500"
              >
                Aplicar plan · próximamente
              </button>
            </div>
          ))}
        </div>
        <p className="m-0 mt-2 text-[10px] text-gray-500">
          Detalle y pasos de activación: <code>Docs/CONCEPTOS/RABBIT-CHAIR-PLANES.md</code> (local).
        </p>
      </div>
    </section>
  );
}
