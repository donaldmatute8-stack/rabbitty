"use client";

import { useState } from "react";
import { trpc } from "../../lib/trpc-client";
import { Card, Badge, Button, Input, toast } from "@rabbitty/ui";
import { Store, DollarSign, Clock, Gift, Monitor, Sun, Moon, Edit3, Check, X } from "lucide-react";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: restaurants } = trpc.admin.getRestaurants.useQuery();
  const r = restaurants?.[0];

  const update = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      utils.admin.getRestaurants.invalidate();
      toast.success("Configuración actualizada");
    },
    onError: (e) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", taxRate: 0, defaultRewardRate: 0.05, acceptsBunz: true });

  const startEdit = (section: string) => {
    if (!r) return;
    setForm({ name: r.name, taxRate: r.taxRate, defaultRewardRate: r.defaultRewardRate ?? 0.05, acceptsBunz: r.acceptsBunz ?? true });
    setEditing(section);
  };

  const saveSection = () => {
    if (!r) return;
    update.mutate({ id: r.id, ...form });
    setEditing(null);
  };

  if (!r) return <div className="text-sm text-gray-400">Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-sm text-gray-500">Ajustes generales del sistema</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100">
                <Store className="h-5 w-5 text-pink-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Perfil del Restaurante</h3>
            </div>
            {editing !== "profile" ? (
              <button onClick={() => startEdit("profile")} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <Edit3 className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
                <button onClick={saveSection} className="rounded-lg p-1.5 text-green-600 hover:bg-green-50">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {editing === "profile" ? (
            <div className="space-y-3">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nombre</span>
                <span className="font-semibold text-gray-900">{r.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Slug</span>
                <span className="font-semibold text-gray-900">{r.slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado</span>
                <Badge variant={r.isActive ? "success" : "danger"}>
                  {r.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
                <DollarSign className="h-5 w-5 text-emerald-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Facturación</h3>
            </div>
            {editing !== "billing" ? (
              <button onClick={() => startEdit("billing")} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <Edit3 className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
                <button onClick={saveSection} className="rounded-lg p-1.5 text-green-600 hover:bg-green-50">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {editing === "billing" ? (
            <Input
              label="Tasa de IVA (%)"
              type="number"
              value={form.taxRate * 100}
              onChange={(e) => setForm((f) => ({ ...f, taxRate: Number(e.target.value) / 100 }))}
            />
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Moneda</span>
                <span className="font-semibold text-gray-900">{r.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tasa de IVA</span>
                <span className="font-semibold text-gray-900">{(r.taxRate * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Zona Horaria</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Zona</span>
              <span className="font-semibold text-gray-900">{r.timezone}</span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100">
                <Gift className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900">Bunz Rewards</h3>
            </div>
            {editing !== "bunz" ? (
              <button onClick={() => startEdit("bunz")} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <Edit3 className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex gap-1">
                <button onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                  <X className="h-4 w-4" />
                </button>
                <button onClick={saveSection} className="rounded-lg p-1.5 text-green-600 hover:bg-green-50">
                  <Check className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {editing === "bunz" ? (
            <div className="space-y-3">
              <Input
                label="Tasa de recompensa (%)"
                type="number"
                value={form.defaultRewardRate * 100}
                onChange={(e) => setForm((f) => ({ ...f, defaultRewardRate: Number(e.target.value) / 100 }))}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.acceptsBunz}
                  onChange={(e) => setForm((f) => ({ ...f, acceptsBunz: e.target.checked }))}
                  className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                />
                Acepta Bunz
              </label>
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Tasa de recompensa</span>
                <span className="font-semibold text-gray-900">
                  {r.defaultRewardRate != null ? `${(r.defaultRewardRate * 100).toFixed(0)}%` : "5%"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Acepta Bunz</span>
                <Badge variant={r.acceptsBunz ? "success" : "default"}>
                  {r.acceptsBunz ? "Sí" : "No"}
                </Badge>
              </div>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
              <Monitor className="h-5 w-5 text-gray-600" />
            </div>
            <h3 className="font-semibold text-gray-900">Apariencia</h3>
          </div>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tema</span>
              <div className="flex gap-2">
                <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-gray-700">
                  <Sun className="h-3.5 w-3.5" />
                  Claro
                </button>
                <button className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-gray-400">
                  <Moon className="h-3.5 w-3.5" />
                  Oscuro
                </button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
