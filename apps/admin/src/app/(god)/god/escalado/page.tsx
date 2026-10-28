"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Rocket, RefreshCw } from "lucide-react";
import { Card, Button, cn } from "@rabbitty/ui";

interface ScalingMetric { key: string; label: string; icon: string; value: number; pct: number; max: number }
async function godQuery<T>(proc: string): Promise<T> {
  const url = `/api/trpc/${proc}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: null } }))}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data?.[0]?.error) throw new Error(data[0].error.message);
  return data?.[0]?.result?.data?.json as T;
}

export default function GodEscaladoPage() {
  const [metrics, setMetrics] = useState<ScalingMetric[] | null>(null);
  const [over80, setOver80] = useState<string[]>([]);
  const load = async () => {
    try {
      const d = await godQuery<{ metrics: ScalingMetric[]; over80: string[] }>("god.getScalingStatus");
      setMetrics(d.metrics); setOver80(d.over80);
    } catch { setMetrics(null); }
  };
  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-cyan-500/15 border border-cyan-500/30"><Rocket className="h-7 w-7 text-cyan-400" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Estado de Escalado</h1>
            <p className="text-xs text-gray-400">Umbrales de infraestructura antes de tocar límites del plan</p>
          </div>
          <Button variant="secondary" onClick={() => void load()} className="ml-auto rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {over80.length > 0 && (
          <Card className="p-4 border border-rose-500/30 bg-rose-500/10">
            <p className="text-xs font-black text-rose-400">⚠️ Métricas sobre 80%: {over80.join(", ")}</p>
          </Card>
        )}

        <div className="space-y-3">
          {(metrics ?? []).map((m) => (
            <Card key={m.key} className="p-4 border border-white/10 bg-white/5">
              <div className="flex items-center justify-between pb-2">
                <span className="text-xs font-black text-white">{m.icon} {m.label}</span>
                <span className={cn("text-xs font-black", m.pct >= 80 ? "text-rose-400" : m.pct >= 50 ? "text-amber-400" : "text-emerald-400")}>
                  {m.value.toLocaleString()} / {m.max.toLocaleString()} ({m.pct.toFixed(0)}%)
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/60 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", m.pct >= 80 ? "bg-rose-500" : m.pct >= 50 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${m.pct}%` }} />
              </div>
            </Card>
          ))}
          {metrics === null && <p className="text-xs text-gray-500">Cargando…</p>}
        </div>
      </motion.div>
    </div>
  );
}
