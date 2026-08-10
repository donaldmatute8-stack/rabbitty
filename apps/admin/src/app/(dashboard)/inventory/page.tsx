"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, toast } from "@rabbitty/ui";
import { Plus, Package, TrendingUp, TrendingDown, AlertTriangle, Trash2 } from "lucide-react";

type ItemForm = { name: string; sku: string; unit: string; stock: number; minStock: number; costPerUnit: number };
const defaultItemForm: ItemForm = { name: "", sku: "", unit: "pz", stock: 0, minStock: 5, costPerUnit: 0 };

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

  const lowStockItems = items?.filter((i) => i.stock <= i.minStock) ?? [];

  const handleAdjust = (itemId: string) => {
    const qty = adjustments[itemId];
    if (!qty || qty === 0) return;
     updateStock.mutate({ itemId: itemId, quantity: qty, type: "ADJUST", notes: "Ajuste manual" });
    setAdjustments((prev) => ({ ...prev, [itemId]: 0 }));
  };

  const handleCreate = () => {
    createItem.mutate({ ...form });
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Inventario
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Control de stock y suministros</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-5 w-5" />
            Agregar Item
          </Button>
        </div>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/10 p-5 rounded-2xl flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <span className="text-sm font-bold text-red-400">
            {lowStockItems.length} producto(s) con stock crítico / bajo
          </span>
        </Card>
      )}

      <div className="grid gap-4">
        {items?.map((item) => {
          const isLow = item.stock <= item.minStock;

          return (
            <Card key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 hover:bg-white/10 transition-all duration-300 gap-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border shrink-0 ${
                    isLow 
                      ? "bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
                      : "bg-blue-500/10 border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                  }`}
                >
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white">{item.name}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-400">
                    <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5">SKU: {item.sku}</span>
                    <span>•</span>
                    <span>Unidad: {item.unit}</span>
                    <span>•</span>
                    <span>Costo: ${item.costPerUnit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6 justify-between sm:justify-end">
                <div className="text-left sm:text-right">
                  <div className={`text-2xl font-black ${isLow ? "text-red-400" : "text-white"}`}>
                    {item.stock}
                    <span className="ml-1 text-sm font-normal text-gray-400">{item.unit}</span>
                  </div>
                  <div className="text-xs text-gray-400 font-semibold mt-0.5">
                    Mín: {item.minStock} {item.unit}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 bg-white/5 border border-white/5 p-1.5 rounded-2xl">
                  <input
                    type="number"
                    placeholder="0"
                    value={adjustments[item.id] ?? ""}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                    }
                    className="w-16 rounded-xl border-0 bg-transparent px-2 py-1 text-center text-sm font-bold text-white focus:outline-none focus:ring-0 placeholder:text-gray-600"
                  />
                  <button
                    onClick={() => handleAdjust(item.id)}
                    disabled={updateStock.isPending}
                    className="rounded-xl bg-pink-500 hover:bg-pink-600 p-2.5 text-white hover:scale-105 active:scale-95 shadow-[0_4px_14px_rgba(236,72,153,0.3)] transition-all duration-350 disabled:opacity-50"
                  >
                    {(adjustments[item.id] ?? 0) > 0 ? (
                      <TrendingUp className="h-4.5 w-4.5" />
                    ) : (
                      <TrendingDown className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>

                <Badge variant={isLow ? "danger" : "success"}>
                  {isLow ? "Stock Bajo" : "En Stock"}
                </Badge>
              </div>
            </Card>
          );
        })}
      </div>

      <Dialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Agregar Item"
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
            />
            <Input
              label="Unidad"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Stock inicial"
              type="number"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: Number(e.target.value) }))}
            />
            <Input
              label="Stock mínimo"
              type="number"
              value={form.minStock}
              onChange={(e) => setForm((f) => ({ ...f, minStock: Number(e.target.value) }))}
            />
            <Input
              label="Costo unitario"
              type="number"
              step="0.01"
              value={form.costPerUnit}
              onChange={(e) => setForm((f) => ({ ...f, costPerUnit: Number(e.target.value) }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createItem.isPending}>
              {createItem.isPending ? "Creando..." : "Crear"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
