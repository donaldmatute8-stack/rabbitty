"use client";

/**
 * ── Impresoras por sucursal y estación ──────────────────────────────────────
 *
 * Configura el catálogo de impresoras (ticket / cocina / barra) y a qué
 * impresora imprime cada estación. Es aditivo: sin impresoras configuradas,
 * todo sigue imprimiendo como hoy.
 */

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { toast } from "@rabbitty/ui";
import { Printer, Plus, Trash2, Save } from "lucide-react";

const ROLES = [
  ["RECEIPT", "Ticket / caja"],
  ["KITCHEN", "Cocina"],
  ["BAR", "Barra"],
  ["EXPO", "Expo / entrega"],
] as const;

const CONNECTIONS = [
  ["BLE", "Bluetooth BLE"],
  ["SPP", "Bluetooth clásico (SPP)"],
  ["USB", "USB / bridge"],
  ["NETWORK", "Red (IP)"],
] as const;

export default function PrintersPage() {
  const utils = trpc.useUtils();
  const { data: printers } = trpc.printers.list.useQuery();
  const { data: stations } = trpc.stations.list.useQuery();

  const [form, setForm] = useState({ name: "", role: "KITCHEN", connection: "BLE", identifier: "" });
  const [saving, setSaving] = useState(false);

  const upsert = trpc.printers.upsert.useMutation({
    onSuccess: () => {
      toast.success("Impresora guardada");
      utils.printers.list.invalidate();
      setForm({ name: "", role: "KITCHEN", connection: "BLE", identifier: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const remove = trpc.printers.remove.useMutation({
    onSuccess: () => { toast.success("Impresora desactivada"); utils.printers.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const assign = trpc.printers.assignStation.useMutation({
    onSuccess: () => { toast.success("Estación actualizada"); utils.stations.list.invalidate(); utils.printers.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!form.name.trim()) { toast.error("Ponle nombre a la impresora"); return; }
    setSaving(true);
    upsert.mutate(
      {
        name: form.name.trim(),
        role: form.role as "RECEIPT" | "KITCHEN" | "BAR" | "EXPO",
        connection: form.connection as "BLE" | "SPP" | "USB" | "NETWORK",
        identifier: form.identifier.trim() || null,
        paperWidth: 58,
      },
      { onSettled: () => setSaving(false) },
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <header className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/15">
          <Printer className="h-6 w-6 text-cyan-300" />
        </div>
        <div>
          <h1 className="m-0 text-2xl font-bold text-white">Impresoras</h1>
          <p className="m-0 mt-0.5 text-[12px] text-white/45">
            Varias impresoras por sucursal y una por estación (cocina, barra, ticket).
          </p>
        </div>
      </header>

      {/* Alta */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Nueva impresora</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre (Barra 1)"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
          />
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
          >
            {ROLES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <select
            value={form.connection}
            onChange={(e) => setForm({ ...form, connection: e.target.value })}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
          >
            {CONNECTIONS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
          <input
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            placeholder="MAC / nombre / IP (opcional)"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
          />
          <button
            type="button"
            onClick={submit}
            disabled={saving || upsert.isPending}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#E91E63] px-3 py-2 text-xs font-black text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> {saving ? "Guardando…" : "Agregar"}
          </button>
        </div>
      </section>

      {/* Listado */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          Impresoras de la sucursal ({printers?.length ?? 0})
        </p>
        {(printers?.length ?? 0) === 0 ? (
          <p className="m-0 text-[12px] text-white/40">Aún no hay impresoras. Agrega la primera arriba.</p>
        ) : (
          <div className="space-y-2">
            {printers?.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                <div className="min-w-0">
                  <p className="m-0 text-[12.5px] font-bold text-white">
                    {p.name}
                    <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white/50">
                      {ROLES.find(([id]) => id === p.role)?.[1] ?? p.role}
                    </span>
                  </p>
                  <p className="m-0 text-[10.5px] text-white/40">
                    {CONNECTIONS.find(([id]) => id === p.connection)?.[1] ?? p.connection}
                    {p.identifier ? ` · ${p.identifier}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove.mutate({ id: p.id })}
                  className="text-rose-400/80 hover:text-rose-300"
                  title="Desactivar"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Estación → impresora */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          Estación → impresora
        </p>
        {(stations?.length ?? 0) === 0 ? (
          <p className="m-0 text-[12px] text-white/40">No hay estaciones configuradas (se usa la de cocina por defecto).</p>
        ) : (
          <div className="space-y-2">
            {stations?.map((st) => (
              <div key={st.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/8 bg-black/25 px-3 py-2">
                <div className="min-w-0">
                  <p className="m-0 text-[12.5px] font-bold text-white">{st.name}</p>
                  <p className="m-0 text-[10.5px] text-white/40">{st.type}{st.isDefault ? " · predeterminada" : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={st.printerId ?? ""}
                    onChange={(e) => assign.mutate({ stationId: st.id, printerId: e.target.value || null })}
                    className="rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[11px] text-white outline-none"
                  >
                    <option value="">Sin impresora</option>
                    {(printers ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {assign.isPending && <Save className="h-3.5 w-3.5 animate-pulse text-white/40" />}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-[10.5px] text-white/35">
        El POS y el KDS usan esta asignación cuando imprimen; si una estación no tiene impresora, se usa la
        conexión del dispositivo (como hoy).
      </p>
    </div>
  );
}
