"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, toast } from "@rabbitty/ui";
import { DollarSign, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Clock, Hash, Percent, ArrowUpDown } from "lucide-react";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function PricingPage() {
  const utils = trpc.useUtils();
  const { data: rules } = trpc.pricing.list.useQuery({});
  const createRule = trpc.pricing.create.useMutation({
    onSuccess: () => { utils.pricing.list.invalidate(); toast.success("Regla creada"); setDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateRule = trpc.pricing.update.useMutation({
    onSuccess: () => { utils.pricing.list.invalidate(); toast.success("Regla actualizada"); setDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteRule = trpc.pricing.delete.useMutation({
    onSuccess: () => { utils.pricing.list.invalidate(); toast.success("Regla eliminada"); },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    branchId: "b1", name: "", priority: 0, adjustmentType: "PERCENTAGE",
    adjustmentValue: 10, dayOfWeek: "", startTime: "", endTime: "",
    minPrice: "", maxPrice: "",
  });

  const openEdit = (r: any) => {
    setForm({
      branchId: r.branchId, name: r.name, priority: r.priority ?? 0,
      adjustmentType: r.adjustmentType, adjustmentValue: r.adjustmentValue,
      dayOfWeek: r.dayOfWeek?.toString() ?? "",
      startTime: r.startTime ?? "", endTime: r.endTime ?? "",
      minPrice: r.minPrice?.toString() ?? "", maxPrice: r.maxPrice?.toString() ?? "",
    });
    setEditing(r.id);
    setDialog(true);
  };

  const save = () => {
    const data: any = { ...form };
    if (editing) {
      const payload: any = { id: editing };
      for (const [k, v] of Object.entries(data)) {
        if (k === "branchId") continue;
        if (k === "dayOfWeek") { payload[k] = v === "" ? undefined : parseInt(v); }
        else if (k === "minPrice" || k === "maxPrice") { payload[k] = v === "" ? undefined : parseFloat(v); }
        else if (k === "priority") { payload[k] = parseInt(v); }
        else if (k === "adjustmentValue") { payload[k] = parseFloat(v); }
        else { payload[k] = v; }
      }
      updateRule.mutate(payload);
    } else {
      data.branchId = "b1";
      if (data.dayOfWeek === "") data.dayOfWeek = undefined;
      else data.dayOfWeek = parseInt(data.dayOfWeek);
      if (data.minPrice === "") data.minPrice = undefined;
      else data.minPrice = parseFloat(data.minPrice);
      if (data.maxPrice === "") data.maxPrice = undefined;
      else data.maxPrice = parseFloat(data.maxPrice);
      data.adjustmentValue = parseFloat(data.adjustmentValue);
      data.priority = parseInt(data.priority);
      createRule.mutate(data);
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Precios Dinámicos
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Reglas de precio automáticas según hora, día y demanda</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ branchId: "b1", name: "", priority: 0, adjustmentType: "PERCENTAGE", adjustmentValue: 10, dayOfWeek: "", startTime: "", endTime: "", minPrice: "", maxPrice: "" }); setDialog(true); }}>
            <Plus className="h-4 w-4" />
            Nueva Regla
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <p className="text-sm text-gray-400 font-semibold mb-1">Reglas Activas</p>
          <p className="text-2xl font-black text-green-400">{rules?.filter((r) => r.isActive).length ?? 0}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <p className="text-sm text-gray-400 font-semibold mb-1">Reglas Inactivas</p>
          <p className="text-2xl font-black text-gray-400">{rules?.filter((r) => !r.isActive).length ?? 0}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <p className="text-sm text-gray-400 font-semibold mb-1">Porcentaje</p>
          <p className="text-2xl font-black text-amber-400">{rules?.filter((r) => r.adjustmentType === "PERCENTAGE").length ?? 0}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
          <p className="text-sm text-gray-400 font-semibold mb-1">Monto Fijo</p>
          <p className="text-2xl font-black text-blue-400">{rules?.filter((r) => r.adjustmentType === "FIXED").length ?? 0}</p>
        </Card>
      </div>

      <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
        <h3 className="font-bold text-lg text-white mb-6">Reglas de Precio</h3>
        <div className="space-y-3">
          {rules?.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/5 p-4 hover:border-white/10 transition-all">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                  {rule.adjustmentType === "PERCENTAGE" ? <Percent className="h-5 w-5 text-amber-400" /> : <DollarSign className="h-5 w-5 text-blue-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-white">{rule.name}</p>
                    <Badge variant="default" className={rule.isActive ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-gray-500/20 text-gray-400 border-gray-500/30"}>
                      {rule.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 flex items-center gap-3 mt-0.5">
                    {rule.dayOfWeek !== null && (
                      <span><Hash className="h-3 w-3 inline" /> {DAYS[rule.dayOfWeek]}</span>
                    )}
                    {(rule.startTime || rule.endTime) && (
                      <span><Clock className="h-3 w-3 inline" /> {rule.startTime ?? "00:00"} - {rule.endTime ?? "23:59"}</span>
                    )}
                    <span>
                      <ArrowUpDown className="h-3 w-3 inline" />{" "}
                      {rule.adjustmentType === "PERCENTAGE" ? `${rule.adjustmentValue >= 0 ? "+" : ""}${rule.adjustmentValue}%` : `$${rule.adjustmentValue.toFixed(2)}`}
                    </span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateRule.mutate({ id: rule.id, isActive: !rule.isActive })}
                  className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:text-white transition-all"
                >
                  {rule.isActive ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4" />}
                </button>
                <button onClick={() => openEdit(rule)} className="rounded-xl border border-white/5 bg-white/5 p-2 text-gray-400 hover:text-white transition-all">
                  <Pencil className="h-4 w-4" />
                </button>
                <button onClick={() => deleteRule.mutate({ id: rule.id })} className="rounded-xl border border-red-500/10 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all duration-300">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {!rules?.length && (
            <div className="py-12 text-center">
              <DollarSign className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-lg font-bold text-gray-300">Sin reglas de precio</p>
              <p className="text-sm text-gray-500 mt-1">Crea tu primera regla para ajustar precios automáticamente</p>
            </div>
          )}
        </div>
      </Card>

      <Dialog open={dialog} onClose={() => setDialog(false)} title={editing ? "Editar Regla" : "Nueva Regla de Precio"}>
        <div className="space-y-4">
          <Input label="Nombre" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tipo</label>
              <select value={form.adjustmentType} onChange={(e) => setForm((f) => ({ ...f, adjustmentType: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none">
                <option value="PERCENTAGE" className="bg-gray-900">Porcentaje (%)</option>
                <option value="FIXED" className="bg-gray-900">Monto Fijo ($)</option>
              </select>
            </div>
            <Input label={form.adjustmentType === "PERCENTAGE" ? "Valor (%)" : "Valor ($)"} type="number" step="0.01" value={form.adjustmentValue} onChange={(e) => setForm((f) => ({ ...f, adjustmentValue: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Prioridad" type="number" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} />
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Día</label>
              <select value={form.dayOfWeek} onChange={(e) => setForm((f) => ({ ...f, dayOfWeek: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none">
                <option value="" className="bg-gray-900">Todos los días</option>
                {DAYS.map((d, i) => (
                  <option key={i} value={i} className="bg-gray-900">{d}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Hora inicio" type="time" value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            <Input label="Hora fin" type="time" value={form.endTime} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Precio mínimo" type="number" step="0.01" value={form.minPrice} onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))} />
            <Input label="Precio máximo" type="number" step="0.01" value={form.maxPrice} onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={save} disabled={!form.name}>
              {editing ? "Actualizar" : "Crear Regla"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
