"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scale, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { Card, Button, cn } from "@rabbitty/ui";

interface ReconData {
  timestamp: string;
  totalUsersChecked: number;
  balancedUsers: number;
  discrepantUsers: number;
  totalCachedCirculation: number;
  totalLedgerCirculation: number;
  systemDifference: number;
  status: "HEALTHY" | "DEVIATION_DETECTED";
  details: { userId: string; username: string; cachedBalance: number; ledgerNet: number; discrepancy: number; isBalanced: boolean }[];
}

async function godQuery<T>(proc: string, input: unknown): Promise<T> {
  const url = `/api/trpc/${proc}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: input } }))}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data?.[0]?.error) throw new Error(data[0].error.message);
  return data?.[0]?.result?.data?.json as T;
}

export default function GodEconomiaPage() {
  const [onlyDiscrepancias, setOnlyDiscrepancias] = useState(false);
  const [data, setData] = useState<ReconData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setData(await godQuery<ReconData>("god.getLedgerReconciliation", { discrepanciesOnly: onlyDiscrepancias, limit: 300 })); }
    catch { setData(null); } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [onlyDiscrepancias]);

  const healthy = data?.status === "HEALTHY";

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className={cn("p-3 rounded-2xl border", healthy ? "bg-emerald-500/15 border-emerald-500/30" : "bg-rose-500/15 border-rose-500/30")}>
            {healthy ? <ShieldCheck className="h-7 w-7 text-emerald-400" /> : <AlertTriangle className="h-7 w-7 text-rose-400" />}
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Economía & Reconciliación de Ledger</h1>
            <p className="text-xs text-gray-400">
              Consistencia matemática entre saldos cacheados y el ledger inmutable ·{" "}
              <span className={cn("font-black", healthy ? "text-emerald-400" : "text-rose-400")}>{data?.status ?? "…"}</span>
            </p>
          </div>
          <label className="ml-auto flex items-center gap-2 text-[11px] font-bold text-gray-300 cursor-pointer">
            <input type="checkbox" checked={onlyDiscrepancias} onChange={(e) => setOnlyDiscrepancias(e.target.checked)} className="accent-pink-500" />
            Solo discrepancias
          </label>
          <Button variant="secondary" onClick={() => void load()} className="rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer">
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Usuarios Auditados", value: data?.totalUsersChecked ?? "—" },
            { label: "Balanceados", value: data?.balancedUsers ?? "—" },
            { label: "Discrepantes", value: data?.discrepantUsers ?? "—" },
            { label: "Diferencia Sistema", value: data?.systemDifference ?? "—" },
          ].map((c) => (
            <Card key={c.label} className="p-5 border border-white/10 bg-white/5">
              <p className={cn("text-2xl font-black", c.label === "Discrepantes" && Number(c.value) > 0 ? "text-rose-400" : "text-white")}>{c.value}</p>
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{c.label}</p>
            </Card>
          ))}
        </div>

        <Card className="p-5 border border-white/10 bg-white/5">
          <h2 className="text-sm font-black text-white uppercase tracking-wider pb-3">Detalle por Usuario</h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto custom-scrollbar">
            {(data?.details ?? []).map((d) => (
              <div key={d.userId} className={cn("flex items-center justify-between text-[11px] px-3 py-2 rounded-lg border", d.isBalanced ? "bg-black/40 border-white/5" : "bg-rose-500/10 border-rose-500/25")}>
                <span className="text-gray-300 font-bold truncate">{d.username}</span>
                <span className="text-gray-500">cache {d.cachedBalance} · ledger {d.ledgerNet}</span>
                <span className={cn("font-black", d.isBalanced ? "text-emerald-400" : "text-rose-400")}>{d.discrepancy > 0 ? "+" : ""}{d.discrepancy}</span>
              </div>
            ))}
            {loading && <p className="text-xs text-gray-500 py-4">Reconciliando…</p>}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
