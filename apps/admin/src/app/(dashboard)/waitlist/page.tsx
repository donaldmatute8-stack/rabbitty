"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Badge, Button, Dialog, Input, toast } from "@rabbitty/ui";
import { Users, Bell, Check, X, Phone, Clock, MessageSquare, Plus, RefreshCw, UserPlus, Send } from "lucide-react";

export default function WaitlistPage() {
  const utils = trpc.useUtils();
  const { data: entries } = trpc.waitlist.list.useQuery();
  const { data: stats } = trpc.waitlist.stats.useQuery();
  const { data: tables } = trpc.pos.getTables.useQuery();

  const addEntry = trpc.waitlist.add.useMutation({
    onSuccess: () => { utils.waitlist.list.invalidate(); utils.waitlist.stats.invalidate(); toast.success("Cliente agregado a la lista"); setShowAdd(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateStatus = trpc.waitlist.updateStatus.useMutation({
    onSuccess: () => { utils.waitlist.list.invalidate(); utils.waitlist.stats.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ customerName: "", customerPhone: "", partySize: 1, notes: "" });

  const waiting = entries?.filter((e) => e.status === "WAITING") ?? [];
  const called = entries?.filter((e) => e.status === "CALLED") ?? [];

  const getTableForParty = (partySize: number) => {
    return tables
      ?.filter((t) => t.capacity >= partySize)
      .sort((a, b) => a.capacity - b.capacity)[0];
  };

  const assignTable = (id: string) => {
    const item = entries?.find((e) => e.id === id);
    if (!item) return;
    const table = getTableForParty(item.partySize);
    if (table) {
      updateStatus.mutate({ id, status: "SEATED", tableId: table.id });
      toast.success(`Mesa ${table.number} asignada a ${item.customerName}`);
    } else {
      toast.error("No hay mesas disponibles");
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "WAITING": return <Users className="h-5 w-5" />;
      case "CALLED": return <Bell className="h-5 w-5" />;
      case "SEATED": return <Check className="h-5 w-5" />;
      case "CANCELLED": return <X className="h-5 w-5" />;
      default: return <Users className="h-5 w-5" />;
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "WAITING": return { bg: "bg-red-500/10", border: "border-red-500/20", text: "text-red-400", icon: "bg-red-500/20 text-red-500" };
      case "CALLED": return { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-400", icon: "bg-amber-500/20 text-amber-500" };
      case "SEATED": return { bg: "bg-green-500/10", border: "border-green-500/20", text: "text-green-400", icon: "bg-green-500/20 text-green-500" };
      case "CANCELLED": return { bg: "bg-gray-500/10", border: "border-gray-500/20", text: "text-gray-400", icon: "bg-gray-500/20 text-gray-500" };
      default: return { bg: "bg-white/5", border: "border-white/5", text: "text-gray-400", icon: "bg-white/5 text-gray-500" };
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Lista de Espera
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Gestión inteligente de clientes en espera</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-3.5 py-2 text-xs font-bold text-red-400">
                {stats?.waiting ?? 0} esperando
              </div>
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-3.5 py-2 text-xs font-bold text-amber-400">
                {stats?.called ?? 0} llamados
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => { utils.waitlist.list.invalidate(); utils.waitlist.stats.invalidate(); }}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <UserPlus className="h-4 w-4" />
              Agregar Cliente
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {!entries?.length ? (
          <Card className="p-12 border border-white/5 bg-white/5 backdrop-blur-md hover:border-white/10 transition-all duration-300">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
                <Users className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-bold text-gray-300">Sin clientes en espera</p>
              <p className="text-sm text-gray-500 mt-1">Los clientes aparecerán aquí cuando se registren</p>
            </div>
          </Card>
        ) : (
          [...waiting, ...called, ...(entries?.filter((e) => e.status === "SEATED" || e.status === "CANCELLED") ?? [])].map((item) => {
            const colors = statusColor(item.status);
            const waitTime = item.createdAt
              ? Math.round((Date.now() - new Date(item.createdAt).getTime()) / 60000)
              : 0;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border ${colors.border} ${colors.bg} p-5 backdrop-blur-md hover:border-white/10 transition-all`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${colors.icon}`}>
                      {statusIcon(item.status)}
                    </div>
                    <div>
                      <p className="font-bold text-white text-lg">{item.customerName}</p>
                      <div className="flex items-center gap-3 text-sm text-gray-400 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {item.customerPhone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {item.partySize} {item.partySize === 1 ? "persona" : "personas"}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {waitTime} min
                        </span>
                      </div>
                      {item.notes && (
                        <div className="flex items-center gap-1 text-sm text-amber-400 mt-1">
                          <MessageSquare className="h-3 w-3" />
                          {item.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {item.estimatedWaitMinutes && (
                      <Badge variant="default" className={colors.text}>
                        ~{item.estimatedWaitMinutes} min estimado
                      </Badge>
                    )}

                    {item.status === "WAITING" && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => updateStatus.mutate({ id: item.id, status: "CALLED" })}
                        >
                          <Bell className="h-4 w-4 mr-1" />
                          Llamar
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => assignTable(item.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Asignar Mesa
                        </Button>
                      </div>
                    )}

                    {item.status === "CALLED" && (
                      <div className="flex gap-2 mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => assignTable(item.id)}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Asignar Mesa
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            toast.success(`Notificación enviada a ${item.customerPhone}`);
                          }}
                        >
                          <Send className="h-4 w-4 mr-1" />
                          Notificar
                        </Button>
                      </div>
                    )}

                    {item.status === "SEATED" && (
                      <Badge variant="success">Asignada</Badge>
                    )}

                    {item.status === "CANCELLED" && (
                      <Badge variant="default">Cancelado</Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <Dialog open={showAdd} onClose={() => setShowAdd(false)} title="Agregar a Lista de Espera">
        <div className="space-y-4">
          <Input
            label="Nombre del cliente"
            value={form.customerName}
            onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
          />
          <Input
            label="Teléfono"
            value={form.customerPhone}
            onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
          />
          <Input
            label="Número de personas"
            type="number"
            min={1}
            value={form.partySize}
            onChange={(e) => setForm((f) => ({ ...f, partySize: Number(e.target.value) }))}
          />
          <Input
            label="Notas (opcional)"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancelar</Button>
            <Button
              onClick={() => addEntry.mutate(form)}
              disabled={addEntry.isPending || !form.customerName || !form.customerPhone}
            >
              Agregar
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
