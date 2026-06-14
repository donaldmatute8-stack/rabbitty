"use client";

import { useState, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Input, toast } from "@rabbitty/ui";
import { Store, DollarSign, Clock, Gift, Monitor, Sun, Moon, Edit3, Check, X } from "lucide-react";

export default function SettingsPage() {
  const utils = trpc.useUtils();
  const { data: restaurants, isLoading, error } = trpc.admin.getRestaurants.useQuery();
  const r = restaurants?.[0];

  const update = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      utils.admin.getRestaurants.invalidate();
      toast.success("Configuración actualizada");
    },
    onError: (e) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", taxRate: 0, defaultRewardRate: 0.05, acceptsBunz: true, happyHourStart: "", happyHourEnd: "", happyHourRewardRate: 0.1 });

  // Sync form state when restaurant data becomes available
  useEffect(() => {
    if (r) {
      setForm({
        name: r.name,
        taxRate: r.taxRate,
        defaultRewardRate: r.defaultRewardRate ?? 0.05,
        acceptsBunz: r.acceptsBunz ?? true,
        happyHourStart: r.happyHourStart ?? "",
        happyHourEnd: r.happyHourEnd ?? "",
        happyHourRewardRate: r.happyHourRewardRate ?? 0.1
      });
    }
  }, [r]);

  const startEdit = (section: string) => {
    if (!r) return;
    setForm({
      name: r.name,
      taxRate: r.taxRate,
      defaultRewardRate: r.defaultRewardRate ?? 0.05,
      acceptsBunz: r.acceptsBunz ?? true,
      happyHourStart: r.happyHourStart ?? "",
      happyHourEnd: r.happyHourEnd ?? "",
      happyHourRewardRate: r.happyHourRewardRate ?? 0.1
    });
    setEditing(section);
  };

  const saveSection = () => {
    if (!r) return;
    update.mutate({ id: r.id, ...form });
    setEditing(null);
  };

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-pink-500 border-t-transparent mx-auto" />
          <p className="text-sm text-gray-400 font-bold">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-red-500/20 bg-red-500/10 text-red-400 rounded-3xl max-w-xl">
        <h3 className="font-bold text-lg">Error al cargar la configuración</h3>
        <p className="text-sm mt-1">{error.message}</p>
      </Card>
    );
  }

  if (!r) {
    return (
      <div className="space-y-8 pb-10">
        <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
            Configuración
          </h1>
          <p className="text-gray-400 mt-2 text-sm font-medium">Ajustes generales del sistema</p>
        </div>
        <Card className="p-8 border border-white/5 bg-white/5 backdrop-blur-md rounded-3xl max-w-2xl text-center space-y-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 mx-auto shadow-[0_0_15px_rgba(236,72,153,0.15)]">
            <Store className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">No se encontró ningún restaurante</h3>
            <p className="text-sm text-gray-400 max-w-md mx-auto leading-relaxed">
              Para poder configurar los parámetros generales del sistema, primero debes crear o registrar al menos un restaurante en la sección de Restaurantes.
            </p>
          </div>
          <div className="pt-2">
            <Button onClick={() => window.location.href = "/restaurants"}>
              Ir a Restaurantes
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Configuración
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Ajustes generales del sistema y parámetros operativos</p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Profile Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)] shrink-0">
                <Store className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Perfil del Restaurante</h3>
            </div>
            {editing !== "profile" ? (
              <button 
                onClick={() => startEdit("profile")} 
                className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
              >
                <Edit3 className="h-4.5 w-4.5" />
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setEditing(null)} 
                  className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
                <button 
                  onClick={saveSection} 
                  className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30 transition-all duration-300"
                >
                  <Check className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
          </div>
          {editing === "profile" ? (
            <div className="space-y-3">
              <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Nombre</span>
                <span className="font-bold text-white text-base">{r.name}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Slug</span>
                <span className="font-mono text-gray-300 bg-white/5 px-2 py-0.5 rounded border border-white/5 text-xs">{r.slug}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Estado</span>
                <Badge variant={r.isActive ? "success" : "danger"}>
                  {r.isActive ? "Activo" : "Inactivo"}
                </Badge>
              </div>
            </div>
          )}
        </Card>

        {/* Billing Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)] shrink-0">
                <DollarSign className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Facturación</h3>
            </div>
            {editing !== "billing" ? (
              <button 
                onClick={() => startEdit("billing")} 
                className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
              >
                <Edit3 className="h-4.5 w-4.5" />
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setEditing(null)} 
                  className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
                <button 
                  onClick={saveSection} 
                  className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30 transition-all duration-300"
                >
                  <Check className="h-4.5 w-4.5" />
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
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Moneda</span>
                <span className="font-bold text-white uppercase">{r.currency}</span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Tasa de IVA</span>
                <span className="font-bold text-white">{(r.taxRate * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </Card>

        {/* Timezone Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Zona Horaria</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 font-medium">Zona</span>
              <span className="font-bold text-white font-mono bg-white/5 px-2.5 py-1 rounded border border-white/5 text-xs">{r.timezone}</span>
            </div>
          </div>
        </Card>

        {/* Rewards Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.15)] shrink-0">
                <Gift className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-white text-base">Bunz Rewards</h3>
            </div>
            {editing !== "bunz" ? (
              <button 
                onClick={() => startEdit("bunz")} 
                className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
              >
                <Edit3 className="h-4.5 w-4.5" />
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button 
                  onClick={() => setEditing(null)} 
                  className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:bg-white/10 hover:text-white hover:border-white/20 transition-all duration-300"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
                <button 
                  onClick={saveSection} 
                  className="rounded-xl border border-green-500/20 bg-green-500/10 p-2 text-green-400 hover:bg-green-500/20 hover:text-green-300 hover:border-green-500/30 transition-all duration-300"
                >
                  <Check className="h-4.5 w-4.5" />
                </button>
              </div>
            )}
          </div>
          {editing === "bunz" ? (
            <div className="space-y-4">
              <Input
                label="Tasa de recompensa (%)"
                type="number"
                value={form.defaultRewardRate * 100}
                onChange={(e) => setForm((f) => ({ ...f, defaultRewardRate: Number(e.target.value) / 100 }))}
              />
              <label className="flex items-center gap-2.5 text-sm text-gray-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.acceptsBunz}
                  onChange={(e) => setForm((f) => ({ ...f, acceptsBunz: e.target.checked }))}
                  className="h-5 w-5 rounded border-white/10 bg-white/5 text-pink-500 focus:ring-pink-500/20 focus:ring-offset-0 transition-all duration-300 cursor-pointer"
                />
                Acepta Bunz
              </label>

              <div className="mt-4 rounded-2xl bg-white/5 p-5 border border-white/5">
                <h4 className="mb-3 text-sm font-bold text-pink-400">Happy Hours (Promociones Bunz)</h4>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Hora Inicio (ej. 14:00)"
                    type="time"
                    value={form.happyHourStart || ""}
                    onChange={(e) => setForm((f) => ({ ...f, happyHourStart: e.target.value }))}
                  />
                  <Input
                    label="Hora Fin (ej. 18:00)"
                    type="time"
                    value={form.happyHourEnd || ""}
                    onChange={(e) => setForm((f) => ({ ...f, happyHourEnd: e.target.value }))}
                  />
                  <div className="col-span-2">
                    <Input
                      label="Tasa de recompensa en Happy Hour (%)"
                      type="number"
                      value={(form.happyHourRewardRate || 0) * 100}
                      onChange={(e) => setForm((f) => ({ ...f, happyHourRewardRate: Number(e.target.value) / 100 }))}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Tasa de recompensa</span>
                <span className="font-bold text-white">
                  {r.defaultRewardRate != null ? `${(r.defaultRewardRate * 100).toFixed(0)}%` : "5%"}
                </span>
              </div>
              <div className="flex justify-between items-center py-0.5">
                <span className="text-gray-400 font-medium">Acepta Bunz</span>
                <Badge variant={r.acceptsBunz ? "success" : "default"}>
                  {r.acceptsBunz ? "Sí" : "No"}
                </Badge>
              </div>

              {r.happyHourStart && r.happyHourEnd && (
                <div className="mt-4 rounded-2xl bg-pink-500/10 border border-pink-500/20 p-4">
                  <p className="text-xs font-bold text-pink-400 mb-2">Happy Hour Configurado</p>
                  <div className="flex justify-between items-center mb-1 text-xs">
                    <span className="text-pink-300/80 font-medium">Horario</span>
                    <span className="font-bold text-pink-200">{r.happyHourStart} - {r.happyHourEnd}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-pink-300/80 font-medium">Recompensa Happy Hour</span>
                    <span className="font-bold text-pink-200">
                      {r.happyHourRewardRate != null ? `${(r.happyHourRewardRate * 100).toFixed(0)}%` : "N/A"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Appearance Card */}
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5 border border-white/5 text-gray-400 shrink-0">
              <Monitor className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-white text-base">Apariencia</h3>
          </div>
          <div className="space-y-4 text-sm">
            <div className="flex justify-between items-center py-0.5">
              <span className="text-gray-400 font-medium">Tema del Panel</span>
              <div className="flex gap-2.5">
                <button className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-gray-400 hover:bg-white/10 hover:text-white transition-all duration-350 cursor-pointer">
                  <Sun className="h-4 w-4" />
                  Claro
                </button>
                <button className="flex items-center gap-2 rounded-xl border border-pink-500/20 bg-pink-500/15 px-4 py-2.5 text-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.15)] transition-all duration-350 cursor-pointer">
                  <Moon className="h-4 w-4 animate-pulse" />
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
