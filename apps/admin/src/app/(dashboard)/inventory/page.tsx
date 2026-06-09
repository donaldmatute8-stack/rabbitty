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
    createItem.mutate({ ...form, branchId: process.env.NEXT_PUBLIC_BRANCH_ID ?? "b1" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventario</h1>
          <p className="text-sm text-gray-500">Control de stock y suministros</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Agregar Item
        </Button>
      </div>

      {lowStockItems.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              {lowStockItems.length} producto(s) con stock bajo
            </span>
          </div>
        </Card>
      )}

      <div className="grid gap-3">
        {items?.map((item) => {
          const isLow = item.stock <= item.minStock;

          return (
            <Card key={item.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    isLow ? "bg-red-100" : "bg-blue-100"
                  }`}
                >
                  <Package className={`h-5 w-5 ${isLow ? "text-red-600" : "text-blue-600"}`} />
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                    <span>SKU: {item.sku}</span>
                    <span>•</span>
                    <span>Unidad: {item.unit}</span>
                    <span>•</span>
                    <span>Costo: ${item.costPerUnit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className={`text-lg font-bold ${isLow ? "text-red-600" : "text-gray-900"}`}>
                    {item.stock}
                    <span className="ml-0.5 text-sm font-normal text-gray-400">{item.unit}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Mín: {item.minStock} {item.unit}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    placeholder="0"
                    value={adjustments[item.id] ?? ""}
                    onChange={(e) =>
                      setAdjustments((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))
                    }
                    className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-center text-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
                  />
                  <button
                    onClick={() => handleAdjust(item.id)}
                    disabled={updateStock.isPending}
                    className="rounded-lg bg-pink-600 p-1.5 text-white hover:bg-pink-700 disabled:opacity-50"
                  >
                    {(adjustments[item.id] ?? 0) > 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
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
