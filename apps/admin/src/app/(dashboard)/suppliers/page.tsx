"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, toast } from "@rabbitty/ui";
import { Truck, Plus, Pencil, Trash2, Package, DollarSign, RefreshCw, Calendar } from "lucide-react";

export default function SuppliersPage() {
  const utils = trpc.useUtils();
  const { data: suppliers } = trpc.suppliers.list.useQuery();
  const { data: inventoryItems } = trpc.inventory.getItems.useQuery({});
  const createSupplier = trpc.suppliers.create.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Proveedor creado"); setDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const updateSupplier = trpc.suppliers.update.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Proveedor actualizado"); setDialog(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSupplier = trpc.suppliers.delete.useMutation({
    onSuccess: () => { utils.suppliers.list.invalidate(); toast.success("Proveedor eliminado"); },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState<{ mode: "create" | "edit"; id?: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [form, setForm] = useState({ name: "", contactName: "", phone: "", email: "", address: "", notes: "" });
  const [poDialog, setPoDialog] = useState<string | null>(null);
  const [poForm, setPoForm] = useState<{ inventoryItemId: string; quantity: number; unitCost: number }[]>([{ inventoryItemId: "", quantity: 1, unitCost: 0 }]);

  const openEdit = (s: NonNullable<typeof suppliers>[number]) => {
    setForm({ name: s.name, contactName: s.contactName ?? "", phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "", notes: s.notes ?? "" });
    setDialog({ mode: "edit", id: s.id });
  };

  const save = () => {
    if (dialog?.mode === "create") {
      createSupplier.mutate(form);
    } else if (dialog?.id) {
      updateSupplier.mutate({ id: dialog.id, ...form });
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Proveedores
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Gestiona tus proveedores y órdenes de compra</p>
          </div>
          <Button onClick={() => { setForm({ name: "", contactName: "", phone: "", email: "", address: "", notes: "" }); setDialog({ mode: "create" }); }}>
            <Plus className="h-4 w-4" />
            Agregar Proveedor
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {suppliers?.map((supplier) => (
          <Card key={supplier.id} className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center">
                  <Truck className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{supplier.name}</h3>
                  {supplier.contactName && (
                    <p className="text-xs text-gray-400">{supplier.contactName}</p>
                  )}
                </div>
              </div>
              <Badge variant={supplier.isActive ? "success" : "default"}>
                {supplier.isActive ? "Activo" : "Inactivo"}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              {supplier.phone && (
                <p className="text-gray-400"><span className="text-gray-500">Tel:</span> {supplier.phone}</p>
              )}
              {supplier.email && (
                <p className="text-gray-400"><span className="text-gray-500">Email:</span> {supplier.email}</p>
              )}
              {supplier.address && (
                <p className="text-gray-400 text-xs"><span className="text-gray-500">Dir:</span> {supplier.address}</p>
              )}
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              <Button variant="secondary" size="sm" onClick={() => openEdit(supplier)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPoDialog(supplier.id)}>
                <Package className="h-4 w-4 mr-1" /> Orden
              </Button>
              <button
                onClick={() => setDeleteConfirm({ id: supplier.id, name: supplier.name })}
                className="rounded-xl border border-red-500/10 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-all duration-300 cursor-pointer"
                title="Eliminar proveedor"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog open={!!dialog} onClose={() => setDialog(null)} title={dialog?.mode === "create" ? "Agregar Proveedor" : "Editar Proveedor"}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Input label="Contacto" value={form.contactName} onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))} />
          <Input label="Teléfono" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          <Input label="Dirección" value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} />
          <Input label="Notas" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={save}>{dialog?.mode === "create" ? "Crear" : "Guardar"}</Button>
          </div>
        </div>
      </Dialog>

      {/* Confirmation Dialog for Deleting Supplier */}
      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Confirmar eliminación de proveedor">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <Trash2 className="h-5 w-5 shrink-0" />
            <span>Esta acción no se puede deshacer.</span>
          </div>
          <p className="text-sm text-gray-300">
            ¿Estás seguro de que deseas eliminar al proveedor <strong className="text-white font-bold">"{deleteConfirm?.name}"</strong>?
          </p>
          <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (deleteConfirm) {
                  deleteSupplier.mutate({ id: deleteConfirm.id });
                  setDeleteConfirm(null);
                }
              }}
              disabled={deleteSupplier.isPending}
            >
              Sí, Eliminar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
