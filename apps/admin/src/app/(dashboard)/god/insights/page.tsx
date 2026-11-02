"use client";

/**
 * ── /god/insights ── Analíticas God-Admin (solo God, layout /god la protege):
 * 1. Cómo pagan los clientes (mix de métodos, funnel de intents, tips, abandono)
 * 2. Seguridad de creación de cuentas (una cuenta por número, huérfanas, dedupe)
 * 3. Crecimiento para inversionistas (GMV mensual, nuevos usuarios, MAU, campañas upsell, liabilidad Bunz)
 */

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, CreditCard, ShieldCheck, TrendingUp, AlertTriangle, Banknote, Zap, Users } from "lucide-react";
import { Card, Button, cn, Badge } from "@rabbitty/ui";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area, Legend,
} from "recharts";

// ── Helper tRPC por HTTP (mismo patrón que /god/ecosistema) ──
async function godQuery<T>(proc: string, input?: unknown): Promise<T> {
  const url = `/api/trpc/${proc}?batch=1&input=${encodeURIComponent(JSON.stringify({ "0": { json: input ?? null } }))}`;
  const r = await fetch(url);
  const data = await r.json();
  if (data?.[0]?.error) throw new Error(data[0].error.message);
  return data?.[0]?.result?.data?.json as T;
}

interface PaymentMetrics {
  windowDays: number;
  byMethod: { method: string; count: number; total: number; avg: number; share: number }[];
  totalCount: number;
  totalAmount: number;
  byVerification: { verification: string; count: number }[];
  intents: { total: number; byStatus: Record<string, number>; settled: number; failed: number; conversion: number; abandoned: number };
  tips: { ordersWithTip: number; totalTip: number };
  weekly: { week: string; method: string; total: number }[];
}

interface AccountSecurity {
  totals: {
    totalUsers: number; withPhone: number; withTelegram: number; withEmail: number;
    withUsername: number; noIdentity: number; newLast7: number; newLast30: number; affiliates: number;
  };
  oneAccountPerPhone: {
    enforced: boolean; indexes: string[]; duplicatePhonesAfterNormalize: { digits: string; n: number }[];
  };
  orphanAccounts: { id: string; username: string | null; createdAt: string | null }[];
  identityLinkSignals: {
    gmailClusters: { inbox: string; alias_tag: string | null; n: number; accounts: string }[];
    ipSharing: { ip: string; n: number; accounts: string }[];
    deviceSharing: { device: string; agent: string; n: number; accounts: string }[];
    tokenHistory: { token_prefix: string; n: number; accounts: string }[];
    walletClusters: Record<string, unknown>[];
  };
}

interface GrowthMetrics {
  gmvByMonth: { month: string; gmv: number; orders: number }[];
  newUsersByMonth: { month: string; count: number }[];
  mauByMonth: { month: string; activeUsers: number }[];
  topBusinesses: { restaurant: string; orders: number; gmv: number }[];
  campaigns: { id: string; type: string; status: string; rewardPercentage: number; budget: number; spent: number; utilization: number; redemptions: number; fiatSpent: number; upsell: string | null }[];
  bunzLiability: { minted: number; spent: number; outstanding: number };
}

interface AnalyticsTenant {
  id: string; name: string; currency: string; branchCount: number;
  analyticsProEnabled: boolean; showUsdTicket: boolean; createdAt: string | null;
}

// ── Rabbitter Trust & Engagement (F2, SHADOW — jamás operativo) ──
interface TrustShadowQueueRow {
  subjectId: string; username: string | null;
  score: number | null; confidence: string; sampleN: number;
  reviewFlag: boolean; computedAt: string;
}
interface TrustComponents {
  payments: { score: number | null; sampleN: number; notes?: Record<string, unknown> };
  tabs: { score: number | null; sampleN: number; notes?: Record<string, unknown> };
  ledger: { score: number | null; sampleN: number; notes?: Record<string, unknown> };
  presence: { score: number | null; sampleN: number; notes?: Record<string, unknown> };
}
interface TrustShadowResult {
  subjectId: string; score: number | null; confidence: string;
  sampleN: number; components: TrustComponents; insufficient: string[];
  reviewFlag: boolean;
  reviewFlags: { gmailCluster: boolean; ipSharing: boolean; deviceSharing: boolean; pushTokenSharing: boolean; ledgerSuspect: boolean };
}

const METHOD_COLORS: Record<string, string> = {
  CASH: "#10B981",
  CREDIT_CARD: "#06B6D4",
  STRIPE: "#8B5CF6",
  BUNZ: "#E91E63",
};

export default function GodInsightsPage() {
  const [payments, setPayments] = useState<PaymentMetrics | null>(null);
  const [security, setSecurity] = useState<AccountSecurity | null>(null);
  const [growth, setGrowth] = useState<GrowthMetrics | null>(null);
  const [tenants, setTenants] = useState<AnalyticsTenant[] | null>(null);
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowDays, setWindowDays] = useState(30);
  // ── Rabbitter Trust (shadow) ──
  const [trustQueue, setTrustQueue] = useState<TrustShadowQueueRow[]>([]);
  const [trustSubject, setTrustSubject] = useState("");
  const [trustResult, setTrustResult] = useState<TrustShadowResult | null>(null);
  const [trustLoading, setTrustLoading] = useState(false);

  const provisionPro = async (tenantId: string, enabled: boolean) => {
    setProvisioning(tenantId);
    try {
      await godQuery("god.setAnalyticsPro", { restaurantId: tenantId, enabled });
      setTenants((prev) => (prev ?? []).map((t) => (t.id === tenantId ? { ...t, analyticsProEnabled: enabled } : t)));
    } catch { /* recarga fallará visible en botón */ }
    finally { setProvisioning(null); }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [p, s, g, t] = await Promise.all([
        godQuery<PaymentMetrics>("god.getPaymentMetrics", { days: windowDays }),
        godQuery<AccountSecurity>("god.getAccountSecurity"),
        godQuery<GrowthMetrics>("god.getGrowthMetrics", { months: 12 }),
        godQuery<AnalyticsTenant[]>("god.listAnalyticsTenants"),
      ]);
      setPayments(p); setSecurity(s); setGrowth(g); setTenants(t);
    } catch { setPayments(null); setSecurity(null); setGrowth(null); }
    try {
      setTrustQueue(await godQuery<TrustShadowQueueRow[]>("god.rabbitterTrustShadowQueue"));
    } catch { setTrustQueue([]); }
    finally { setLoading(false); }
  };

  const computeTrust = async () => {
    const subjectId = trustSubject.trim();
    if (!subjectId) return;
    setTrustLoading(true);
    try {
      // persist: true → snapshot para medir poder predictivo (shadow, no operativo)
      setTrustResult(await godQuery<TrustShadowResult>("god.getRabbitterTrustShadow", { subjectId, lookbackDays: 90, persist: true }));
      setTrustQueue(await godQuery<TrustShadowQueueRow[]>("god.rabbitterTrustShadowQueue"));
    } catch { setTrustResult(null); }
    finally { setTrustLoading(false); }
  };

  useEffect(() => { void load(); /* eslint-disable-line react-hooks/exhaustive-deps */ }, [windowDays]);

  const methodPie = useMemo(
    () => (payments?.byMethod ?? []).map((m) => ({ name: m.method, value: m.total })),
    [payments]
  );

  const gmvChart = useMemo(() => (growth?.gmvByMonth ?? []).map((g) => ({ ...g, gmv: Number(g.gmv.toFixed(2)) })), [growth]);

  return (
    <div className="min-h-screen bg-[#050508] p-6 lg:p-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-3 rounded-2xl bg-pink-500/15 border border-pink-500/30"><RefreshCw className="h-7 w-7 text-pink-400" /></div>
          <div>
            <h1 className="text-2xl font-black text-white">Pago · Seguridad · Crecimiento</h1>
            <p className="text-xs text-gray-400">Analíticas God: cómo pagan, sanidad de cuentas y métricas de ronda</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setWindowDays(d)}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-xs font-black cursor-pointer border transition-all",
                  windowDays === d ? "bg-pink-500/20 border-pink-500/40 text-pink-300" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                )}
              >{d}d</button>
            ))}
            <Button variant="secondary" onClick={() => void load()} className="rounded-xl bg-white/5 border border-white/10 text-gray-200 text-xs font-bold cursor-pointer">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> Refrescar
            </Button>
          </div>
        </div>

        {/* ───────────── 1. MÉTRICAS DE PAGO ───────────── */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="h-5 w-5 text-cyan-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Cómo pagan · últimos {payments?.windowDays ?? windowDays} días</h2>
          </div>
          {payments ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <Card className="p-4 bg-white/5 border-white/10">
                  <Banknote className="h-4 w-4 text-emerald-400 mb-1" />
                  <p className="text-lg font-black text-white">${payments.totalAmount.toLocaleString("es-MX", { maximumFractionDigits: 0 })}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Cobrado (MXN)</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/10">
                  <CreditCard className="h-4 w-4 text-cyan-400 mb-1" />
                  <p className="text-lg font-black text-white">{payments.totalCount.toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Pagos completados</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/10">
                  <Zap className="h-4 w-4 text-purple-400 mb-1" />
                  <p className="text-lg font-black text-white">{payments.intents.conversion}%</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Conversión de cobro digital</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/10">
                  <AlertTriangle className={cn("h-4 w-4 mb-1", payments.intents.abandoned > 10 ? "text-amber-400" : "text-gray-500")} />
                  <p className="text-lg font-black text-white">{payments.intents.abandoned}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Checkouts abandonados (2h+)</p>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                {/* Pie mix de métodos */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Mix por método (Monto)</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <PieChart>
                      <Pie data={methodPie} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                        {methodPie.map((m, i) => (
                          <Cell key={i} fill={METHOD_COLORS[m.name] || ["#F43F5E", "#A855F7", "#38BDF8", "#FACC15"][i % 4]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()} MXN`} contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 12 }} />
                      <Legend formatter={(v: string) => <span className="text-[11px] text-gray-300">{v}</span>} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Tabla métodos */}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Detalle por método</p>
                  <div className="space-y-2">
                    {payments.byMethod.map((m) => (
                      <div key={m.method} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: METHOD_COLORS[m.method] || "#666" }} />
                          <span className="text-xs font-black text-white">{m.method}</span>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-white">${m.total.toLocaleString()} <span className="text-gray-500 font-bold">({m.share}%)</span></p>
                          <p className="text-[10px] text-gray-500">{m.count} pagos · ticket prom ${m.avg.toFixed(0)}</p>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                      <span className="text-xs font-bold text-gray-300">Propinas recibidas</span>
                      <span className="text-xs font-black text-amber-300">${payments.tips.totalTip.toFixed(2)} en {payments.tips.ordersWithTip} cuentas</span>
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Verificación</p>
                      {payments.byVerification.map((v) => (
                        <div key={v.verification} className="flex justify-between text-[11px] text-gray-300">
                          <span>{v.verification}</span><span className="font-black text-white">{v.count}</span>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1">Funnel de intents digitales</p>
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(payments.intents.byStatus).map(([k, v]) => (
                          <Badge key={k} variant="secondary" className="text-[10px] border-white/10 bg-white/5">{k}: {v}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trend semanal */}
              {payments.weekly.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Tendencia semanal por método (12 sem)</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={Object.values(payments.weekly.reduce<Record<string, { week: string } & Record<string, number>>>((acc, r) => {
                      acc[r.week] = acc[r.week] || { week: r.week };
                      acc[r.week][r.method] = (acc[r.week][r.method] || 0) + r.total;
                      return acc;
                    }, {}))}>
                      <XAxis dataKey="week" tick={{ fill: "#888", fontSize: 10 }} />
                      <YAxis tick={{ fill: "#888", fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()} MXN`} contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 12 }} />
                      <Legend formatter={(v: string) => <span className="text-[11px] text-gray-300">{v}</span>} />
                      {Object.keys(payments.weekly.reduce<Record<string, number>>((acc, r) => { acc[r.method] = 1; return acc; }, {})).map((m) => (
                        <Bar key={m} dataKey={m} fill={METHOD_COLORS[m] || "#888"} radius={[4, 4, 0, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500 py-4">Sin datos de pagos en este rango.</p>
          )}
        </Card>

        {/* ───────────── 2. SEGURIDAD DE CUENTAS ───────────── */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-4">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Seguridad de creación de cuentas</h2>
            {security && (
              <Badge variant={security.oneAccountPerPhone.enforced ? "success" : "danger"}
                className={cn("text-[10px]", security.oneAccountPerPhone.enforced ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-red-500/40 bg-red-500/10 text-red-300")}>
                {security.oneAccountPerPhone.enforced ? "✔ 1 cuenta por número (UNIQUE en DB)" : "⚠ Índice UNIQUE de teléfono NO detectado"}
              </Badge>
            )}
          </div>
          {security ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-5">
                {[
                  ["Cuentas totales", security.totals.totalUsers, "text-white"],
                  ["Con móvil verificado", security.totals.withPhone, "text-emerald-400"],
                  ["Con Telegram", security.totals.withTelegram, "text-cyan-400"],
                  ["Nuevas · 7 días", security.totals.newLast7, "text-pink-400"],
                  ["Afiliados", security.totals.affiliates, "text-amber-400"],
                ].map(([label, value, color]) => (
                  <Card key={label as string} className="p-4 bg-white/5 border-white/10">
                    <p className={cn("text-lg font-black", color as string)}>{Number(value).toLocaleString()}</p>
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">{label as string}</p>
                  </Card>
                ))}
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Cobertura de identidad</p>
                    {[
                      ["Verificados por móvil", security.totals.withPhone],
                      ["Vinculados a Telegram", security.totals.withTelegram],
                      ["Con email", security.totals.withEmail],
                      ["Con @username", security.totals.withUsername],
                      ["Sin ninguna identidad (huérfanas)", security.totals.noIdentity],
                    ].map(([k, v]) => (
                      <div key={k as string} className="flex justify-between border-b border-white/5 py-0.5 text-[11px]">
                        <span className="text-gray-400">{k as string}</span>
                        <span className={cn("font-black", Number(v) > 0 && (k as string).includes("huérf") ? "text-amber-400" : "text-white")}>{Number(v).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-1.5">Dedupe de teléfonos (normalizado a 10 dígitos)</p>
                    {security.oneAccountPerPhone.duplicatePhonesAfterNormalize.length === 0 ? (
                      <p className="text-[11px] text-emerald-300 font-bold">✔ Sin duplicados — cada número tiene una sola cuenta</p>
                    ) : (
                      security.oneAccountPerPhone.duplicatePhonesAfterNormalize.map((d) => (
                        <div key={d.digits} className="flex justify-between text-[11px] text-amber-300 font-bold">
                          <span>…{d.digits.slice(-10)}</span><span>×{d.n}</span>
                        </div>
                      ))
                    )}
                    <p className="text-[10px] text-gray-500 mt-1">Índices UNIQUE: {security.oneAccountPerPhone.indexes.join(", ")}</p>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Cuentas huérfanas (candidatas a cleanup)</p>
                  {security.orphanAccounts.length === 0 ? (
                    <p className="text-[11px] text-emerald-300 font-bold">✔ Ninguna — cero cuentas vacías activas</p>
                  ) : (
                    <div className="max-h-44 overflow-y-auto custom-scrollbar space-y-1.5">
                      {security.orphanAccounts.map((o) => (
                        <div key={o.id} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                          <span className="font-mono text-[10px] text-gray-400">#{o.id.slice(-8)}</span>
                          <span className="text-[10px] text-gray-500">{o.createdAt ? new Date(o.createdAt).toLocaleDateString() : "—"}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Investigación multi-cuenta: vinculación de identidades ── */}
              <div className="mt-5 rounded-2xl bg-amber-500/5 border border-amber-500/25 p-4">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300 mb-3">
                  🔗 Investigación multi-cuenta — señales de que "una misma persona" tiene varias cuentas
                </p>
                <div className="grid md:grid-cols-2 gap-3 text-[11px]">
                  {[
                    {
                      title: "📧 Mismo inbox Gmail (puntos/+tag)",
                      rows: security.identityLinkSignals.gmailClusters.map((c) => ({
                        k: `${c.alias_tag ? `+${c.alias_tag}` : "sin tag"} · inbox …${String(c.inbox).slice(-16)}`,
                        v: `×${c.n} — ${c.accounts}`,
                      })),
                    },
                    {
                      title: "🌐 Misma IP confiable",
                      rows: security.identityLinkSignals.ipSharing.map((c) => ({ k: String(c.ip), v: `×${c.n} — ${c.accounts}` })),
                    },
                    {
                      title: "📱 Mismo dispositivo (device + UA)",
                      rows: security.identityLinkSignals.deviceSharing.map((c) => ({ k: String(c.device), v: `×${c.n} — ${c.accounts}` })),
                    },
                    {
                      title: "📲 Push token físico compartido",
                      rows: security.identityLinkSignals.tokenHistory.map((c) => ({ k: `tok…${String(c.token_prefix).slice(-10)}`, v: `×${c.n} — ${c.accounts}` })),
                    },
                  ].map((group) => (
                    <div key={group.title} className="rounded-xl bg-black/30 border border-white/10 p-3">
                      <p className="font-black text-gray-200 mb-1.5">{group.title}</p>
                      {group.rows.length === 0 ? (
                        <p className="text-[10px] text-emerald-300">✔ Sin coincidencias</p>
                      ) : (
                        <div className="space-y-1">
                          {group.rows.map((row, i) => (
                            <div key={i} className="flex items-center justify-between gap-2 border-b border-white/5 pb-1">
                              <span className="text-gray-300 font-mono truncate">{row.k}</span>
                              <span className="text-white font-bold shrink-0">{row.v}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 mt-2.5 leading-relaxed">
                  Regla: 2+ señales distintas apuntando a las mismas cuentas = misma persona casi seguro (ej. mismo inbox Gmail + misma IP). Una sola señal puede ser coincidencia (red de casa, dispositivo familiar).
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 py-4">Cargando sanidad de cuentas…</p>
          )}
        </Card>

        {/* ───────────── 3. CRECIMIENTO / VC ───────────── */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="h-5 w-5 text-pink-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Crecimiento · ronda de inversión (12 meses)</h2>
          </div>
          {growth ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <Card className="p-4 bg-white/5 border-white/10">
                  <TrendingUp className="h-4 w-4 text-emerald-400 mb-1" />
                  <p className="text-lg font-black text-white">${(growth.gmvByMonth.at(-1)?.gmv || 0).toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">GMV último mes</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/10">
                  <Users className="h-4 w-4 text-cyan-400 mb-1" />
                  <p className="text-lg font-black text-white">{(growth.newUsersByMonth.at(-1)?.count || 0).toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Nuevos usuarios (mes)</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/10">
                  <Zap className="h-4 w-4 text-purple-400 mb-1" />
                  <p className="text-lg font-black text-white">{(growth.mauByMonth.at(-1)?.activeUsers || 0).toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Usuarias activas (ledger)</p>
                </Card>
                <Card className="p-4 bg-white/5 border-white/10">
                  <Banknote className="h-4 w-4 text-amber-400 mb-1" />
                  <p className="text-lg font-black text-white">{growth.bunzLiability.outstanding.toLocaleString()}</p>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Liabilidad Bunz por cubrir</p>
                </Card>
              </div>

              <div className="grid lg:grid-cols-2 gap-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">GMV mensual (órd. completadas)</p>
                  <ResponsiveContainer width="100%" height={230}>
                    <AreaChart data={gmvChart}>
                      <defs>
                        <linearGradient id="gmvGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E91E63" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#E91E63" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 9 }} />
                      <YAxis tick={{ fill: "#888", fontSize: 10 }} />
                      <Tooltip formatter={(v: number) => `$${Number(v).toLocaleString()} MXN`} contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 12 }} />
                      <Area type="monotone" dataKey="gmv" stroke="#E91E63" strokeWidth={2.5} fill="url(#gmvGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Nuevos usuarios + usuarios activos</p>
                  <ResponsiveContainer width="100%" height={230}>
                    <BarChart data={growth.newUsersByMonth.map((n, i) => ({ month: n.month, nuevos: n.count, activos: growth.mauByMonth[i]?.activeUsers ?? 0 }))}>
                      <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 9 }} />
                      <YAxis tick={{ fill: "#888", fontSize: 10 }} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: 12 }} />
                      <Legend formatter={(v: string) => <span className="text-[11px] text-gray-300">{v}</span>} />
                      <Bar dataKey="nuevos" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="activos" fill="#E91E63" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-5 mt-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Top comercios por GMV (90 días) — candidatos a upsell</p>
                  <div className="space-y-1.5">
                    {growth.topBusinesses.map((b, i) => (
                      <div key={b.restaurant} className="flex items-center justify-between rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                        <span className="text-[11px] font-black text-white">{i + 1}. {b.restaurant}</span>
                        <span className="text-[11px] text-gray-300">${b.gmv.toLocaleString()} · {b.orders} órd.</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Campañas afiliados — señales de venta</p>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-1.5">
                    {growth.campaigns.length === 0 && <p className="text-[11px] text-gray-500">Sin campañas aún.</p>}
                    {growth.campaigns.map((c) => (
                      <div key={c.id} className="rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black text-white">{c.type} · {c.rewardPercentage}%</span>
                          <span className="text-[10px] text-gray-400">{c.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-500">
                          <span>Presupuesto {c.utilization}% usado · {c.redemptions} canjes</span>
                          {c.upsell && (
                            <span className={cn(
                              "text-[9px] font-black px-1.5 py-0.5 rounded-full",
                              c.upsell === "BUDGET_AGOTANDOSE" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
                            )}>
                              {c.upsell === "BUDGET_AGOTANDOSE" ? "🎯 Ampliar presupuesto" : "⚡ Optimizar campaña"}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 py-4">Cargando métricas de crecimiento…</p>
          )}
        </Card>

        {/* ───────────── RABBITTER TRUST & ENGAGEMENT (F2, SHADOW) ───────────── */}
        <Card className="p-5 border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-1">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Rabbitter Trust &amp; Engagement — Shadow</h2>
            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 uppercase tracking-wider">Solo God · no operativo</span>
          </div>
          <p className="text-[11px] text-gray-500 mb-4">
            Score de confiabilidad del comensal: pagos completados vs abandonados, tabs huérfanas (diagnóstico),
            disciplina de canjes y presencia honesta. Se persiste para medir poder predictivo; jamás mueve un peso.
          </p>

          <div className="flex items-center gap-2 mb-4">
            <input
              value={trustSubject}
              onChange={(e) => setTrustSubject(e.target.value)}
              placeholder="subjectId del Rabbitter (id de usuario core)"
              className="flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder:text-gray-600 outline-none focus:border-pink-500/40"
            />
            <Button
              variant="secondary"
              disabled={trustLoading || !trustSubject.trim()}
              onClick={() => void computeTrust()}
              className="rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-black py-2 px-4 hover:bg-amber-500/20 cursor-pointer"
            >
              {trustLoading ? "Calculando…" : "Calcular snapshot"}
            </Button>
          </div>

          {trustResult && (
            <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-4 space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-lg font-black text-white">
                  {trustResult.score === null ? "Sin datos" : `${trustResult.score.toFixed(1)} / 100`}
                </p>
                <span className={cn(
                  "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                  trustResult.confidence === "HIGH" && "bg-emerald-500/15 text-emerald-300",
                  trustResult.confidence === "MEDIUM" && "bg-blue-500/15 text-blue-300",
                  trustResult.confidence === "LOW" && "bg-amber-500/15 text-amber-300",
                  (trustResult.confidence === "NONE" || !["HIGH", "MEDIUM", "LOW"].includes(trustResult.confidence)) && "bg-gray-500/15 text-gray-400"
                )}>
                  Confianza {trustResult.confidence}
                </span>
                {trustResult.reviewFlag && <Badge className="text-[10px] bg-red-500/20 text-red-300">REVISIÓN multi-cuenta</Badge>}
                <span className="text-[10px] text-gray-500">muestra n={trustResult.sampleN}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[10px]">
                {([
                  ["Pagos completados", trustResult.components.payments],
                  ["Tabs huérfanas (diag.)", trustResult.components.tabs],
                  ["Disciplina de canjes", trustResult.components.ledger],
                  ["Presencia honesta", trustResult.components.presence],
                ] as const).map(([label, c]) => (
                  <div key={label} className="rounded-lg bg-white/5 border border-white/10 p-2.5">
                    <p className="font-black text-gray-300 uppercase tracking-wider mb-0.5">{label}</p>
                    <p className="text-white font-black text-sm">
                      {c.score === null ? "— (sin muestra)" : `${c.score.toFixed(0)}`}
                    </p>
                    <p className="text-gray-500">n={c.sampleN}</p>
                  </div>
                ))}
              </div>
              {trustResult.insufficient.length > 0 && (
                <p className="text-[10px] text-gray-500">Excluidos por muestra mínima: {trustResult.insufficient.join(", ")}</p>
              )}
            </div>
          )}

          <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Últimos snapshots (cola shadow)</p>
          <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar">
            {trustQueue.length === 0 && <p className="text-[11px] text-gray-500">Sin snapshots aún.</p>}
            {trustQueue.map((r) => (
              <div key={`${r.subjectId}-${r.computedAt}`} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 border border-white/10 px-2.5 py-1.5">
                <span className="text-[11px] font-black text-white truncate">{r.username ?? r.subjectId.slice(0, 12)}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {r.reviewFlag && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-300">REVISIÓN</span>}
                  <span className="text-[10px] text-gray-400">{r.score === null ? "—" : r.score.toFixed(1)} · {r.confidence}</span>
                  <span className="text-[9px] text-gray-600">{new Date(r.computedAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ───────────── APROVISIONAMIENTO de Analíticas Pro ───────────── */}        <Card className="p-5 border border-white/10 bg-white/5">
          <div className="flex items-center gap-3 mb-1">
            <Zap className="h-5 w-5 text-emerald-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Aprovisionamiento — Plan Analíticas Pro</h2>
          </div>
          <p className="text-[11px] text-gray-500 mb-4">
            Concede o retira el plan por comercio. El afiliado lo verá activo en su Ajustes → Facturación y su /reports dejará de mostrar el candado. (Cuando existan paquetes de membresía, aquí se cobra automáticamente — hoy es manual.)
          </p>
          <div className="space-y-2">
            {(tenants ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                <div>
                  <p className="text-xs font-black text-white">
                    {t.name}
                    <span className="ml-2 text-[10px] font-bold text-gray-500">Sede(s): {t.branchCount}</span>
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Mostrando USD: {t.showUsdTicket ? "sí" : "no"} · alta {t.createdAt ? new Date(t.createdAt).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                    t.analyticsProEnabled ? "bg-emerald-500/15 text-emerald-300" : "bg-gray-500/15 text-gray-400"
                  )}>
                    {t.analyticsProEnabled ? "PRO" : "Básico"}
                  </span>
                  <Button
                    variant="secondary"
                    disabled={provisioning === t.id}
                    onClick={() => void provisionPro(t.id, !t.analyticsProEnabled)}
                    className={cn(
                      "rounded-lg text-[11px] font-black py-1.5 px-3 cursor-pointer border transition-all",
                      t.analyticsProEnabled
                        ? "bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20"
                        : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                    )}
                  >
                    {provisioning === t.id ? "…" : t.analyticsProEnabled ? "Retirar" : "Conceder"}
                  </Button>
                </div>
              </div>
            ))}
            {tenants && tenants.length === 0 && (
              <p className="text-[11px] text-gray-500">Sin restaurantes registrados todavía.</p>
            )}
          </div>
        </Card>
      </motion.div>
    </div>
  );
}