"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Activity, Users, Coins, ArrowLeftRight, Building2, RefreshCw } from "lucide-react";
import { Card, Button, cn } from "@rabbitty/ui";

interface EcoData {
  businesses: { total: number; active: number; pending: number; totalCreditLimit: number; totalCreditUsed: number };
  rabbitters: { total: number; totalBunzEarned: number; totalBunzSpent: number; circulatingSupply: number };
  ledger: { rewardsGiven: number; rewardsCount: number; redemptionsSpent: number; redemptionsCount: number; transfersP2P: number; transfersCount: number };
  monthlyTxns: number;
  businessesBreakdown: { id: string; name: string; category: string | null; status: string; creditLimit: number; creditUsed: number }[];
  recentLedger: { id: string; payer: string; payee: string; amount: number; type: string; createdAt: string | null }[];
}

async function godQuery<T>(proc: string, input?: unknown): Promise<T> {
  const url = `/api/trpc/${proc}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: input ?? null } }))}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data?.[0]?.error) throw new Error(data[0].error.message);
  return data?.[0]?.result?.data?.json as T;
}

export default function GodEcosistemaPage() {
  const [data, setData] = useState<EcoData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await godQuery<EcoData>("god.getEcosystemMetrics")); } catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const cards = data ? [
    { label: "Rabbitters", value: data.rabbitters.total.toLocaleString(), icon: Users, color: "text-pink-400" },
    { label: "Bunz en Circulación", value: data.rabbitters.circulatingSupply.toLocaleString(), icon: Coins, color: "text-amber-400" },
    { label: "Negocios Activos", value: `${data.businesses.active}/${data.businesses.total}`, icon: Building2, color: "text-emerald-400" },
    { label: "Txns / 30 días", value: data.monthlyTxns.toLocaleString(), icon: ArrowLeftRight, color: "text-cyan-400" },
  ] : [];

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-pink-500/15 border border-pink-500/30"><Activity className="h-7 w-7 text-pink-400" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Métricas Investor & Ecosistema</h1>
            <p className="text-xs text-gray-400">Salud global de la red: usuarios, supply, negocios y ledger inmutable</p>
          </div>
          <Button variant="secondary" onClick={() => void load()} className="ml-auto rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" /> Refrescar
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Card key={c.label} className="p-5 border border-white/10 bg-white/5">
              <c.icon className={cn("h-5 w-5 mb-2", c.color)} />
              <p className="text-2xl font-black text-white">{c.value}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{c.label}</p>
            </Card>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="p-5 border border-white/10 bg-white/5">
            <h2 className="text-sm font-black text-white uppercase tracking-wider pb-3">Economía Ledger (Inmutable)</h2>
            {data && (
              <div className="space-y-2 text-xs">
                {[
                  ["Bunz otorgados (EARN)", `${data.ledger.rewardsGiven.toLocaleString()} en ${data.ledger.rewardsCount} movimientos`],
                  ["Bunz canjeados (SPEND)", `${data.ledger.redemptionsSpent.toLocaleString()} en ${data.ledger.redemptionsCount} movimientos`],
                  ["Transferencias P2P", `${data.ledger.transfersP2P.toLocaleString()} en ${data.ledger.transfersCount} movimientos`],
                  ["Crédito afiliados", `${data.businesses.totalCreditUsed.toLocaleString()} / ${data.businesses.totalCreditLimit.toLocaleString()} Bunz`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between border-b border-white/5 pb-1.5">
                    <span className="text-gray-400">{k}</span><span className="font-black text-white">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5 border border-white/10 bg-white/5">
            <h2 className="text-sm font-black text-white uppercase tracking-wider pb-3">Últimos Movimientos</h2>
            <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
              {(data?.recentLedger ?? []).map((l) => (
                <div key={l.id} className="flex items-center justify-between text-[11px] px-3 py-2 rounded-lg bg-black/40 border border-white/5">
                  <span className="text-gray-400 truncate max-w-40">{l.type} · {l.payer.slice(0, 12)} → {l.payee.slice(0, 12)}</span>
                  <span className={cn("font-black", l.type === "EARN" ? "text-emerald-400" : l.type === "SPEND" ? "text-rose-400" : "text-cyan-400")}>
                    {l.amount > 0 ? "+" : ""}{l.amount}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {loading && <p className="text-xs text-gray-500">Cargando métricas…</p>}
      </motion.div>
    </div>
  );
}
