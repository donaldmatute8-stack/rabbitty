"use client";

/**
 * ── Órdenes de compra → inventario ──────────────────────────────────────────
 *
 * Crea órdenes con insumos y costo, y al recibirlas suma stock + deja bitácora
 * (`inventory_movements`). La recepción es idempotente: un reintento no vuelve
 * a sumar inventario.
 */

import { useMemo, useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { toast } from "@rabbitty/ui";
import { ShoppingCart, Plus, Trash2, Check, X, RefreshCw } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  RECEIVED: "Recibida",
  CANCELLED: "Cancelada",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#F59E0B",
  APPROVED: "#38BDF8",
  RECEIVED: "#34D399",
  CANCELLED: "#94A3B8",
};

interface DraftRow {
  inventoryItemId: string;
  quantity: string;
  unitCost: string;
}

const emptyRow: DraftRow = { inventoryItemId: "", quantity: "", unitCost: "" };

export default function PurchasesPage() {
  const utils = trpc.useUtils();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: items } = trpc.inventory.getItems.useQuery({});
  const { data: orders, isFetching } = trpc.suppliers.getPurchaseOrders.useQuery({});

  const [supplierId, setSupplierId] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([{ ...emptyRow }]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const itemById = useMemo(() => new Map((items ?? []).map((i) => [i.id, i])), [items]);
  const total = rows.reduce((sum, r) => {
    const it = itemById.get(r.inventoryItemId);
    const qty = Number(r.quantity) || 0;
    const cost = r.unitCost ? Number(r.unitCost) : Number(it?.costPerUnit ?? 0);
    return sum + qty * cost;
  }, 0);

  const create = trpc.suppliers.createPurchaseOrder.useMutation({
    onSuccess: () => {
      toast.success("Orden de compra creada");
      utils.suppliers.getPurchaseOrders.invalidate();
      setRows([{ ...emptyRow }]);
      setNotes("");
    },
    onError: (e) => toast.error(e.message),
  });

  const setStatus = trpc.suppliers.updatePurchaseOrderStatus.useMutation({
    onSuccess: () => { utils.suppliers.getPurchaseOrders.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const receive = trpc.suppliers.receivePurchaseOrder.useMutation({
    onSuccess: (r) => {
      const already = "already" in r && Boolean(r.already);
      toast.success(already ? "Esa orden ya estaba recibida" : `Recibida: ${r.itemsReceived} insumos al inventario`);
      utils.suppliers.getPurchaseOrders.invalidate();
      utils.inventory.getItems.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const submit = () => {
    if (!supplierId) { toast.error("Elige un proveedor"); return; }
    const payload = rows
      .filter((r) => r.inventoryItemId && Number(r.quantity) > 0)
      .map((r) => {
        const it = itemById.get(r.inventoryItemId);
        return {
          inventoryItemId: r.inventoryItemId,
          quantity: Number(r.quantity),
          unitCost: r.unitCost ? Number(r.unitCost) : Number(it?.costPerUnit ?? 0),
        };
      });
    if (payload.length === 0) { toast.error("Agrega al menos un insumo con cantidad"); return; }
    create.mutate({ supplierId, items: payload, notes: notes.trim() || undefined });
  };

  const detail = trpc.suppliers.getPurchaseOrder.useQuery(
    { id: expanded ?? "" },
    { enabled: Boolean(expanded) },
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/15">
            <ShoppingCart className="h-6 w-6 text-emerald-300" />
          </div>
          <div>
            <h1 className="m-0 text-2xl font-bold text-white">Órdenes de compra</h1>
            <p className="m-0 mt-0.5 text-[12px] text-white/45">
              Compras a proveedor → al recibir suman stock y dejan bitácora de inventario.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => utils.suppliers.getPurchaseOrders.invalidate()}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/70 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </header>

      {/* Nueva orden */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">Nueva orden</p>

        <div className="grid gap-2 sm:grid-cols-3">
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
          >
            <option value="">Proveedor…</option>
            {(suppliers ?? []).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none sm:col-span-2"
          />
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((row, idx) => {
            const it = itemById.get(row.inventoryItemId);
            return (
              <div key={idx} className="grid gap-2 sm:grid-cols-4">
                <select
                  value={row.inventoryItemId}
                  onChange={(e) => {
                    const next = [...rows];
                    next[idx] = { ...row, inventoryItemId: e.target.value, unitCost: row.unitCost || String(itemById.get(e.target.value)?.costPerUnit ?? "") };
                    setRows(next);
                  }}
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none sm:col-span-2"
                >
                  <option value="">Insumo…</option>
                  {(items ?? []).map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
                  ))}
                </select>
                <input
                  value={row.quantity}
                  onChange={(e) => { const next = [...rows]; next[idx] = { ...row, quantity: e.target.value.replace(/[^0-9.]/g, "") }; setRows(next); }}
                  placeholder={`Cantidad${it ? ` (${it.unit})` : ""}`}
                  inputMode="decimal"
                  className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
                />
                <div className="flex gap-2">
                  <input
                    value={row.unitCost}
                    onChange={(e) => { const next = [...rows]; next[idx] = { ...row, unitCost: e.target.value.replace(/[^0-9.]/g, "") }; setRows(next); }}
                    placeholder="Costo unit."
                    inputMode="decimal"
                    className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setRows(rows.length === 1 ? [{ ...emptyRow }] : rows.filter((_, i) => i !== idx))}
                    className="shrink-0 text-rose-400/80 hover:text-rose-300"
                    title="Quitar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setRows([...rows, { ...emptyRow }])}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/70 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" /> Agregar insumo
          </button>
          <div className="flex items-center gap-3">
            <span className="text-[12px] font-black text-white/70">Total ${total.toFixed(2)}</span>
            <button
              type="button"
              onClick={submit}
              disabled={create.isPending}
              className="rounded-lg bg-[#E91E63] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
            >
              {create.isPending ? "Creando…" : "Crear orden"}
            </button>
          </div>
        </div>
      </section>

      {/* Listado */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="m-0 mb-3 text-[10px] font-black uppercase tracking-[0.16em] text-white/35">
          Órdenes ({orders?.length ?? 0})
        </p>
        {(orders?.length ?? 0) === 0 ? (
          <p className="m-0 text-[12px] text-white/40">Aún no hay órdenes de compra.</p>
        ) : (
          <div className="space-y-2">
            {orders?.map((o) => {
              const color = STATUS_COLOR[o.status] ?? "#94A3B8";
              const supplier = (suppliers ?? []).find((s) => s.id === o.supplierId);
              return (
                <div key={o.id} className="rounded-xl border border-white/8 bg-black/25">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <button type="button" onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="min-w-0 text-left">
                      <p className="m-0 text-[12.5px] font-bold text-white">
                        {supplier?.name ?? "Proveedor"} · ${Number(o.total).toFixed(2)}
                      </p>
                      <p className="m-0 text-[10.5px] text-white/40">
                        {new Date(o.orderedAt as unknown as string).toLocaleString("es-MX")}
                      </p>
                    </button>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider" style={{ color, background: `${color}1f`, border: `1px solid ${color}55` }}>
                        {STATUS_LABEL[o.status] ?? o.status}
                      </span>
                      {o.status === "PENDING" && (
                        <button type="button" onClick={() => setStatus.mutate({ id: o.id, status: "APPROVED" })} className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-black text-sky-300">
                          <Check className="h-3 w-3" /> Aprobar
                        </button>
                      )}
                      {o.status === "APPROVED" && (
                        <button type="button" onClick={() => receive.mutate({ id: o.id })} className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300">
                          <Check className="h-3 w-3" /> Recibir
                        </button>
                      )}
                      {(o.status === "PENDING" || o.status === "APPROVED") && (
                        <button type="button" onClick={() => setStatus.mutate({ id: o.id, status: "CANCELLED" })} className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-white/50">
                          <X className="h-3 w-3" /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>

                  {expanded === o.id && (
                    <div className="border-t border-white/8 px-3 py-2">
                      {detail.isLoading ? (
                        <p className="m-0 text-[11px] text-white/40">Cargando…</p>
                      ) : (
                        <div className="space-y-1">
                          {(detail.data?.items ?? []).map((it) => (
                            <div key={it.id} className="flex items-center justify-between text-[11px]">
                              <span className="text-white/70">{it.name}</span>
                              <span className="text-white/40">
                                {it.quantity} {it.unit} × ${Number(it.unitCost).toFixed(2)} = <b className="text-white/70">${Number(it.totalCost).toFixed(2)}</b>
                              </span>
                            </div>
                          ))}
                          {detail.data?.order.notes && (
                            <p className="m-0 mt-1 text-[10.5px] italic text-white/35">{detail.data.order.notes}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="text-[10.5px] text-white/35">
        Recibir una orden es idempotente: si se repite, no vuelve a sumar inventario.
      </p>
    </div>
  );
}
