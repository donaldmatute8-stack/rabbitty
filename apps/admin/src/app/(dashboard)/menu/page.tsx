"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, Select, toast } from "@rabbitty/ui";
import { Plus, Pencil, Trash2, Search, Tag } from "lucide-react";

type ItemForm = { name: string; description: string; price: number; categoryId: string; isAvailable: boolean };
type CatForm = { name: string; description: string };

const defaultItemForm: ItemForm = { name: "", description: "", price: 0, categoryId: "", isAvailable: true };
const defaultCatForm: CatForm = { name: "", description: "" };

export default function MenuPage() {
  const utils = trpc.useUtils();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { data: categories } = trpc.pos.getCategories.useQuery();
  const { data: items } = trpc.pos.getMenuItems.useQuery(activeCategory ? { categoryId: activeCategory } : {});

  const createItem = trpc.admin.createMenuItem.useMutation({ onSuccess: () => { utils.pos.getMenuItems.invalidate(); utils.pos.getCategories.invalidate(); toast.success("Platillo creado"); setItemDialog(null); }, onError: (e) => toast.error(e.message) });
  const updateItem = trpc.admin.updateMenuItem.useMutation({ onSuccess: () => { utils.pos.getMenuItems.invalidate(); toast.success("Platillo actualizado"); setItemDialog(null); }, onError: (e) => toast.error(e.message) });
  const deleteItem = trpc.admin.deleteMenuItem.useMutation({ onSuccess: () => { utils.pos.getMenuItems.invalidate(); toast.success("Platillo eliminado"); }, onError: (e) => toast.error(e.message) });
  const createCategory = trpc.admin.createCategory.useMutation({ onSuccess: () => { utils.pos.getCategories.invalidate(); toast.success("Categoría creada"); setCatDialog(null); }, onError: (e) => toast.error(e.message) });
  const updateCategory = trpc.admin.updateCategory.useMutation({ onSuccess: () => { utils.pos.getCategories.invalidate(); toast.success("Categoría actualizada"); setCatDialog(null); }, onError: (e) => toast.error(e.message) });
  const deleteCategory = trpc.admin.deleteCategory.useMutation({ onSuccess: () => { utils.pos.getCategories.invalidate(); toast.success("Categoría eliminada"); setCatDialog(null); }, onError: (e) => toast.error(e.message) });

  const [itemDialog, setItemDialog] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(defaultItemForm);
  const [catDialog, setCatDialog] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [catForm, setCatForm] = useState<CatForm>(defaultCatForm);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "item" | "category"; id: string; name: string } | null>(null);

  const openItemEdit = (item: NonNullable<typeof items>[number]) => {
    setItemForm({ name: item.name, description: item.description ?? "", price: item.price, categoryId: item.categoryId, isAvailable: item.isAvailable });
    setItemDialog({ mode: "edit", id: item.id });
  };

  const openCatEdit = (cat: NonNullable<typeof categories>[number]) => {
    setCatForm({ name: cat.name, description: "" });
    setCatDialog({ mode: "edit", id: cat.id });
  };

  const saveItem = () => {
    if (itemDialog?.mode === "create") {
      createItem.mutate({ ...itemForm });
    } else if (itemDialog?.id) {
      updateItem.mutate({ id: itemDialog.id, ...itemForm });
    }
  };

  const saveCategory = () => {
    if (catDialog?.mode === "create") {
      createCategory.mutate({ ...catForm });
    } else if (catDialog?.id) {
      updateCategory.mutate({ id: catDialog.id, name: catForm.name });
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Menú
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Gestiona los platillos y categorías de tu restaurante</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setCatForm(defaultCatForm); setCatDialog({ mode: "create" }); }}>
              <Tag className="h-5 w-5" />
              Categoría
            </Button>
            <Button onClick={() => { setItemForm(defaultItemForm); setItemDialog({ mode: "create" }); }}>
              <Plus className="h-5 w-5" />
              Agregar Platillo
            </Button>
          </div>
        </div>
      </div>

      {/* Category Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
            !activeCategory
              ? "bg-pink-500 text-white shadow-[0_4px_14px_rgba(236,72,153,0.35)] border border-pink-400/20"
              : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5 shadow-sm"
          }`}
        >
          Todos
        </button>
        {categories?.map((cat) => (
          <div key={cat.id} className="group relative shrink-0">
            <button
              onClick={() => setActiveCategory(cat.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-300 ${
                activeCategory === cat.id
                  ? "bg-pink-500 text-white shadow-[0_4px_14px_rgba(236,72,153,0.35)] border border-pink-400/20"
                  : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5 shadow-sm"
              }`}
            >
              {cat.name}
            </button>
            <div className="absolute -right-1.5 -top-1.5 hidden gap-1 group-hover:flex z-20">
              <button
                onClick={() => openCatEdit(cat)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 border border-white/10 text-gray-400 shadow-lg hover:text-white hover:bg-white/10 transition-all"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeleteConfirm({ type: "category", id: cat.id, name: cat.name })}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-900 border border-red-500/20 text-red-400 shadow-lg hover:text-red-300 hover:bg-red-500/20 transition-all"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar platillo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white placeholder:text-gray-500 focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20 transition-all duration-300"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items
          ?.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
          .map((item) => (
            <Card key={item.id} className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-pink-500/20 hover:shadow-[0_0_20px_rgba(236,72,153,0.05)] transition-all duration-300 rounded-2xl flex flex-col justify-between">
              <div>
                <div className="mb-4 flex aspect-video items-center justify-center rounded-xl bg-white/5 text-gray-400 border border-white/5 font-semibold text-sm">
                  <span>Sin imagen</span>
                </div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-lg text-white">{item.name}</h3>
                    <p className="mt-0.5 text-xs text-pink-400 font-semibold">
                      {categories?.find((c) => c.id === item.categoryId)?.name ?? "Sin categoría"}
                    </p>
                  </div>
                  <Badge variant={item.isAvailable ? "success" : "warning"}>
                    {item.isAvailable ? "Disponible" : "Agotado"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-gray-400 line-clamp-2">{item.description}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-xl font-black text-white">${item.price}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => openItemEdit(item)}
                    className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: "item", id: item.id, name: item.name })}
                    className="rounded-xl border border-red-500/10 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-all duration-300"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
      </div>

      <Dialog
        open={!!itemDialog}
        onClose={() => setItemDialog(null)}
        title={itemDialog?.mode === "create" ? "Agregar Platillo" : "Editar Platillo"}
        className="max-w-xl"
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={itemForm.name}
            onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Descripción"
            value={itemForm.description}
            onChange={(e) => setItemForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Precio"
              type="number"
              step="0.01"
              value={itemForm.price}
              onChange={(e) => setItemForm((f) => ({ ...f, price: Number(e.target.value) }))}
            />
            <Select
              label="Categoría"
              value={itemForm.categoryId}
              onChange={(e) => setItemForm((f) => ({ ...f, categoryId: e.target.value }))}
              options={categories?.map((c) => ({ value: c.id, label: c.name })) ?? []}
              placeholder="Seleccionar categoría"
            />
          </div>
          <label className="flex items-center gap-2.5 text-sm text-gray-300 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={itemForm.isAvailable}
              onChange={(e) => setItemForm((f) => ({ ...f, isAvailable: e.target.checked }))}
              className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all duration-300"
            />
            Disponible
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setItemDialog(null)}>Cancelar</Button>
            <Button onClick={saveItem} disabled={createItem.isPending || updateItem.isPending}>
              {itemDialog?.mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!catDialog}
        onClose={() => setCatDialog(null)}
        title={catDialog?.mode === "create" ? "Agregar Categoría" : "Editar Categoría"}
        className="max-w-xl"
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={catForm.name}
            onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Descripción"
            value={catForm.description}
            onChange={(e) => setCatForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCatDialog(null)}>Cancelar</Button>
            <Button onClick={saveCategory} disabled={createCategory.isPending || updateCategory.isPending}>
              {catDialog?.mode === "create" ? "Crear" : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar eliminación"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <Trash2 className="h-5 w-5 shrink-0" />
            <span>Esta acción no se puede deshacer y eliminará el registro permanentemente.</span>
          </div>
          <p className="text-sm text-gray-300">
            ¿Estás seguro de que deseas eliminar{" "}
            {deleteConfirm?.type === "category" ? "la categoría" : "el platillo"}{" "}
            <strong className="text-white font-bold">"{deleteConfirm?.name}"</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "item") deleteItem.mutate({ id: deleteConfirm.id });
                else deleteCategory.mutate({ id: deleteConfirm.id });
                setDeleteConfirm(null);
              }}
              disabled={deleteItem.isPending || deleteCategory.isPending}
            >
              Sí, Eliminar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
