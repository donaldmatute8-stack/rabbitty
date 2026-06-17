"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, toast } from "@rabbitty/ui";
import { CalendarCheck, Plus, Pencil, Trash2, CalendarDays, DollarSign, Users, Phone, Mail } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  CONFIRMED: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  DEPOSIT_PAID: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  COMPLETED: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/20 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmado",
  DEPOSIT_PAID: "Anticipo Pagado",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
};

export default function CateringPage() {
  const utils = trpc.useUtils();
  const { data: events } = trpc.catering.list.useQuery({});
  const [statusFilter, setStatusFilter] = useState("");
  const createEvent = trpc.catering.create.useMutation({
    onSuccess: () => { utils.catering.list.invalidate(); toast.success("Evento creado"); setDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateEvent = trpc.catering.update.useMutation({
    onSuccess: () => { utils.catering.list.invalidate(); toast.success("Evento actualizado"); setDialog(false); },
    onError: (e) => toast.error(e.message),
  });
  const deleteEvent = trpc.catering.delete.useMutation({
    onSuccess: () => { utils.catering.list.invalidate(); toast.success("Evento eliminado"); },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    branchId: "b1",
    eventName: "", eventDate: "", partySize: 1,
    customerName: "", customerPhone: "", customerEmail: "",
    deposit: 0, totalAmount: 0, notes: "", status: "PENDING",
  });

  const openEdit = (ev: any) => {
    setForm({
      branchId: ev.branchId, eventName: ev.eventName,
      eventDate: ev.eventDate ? new Date(ev.eventDate).toISOString().split("T")[0] : "",
      partySize: ev.partySize, customerName: ev.customerName,
      customerPhone: ev.customerPhone ?? "", customerEmail: ev.customerEmail ?? "",
      deposit: ev.deposit ?? 0, totalAmount: ev.totalAmount ?? 0,
      notes: ev.notes ?? "", status: ev.status ?? "PENDING",
    });
    setEditing(ev.id);
    setDialog(true);
  };

  const save = () => {
    if (editing) {
      updateEvent.mutate({ id: editing, ...form });
    } else {
      createEvent.mutate(form);
    }
  };

  const filtered = events?.filter((e) => !statusFilter || e.status === statusFilter) ?? [];

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Eventos & Catering
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Gestión de eventos, menús personalizados y contratos</p>
          </div>
          <Button onClick={() => { setEditing(null); setForm({ branchId: "b1", eventName: "", eventDate: "", partySize: 1, customerName: "", customerPhone: "", customerEmail: "", deposit: 0, totalAmount: 0, notes: "" }); setDialog(true); }}>
            <Plus className="h-4 w-4" />
            Nuevo Evento
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {["", "PENDING", "CONFIRMED", "DEPOSIT_PAID", "COMPLETED", "CANCELLED"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
              statusFilter === s
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "text-gray-400 border border-white/5 hover:border-white/20"
            }`}
          >
            {s === "" ? "Todos" : STATUS_LABELS[s] ?? s}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((ev) => (
          <Card key={ev.id} className="p-6 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
                  <CalendarCheck className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white">{ev.eventName}</h3>
                  <p className="text-xs text-gray-400">{ev.customerName}</p>
                </div>
              </div>
              <Badge variant="default" className={STATUS_COLORS[ev.status]}>
                {STATUS_LABELS[ev.status] ?? ev.status}
              </Badge>
            </div>

            <div className="space-y-2 text-sm">
              <p className="text-gray-400 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-gray-500" />
                {ev.eventDate ? new Date(ev.eventDate).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "—"}
              </p>
              <p className="text-gray-400 flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                {ev.partySize} personas
              </p>
              {ev.customerPhone && (
                <p className="text-gray-400 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  {ev.customerPhone}
                </p>
              )}
              {ev.customerEmail && (
                <p className="text-gray-400 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-gray-500" />
                  {ev.customerEmail}
                </p>
              )}
              <div className="flex gap-4 pt-2">
                <p className="text-xs text-gray-500">
                  Anticipo: <span className="text-amber-400 font-bold">${ev.deposit.toFixed(2)}</span>
                </p>
                <p className="text-xs text-gray-500">
                  Total: <span className="text-green-400 font-bold">${ev.totalAmount.toFixed(2)}</span>
                </p>
              </div>
            </div>

            {ev.notes && (
              <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-white/5">{ev.notes}</p>
            )}

            <div className="flex gap-2 mt-4 pt-4 border-t border-white/5">
              <Button variant="secondary" size="sm" onClick={() => openEdit(ev)}>
                <Pencil className="h-4 w-4 mr-1" /> Editar
              </Button>
              <button
                onClick={() => deleteEvent.mutate({ id: ev.id })}
                className="rounded-xl border border-red-500/10 bg-red-500/5 p-2 text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 transition-all duration-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </Card>
        ))}
        {!filtered.length && (
          <div className="col-span-full py-16 text-center">
            <CalendarCheck className="h-12 w-12 text-gray-500 mx-auto mb-4" />
            <p className="text-lg font-bold text-gray-300">No hay eventos</p>
            <p className="text-sm text-gray-500 mt-1">Crea tu primer evento de catering</p>
          </div>
        )}
      </div>

      <Dialog open={dialog} onClose={() => setDialog(false)} title={editing ? "Editar Evento" : "Nuevo Evento"}>
        <div className="space-y-4">
          <Input label="Nombre del Evento" value={form.eventName} onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha" type="date" value={form.eventDate} onChange={(e) => setForm((f) => ({ ...f, eventDate: e.target.value }))} />
            <Input label="Personas" type="number" value={form.partySize} onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))} />
          </div>
          <Input label="Cliente" value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Teléfono" value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} />
            <Input label="Email" type="email" value={form.customerEmail} onChange={(e) => setForm((f) => ({ ...f, customerEmail: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Anticipo ($)" type="number" step="0.01" value={form.deposit} onChange={(e) => setForm((f) => ({ ...f, deposit: Number(e.target.value) }))} />
            <Input label="Total ($)" type="number" step="0.01" value={form.totalAmount} onChange={(e) => setForm((f) => ({ ...f, totalAmount: Number(e.target.value) }))} />
          </div>
          {editing && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Estado</label>
              <select
                value={form.status || "PENDING"}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
              >
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k} className="bg-gray-900">{v}</option>
                ))}
              </select>
            </div>
          )}
          <Input label="Notas" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={save} disabled={createEvent.isPending || !form.eventName || !form.customerName}>
              {editing ? "Actualizar" : "Crear Evento"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
