"use client";

import { useState } from "react";
import { trpc } from "../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, toast } from "@rabbitty/ui";
import { Plus, Settings, MapPin } from "lucide-react";

export default function RestaurantsPage() {
  const utils = trpc.useUtils();
  const { data: restaurants } = trpc.admin.getRestaurants.useQuery();
  const updateRestaurant = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      utils.admin.getRestaurants.invalidate();
      toast.success("Restaurante actualizado");
      setEditDialog(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const [editDialog, setEditDialog] = useState<Record<string, any> | null>(null);
  const [form, setForm] = useState({ name: "", taxRate: 0, defaultRewardRate: 0, acceptsBunz: false });

  const openEdit = (r: any) => {
    setEditDialog(r);
    setForm({ name: r.name, taxRate: r.taxRate, defaultRewardRate: r.defaultRewardRate ?? 0.05, acceptsBunz: r.acceptsBunz ?? true });
  };

  const handleSave = () => {
    if (!editDialog) return;
    updateRestaurant.mutate({ id: editDialog.id, ...form });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Restaurantes</h1>
          <p className="text-sm text-gray-500">Gestiona tus restaurantes y sucursales</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          Agregar Restaurante
        </Button>
      </div>

      <div className="grid gap-4">
        {restaurants?.map((r) => (
          <Card key={r.id} className="flex items-center justify-between p-5">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-pink-100 text-lg font-bold text-pink-600">
                {r.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{r.name}</h3>
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                  <span>{r.slug}</span>
                  <Badge variant={r.isActive ? "success" : "danger"}>
                    {r.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                  <span>{r.currency}</span>
                  <span>{(r.taxRate * 100).toFixed(0)}% IVA</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50">
                <MapPin className="h-4 w-4" />
              </button>
              <button
                onClick={() => openEdit(r)}
                className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Dialog
        open={!!editDialog}
        onClose={() => setEditDialog(null)}
        title="Editar Restaurante"
      >
        <div className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="IVA (%)"
              type="number"
              value={form.taxRate * 100}
              onChange={(e) => setForm((f) => ({ ...f, taxRate: Number(e.target.value) / 100 }))}
            />
            <Input
              label="Reward Rate (%)"
              type="number"
              value={form.defaultRewardRate * 100}
              onChange={(e) => setForm((f) => ({ ...f, defaultRewardRate: Number(e.target.value) / 100 }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.acceptsBunz}
              onChange={(e) => setForm((f) => ({ ...f, acceptsBunz: e.target.checked }))}
              className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
            />
            Acepta Bunz
          </label>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setEditDialog(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateRestaurant.isPending}>
              {updateRestaurant.isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
