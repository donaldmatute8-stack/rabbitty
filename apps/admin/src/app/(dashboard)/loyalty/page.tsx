"use client";

import { trpc } from "../../../lib/trpc-client";
import { Button, cn, toast } from "@rabbitty/ui";
import { Award, Users, Flame, Percent, Sparkles, Droplet, ArrowUpRight, Zap, Target, Hexagon } from "lucide-react";
import { useState, useEffect } from "react";

const LEVEL_ICONS: Record<string, { emoji: string, color: string, glow: string }> = {
  "1": { emoji: "🥚", color: "from-gray-500 to-gray-400", glow: "shadow-[0_0_30px_rgba(156,163,175,0.4)]" },
  "2": { emoji: "🐣", color: "from-yellow-500 to-amber-400", glow: "shadow-[0_0_30px_rgba(245,158,11,0.4)]" },
  "3": { emoji: "🐰", color: "from-pink-500 to-rose-400", glow: "shadow-[0_0_30px_rgba(244,63,94,0.4)]" },
  "4": { emoji: "🦊", color: "from-orange-600 to-orange-400", glow: "shadow-[0_0_30px_rgba(249,115,22,0.4)]" },
  "5": { emoji: "🦅", color: "from-blue-600 to-cyan-400", glow: "shadow-[0_0_30px_rgba(6,182,212,0.4)]" },
  "6": { emoji: "🐉", color: "from-purple-600 to-indigo-400", glow: "shadow-[0_0_30px_rgba(139,92,246,0.5)]" },
};

export default function LoyaltyPage() {
  const utils = trpc.useUtils();
  const { data } = trpc.admin.getLoyaltyStats.useQuery(undefined, { retry: false });
  const { data: restaurants } = trpc.admin.getRestaurants.useQuery(undefined, { retry: false });
  const updateRewardRate = trpc.admin.updateRestaurant.useMutation({
    onSuccess: () => {
      utils.admin.getRestaurants.invalidate();
      toast.success(`Cashback actualizado a ${rewardPercentage}%`);
    }
  });

  const [rewardPercentage, setRewardPercentage] = useState<number>(10);
  const [simulatedTicket, setSimulatedTicket] = useState<number>(500);
  const [activeLevelId, setActiveLevelId] = useState<string>("3"); // Conejo por defecto para el showcase

  useEffect(() => {
    if (restaurants && restaurants.length > 0) {
      const currentRate = restaurants[0].defaultRewardRate;
      if (typeof currentRate === "number" && currentRate > 0) {
        setRewardPercentage(Math.round(currentRate < 1 ? currentRate * 100 : currentRate));
      } else {
        setRewardPercentage(10);
      }
    }
  }, [restaurants]);

  const totalUsers = data?.totalUsers ?? 1542; // Fallback mock for showcase
  const totalBunzEarned = data?.totalBunzEarned ?? 245000;
  const levels = data?.levels ?? [
    { id: "1", name: "Huevo", requiredHops: 0, bunzMultiplier: 1.0, userCount: 840 },
    { id: "2", name: "Polluelo", requiredHops: 10, bunzMultiplier: 1.2, userCount: 420 },
    { id: "3", name: "Conejo", requiredHops: 50, bunzMultiplier: 1.5, userCount: 210 },
    { id: "4", name: "Zorro", requiredHops: 200, bunzMultiplier: 2.0, userCount: 50 },
    { id: "5", name: "Águila", requiredHops: 500, bunzMultiplier: 2.5, userCount: 15 },
    { id: "6", name: "Dragón", requiredHops: 1000, bunzMultiplier: 3.0, userCount: 7 },
  ];

  const activeLevel = levels.find(l => l.id === activeLevelId) || levels[2];
  const calculatedBunz = Math.round(simulatedTicket * (rewardPercentage / 100) * activeLevel.bunzMultiplier);

  const handleSaveRewardRate = () => {
    if (!restaurants || restaurants.length === 0) return;
    updateRewardRate.mutate({
      id: restaurants[0].id,
      defaultRewardRate: rewardPercentage,
    });
  };

  return (
    <div className="space-y-8 pb-10 max-w-[1600px] mx-auto">
      
      {/* ── Immersive Header ── */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-gradient-to-br from-indigo-900/40 via-gray-900 to-black p-10 shadow-2xl backdrop-blur-3xl">
        <div className="absolute top-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[10%] h-[400px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="flex gap-6 items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-pink-500 to-purple-600 shadow-[0_0_40px_rgba(236,72,153,0.3)]">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div>
              <h1 className="text-5xl font-black tracking-tight text-white mb-2">Lealtad Bunz</h1>
              <p className="text-lg text-gray-400 font-medium max-w-lg">Sistema de recompensas gamificado. Ajusta las tasas de emisión y visualiza el crecimiento de tu comunidad.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex flex-col items-end p-4 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total Usuarios</span>
              <div className="flex items-center gap-2">
                <Users className="h-6 w-6 text-indigo-400" />
                <span className="text-3xl font-black text-white">{totalUsers.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex flex-col items-end p-4 rounded-2xl bg-black/40 border border-white/5 backdrop-blur-md">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Bunz Emitidos</span>
              <div className="flex items-center gap-2">
                <Hexagon className="h-6 w-6 text-pink-400 fill-pink-500/20" />
                <span className="text-3xl font-black text-white">{totalBunzEarned.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        
        {/* ── Left Column: Config & Gamification Engine ── */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Base Cashback Configurator */}
          <div className="rounded-[2.5rem] border border-white/5 bg-gray-900/60 p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="flex items-center gap-4 mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400">
                <Percent className="h-6 w-6" />
              </div>
              <h3 className="text-2xl font-black text-white">Cashback Base</h3>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-gray-400 font-bold">Porcentaje Global</span>
                <span className="text-3xl font-black text-white">{rewardPercentage}%</span>
              </div>
              <input
                type="range" min="1" max="50" step="1"
                value={rewardPercentage}
                onChange={(e) => setRewardPercentage(Number(e.target.value))}
                className="w-full accent-pink-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs font-bold text-gray-600">
                <span>1% (Tacaño)</span>
                <span>25% (Equilibrado)</span>
                <span>50% (Agresivo)</span>
              </div>

              <button 
                onClick={handleSaveRewardRate}
                className="w-full rounded-2xl bg-white/5 border border-white/10 py-4 text-sm font-black text-white hover:bg-pink-500 hover:border-pink-400 hover:shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all active:scale-95"
              >
                Guardar Configuración
              </button>
            </div>
          </div>

          {/* Special Rules Cards */}
          <div className="rounded-[2.5rem] border border-white/5 bg-gray-900/60 p-8 shadow-2xl backdrop-blur-xl">
            <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
              <Zap className="h-5 w-5 text-yellow-400" /> Reglas Dinámicas
            </h3>
            
            <div className="space-y-4">
              <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-black/40 p-4 transition-all hover:border-indigo-500/50">
                <div className="absolute inset-0 bg-indigo-500/10 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Martes Locos</div>
                    <div className="text-xs text-indigo-400 mt-1">Doble Bunz (+100%)</div>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]" />
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-black/40 p-4 transition-all hover:border-emerald-500/50">
                <div className="absolute inset-0 bg-emerald-500/10 translate-y-[100%] group-hover:translate-y-[0%] transition-transform duration-300" />
                <div className="relative z-10 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white">Cumpleañeros</div>
                    <div className="text-xs text-emerald-400 mt-1">+500 Bunz Extra</div>
                  </div>
                  <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                </div>
              </div>
              
              <button className="w-full rounded-xl border border-dashed border-white/20 py-3 text-sm font-bold text-gray-400 hover:text-white hover:border-white/50 transition-all">
                + Crear Nueva Regla
              </button>
            </div>
          </div>

        </div>

        {/* ── Right Column: Gamification Sandbox ── */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* Level Showcase Sandbox */}
          <div className="flex-1 rounded-[2.5rem] border border-white/5 bg-gray-900/60 p-10 shadow-2xl backdrop-blur-xl relative flex flex-col overflow-hidden">
            
            <div className="flex justify-between items-end mb-10 z-10 relative">
              <div>
                <h2 className="text-3xl font-black text-white">Simulador de Recompensas</h2>
                <p className="text-gray-400 font-medium mt-1">Descubre cuánto gana cada nivel de usuario.</p>
              </div>
              
              <div className="flex bg-black/50 p-1 rounded-2xl border border-white/5">
                {levels.map(l => (
                  <button 
                    key={l.id}
                    onClick={() => setActiveLevelId(l.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all",
                      activeLevelId === l.id ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                    )}
                  >
                    <span>{LEVEL_ICONS[l.id].emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Showcase Stage */}
            <div className="flex-1 flex items-center justify-center relative z-10">
              
              {/* Dynamic Aura */}
              <div className={cn("absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-20 transition-all duration-1000", `bg-gradient-to-br ${LEVEL_ICONS[activeLevel.id].color}`)} />

              <div className="flex w-full items-center justify-between gap-12 px-12">
                
                {/* 3D Badge Simulation */}
                <div className={cn(
                  "relative flex h-64 w-64 shrink-0 flex-col items-center justify-center rounded-[3rem] bg-gradient-to-br border border-white/20 transition-all duration-500",
                  LEVEL_ICONS[activeLevel.id].color,
                  LEVEL_ICONS[activeLevel.id].glow
                )}>
                  <div className="absolute inset-0 rounded-[3rem] bg-black/40 backdrop-blur-sm" />
                  <span className="relative z-10 text-[6rem] drop-shadow-2xl mb-2">{LEVEL_ICONS[activeLevel.id].emoji}</span>
                  <span className="relative z-10 text-2xl font-black text-white uppercase tracking-widest">{activeLevel.name}</span>
                  <div className="relative z-10 mt-2 rounded-full bg-black/50 px-3 py-1 text-xs font-bold text-white border border-white/10">
                    Nivel {activeLevel.id}
                  </div>
                </div>

                {/* Calculation Screen */}
                <div className="flex-1 space-y-8">
                  
                  <div className="space-y-3">
                    <label className="text-sm font-bold text-gray-400 uppercase tracking-widest">Si un cliente de este nivel gasta:</label>
                    <div className="flex items-center gap-4 bg-black/40 border border-white/5 rounded-2xl p-2 px-6">
                      <span className="text-3xl font-black text-gray-500">$</span>
                      <input 
                        type="number" 
                        value={simulatedTicket}
                        onChange={(e) => setSimulatedTicket(Number(e.target.value))}
                        className="w-full bg-transparent text-5xl font-black text-white py-4 focus:outline-none"
                      />
                    </div>
                  </div>

                  <ArrowUpRight className="h-10 w-10 text-gray-700 mx-auto" />

                  <div className="rounded-[2rem] bg-black/60 border border-white/5 p-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <Hexagon className="h-32 w-32" />
                    </div>
                    <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Ellos Reciben (Cashback)</div>
                    <div className="flex items-end gap-3 relative z-10">
                      <span className="text-[5rem] font-black text-pink-500 leading-none tracking-tighter">
                        {calculatedBunz}
                      </span>
                      <span className="text-2xl font-bold text-pink-400 mb-2 flex items-center gap-2">
                        <Hexagon className="h-6 w-6 fill-pink-500/20" /> Bunz
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-lg bg-white/5 px-2 py-1 text-xs font-bold text-gray-400 border border-white/5">Base: {rewardPercentage}%</span>
                      <span className="rounded-lg bg-pink-500/20 px-2 py-1 text-xs font-bold text-pink-400 border border-pink-500/20">Multiplicador de Nivel: {activeLevel.bunzMultiplier}x</span>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* User Distribution Bar */}
          <div className="rounded-[2rem] border border-white/5 bg-gray-900/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Distribución de Usuarios por Nivel</h3>
              <div className="text-sm font-bold text-gray-400">Total: {totalUsers}</div>
            </div>
            
            <div className="flex h-12 w-full rounded-2xl overflow-hidden shadow-inner border border-white/5 bg-black">
              {levels.map((l) => {
                const percent = totalUsers > 0 ? (l.userCount / totalUsers) * 100 : 0;
                if (percent === 0) return null;
                const colors = [
                  "bg-gray-500", "bg-yellow-500", "bg-pink-500", 
                  "bg-orange-500", "bg-blue-500", "bg-purple-500"
                ];
                return (
                  <div 
                    key={l.id} 
                    style={{ width: `${percent}%` }}
                    className={cn("h-full relative group transition-all hover:brightness-125 cursor-help", colors[parseInt(l.id) - 1])}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/20 transition-opacity" />
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex flex-wrap gap-4">
              {levels.map(l => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="text-lg">{LEVEL_ICONS[l.id].emoji}</span>
                  <div className="text-sm font-bold text-gray-300">
                    {l.name} <span className="text-gray-500">({l.userCount})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
