"use client";

import { useState, useMemo } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Button, cn, Dialog } from "@rabbitty/ui";
import { Salad, Plus, Trash2, PieChart, Search, AlertTriangle, Layers, ArrowRight, Settings2, ChevronRight } from "lucide-react";

export default function RecipesPage() {
  const utils = trpc.useUtils();
  const { data: menuItems } = trpc.pos.getMenuItems.useQuery({});
  const { data: inventoryItems } = trpc.inventory.getItems.useQuery({});
  
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [ingDialogOpen, setIngDialogOpen] = useState(false);
  const [ingredientType, setIngredientType] = useState<"raw" | "subrecipe">("raw");
  const [ingForm, setIngForm] = useState({ 
    inventoryItemId: "", 
    subRecipeId: "",
    quantityRequired: 0, 
    unit: "pz" 
  });

  const { data: recipe } = trpc.inventory.getRecipe.useQuery(
    { menuItemId: selectedItemId ?? "" },
    { enabled: !!selectedItemId }
  );

  const addIngredient = trpc.inventory.addRecipeIngredient.useMutation({
    onSuccess: () => {
      utils.inventory.getRecipe.invalidate();
      setIngForm({ inventoryItemId: "", subRecipeId: "", quantityRequired: 0, unit: "pz" });
      setIngDialogOpen(false);
    }
  });

  const removeIngredient = trpc.inventory.removeRecipeIngredient.useMutation({
    onSuccess: () => { utils.inventory.getRecipe.invalidate(); }
  });

  // Calculate Costs
  const selectedItem = menuItems?.find((i) => i.id === selectedItemId);
  
  const totalCost = recipe?.reduce((sum, ing) => {
    if (ing.inventoryItemId) {
      const invItem = inventoryItems?.find((i) => i.id === ing.inventoryItemId);
      return sum + (invItem?.costPerUnit ?? 0) * ing.quantityRequired;
    }
    if (ing.subRecipeId) {
      // For subrecipes we'd ideally recursively calculate cost, but for this demo 
      // we'll assume the subrecipe (menuItem) has its `cost` pre-calculated in DB.
      const subItem = menuItems?.find(i => i.id === ing.subRecipeId);
      return sum + (subItem?.cost ?? 0) * ing.quantityRequired;
    }
    return sum;
  }, 0) ?? 0;

  const margin = selectedItem && selectedItem.price > 0
    ? ((selectedItem.price - totalCost) / selectedItem.price) * 100
    : 0;

  const filteredItems = menuItems?.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 pb-10">
      
      {/* ── Left: Menu Items List ── */}
      <div className="w-[380px] shrink-0 flex flex-col gap-4">
        <div className="rounded-[2rem] border border-white/5 bg-gray-900/60 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.2)]">
              <Salad className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Recetario</h2>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Gestión de escandallos y mermas</p>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
            <input 
              type="text" 
              placeholder="Buscar platillo..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 rounded-2xl border border-white/10 bg-black/50 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-indigo-500/50"
            />
          </div>

          <div className="flex flex-col gap-2 h-[calc(100vh-22rem)] overflow-y-auto custom-scrollbar pr-2">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItemId(item.id)}
                className={cn(
                  "flex items-center justify-between rounded-2xl p-4 text-left transition-all border",
                  selectedItemId === item.id 
                    ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-100 shadow-[0_0_15px_rgba(99,102,241,0.15)]" 
                    : "bg-white/5 border-white/5 text-gray-300 hover:bg-white/10 hover:border-white/10"
                )}
              >
                <div>
                  <div className="font-bold">{item.name}</div>
                  <div className="text-xs mt-1 opacity-70">Costo Ref: ${item.cost?.toFixed(2) || "0.00"}</div>
                </div>
                <ChevronRight className={cn("h-5 w-5", selectedItemId === item.id ? "text-indigo-400" : "text-gray-500")} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Recipe Studio (Bento Layout) ── */}
      <div className="flex-1 flex flex-col gap-6">
        {selectedItemId && selectedItem ? (
          <>
            {/* Bento Grid Top */}
            <div className="grid grid-cols-3 gap-6 shrink-0">
              
              {/* Product Card */}
              <div className="col-span-1 rounded-[2rem] border border-white/5 bg-gray-900/60 p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Platillo</h3>
                <div className="text-3xl font-black text-white leading-tight mb-2">{selectedItem.name}</div>
                <div className="text-2xl font-black text-emerald-400">${selectedItem.price.toFixed(2)}</div>
                <div className="mt-6 flex gap-2">
                  <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs font-bold text-gray-300">Menú Activo</span>
                </div>
              </div>

              {/* Utility Margin Card */}
              <div className="col-span-2 rounded-[2rem] border border-white/5 bg-gray-900/60 p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden flex gap-8 items-center">
                <div className="absolute bottom-0 right-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Finanzas del Platillo</h3>
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <div className="text-sm font-bold text-gray-500 mb-1">Costo de Producción</div>
                      <div className="text-4xl font-black text-rose-400">${totalCost.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-500 mb-1">Utilidad Bruta</div>
                      <div className="text-4xl font-black text-emerald-400">${(selectedItem.price - totalCost).toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                {/* Circular Margin Graph */}
                <div className="shrink-0 flex flex-col items-center justify-center relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="64" cy="64" r="56" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="12" />
                    <circle 
                      cx="64" cy="64" r="56" fill="none" 
                      stroke={margin > 60 ? "#10b981" : margin > 30 ? "#f59e0b" : "#ef4444"} 
                      strokeWidth="12" 
                      strokeDasharray="351.8" 
                      strokeDashoffset={351.8 - (351.8 * margin) / 100}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-white">{margin.toFixed(0)}%</span>
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Margen</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ingredients List */}
            <div className="flex-1 rounded-[2rem] border border-white/5 bg-gray-900/60 p-8 shadow-2xl backdrop-blur-xl flex flex-col">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-black text-white">Ingredientes & Sub-recetas</h3>
                  <p className="text-sm text-gray-400 font-medium mt-1">Lo que compone este platillo en almacén</p>
                </div>
                <button 
                  onClick={() => setIngDialogOpen(true)}
                  className="flex items-center gap-2 rounded-2xl bg-indigo-500 px-5 py-3 text-sm font-bold text-white shadow-[0_5px_20px_rgba(99,102,241,0.3)] hover:bg-indigo-400 transition-all active:scale-95"
                >
                  <Plus className="h-5 w-5" /> Agregar Ingrediente
                </button>
              </div>

              {margin < 30 && (
                <div className="mb-6 flex items-center gap-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-rose-400">
                  <AlertTriangle className="h-6 w-6 shrink-0" />
                  <div>
                    <div className="font-bold text-sm">Alerta de Margen Crítico</div>
                    <div className="text-xs font-medium opacity-80">El costo de los ingredientes supera el 70% del precio de venta. Considera ajustar tu precio o renegociar con proveedores.</div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="grid gap-3">
                  {recipe?.map(ing => {
                    const isSubRecipe = !!ing.subRecipeId;
                    const name = isSubRecipe 
                      ? menuItems?.find(m => m.id === ing.subRecipeId)?.name 
                      : inventoryItems?.find(i => i.id === ing.inventoryItemId)?.name;
                    
                    const unitCost = isSubRecipe
                      ? (menuItems?.find(m => m.id === ing.subRecipeId)?.cost || 0)
                      : (inventoryItems?.find(i => i.id === ing.inventoryItemId)?.costPerUnit || 0);

                    return (
                      <div key={ing.id} className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/5 p-4 hover:border-white/10 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", isSubRecipe ? "bg-orange-500/20 text-orange-400" : "bg-emerald-500/20 text-emerald-400")}>
                            {isSubRecipe ? <Layers className="h-5 w-5" /> : <PieChart className="h-5 w-5" />}
                          </div>
                          <div>
                            <div className="font-bold text-white flex items-center gap-2">
                              {name || "Desconocido"}
                              {isSubRecipe && <span className="rounded bg-orange-500/20 px-1.5 py-0.5 text-[9px] font-black uppercase text-orange-400">Sub-Receta</span>}
                            </div>
                            <div className="text-xs font-medium text-gray-500">
                              Costo Unitario: ${unitCost.toFixed(2)}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <div className="text-lg font-black text-white">{ing.quantityRequired} <span className="text-sm font-bold text-gray-500">{ing.unit}</span></div>
                            <div className="text-xs font-bold text-rose-400">Costo: ${(unitCost * ing.quantityRequired).toFixed(2)}</div>
                          </div>
                          <button onClick={() => removeIngredient.mutate({ id: ing.id })} className="rounded-xl p-2 text-gray-500 hover:bg-rose-500/20 hover:text-rose-400 transition-all">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  {recipe?.length === 0 && (
                    <div className="py-20 text-center text-gray-500">
                      <Settings2 className="h-16 w-16 mx-auto mb-4 opacity-20" />
                      <div className="text-xl font-bold">Sin ingredientes</div>
                      <div className="text-sm mt-1">Este platillo no tiene escandallo configurado.</div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center rounded-[2rem] border border-white/5 bg-gray-900/60 shadow-2xl backdrop-blur-xl">
            <div className="text-center text-gray-500">
              <Salad className="h-24 w-24 mx-auto mb-6 opacity-20" />
              <h2 className="text-2xl font-black">Selecciona un Platillo</h2>
              <p className="text-sm font-medium mt-2">Para visualizar o editar su receta</p>
            </div>
          </div>
        )}
      </div>

      {/* Add Ingredient / Subrecipe Modal */}
      <Dialog open={ingDialogOpen} onClose={() => setIngDialogOpen(false)}>
        <div className="p-8 space-y-6">
          <h2 className="text-3xl font-black text-white">Agregar a Receta</h2>
          
          <div className="flex rounded-xl bg-black border border-white/10 p-1">
            <button 
              onClick={() => setIngredientType("raw")}
              className={cn("flex-1 py-3 text-sm font-bold rounded-lg transition-all", ingredientType === "raw" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white")}
            >
              Materia Prima
            </button>
            <button 
              onClick={() => setIngredientType("subrecipe")}
              className={cn("flex-1 py-3 text-sm font-bold rounded-lg transition-all", ingredientType === "subrecipe" ? "bg-white/10 text-white" : "text-gray-500 hover:text-white")}
            >
              Sub-Receta (Salsas, Masas)
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-bold text-gray-400 mb-2 block">
                {ingredientType === "raw" ? "Elemento de Inventario" : "Platillo / Sub-receta"}
              </label>
              <select 
                value={ingredientType === "raw" ? ingForm.inventoryItemId : ingForm.subRecipeId}
                onChange={(e) => setIngForm({ ...ingForm, [ingredientType === "raw" ? "inventoryItemId" : "subRecipeId"]: e.target.value })}
                className="w-full rounded-xl border border-white/10 bg-black/50 p-4 text-white focus:border-indigo-500/50 outline-none"
              >
                <option value="">Selecciona...</option>
                {ingredientType === "raw" 
                  ? inventoryItems?.map(i => <option key={i.id} value={i.id}>{i.name}</option>)
                  : menuItems?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                }
              </select>
            </div>
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="text-sm font-bold text-gray-400 mb-2 block">Cantidad</label>
                <input 
                  type="number" step="0.01" 
                  value={ingForm.quantityRequired || ""}
                  onChange={(e) => setIngForm({ ...ingForm, quantityRequired: parseFloat(e.target.value) })}
                  className="w-full rounded-xl border border-white/10 bg-black/50 p-4 text-white outline-none focus:border-indigo-500/50"
                  placeholder="0.00"
                />
              </div>
              <div className="w-1/3">
                <label className="text-sm font-bold text-gray-400 mb-2 block">Unidad</label>
                <select 
                  value={ingForm.unit}
                  onChange={(e) => setIngForm({ ...ingForm, unit: e.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-black/50 p-4 text-white outline-none focus:border-indigo-500/50"
                >
                  <option value="pz">Piezas</option>
                  <option value="kg">Kilos</option>
                  <option value="gr">Gramos</option>
                  <option value="L">Litros</option>
                  <option value="ml">Mililitros</option>
                </select>
              </div>
            </div>
          </div>

          <button 
            onClick={() => addIngredient.mutate({
              menuItemId: selectedItemId!,
              inventoryItemId: ingredientType === "raw" ? ingForm.inventoryItemId : undefined,
              subRecipeId: ingredientType === "subrecipe" ? ingForm.subRecipeId : undefined,
              quantityRequired: ingForm.quantityRequired,
              unit: ingForm.unit
            })}
            disabled={!ingForm.quantityRequired || (ingredientType === "raw" ? !ingForm.inventoryItemId : !ingForm.subRecipeId)}
            className="w-full rounded-2xl bg-indigo-500 py-4 text-lg font-black text-white shadow-[0_10px_20px_rgba(99,102,241,0.3)] hover:bg-indigo-400 disabled:opacity-50 transition-all active:scale-95"
          >
            AÑADIR A LA RECETA
          </button>
        </div>
      </Dialog>
    </div>
  );
}
