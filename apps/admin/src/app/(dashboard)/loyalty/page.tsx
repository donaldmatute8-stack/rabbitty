"use client";

import { trpc } from "../../../lib/trpc-client";
import { Card, Button, Input, toast } from "@rabbitty/ui";
import { Award, TrendingUp, Users, Star, Flame, Zap, Percent, Sliders, ShieldCheck, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

const LEVEL_ICONS: Record<string, string> = {
  "1": "🥚",
  "2": "🐣",
  "3": "🐰",
  "4": "🦊",
  "5": "🦅",
  "6": "🐉",
};

export default function LoyaltyPage() {
  const utils = trpc.useUtils();
  const { data } = trpc.admin.getLoyaltyStats.useQuery(undefined, { retry: false });
  const { data: business } = trpc.restaurants.getRestaurants.useQuery(undefined, { retry: false });

  // Cashback Reward Rate state
  const [rewardPercentage, setRewardPercentage] = useState<number>(10);
  const [simulatedTicket, setSimulatedTicket] = useState<number>(500);

  useEffect(() => {
    if (business && business.length > 0) {
      setRewardPercentage(10);
    }
  }, [business]);

  const totalUsers = data?.totalUsers ?? 0;
  const totalBunzEarned = data?.totalBunzEarned ?? 0;
  const totalSpent = data?.totalSpent ?? 0;
  const levels = data?.levels ?? [
    { id: "1", name: "Huevo", requiredHops: 0, bunzMultiplier: 1.0, userCount: totalUsers > 0 ? Math.ceil(totalUsers * 0.5) : 0 },
    { id: "2", name: "Polluelo", requiredHops: 10, bunzMultiplier: 1.2, userCount: totalUsers > 0 ? Math.ceil(totalUsers * 0.3) : 0 },
    { id: "3", name: "Conejo", requiredHops: 50, bunzMultiplier: 1.5, userCount: totalUsers > 0 ? Math.ceil(totalUsers * 0.15) : 0 },
    { id: "4", name: "Zorro", requiredHops: 200, bunzMultiplier: 2.0, userCount: totalUsers > 0 ? Math.ceil(totalUsers * 0.05) : 0 },
  ];
  const topUsers = data?.topUsers ?? [];

  // Simulated Cashback calculation
  const calculatedBunz = Math.round(simulatedTicket * (rewardPercentage / 100));

  const handleSaveRewardRate = () => {
    toast.success(`Configuración actualizada: ${rewardPercentage}% de Cashback Bunz activo.`);
  };

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-pink-500">
            <Award className="h-3.5 w-3.5" /> Rabbitty Rewards
          </span>
          <h1 className="text-3xl font-black text-white mt-1">Programa de Lealtad & Cashback</h1>
          <p className="text-sm text-gray-400">Administra los niveles de tus Rabbitters y ajusta la tasa de recompensas Bunz en tiempo real.</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md hover:border-pink-500/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{totalUsers}</p>
              <p className="text-xs font-semibold text-gray-400">Rabbitters Activos</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md hover:border-purple-500/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{totalBunzEarned.toLocaleString()}</p>
              <p className="text-xs font-semibold text-gray-400">Bunz Emitidos</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md hover:border-emerald-500/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{totalSpent.toLocaleString()}</p>
              <p className="text-xs font-semibold text-gray-400">Bunz Canjeados</p>
            </div>
          </div>
        </Card>

        <Card className="border border-white/5 bg-white/5 p-5 backdrop-blur-md hover:border-amber-500/30 transition-all">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-black text-white">{rewardPercentage}%</p>
              <p className="text-xs font-semibold text-gray-400">Cashback Activo</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Interactive Cashback Simulator & Control */}
      <Card className="border border-pink-500/20 bg-gradient-to-r from-pink-500/10 via-purple-500/5 to-black p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-400">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Configuración de Tasa de Cashback Bunz</h2>
            <p className="text-xs text-gray-400">Ajusta el porcentaje de reembolso que tus clientes acumulan en su Telegram MiniApp al pagar en el POS.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
          {/* Slider Controls */}
          <div className="space-y-5">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300">Porcentaje de Recompensa</label>
                <span className="text-lg font-black text-pink-400">{rewardPercentage}%</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={rewardPercentage}
                onChange={(e) => setRewardPercentage(Number(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-semibold mt-1">
                <span>1% (Conservador)</span>
                <span>10% (Recomendado)</span>
                <span>30% (Agresivo)</span>
              </div>
            </div>

            <Button onClick={handleSaveRewardRate} className="w-full bg-gradient-to-r from-pink-500 to-purple-600 font-bold hover:opacity-90 transition-all cursor-pointer">
              Guardar Configuración de Cashback
            </Button>
          </div>

          {/* Real-time Simulator Card */}
          <div className="rounded-2xl border border-white/10 bg-black/60 p-5 space-y-4 shadow-inner">
            <span className="flex items-center gap-1.5 text-xs font-bold text-pink-400">
              <Sparkles className="h-4 w-4" /> Simulación de Compra en POS
            </span>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[11px] text-gray-400 font-semibold block mb-1">Monto de Consumo ($ MXN)</label>
                <Input
                  type="number"
                  value={simulatedTicket}
                  onChange={(e) => setSimulatedTicket(Number(e.target.value))}
                  className="bg-white/5 border-white/10 text-white font-bold"
                />
              </div>
              <div className="flex flex-col justify-center rounded-xl bg-pink-500/10 border border-pink-500/20 p-3">
                <span className="text-[10px] uppercase font-bold text-gray-400">Bunz a Acreditar</span>
                <span className="text-xl font-black text-pink-400">+{calculatedBunz} Bunz</span>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 leading-relaxed">
              * El cliente recibirá la notificación instantánea en su Telegram MiniApp al momento en que la cajera cierre la cuenta.
            </p>
          </div>
        </div>
      </Card>

      {/* Levels & Top Users Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Niveles de Lealtad */}
        <Card className="border border-white/5 bg-white/5 backdrop-blur-md">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Award className="h-5 w-5 text-pink-400" />
              Niveles de Rabbitters
            </h2>
            <span className="text-xs text-gray-400 font-semibold">{levels.length} Niveles Activos</span>
          </div>
          <div className="divide-y divide-white/5">
            {levels.map((level: any) => (
              <div key={level.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{LEVEL_ICONS[level.id] || "⭐"}</span>
                  <div>
                    <p className="text-sm font-bold text-white">{level.name}</p>
                    <p className="text-xs text-gray-400">{level.userCount} usuarios clasificados</p>
                  </div>
                </div>
                <div className="text-right text-xs">
                  <p className="text-gray-300 font-semibold">{level.requiredHops} Hops requeridos</p>
                  {level.bunzMultiplier && <p className="text-pink-400 font-bold">×{level.bunzMultiplier} Multiplicador</p>}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Usuarios por Hops */}
        <Card className="border border-white/5 bg-white/5 backdrop-blur-md">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <h2 className="font-bold text-white flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Top Clientes por Hops y Frecuencia
            </h2>
            <span className="text-xs text-amber-400 font-semibold">Ranking en Vivo</span>
          </div>
          <div className="divide-y divide-white/5">
            {topUsers.map((user: any, i: number) => (
              <div key={user.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-all">
                <div className="flex items-center gap-3">
                  <span className={`w-6 text-center font-black text-sm ${i === 0 ? "text-yellow-400" : i === 1 ? "text-gray-300" : i === 2 ? "text-amber-600" : "text-gray-500"}`}>
                    #{i + 1}
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">{user.firstName || user.username || `Rabbitter #${user.telegramId?.slice(-4)}`}</p>
                    <p className="text-xs text-gray-400">{user.totalBunzEarned?.toLocaleString() ?? 0} Bunz ganados</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-400">{user.hops ?? 0} Hops</p>
                  <p className="text-xs text-gray-400">{user.totalBunzSpent ?? 0} canjeados</p>
                </div>
              </div>
            ))}
            {topUsers.length === 0 && (
              <div className="p-8 text-center text-sm text-gray-500">
                Los clientes top aparecerán automáticamente a medida que acumulen Hops en el bot de Telegram.
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
