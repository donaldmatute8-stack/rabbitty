"use client";

import { useState } from "react";
import { trpc } from "../../lib/trpc-client";
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
      createItem.mutate({ ...itemForm, branchId: process.env.NEXT_PUBLIC_BRANCH_ID ?? "b1" });
    } else if (itemDialog?.id) {
      updateItem.mutate({ id: itemDialog.id, ...itemForm });
    }
  };

  const saveCategory = () => {
    if (catDialog?.mode === "create") {
      createCategory.mutate({ ...catForm, branchId: process.env.NEXT_PUBLIC_BRANCH_ID ?? "b1" });
    } else if (catDialog?.id) {
      updateCategory.mutate({ id: catDialog.id, name: catForm.name });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menú</h1>
          <p className="text-sm text-gray-500">Gestiona los platillos y categorías</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { setCatForm(defaultCatForm); setCatDialog({ mode: "create" }); }}>
            <Tag className="h-4 w-4" />
            Categoría
          </Button>
          <Button onClick={() => { setItemForm(defaultItemForm); setItemDialog({ mode: "create" }); }}>
            <Plus className="h-4 w-4" />
            Agregar Platillo
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium ${
            !activeCategory ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          Todos
        </button>
        {categories?.map((cat) => (
          <div key={cat.id} className="group relative shrink-0">
            <button
              onClick={() => setActiveCategory(cat.name)}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                activeCategory === cat.name ? "bg-pink-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.name}
            </button>
            <div className="absolute -right-1 -top-1 hidden gap-0.5 group-hover:flex">
              <button
                onClick={() => openCatEdit(cat)}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-gray-400 shadow-sm hover:text-gray-600"
              >
                <Pencil className="h-3 w-3" />
              </button>
              <button
                onClick={() => setDeleteConfirm({ type: "category", id: cat.id, name: cat.name })}
                className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-400 shadow-sm hover:text-red-600"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar platillo..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm focus:border-pink-500 focus:outline-none focus:ring-2 focus:ring-pink-500/20"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items
          ?.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
          .map((item) => (
            <Card key={item.id} className="p-4">
              <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                <span className="text-sm">Sin imagen</span>
              </div>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{item.name}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">ID: {item.categoryId.slice(0, 8)}</p>
                </div>
                <Badge variant={item.isAvailable ? "success" : "warning"}>
                  {item.isAvailable ? "Disponible" : "Agotado"}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-gray-500 line-clamp-2">{item.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900">${item.price}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => openItemEdit(item)}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ type: "item", id: item.id, name: item.name })}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={itemForm.isAvailable}
              onChange={(e) => setItemForm((f) => ({ ...f, isAvailable: e.target.checked }))}
              className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
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
        <p className="text-sm text-gray-600">
          ¿Estás seguro de eliminar <strong>{deleteConfirm?.name}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-3 pt-4">
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
            Eliminar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
