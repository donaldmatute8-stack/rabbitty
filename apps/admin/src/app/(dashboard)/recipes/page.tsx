"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, Select, toast } from "@rabbitty/ui";
import { Salad, Plus, Trash2, DollarSign, PieChart, Scale, ChevronRight, Search } from "lucide-react";

const recipeUnits = [
  { value: "pz", label: "Pieza (pz)" },
  { value: "kg", label: "Kilogramo (kg)" },
  { value: "gr", label: "Gramo (gr)" },
  { value: "L", label: "Litro (L)" },
  { value: "ml", label: "Mililitro (ml)" },
  { value: "cucharada", label: "Cucharada (15ml)" },
  { value: "cucharadita", label: "Cucharadita (5ml)" },
  { value: "taza", label: "Taza (250ml)" },
  { value: "pizca", label: "Pizca" },
  { value: "puñado", label: "Puñado" },
];

export default function RecipesPage() {
  const utils = trpc.useUtils();
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery({});
  const { data: inventoryItems } = trpc.inventory.getItems.useQuery({});

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const { data: recipe } = trpc.inventory.getRecipe.useQuery(
    { menuItemId: selectedItemId ?? "" },
    { enabled: !!selectedItemId }
  );

  const addIngredient = trpc.inventory.addRecipeIngredient.useMutation({
    onSuccess: () => {
      utils.inventory.getRecipe.invalidate();
      toast.success("Ingrediente agregado");
      setIngForm({ inventoryItemId: "", quantityRequired: 0, unit: "pz" });
      setDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const [ingForm, setIngForm] = useState({ inventoryItemId: "", quantityRequired: 0, unit: "pz" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedItem = menuItems?.find((i) => i.id === selectedItemId);

  const totalCost = recipe?.reduce((sum, ing) => {
    const invItem = inventoryItems?.find((i) => i.id === ing.inventoryItemId);
    return sum + (invItem?.costPerUnit ?? 0) * ing.quantityRequired;
  }, 0) ?? 0;

  const margin = selectedItem && selectedItem.price > 0
    ? ((selectedItem.price - totalCost) / selectedItem.price) * 100
    : 0;

  const filteredItems = menuItems?.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
            Recetas y Costeo
          </h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">Gestiona ingredientes por platillo y calcula costos reales</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card className="p-4 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar platillo..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all"
                />
              </div>
            </div>
            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {filteredItems?.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSelectedItemId(item.id)}
                  className={`w-full flex items-center justify-between rounded-xl px-4 py-3 text-left transition-all ${
                    selectedItemId === item.id
                      ? "bg-pink-500/10 border border-pink-500/20 text-pink-400"
                      : "hover:bg-white/5 border border-transparent text-gray-300 hover:text-white"
                  }`}
                >
                  <div>
                    <p className="text-sm font-bold">{item.name}</p>
                    <p className="text-xs text-gray-500">${Number(item.price).toFixed(2)}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 opacity-50" />
                </button>
              ))}
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {!selectedItemId ? (
            <Card className="p-12 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
                  <Salad className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-lg font-bold text-gray-300">Selecciona un platillo</p>
                <p className="text-sm text-gray-500 mt-1">Elige un platillo del menú para ver o editar su receta</p>
              </div>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 grid-cols-3">
                <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <DollarSign className="h-5 w-5 text-green-400" />
                    <span className="text-sm text-gray-400 font-semibold">Precio Venta</span>
                  </div>
                  <p className="text-2xl font-black text-white">${Number(selectedItem?.price ?? 0).toFixed(2)}</p>
                </Card>
                <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <Scale className="h-5 w-5 text-blue-400" />
                    <span className="text-sm text-gray-400 font-semibold">Costo Receta</span>
                  </div>
                  <p className="text-2xl font-black text-white">${totalCost.toFixed(2)}</p>
                </Card>
                <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-3">
                    <PieChart className="h-5 w-5 text-amber-400" />
                    <span className="text-sm text-gray-400 font-semibold">Margen</span>
                  </div>
                  <p className={`text-2xl font-black ${margin >= 50 ? "text-green-400" : margin >= 30 ? "text-amber-400" : "text-red-400"}`}>
                    {margin.toFixed(1)}%
                  </p>
                </Card>
              </div>

              <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="font-bold text-lg text-white">Ingredientes</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{recipe?.length ?? 0} ingredientes en la receta</p>
                  </div>
                  <Button onClick={() => { setIngForm({ inventoryItemId: "", quantityRequired: 0, unit: "pz" }); setDialogOpen(true); }}>
                    <Plus className="h-4 w-4" />
                    Agregar Ingrediente
                  </Button>
                </div>

                {!recipe?.length ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-500">Esta receta no tiene ingredientes. Agrega el primero.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recipe.map((ing) => {
                      const invItem = inventoryItems?.find((i) => i.id === ing.inventoryItemId);
                      return (
                        <div key={ing.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4 hover:border-white/10 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/20 flex items-center justify-center">
                              <Scale className="h-5 w-5 text-emerald-400" />
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white">{invItem?.name ?? "—"}</p>
                              <p className="text-xs text-gray-400">
                                {ing.quantityRequired} {ing.unit}
                                {invItem?.costPerUnit ? ` · $${(invItem.costPerUnit * ing.quantityRequired).toFixed(2)}` : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="default">{invItem?.unit ?? ing.unit}</Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Agregar Ingrediente"
      >
        <div className="space-y-4">
          <Select
            label="Ingrediente"
            value={ingForm.inventoryItemId}
            onChange={(e) => setIngForm((f) => ({ ...f, inventoryItemId: e.target.value }))}
            options={inventoryItems?.map((i) => ({ value: i.id, label: `${i.name} (${i.stock} ${i.unit})` })) ?? []}
          />
          <Input
            label="Cantidad requerida"
            type="number"
            step="0.01"
            value={ingForm.quantityRequired}
            onChange={(e) => setIngForm((f) => ({ ...f, quantityRequired: Number(e.target.value) }))}
          />
          <Select
            label="Unidad de Medida"
            value={ingForm.unit}
            onChange={(e) => setIngForm((f) => ({ ...f, unit: e.target.value }))}
            options={recipeUnits}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button onClick={() => {
              if (!selectedItemId) return;
              addIngredient.mutate({
                menuItemId: selectedItemId,
                inventoryItemId: ingForm.inventoryItemId,
                quantityRequired: ingForm.quantityRequired,
                unit: ingForm.unit,
              });
            }} disabled={addIngredient.isPending || !ingForm.inventoryItemId}>
              Agregar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
