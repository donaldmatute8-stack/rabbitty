"use client";

import { trpc } from "../../../lib/trpc-client";
import { Button, cn, toast } from "@rabbitty/ui";
import { Award, Users, Flame, Percent, Sparkles, Droplet, ArrowUpRight, Zap, Target, Hexagon, X, Plus } from "lucide-react";
import { useState, useEffect } from "react";

const LEVEL_ICONS: Record<string, { emoji: string, color: string, glow: string }> = {
  "1": { emoji: "🥚", color: "from-gray-500 to-gray-400", glow: "shadow-[0_0_30px_rgba(156,163,175,0.4)]" },
  "2": { emoji: "🐣", color: "from-yellow-500 to-amber-400", glow: "shadow-[0_0_30px_rgba(245,158,11,0.4)]" },
  "3": { emoji: "🐰", color: "from-pink-500 to-rose-400", glow: "shadow-[0_0_30px_rgba(244,63,94,0.4)]" },
  "4": { emoji: "🦊", color: "from-orange-600 to-orange-400", glow: "shadow-[0_0_30px_rgba(249,115,22,0.4)]" },
  "5": { emoji: "🦅", color: "from-blue-600 to-cyan-400", glow: "shadow-[0_0_30px_rgba(6,182,212,0.4)]" },
  "6": { emoji: "🐉", color: "from-purple-600 to-indigo-400", glow: "shadow-[0_0_30px_rgba(139,92,246,0.5)]" },
  "lvl_1": { emoji: "🥚", color: "from-gray-500 to-gray-400", glow: "shadow-[0_0_30px_rgba(156,163,175,0.4)]" },
  "lvl_2": { emoji: "🐣", color: "from-yellow-500 to-amber-400", glow: "shadow-[0_0_30px_rgba(245,158,11,0.4)]" },
  "lvl_3": { emoji: "🐰", color: "from-pink-500 to-rose-400", glow: "shadow-[0_0_30px_rgba(244,63,94,0.4)]" },
  "lvl_4": { emoji: "🦊", color: "from-orange-600 to-orange-400", glow: "shadow-[0_0_30px_rgba(249,115,22,0.4)]" },
  "l1": { emoji: "🥚", color: "from-gray-500 to-gray-400", glow: "shadow-[0_0_30px_rgba(156,163,175,0.4)]" },
  "l2": { emoji: "🐣", color: "from-yellow-500 to-amber-400", glow: "shadow-[0_0_30px_rgba(245,158,11,0.4)]" },
  "l3": { emoji: "🐰", color: "from-pink-500 to-rose-400", glow: "shadow-[0_0_30px_rgba(244,63,94,0.4)]" },
  "l4": { emoji: "🦊", color: "from-orange-600 to-orange-400", glow: "shadow-[0_0_30px_rgba(249,115,22,0.4)]" },
};

const DEFAULT_LEVEL_ICON = { emoji: "🐰", color: "from-pink-500 to-rose-400", glow: "shadow-[0_0_30px_rgba(244,63,94,0.4)]" };

function getLevelIcon(id?: string | null) {
  if (!id) return DEFAULT_LEVEL_ICON;
  const match = LEVEL_ICONS[id] || LEVEL_ICONS[id.replace(/\D/g, "")];
  return match || DEFAULT_LEVEL_ICON;
}

interface DynamicRule {
  id: string;
  name: string;
  type: "MULTIPLIER" | "BONUS_FIXED" | "PERCENTAGE_BOOST";
  value: number;
  active: boolean;
}

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
  const [activeLevelId, setActiveLevelId] = useState<string>("");

  // Reglas Dinámicas con estado interactivo y simulación en vivo
  const [dynamicRules, setDynamicRules] = useState<DynamicRule[]>([
    { id: "r1", name: "Martes Locos", type: "MULTIPLIER", value: 2.0, active: true },
    { id: "r2", name: "Cumpleañeros", type: "BONUS_FIXED", value: 500, active: false },
    { id: "r3", name: "Happy Hour Bucerías", type: "PERCENTAGE_BOOST", value: 10, active: false },
  ]);

  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState("");
  const [newRuleType, setNewRuleType] = useState<"MULTIPLIER" | "BONUS_FIXED" | "PERCENTAGE_BOOST">("MULTIPLIER");
  const [newRuleValue, setNewRuleValue] = useState<number>(1.5);

  const toggleRule = (id: string) => {
    setDynamicRules(prev => prev.map(r => r.id === id ? { ...r, active: !r.active } : r));
  };

  const handleCreateRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) {
      toast.error("Ingresa un nombre para la regla");
      return;
    }
    const newRule: DynamicRule = {
      id: "rule_" + Date.now(),
      name: newRuleName.trim(),
      type: newRuleType,
      value: Number(newRuleValue) || 1,
      active: true,
    };
    setDynamicRules(prev => [...prev, newRule]);
    setIsCreateRuleOpen(false);
    setNewRuleName("");
    setNewRuleValue(1.5);
    toast.success(`Regla "${newRule.name}" creada y activada.`);
  };

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
  
  // Deduplicar niveles por nombre o ID base si vienen duplicados de la DB
  const rawLevels = (data?.levels && data.levels.length > 0) ? data.levels : [
    { id: "lvl_1", name: "Rabbitter Novato", requiredHops: 0, bunzMultiplier: 1.0, userCount: 840 },
    { id: "lvl_2", name: "Explorador Urbano", requiredHops: 50, bunzMultiplier: 1.1, userCount: 420 },
    { id: "lvl_3", name: "Guía de la Madriguera", requiredHops: 200, bunzMultiplier: 1.25, userCount: 210 },
    { id: "lvl_4", name: "Conejo Legendario", requiredHops: 500, bunzMultiplier: 1.5, userCount: 50 },
  ];

  // Limpiar niveles únicos para evitar dobles botones idénticos
  const seenNames = new Set<string>();
  const levels = rawLevels.filter(lvl => {
    if (seenNames.has(lvl.name)) return false;
    seenNames.add(lvl.name);
    return true;
  });

  // Asegurar selección inicial válida
  useEffect(() => {
    if (levels.length > 0 && (!activeLevelId || !levels.some(l => l.id === activeLevelId))) {
      setActiveLevelId(levels[0].id);
    }
  }, [levels, activeLevelId]);

  const activeLevel = levels.find(l => l.id === activeLevelId) || levels[0] || {
    id: "lvl_1",
    name: "Rabbitter Novato",
    requiredHops: 0,
    bunzMultiplier: 1.0,
    userCount: 0,
  };

  // Cálculo en vivo del simulador incorporando Reglas Dinámicas activas
  const activeMultiplierRule = dynamicRules.find(r => r.active && r.type === "MULTIPLIER");
  const activeBoostRule = dynamicRules.find(r => r.active && r.type === "PERCENTAGE_BOOST");
  const activeFixedRules = dynamicRules.filter(r => r.active && r.type === "BONUS_FIXED");

  const effectiveCashbackRate = rewardPercentage + (activeBoostRule?.value || 0);
  const ruleMultiplier = activeMultiplierRule ? activeMultiplierRule.value : 1.0;
  const fixedBonusBunz = activeFixedRules.reduce((acc, r) => acc + r.value, 0);

  const baseCalculatedBunz = Math.round(
    simulatedTicket * (effectiveCashbackRate / 100) * (activeLevel.bunzMultiplier ?? 1.0) * ruleMultiplier
  );
  const calculatedBunz = baseCalculatedBunz + fixedBonusBunz;

  const handleSaveRewardRate = () => {
    if (!restaurants || restaurants.length === 0) return;
    updateRewardRate.mutate({
      id: restaurants[0].id,
      defaultRewardRate: rewardPercentage,
    });
  };

  return (
    <div className="space-y-8 pb-10 max-w-400 mx-auto">
      
      {/* ── Immersive Header ── */}
      <div className="relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-linear-to-br from-indigo-900/40 via-gray-900 to-black p-10 shadow-2xl backdrop-blur-3xl">
        <div className="absolute top-[-20%] right-[-10%] h-125 w-125 rounded-full bg-pink-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-20%] left-[10%] h-100 w-100 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="flex gap-6 items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-4xl bg-linear-to-br from-pink-500 to-purple-600 shadow-[0_0_40px_rgba(236,72,153,0.3)]">
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
            <div className="absolute inset-0 bg-linear-to-tr from-pink-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
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
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-3">
                <Zap className="h-5 w-5 text-yellow-400" /> Reglas Dinámicas
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/5 text-gray-400 border border-white/10">
                {dynamicRules.filter(r => r.active).length} activas
              </span>
            </div>
            
            <div className="space-y-4">
              {dynamicRules.map((rule) => (
                <div 
                  key={rule.id}
                  onClick={() => toggleRule(rule.id)}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border p-4 transition-all cursor-pointer",
                    rule.active 
                      ? "border-pink-500/40 bg-pink-500/5 shadow-[0_0_15px_rgba(236,72,153,0.15)]" 
                      : "border-white/5 bg-black/40 opacity-60 hover:opacity-100 hover:border-white/20"
                  )}
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white flex items-center gap-2">
                        {rule.name}
                        {rule.active && (
                          <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-400 border border-pink-500/30">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {rule.type === "MULTIPLIER" && `Multiplicador x${rule.value} en Bunz`}
                        {rule.type === "BONUS_FIXED" && `+${rule.value} Bunz fijos de bono`}
                        {rule.type === "PERCENTAGE_BOOST" && `+${rule.value}% de cashback extra`}
                      </div>
                    </div>
                    <div className={cn(
                      "h-3.5 w-3.5 rounded-full transition-all shrink-0",
                      rule.active 
                        ? "bg-pink-500 shadow-[0_0_12px_#ec4899]" 
                        : "bg-gray-600 border border-gray-500"
                    )} />
                  </div>
                </div>
              ))}
              
              <button 
                onClick={() => setIsCreateRuleOpen(true)}
                className="w-full rounded-xl border border-dashed border-white/20 py-3 text-sm font-bold text-gray-400 hover:text-white hover:border-pink-500/50 hover:bg-pink-500/10 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
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
                    <span>{getLevelIcon(l.id).emoji}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Showcase Stage */}
            <div className="flex-1 flex items-center justify-center relative z-10">
              
              {/* Dynamic Aura */}
              <div className={cn("absolute w-100 h-100 rounded-full blur-[100px] opacity-20 transition-all duration-1000", `bg-linear-to-br ${getLevelIcon(activeLevel.id).color}`)} />

              <div className="flex w-full items-center justify-between gap-12 px-12">
                
                {/* 3D Badge Simulation */}
                <div className={cn(
                  "relative flex h-64 w-64 shrink-0 flex-col items-center justify-center rounded-[3rem] bg-linear-to-br border border-white/20 transition-all duration-500",
                  getLevelIcon(activeLevel.id).color,
                  getLevelIcon(activeLevel.id).glow
                )}>
                  <div className="absolute inset-0 rounded-[3rem] bg-black/40 backdrop-blur-sm" />
                  <span className="relative z-10 text-[6rem] drop-shadow-2xl mb-2">{getLevelIcon(activeLevel.id).emoji}</span>
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

                  <div className="rounded-4xl bg-black/60 border border-white/5 p-8 relative overflow-hidden">
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
                      <span className="rounded-lg bg-white/5 px-2.5 py-1 text-xs font-bold text-gray-300 border border-white/5">
                        Base: {rewardPercentage}% {activeBoostRule && `(+${activeBoostRule.value}% ${activeBoostRule.name})`}
                      </span>
                      <span className="rounded-lg bg-pink-500/20 px-2.5 py-1 text-xs font-bold text-pink-400 border border-pink-500/20">
                        Multiplicador Nivel: {activeLevel.bunzMultiplier}x
                      </span>
                      {activeMultiplierRule && (
                        <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-400 border border-indigo-500/20 flex items-center gap-1">
                          <Zap size={12} /> {activeMultiplierRule.name} (x{activeMultiplierRule.value})
                        </span>
                      )}
                      {fixedBonusBunz > 0 && (
                        <span className="rounded-lg bg-emerald-500/20 px-2.5 py-1 text-xs font-bold text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <Sparkles size={12} /> Bono Fijo: +{fixedBonusBunz} Bunz
                        </span>
                      )}
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>

          {/* User Distribution Bar */}
          <div className="rounded-4xl border border-white/5 bg-gray-900/60 p-8 shadow-2xl backdrop-blur-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-white">Distribución de Usuarios por Nivel</h3>
              <div className="text-sm font-bold text-gray-400">Total: {totalUsers}</div>
            </div>
            
            <div className="flex h-12 w-full rounded-2xl overflow-hidden shadow-inner border border-white/5 bg-black">
              {levels.map((l, index) => {
                const percent = totalUsers > 0 ? (l.userCount / totalUsers) * 100 : 0;
                if (percent === 0) return null;
                const colors = [
                  "bg-gray-500", "bg-yellow-500", "bg-pink-500", 
                  "bg-orange-500", "bg-blue-500", "bg-purple-500"
                ];
                const colorClass = colors[index % colors.length];
                return (
                  <div 
                    key={l.id} 
                    style={{ width: `${percent}%` }}
                    className={cn("h-full relative group transition-all hover:brightness-125 cursor-help", colorClass)}
                  >
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-white/20 transition-opacity" />
                  </div>
                );
              })}
            </div>
            
            <div className="mt-6 flex flex-wrap gap-4">
              {levels.map(l => (
                <div key={l.id} className="flex items-center gap-2">
                  <span className="text-lg">{getLevelIcon(l.id).emoji}</span>
                  <div className="text-sm font-bold text-gray-300">
                    {l.name} <span className="text-gray-500">({l.userCount})</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── Modal: Crear Nueva Regla Dinámica ── */}
      {isCreateRuleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl border border-white/10 bg-[#0F0F16] p-6 sm:p-8 shadow-2xl text-left">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
                  <Zap size={18} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white m-0">Nueva Regla Dinámica</h3>
                  <p className="text-xs text-gray-400 m-0">Incentiva visitas y consumo con beneficios especiales</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateRuleOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateRule} className="space-y-4 mt-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Nombre de la Campaña / Regla
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Jueves 2x1 Bunz, Noche de Chicas..."
                  value={newRuleName}
                  onChange={(e) => setNewRuleName(e.target.value)}
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 transition-all placeholder:text-gray-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  Tipo de Recompensa
                </label>
                <select
                  value={newRuleType}
                  onChange={(e) => {
                    const t = e.target.value as "MULTIPLIER" | "BONUS_FIXED" | "PERCENTAGE_BOOST";
                    setNewRuleType(t);
                    if (t === "MULTIPLIER") setNewRuleValue(2.0);
                    else if (t === "BONUS_FIXED") setNewRuleValue(300);
                    else if (t === "PERCENTAGE_BOOST") setNewRuleValue(10);
                  }}
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 transition-all"
                >
                  <option value="MULTIPLIER">Multiplicador de Bunz (Ej. 2x = Doble Bunz)</option>
                  <option value="PERCENTAGE_BOOST">Porcentaje Adicional de Cashback (+%)</option>
                  <option value="BONUS_FIXED">Bono Fijo de Bunz en cada visita (+Bunz)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1.5">
                  {newRuleType === "MULTIPLIER" && "Factor Multiplicador (Ej. 2.0 = Doble Bunz)"}
                  {newRuleType === "PERCENTAGE_BOOST" && "Porcentaje Extra de Cashback (% adicional)"}
                  {newRuleType === "BONUS_FIXED" && "Cantidad de Bunz Extra de Regalo"}
                </label>
                <input
                  type="number"
                  step={newRuleType === "MULTIPLIER" ? "0.1" : "1"}
                  min={newRuleType === "MULTIPLIER" ? "1" : "1"}
                  required
                  value={newRuleValue}
                  onChange={(e) => setNewRuleValue(Number(e.target.value))}
                  className="w-full rounded-xl bg-black/60 border border-white/10 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-pink-500 transition-all font-mono font-bold"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateRuleOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 text-xs font-bold transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-linear-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white text-xs font-black shadow-lg shadow-pink-500/25 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus size={14} /> Guardar y Activar Regla
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
