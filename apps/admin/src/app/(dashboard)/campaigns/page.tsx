"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Button, toast } from "@rabbitty/ui";
import { Megaphone, Plus, Send, Target, CheckCircle2, XCircle } from "lucide-react";

const segments = ["ALL", "VIP", "RECURRENT", "NEW", "CHURN_RISK"] as const;

export default function CampaignsPage() {
  const utils = trpc.useUtils();
  const { data: campaigns } = trpc.campaigns.list.useQuery();
  const createCampaign = trpc.campaigns.create.useMutation({
    onSuccess: () => {
      utils.campaigns.list.invalidate();
      toast.success("Campaña creada");
      setDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });
  const sendCampaign = trpc.campaigns.send.useMutation({
    onSuccess: (r) => { utils.campaigns.list.invalidate(); toast.success(`Enviada a ${r.deliveredTo} clientes`); },
    onError: (e) => toast.error(e.message),
  });

  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState({ name: "", targetSegment: "ALL" as typeof segments[number], message: "" });

  const totalDelivered = campaigns?.reduce((s, c) => s + (c.deliveredCount ?? 0), 0) ?? 0;
  const totalFailed = campaigns?.reduce((s, c) => s + (c.failedCount ?? 0), 0) ?? 0;
  const sentCampaigns = campaigns?.filter((c) => c.status === "SENT").length ?? 0;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
              <Megaphone className="h-3.5 w-3.5" /> Marketing
            </span>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Campañas
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Crea y analiza campañas de marketing segmentadas</p>
          </div>
          <Button onClick={() => { setForm({ name: "", targetSegment: "ALL", message: "" }); setDialog(true); }}>
            <Plus className="h-4 w-4" />
            Nueva Campaña
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <p className="text-xs text-gray-400 font-semibold mb-1">Campañas Enviadas</p>
          <p className="text-2xl font-black text-white">{sentCampaigns}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <p className="text-xs text-gray-400 font-semibold mb-1">Entregados</p>
          <p className="text-2xl font-black text-emerald-400">{totalDelivered}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <p className="text-xs text-gray-400 font-semibold mb-1">Fallidos</p>
          <p className="text-2xl font-black text-red-400">{totalFailed}</p>
        </Card>
        <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
          <p className="text-xs text-gray-400 font-semibold mb-1">Tasa de Entrega</p>
          <p className="text-2xl font-black text-blue-400">
            {totalDelivered + totalFailed > 0
              ? `${Math.round((totalDelivered / (totalDelivered + totalFailed)) * 100)}%`
              : "—"}
          </p>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns?.map((c) => (
          <Card key={c.id} className="border border-white/5 bg-white/5 p-5 backdrop-blur-md hover:border-white/10 transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">{c.name}</p>
                <span className={`text-xs font-semibold ${c.status === "SENT" ? "text-emerald-400" : "text-yellow-400"}`}>
                  {c.status === "SENT" ? "Enviada" : "Borrador"}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mb-3 line-clamp-2">{c.message}</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Target className="h-3 w-3" />
                <span>Segmento: {c.targetSegment}</span>
              </div>
              {c.status === "SENT" && (
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {c.deliveredCount ?? 0} ok
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <XCircle className="h-3 w-3" /> {c.failedCount ?? 0} fail
                  </span>
                </div>
              )}
              {c.sentAt && <p className="text-xs text-gray-500">Enviada: {new Date(c.sentAt).toLocaleDateString()}</p>}
            </div>
            {c.status === "DRAFT" && (
              <Button
                size="sm"
                className="w-full mt-3"
                onClick={() => sendCampaign.mutate({ id: c.id })}
              >
                <Send className="h-3 w-3" />
                Enviar Ahora
              </Button>
            )}
          </Card>
        ))}
        {!campaigns?.length && (
          <div className="col-span-full text-center py-12 text-gray-500">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Sin campañas aún. Crea la primera.</p>
          </div>
        )}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-4">Nueva Campaña</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nombre</label>
                <input
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none mt-1"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Segmento Objetivo</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none mt-1"
                  value={form.targetSegment}
                  onChange={(e) => setForm({ ...form, targetSegment: e.target.value as typeof segments[number] })}
                >
                  {segments.map((s) => (
                    <option key={s} value={s} className="bg-gray-900">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mensaje</label>
                <textarea
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none mt-1 h-24 resize-none"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="secondary" onClick={() => setDialog(false)}>Cancelar</Button>
                <Button
                  onClick={() => createCampaign.mutate({ ...form })}
                  disabled={!form.name || !form.message}
                >
                  <Send className="h-4 w-4" />
                  Crear
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
