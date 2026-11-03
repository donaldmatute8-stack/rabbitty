"use client";

/**
 * ── Perfil público del negocio (Admin) ──
 * Lo que el Rabbitter ve en la app: "Acerca de", horario, sitio web, dirección y
 * cashback. Antes solo se podía configurar el canal del chat; estos campos no
 * tenían editor en ningún admin y el móvil caía a datos de relleno.
 *
 * Fuente única: ownedBusinesses (vía settings.getBusinessProfile). El mismo
 * registro alimenta /api/business/[id] → tab "Sucursal" del afiliado.
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Store, Save, Globe, Clock, MapPin, Info, RefreshCw } from "lucide-react";
import { Card, Button, Input, toast } from "@rabbitty/ui";
import { trpc } from "../../../lib/trpc-client";

const DAYS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mié" },
  { id: 4, label: "Jue" },
  { id: 5, label: "Vie" },
  { id: 6, label: "Sáb" },
  { id: 7, label: "Dom" },
];

const CATEGORIES = [
  "Restaurante / Cafetería",
  "Bar / Cantina",
  "Pizza / Italiano",
  "Tacos / Mexicano",
  "Hamburguesas",
  "Mariscos",
  "Barbería / Estética",
  "Gym / Fitness",
  "CrossFit",
  "Otro",
];

export default function BusinessProfilePage() {
  const utils = trpc.useUtils();
  const { data, isLoading, refetch } = trpc.settings.getBusinessProfile.useQuery(undefined, { retry: false });
  const save = trpc.settings.updateBusinessProfile.useMutation();

  const biz = data?.business ?? null;

  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    address: "",
    website: "",
    startTime: "09:00",
    endTime: "21:00",
    timezone: "America/Mexico_City",
    activeDays: [1, 2, 3, 4, 5, 6, 7] as number[],
    rewardPercentage: "10",
  });

  useEffect(() => {
    if (!biz) return;
    let days: number[] = [1, 2, 3, 4, 5, 6, 7];
    try {
      const parsed = JSON.parse(biz.activeDays || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) days = parsed.map(Number);
    } catch { /* default */ }
    setForm({
      name: biz.name ?? "",
      category: biz.category ?? "",
      description: biz.description ?? "",
      address: biz.address ?? "",
      website: biz.website ?? "",
      startTime: biz.startTime ?? "09:00",
      endTime: biz.endTime ?? "21:00",
      timezone: biz.timezone ?? "America/Mexico_City",
      activeDays: days,
      rewardPercentage: String(biz.rewardPercentage ?? 10),
    });
  }, [biz]);

  const dirty = useMemo(() => {
    if (!biz) return false;
    let days: number[] = [1, 2, 3, 4, 5, 6, 7];
    try {
      const parsed = JSON.parse(biz.activeDays || "[]");
      if (Array.isArray(parsed) && parsed.length > 0) days = parsed.map(Number);
    } catch { /* default */ }
    const sameDays =
      days.length === form.activeDays.length && days.every((d) => form.activeDays.includes(d));
    return (
      form.name !== (biz.name ?? "") ||
      form.description !== (biz.description ?? "") ||
      form.address !== (biz.address ?? "") ||
      form.website !== (biz.website ?? "") ||
      form.startTime !== (biz.startTime ?? "") ||
      form.endTime !== (biz.endTime ?? "") ||
      !sameDays ||
      String(form.rewardPercentage) !== String(biz.rewardPercentage ?? "")
    );
  }, [biz, form]);

  const onSave = async () => {
    if (!form.name.trim()) { toast.error("El nombre no puede quedar vacío"); return; }
    if (form.activeDays.length === 0) { toast.error("Selecciona al menos un día de servicio"); return; }
    try {
      await save.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim() || null,
        address: form.address.trim(),
        website: form.website.trim() || null,
        activeDays: form.activeDays,
        startTime: form.startTime,
        endTime: form.endTime,
        timezone: form.timezone,
        rewardPercentage: Number(form.rewardPercentage) || 10,
      });
      toast.success("✅ Perfil actualizado — ya se ve en la app");
      await utils.settings.getBusinessProfile.invalidate();
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  const toggleDay = (day: number) => {
    setForm((f) => ({
      ...f,
      activeDays: f.activeDays.includes(day)
        ? f.activeDays.filter((d) => d !== day)
        : [...f.activeDays, day].sort(),
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
        <div className="max-w-3xl mx-auto text-sm text-gray-400">Cargando perfil…</div>
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
        <div className="max-w-3xl mx-auto space-y-3">
          <h1 className="text-2xl font-black text-white">Perfil del negocio</h1>
          <p className="text-sm text-gray-400">
            Esta cuenta no tiene un comercio afiliado asociado. Si eres staff, pide al dueño que lo configure.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-pink-500/15 border border-pink-500/30">
            <Store className="h-7 w-7 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Perfil del negocio</h1>
            <p className="text-xs text-gray-400">Lo que ve el Rabbitter en la app · tab &ldquo;Sucursal&rdquo;</p>
          </div>
          <Button
            variant="secondary"
            onClick={() => void refetch()}
            className="ml-auto rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Identidad */}
        <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Info className="h-4 w-4 text-pink-400" /> Identidad
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400">Nombre del negocio</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-black/50 border-white/10 text-white text-xs h-9 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400">Categoría</label>
              <div className="w-full mt-1 h-9 rounded-lg bg-black/30 border border-white/10 text-gray-400 text-xs px-2 flex items-center" title="La categoría la define Rabbitty al dar de alta el afiliado (afecta el tema del feed)">
                {form.category || "Sin categoría"}
              </div>
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400">Acerca de</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              maxLength={600}
              placeholder="Describe tu local: qué te hace especial, qué sirves, el ambiente…"
              className="w-full mt-1 rounded-lg bg-black/50 border border-white/10 text-white text-xs p-2.5 resize-none"
            />
            <p className="text-[10px] text-gray-500 mt-1">{form.description.length}/600 · visible en &ldquo;Acerca de&rdquo;</p>
          </div>
        </Card>

        {/* Ubicación y sitio web */}
        <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <MapPin className="h-4 w-4 text-emerald-400" /> Ubicación & sitio
          </h2>
          <div>
            <label className="text-[11px] font-bold text-gray-400">Dirección</label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="bg-black/50 border-white/10 text-white text-xs h-9 mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-400 flex items-center gap-1">
              <Globe className="h-3 w-3" /> Sitio web
            </label>
            <Input
              value={form.website}
              onChange={(e) => setForm({ ...form, website: e.target.value })}
              placeholder="midominio.com"
              className="bg-black/50 border-white/10 text-white text-xs h-9 mt-1"
            />
            <p className="text-[10px] text-gray-500 mt-1">
              Vacío = la app no muestra el bloque &ldquo;Sitio Web Oficial&rdquo; (antes mostraba un enlace de relleno).
            </p>
          </div>
        </Card>

        {/* Horario */}
        <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
          <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-400" /> Horario de servicio
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {DAYS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => toggleDay(d.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all cursor-pointer border ${
                  form.activeDays.includes(d.id)
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-gray-400">Abre</label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="bg-black/50 border-white/10 text-white text-xs h-9 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400">Cierra</label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="bg-black/50 border-white/10 text-white text-xs h-9 mt-1"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-400">Zona horaria</label>
              <Input
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="bg-black/50 border-white/10 text-white text-xs h-9 mt-1"
              />
            </div>
          </div>
          <p className="text-[10px] text-gray-500">
            La app calcula &ldquo;Abierto ahora&rdquo; / &ldquo;Cerrado&rdquo; con estos días y horas (no con un texto fijo).
          </p>
        </Card>

        {/* Cashback */}
        <Card className="p-5 border border-white/10 bg-white/5 space-y-3">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">🎁 Cashback Bunz</h2>
          <div className="flex items-center gap-3">
            <Input
              inputMode="numeric"
              value={form.rewardPercentage}
              onChange={(e) => setForm({ ...form, rewardPercentage: e.target.value.replace(/[^\d]/g, "") })}
              className="bg-black/50 border-white/10 text-white text-xs h-9 w-24"
            />
            <span className="text-xs text-gray-400">% en Bunz por consumo</span>
          </div>
        </Card>

        <div className="flex items-center justify-between pb-10">
          <p className="text-[11px] text-gray-500">
            {dirty ? "Hay cambios sin guardar" : "Todo guardado"}
          </p>
          <Button
            onClick={() => void onSave()}
            disabled={save.isPending || !dirty}
            className="rounded-xl px-4 py-2 text-xs font-black bg-linear-to-r from-pink-600 to-purple-600 text-white cursor-pointer disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5 mr-1.5" />
            {save.isPending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
