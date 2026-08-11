"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, Select, toast } from "@rabbitty/ui";
import { Plus, Package, TrendingUp, TrendingDown, AlertTriangle, Search } from "lucide-react";
import { cn } from "@rabbitty/ui";

type ItemForm = { name: string; sku: string; unit: string; stock: number; minStock: number; costPerUnit: number };
const defaultItemForm: ItemForm = { name: "", sku: "", unit: "pz", stock: 0, minStock: 5, costPerUnit: 0 };

const inventoryUnits = [
  { value: "pz", label: "Pieza (pz)" }, { value: "kg", label: "Kilogramo (kg)" },
  { value: "gr", label: "Gramo (gr)" }, { value: "L", label: "Litro (L)" },
  { value: "ml", label: "Mililitro (ml)" }, { value: "caja", label: "Caja" },
  { value: "lata", label: "Lata" }, { value: "frasco", label: "Frasco" },
  { value: "costal", label: "Costal" }, { value: "cucharada", label: "Cucharada (15ml)" },
  { value: "taza", label: "Taza (250ml)" }, { value: "pizca", label: "Pizca" },
];

export default function InventoryPage() {
  const utils = trpc.useUtils();
  const { data: items } = trpc.inventory.getItems.useQuery({});
  const updateStock = trpc.inventory.updateStock.useMutation({
    onSuccess: () => { utils.inventory.getItems.invalidate(); toast.success("Stock actualizado"); },
    onError: (e) => toast.error(e.message),
  });
  const createItem = trpc.inventory.createItem.useMutation({
    onSuccess: () => { utils.inventory.getItems.invalidate(); toast.success("Item creado"); setCreateOpen(false); setForm(defaultItemForm); },
    onError: (e) => toast.error(e.message),
  });

  const [adjustments, setAdjustments] = useState<Record<string, number>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<ItemForm>(defaultItemForm);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "ok">("all");

  const lowStockItems = items?.filter((i) => i.stock <= i.minStock) ?? [];
  const okItems = items?.filter((i) => i.stock > i.minStock) ?? [];

  const filtered = (items ?? []).filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase()) || item.sku?.toLowerCase().includes(search.toLowerCase());
    const isLow = item.stock <= item.minStock;
    if (filter === "low") return matchesSearch && isLow;
    if (filter === "ok") return matchesSearch && !isLow;
    return matchesSearch;
  });

  const totalValue = (items ?? []).reduce((sum, i) => sum + i.stock * i.costPerUnit, 0);

  const handleAdjust = (itemId: string) => {
    const qty = adjustments[itemId];
    if (!qty || qty === 0) return;
    updateStock.mutate({ itemId, quantity: qty, type: "ADJUST", notes: "Ajuste manual" });
    setAdjustments((prev) => ({ ...prev, [itemId]: 0 }));
  };

  return (
    <div className="space-y-8 pb-10">
      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-blue-400">
              <Package className="h-3.5 w-3.5" /> Almacén
            </span>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500 mt-1">
              Inventario & Stock
            </h1>
            <p className="text-gray-400 mt-1 text-sm font-medium">Control de insumos, costos y alertas de reabastecimiento.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> Agregar Item</Button>
        </div>
      </div>

      {/* ── KPI Bento Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button onClick={() => setFilter("all")} className={cn("rounded-2xl border p-5 text-left transition-all cursor-pointer", filter === "all" ? "border-white/20 bg-white/10" : "border-white/5 bg-white/5 hover:bg-white/8")}>
          <p className="text-3xl font-black text-white">{items?.length ?? 0}</p>
          <p className="text-xs text-gray-400 font-semibold mt-1">Total Insumos</p>
        </button>
        <button onClick={() => setFilter("low")} className={cn("rounded-2xl border p-5 text-left transition-all cursor-pointer", filter === "low" ? "border-red-500/30 bg-red-500/15" : "border-white/5 bg-white/5 hover:bg-white/8")}>
          <div className="flex items-center gap-2 mb-2">
            {lowStockItems.length > 0 && <AlertTriangle className="h-4 w-4 text-red-400 animate-pulse" />}
          </div>
          <p className={cn("text-3xl font-black", lowStockItems.length > 0 ? "text-red-400" : "text-white")}>{lowStockItems.length}</p>
          <p className="text-xs text-gray-400 font-semibold mt-1">Stock Crítico</p>
        </button>
        <button onClick={() => setFilter("ok")} className={cn("rounded-2xl border p-5 text-left transition-all cursor-pointer", filter === "ok" ? "border-emerald-500/30 bg-emerald-500/15" : "border-white/5 bg-white/5 hover:bg-white/8")}>
          <p className="text-3xl font-black text-emerald-400">{okItems.length}</p>
          <p className="text-xs text-gray-400 font-semibold mt-1">En Stock</p>
        </button>
        <div className="rounded-2xl border border-white/5 bg-white/5 p-5">
          <p className="text-3xl font-black text-white">${totalValue.toFixed(0)}</p>
          <p className="text-xs text-gray-400 font-semibold mt-1">Valor Total</p>
        </div>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          type="text"
          placeholder="Buscar por nombre o SKU..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 pl-11 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:border-pink-500/50 focus:outline-none transition-all"
        />
      </div>

      {/* ── Inventory Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const isLow = item.stock <= item.minStock;
          const stockPercent = item.minStock > 0 ? Math.min(100, (item.stock / (item.minStock * 3)) * 100) : 100;

          return (
            <div key={item.id} className={cn(
              "relative overflow-hidden rounded-2xl border p-5 transition-all duration-300 group",
              isLow
                ? "border-red-500/30 bg-red-500/5 hover:bg-red-500/10"
                : "border-white/5 bg-white/5 hover:border-white/15 hover:bg-white/8"
            )}>
              {/* Stock meter bar */}
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5">
                <div
                  className={cn("h-full transition-all duration-500", isLow ? "bg-red-400" : "bg-emerald-400")}
                  style={{ width: `${stockPercent}%` }}
                />
              </div>

              <div className="flex items-start justify-between mb-4">
                <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl border shrink-0", isLow ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-blue-500/10 border-blue-500/20 text-blue-400")}>
                  <Package className="h-5 w-5" />
                </div>
                <Badge variant={isLow ? "danger" : "success"}>{isLow ? "⚠️ Crítico" : "En Stock"}</Badge>
              </div>

              <div className="mb-3">
                <h3 className="font-black text-white text-base">{item.name}</h3>
                <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-500">
                  {item.sku && <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">SKU: {item.sku}</span>}
                  <span>${item.costPerUnit.toFixed(2)}/{item.unit}</span>
                </div>
              </div>

              {/* Stock Display */}
              <div className="flex items-baseline gap-1 mb-4">
                <span className={cn("text-3xl font-black", isLow ? "text-red-400" : "text-white")}>{item.stock}</span>
                <span className="text-sm text-gray-400">{item.unit}</span>
                <span className="text-[11px] text-gray-600 ml-auto">mín {item.minStock}</span>
              </div>

              {/* Adjust Control */}
              <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-xl p-1.5">
                <input
                  type="number"
                  placeholder="±0"
                  value={adjustments[item.id] ?? ""}
                  onChange={(e) => setAdjustments((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                  className="flex-1 bg-transparent px-2 py-1 text-center text-sm font-bold text-white focus:outline-none placeholder:text-gray-600"
                />
                <button
                  onClick={() => handleAdjust(item.id)}
                  disabled={updateStock.isPending}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white transition-all cursor-pointer",
                    (adjustments[item.id] ?? 0) >= 0
                      ? "bg-emerald-500 hover:bg-emerald-400 shadow-[0_4px_12px_rgba(52,211,153,0.3)]"
                      : "bg-red-500 hover:bg-red-400 shadow-[0_4px_12px_rgba(248,113,113,0.3)]"
                  )}
                >
                  {(adjustments[item.id] ?? 0) >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  Ajustar
                </button>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full rounded-3xl border border-white/5 bg-white/5 p-16 text-center">
            <div className="text-5xl mb-3">📦</div>
            <p className="text-white font-bold text-lg">Sin insumos</p>
            <p className="text-gray-400 text-sm mt-1">Agrega tu primer insumo con el botón de arriba.</p>
          </div>
        )}
      </div>

      {/* ── Create Dialog ── */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} title="Agregar Item al Inventario">
        <div className="space-y-4">
          <Input label="Nombre del Insumo" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Select label="Unidad de Medida" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} options={inventoryUnits} />
          <div className="grid grid-cols-3 gap-4">
            <Input label="Stock inicial" type="number" value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))} />
            <Input label="Stock mínimo" type="number" value={form.minStock} onChange={(e) => setForm((f) => ({ ...f, minStock: Number(e.target.value) }))} />
            <Input label="Costo unitario" type="number" step="0.01" value={form.costPerUnit} onChange={(e) => setForm((f) => ({ ...f, costPerUnit: Number(e.target.value) }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={() => createItem.mutate({ ...form })} disabled={createItem.isPending}>{createItem.isPending ? "Creando..." : "Crear"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
