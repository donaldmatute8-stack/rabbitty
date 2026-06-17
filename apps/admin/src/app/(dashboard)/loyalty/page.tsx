"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Card, Button, Badge, Input, Dialog, toast } from "@rabbitty/ui";
import { Gift, Users, Trophy, Megaphone, Plus, Star } from "lucide-react";

export default function LoyaltyPage() {
  const [activeTab, setActiveTab] = useState<"CAMPAIGNS" | "TIERS" | "REFERRALS" | "BIRTHDAYS">("CAMPAIGNS");
  const utils = trpc.useUtils();

  const { data: levels } = trpc.loyalty.getLevels.useQuery(undefined, { enabled: activeTab === "TIERS" });
  const { data: referralStats } = trpc.loyalty.getReferralStats.useQuery(undefined, { enabled: activeTab === "REFERRALS" });
  const { data: campaigns } = trpc.loyalty.listCampaigns.useQuery(undefined, { enabled: activeTab === "CAMPAIGNS" });
  const { data: birthdays } = trpc.loyalty.getUpcomingBirthdays.useQuery(undefined, { enabled: activeTab === "BIRTHDAYS" });

  const createCampaign = trpc.loyalty.createCampaign.useMutation({
    onSuccess: () => {
      utils.loyalty.listCampaigns.invalidate();
      toast.success("Campaña creada exitosamente");
      setCampaignDialog(false);
      setNewCampaign({ name: "", targetSegment: "ALL", message: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const [campaignDialog, setCampaignDialog] = useState(false);
  const [newCampaign, setNewCampaign] = useState({ name: "", targetSegment: "ALL", message: "" });

  return (
    <div className="space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-gradient-to-br from-gray-900/60 to-black/80 p-8 shadow-2xl backdrop-blur-xl">
        <div className="absolute top-0 right-0 h-48 w-48 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-gray-500">
              Programa de Lealtad
            </h1>
            <p className="text-gray-400 mt-2 text-sm font-medium">Gestión de campañas, niveles, referidos y recompensas</p>
          </div>
        </div>
      </div>

      <div className="flex space-x-2 overflow-x-auto pb-2">
        <Button variant={activeTab === "CAMPAIGNS" ? "primary" : "secondary"} onClick={() => setActiveTab("CAMPAIGNS")}>
          <Megaphone className="h-4 w-4" /> Campañas
        </Button>
        <Button variant={activeTab === "TIERS" ? "primary" : "secondary"} onClick={() => setActiveTab("TIERS")}>
          <Trophy className="h-4 w-4" /> Niveles
        </Button>
        <Button variant={activeTab === "REFERRALS" ? "primary" : "secondary"} onClick={() => setActiveTab("REFERRALS")}>
          <Users className="h-4 w-4" /> Referidos
        </Button>
        <Button variant={activeTab === "BIRTHDAYS" ? "primary" : "secondary"} onClick={() => setActiveTab("BIRTHDAYS")}>
          <Gift className="h-4 w-4" /> Cumpleaños
        </Button>
      </div>

      {activeTab === "CAMPAIGNS" && (
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-white">Campañas de Marketing</h3>
            <Button onClick={() => setCampaignDialog(true)}>
              <Plus className="h-4 w-4" /> Nueva Campaña
            </Button>
          </div>
          <div className="space-y-4">
            {campaigns?.map(c => (
              <div key={c.id} className="flex justify-between items-center rounded-xl border border-white/5 bg-white/5 p-4">
                <div>
                  <h4 className="font-bold text-white text-md">{c.name}</h4>
                  <p className="text-xs text-gray-400 mt-1">{c.message}</p>
                </div>
                <div className="text-right">
                  <Badge variant="default">{c.targetSegment}</Badge>
                  <p className="text-[10px] text-gray-500 mt-2">{new Date(c.createdAt!).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
            {campaigns?.length === 0 && (
              <p className="text-center text-gray-500 py-8">No hay campañas creadas aún.</p>
            )}
          </div>
        </Card>
      )}

      {activeTab === "TIERS" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {levels?.map(l => (
            <Card key={l.id} className="p-6 border border-white/5 bg-white/5 backdrop-blur-md flex flex-col items-center text-center">
              <div className="h-16 w-16 rounded-full bg-gradient-to-br from-yellow-400/20 to-orange-500/20 flex items-center justify-center mb-4">
                <Star className="h-8 w-8 text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-white">{l.name}</h3>
              <p className="text-sm text-gray-400 mt-2">Requiere: {l.requiredHops} saltos</p>
              <div className="mt-4 flex gap-2">
                <Badge variant="default">Multiplicador {l.bunzMultiplier}x</Badge>
                {l.premiumAccess && <Badge variant="default" className="bg-purple-500/20 text-purple-400 border-purple-500/30">Premium</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {activeTab === "REFERRALS" && referralStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
            <p className="text-sm text-gray-400 font-semibold mb-1">Referidos Totales</p>
            <p className="text-2xl font-black text-blue-400">{referralStats.referrals.length}</p>
          </Card>
          <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
            <p className="text-sm text-gray-400 font-semibold mb-1">Completados</p>
            <p className="text-2xl font-black text-emerald-400">{referralStats.successfulCount}</p>
          </Card>
          <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
            <p className="text-sm text-gray-400 font-semibold mb-1">Bunz Repartidos</p>
            <p className="text-2xl font-black text-amber-400">{referralStats.totalRewards}</p>
          </Card>
          <Card className="p-5 border border-white/5 bg-white/5 backdrop-blur-md">
            <p className="text-sm text-gray-400 font-semibold mb-1">Embajadores</p>
            <p className="text-2xl font-black text-pink-400">{referralStats.totalInviters}</p>
          </Card>
        </div>
      )}

      {activeTab === "BIRTHDAYS" && (
        <Card className="p-6 border border-white/5 bg-white/5 backdrop-blur-md">
          <h3 className="text-lg font-bold text-white mb-6">Próximos Cumpleaños</h3>
          <div className="space-y-4">
            {birthdays?.map(c => (
              <div key={c.id} className="flex justify-between items-center rounded-xl border border-white/5 bg-white/5 p-4">
                <div>
                  <h4 className="font-bold text-white text-md">{c.name ?? c.phone}</h4>
                  <p className="text-xs text-gray-400 mt-1">Cumpleaños: {new Date(c.birthDate!).toLocaleDateString()}</p>
                </div>
                <Badge variant="default" className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Recompensa Pendiente</Badge>
              </div>
            ))}
            {birthdays?.length === 0 && (
              <p className="text-center text-gray-500 py-8">No hay clientes con fecha de cumpleaños registrada.</p>
            )}
          </div>
        </Card>
      )}

      <Dialog open={campaignDialog} onClose={() => setCampaignDialog(false)} title="Crear Campaña">
        <div className="space-y-4">
          <Input label="Nombre de Campaña" value={newCampaign.name} onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })} />
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">Segmento Objetivo</label>
            <select
              value={newCampaign.targetSegment}
              onChange={(e) => setNewCampaign({ ...newCampaign, targetSegment: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none"
            >
              <option value="ALL" className="bg-gray-900">Todos</option>
              <option value="VIP" className="bg-gray-900">VIP</option>
              <option value="RECURRENT" className="bg-gray-900">Recurrentes</option>
              <option value="NEW" className="bg-gray-900">Nuevos</option>
              <option value="CHURN_RISK" className="bg-gray-900">En Riesgo</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase">Mensaje (Telegram)</label>
            <textarea
              value={newCampaign.message}
              onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white focus:border-pink-500 focus:outline-none h-24"
              placeholder="Escribe el mensaje que recibirán..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setCampaignDialog(false)}>Cancelar</Button>
            <Button onClick={() => createCampaign.mutate(newCampaign)} disabled={!newCampaign.name || !newCampaign.message}>Lanzar Campaña</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
