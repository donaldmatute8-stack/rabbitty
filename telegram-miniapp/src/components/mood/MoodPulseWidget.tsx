'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Sparkles, Users, RefreshCw, TrendingUp, Info } from 'lucide-react';

interface MoodDistributionItem {
  mood: string;
  label: string;
  emoji: string;
  accentHex: string;
  count: number;
  percentage: number;
}

interface AtmosphereRecipe {
  title: string;
  action: string;
  lighting: string;
  soundtrack: string;
  pairing: string;
}

interface PulseData {
  status: 'ACTIVE_PULSE' | 'INSUFFICIENT_DATA';
  message?: string;
  totalParticipants: number;
  threshold?: number;
  windowHours: number;
  dominantMood?: MoodDistributionItem;
  atmosphereRecipe?: AtmosphereRecipe;
  distribution?: MoodDistributionItem[];
}

export function MoodPulseWidget({ businessId }: { businessId?: string }) {
  const [data, setData] = useState<PulseData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPulse = useCallback(async () => {
    try {
      setLoading(true);
      const url = businessId ? `/api/mood/pulse?businessId=${encodeURIComponent(businessId)}` : '/api/mood/pulse';
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (e) {
      console.warn('[MoodPulseWidget] Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchPulse();
    });
  }, [fetchPulse]);

  if (loading && !data) {
    return (
      <div className="p-5 rounded-2xl border border-white/10 bg-white/5 animate-pulse flex items-center justify-center min-h-40">
        <div className="flex items-center gap-2 text-white/50 text-xs">
          <Activity className="h-4 w-4 animate-spin" />
          <span>Calculando vibra de la comunidad...</span>
        </div>
      </div>
    );
  }

  if (!data || data.status === 'INSUFFICIENT_DATA') {
    return (
      <div className="p-5 rounded-2xl border border-white/10 bg-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold text-white">Mood Pulse (Inteligencia Ambiental)</span>
          </div>
          <button
            onClick={fetchPulse}
            className="p-1 rounded-lg text-white/40 hover:text-white/80 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="p-3.5 rounded-xl bg-white/2 border border-white/5 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-amber-400/80 shrink-0 mt-0.5" />
          <div className="text-xs text-white/60 space-y-1">
            <p className="font-medium text-white/80">Recopilando datos de privacidad</p>
            <p>
              Actualmente hay {data?.totalParticipants || 0} check-ins. Se requiere un mínimo de {data?.threshold || 3} respuestas en las últimas 24h para mostrar porcentajes sin comprometer la privacidad individual.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl border border-white/10 bg-linear-to-b from-white/[0.07] to-white/2 space-y-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-linear-to-tr from-amber-500/20 to-orange-500/20 text-amber-400">
            <Activity className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              Mood Pulse · Vibra del Local
              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                En vivo
              </span>
            </h4>
            <div className="flex items-center gap-3 text-[11px] text-white/50 mt-0.5">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {data.totalParticipants} Rabbitters
              </span>
              <span>·</span>
              <span>Últimas {data.windowHours} horas</span>
            </div>
          </div>
        </div>

        <button
          onClick={fetchPulse}
          disabled={loading}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Dominant Mood Highlight */}
      {data.dominantMood && (
        <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{data.dominantMood.emoji}</span>
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                Preferencia Predominante
              </span>
              <h5 className="text-base font-extrabold text-white">
                Modo {data.dominantMood.label} ({data.dominantMood.percentage}%)
              </h5>
            </div>
          </div>
          <TrendingUp className="h-5 w-5 text-emerald-400/80" />
        </div>
      )}

      {/* Progress Bars Breakdown */}
      <div className="space-y-2.5">
        <span className="text-xs font-semibold text-white/70">Distribución de Preferencias</span>
        <div className="space-y-2">
          {data.distribution?.map((item) => (
            <div key={item.mood} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-white/80 flex items-center gap-1.5">
                  <span>{item.emoji}</span>
                  <span className="font-medium">{item.label}</span>
                </span>
                <span className="font-bold text-white">{item.percentage}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.percentage}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: item.accentHex }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational Atmosphere Recipe for Staff with PoA Execution Logger */}
      {data.atmosphereRecipe && (
        <div className="p-4 rounded-xl bg-linear-to-r from-amber-500/10 via-orange-500/5 to-transparent border border-amber-500/25 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-black text-amber-400 uppercase tracking-wider">
              <Sparkles className="h-4 w-4" />
              <span>Receta de Atmósfera Activa: {data.atmosphereRecipe.title}</span>
            </div>
            {data.dominantMood && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                PoA Ready
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-white/80">
            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-amber-300/80 block">Acción en Sala</span>
              <p className="leading-snug text-white/90">{data.atmosphereRecipe.action}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-amber-300/80 block">Iluminación</span>
              <p className="leading-snug text-white/90">{data.atmosphereRecipe.lighting}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-amber-300/80 block">Banda Sonora Recomendada</span>
              <p className="leading-snug font-medium text-amber-200">{data.atmosphereRecipe.soundtrack}</p>
            </div>
            <div className="p-2.5 rounded-lg bg-black/20 border border-white/5 space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-amber-300/80 block">Pairing de Menú Sugerido</span>
              <p className="leading-snug text-white/90">{data.atmosphereRecipe.pairing}</p>
            </div>
          </div>

          {/* Action to log recipe execution in PoA */}
          {businessId && (
            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-white/60">
                ¿Aplicaste esta receta en sala?
              </span>
              <button
                onClick={async () => {
                  try {
                    await fetch('/api/mood/intervention', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        businessId,
                        recipeType: data.dominantMood?.mood || 'calm',
                        soundtrackApplied: data.atmosphereRecipe?.soundtrack,
                        lightingApplied: data.atmosphereRecipe?.lighting,
                        roomAction: data.atmosphereRecipe?.action,
                      }),
                    });
                    alert('¡Receta aplicada! Se ha registrado en Proof of Atmosphere (PoA) para calcular el retorno empírico.');
                  } catch {
                    alert('Error registrando intervención.');
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold border border-amber-500/30 transition-all cursor-pointer"
              >
                Registrar Ejecución PoA
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
