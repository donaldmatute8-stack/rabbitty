"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
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
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Restaurantes
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Gestiona tus restaurantes y sucursales</p>
          </div>
          <Button onClick={() => toast.info("Funcionalidad de agregar próximamente")}>
            <Plus className="h-5 w-5" />
            Agregar Restaurante
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {restaurants?.map((r) => (
          <Card key={r.id} className="flex items-center justify-between p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 hover:bg-white/10 transition-all duration-300">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-xl font-black text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)]">
                {r.name.charAt(0)}
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">{r.name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                  <span className="font-mono bg-white/5 px-2 py-0.5 rounded border border-white/5">{r.slug}</span>
                  <span>•</span>
                  <Badge variant={r.isActive ? "success" : "danger"}>
                    {r.isActive ? "Activo" : "Inactivo"}
                  </Badge>
                  <span>•</span>
                  <span className="uppercase text-gray-300 font-semibold">{r.currency}</span>
                  <span>•</span>
                  <span className="text-gray-300 font-semibold">{(r.taxRate * 100).toFixed(0)}% IVA</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border border-white/5 bg-white/5 p-3 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300">
                <MapPin className="h-5 w-5" />
              </button>
              <button
                onClick={() => openEdit(r)}
                className="rounded-xl border border-white/5 bg-white/5 p-3 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
              >
                <Settings className="h-5 w-5" />
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
          <label className="flex items-center gap-2.5 text-sm text-gray-300 font-semibold cursor-pointer">
            <input
              type="checkbox"
              checked={form.acceptsBunz}
              onChange={(e) => setForm((f) => ({ ...f, acceptsBunz: e.target.checked }))}
              className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all duration-300"
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
