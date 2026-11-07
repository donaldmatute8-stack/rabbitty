"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Coins,
  FileText,
  History,
  RefreshCw,
  Scale,
  ShieldCheck,
  Trash2,
  Unlock,
} from "lucide-react";
import { Card, Button, cn } from "@rabbitty/ui";

/**
 * Centro económico GOD.
 *
 * Integra en una sola pantalla: resumen, capacidad MCCE, conciliación,
 * contratos e historial. Solo GOD (allowlist + 2FA).
 */

type Tab = "resumen" | "capacidad" | "conciliacion" | "contratos" | "historial";

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "resumen", label: "Resumen", icon: Activity },
  { id: "capacidad", label: "Capacidad", icon: Coins },
  { id: "conciliacion", label: "Conciliación", icon: Scale },
  { id: "contratos", label: "Contratos", icon: FileText },
  { id: "historial", label: "Historial", icon: History },
];

async function godQuery<T = any>(proc: string, input: unknown = null): Promise<T> {
  const url =
    `/api/trpc/${proc}?batch=1&input=` +
    encodeURIComponent(JSON.stringify({ "0": { json: input } }));
  const res = await fetch(url);
  const payload = await res.json();
  const data = payload?.[0]?.result?.data?.json;
  if (!res.ok || data == null) {
    throw new Error(payload?.[0]?.error?.json?.message ?? `Error en ${proc}`);
  }
  return data as T;
}

async function godMutation<T = any>(proc: string, input: unknown = null): Promise<T> {
  const res = await fetch(`/api/trpc/${proc}?batch=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ "0": { json: input } }),
  });
  const payload = await res.json();
  const data = payload?.[0]?.result?.data?.json;
  if (!res.ok || data == null) {
    throw new Error(payload?.[0]?.error?.json?.message ?? `Error en ${proc}`);
  }
  return data as T;
}

const fmt = (v: number | null | undefined) =>
  typeof v === "number" ? v.toLocaleString("es-MX") : "—";

export default function GodEconomyPage() {
  const [tab, setTab] = useState<Tab>("resumen");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [ledger, setLedger] = useState<any>(null);
  const [capacity, setCapacity] = useState<{ accounts: any[]; events: any[] } | null>(null);
  const [recon, setRecon] = useState<{ lastRun: any; control: any } | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);

  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ authorizedTotal: 0, promo: 0, credit: 0, provisioned: 0, status: "ACTIVE", notes: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<any | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [l, c, r, k] = await Promise.all([
        godQuery("god.getLedgerReconciliation", { discrepanciesOnly: false, limit: 300 }),
        godQuery("god.listCapacityAccounts"),
        godQuery("god.getBunzReconciliation"),
        godQuery("god.listContractAcceptances"),
      ]);
      setLedger(l);
      setCapacity(c);
      setRecon(r);
      setContracts(k ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el centro económico");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const openEdit = (account: any) => {
    setEditing(account);
    setPreview(null);
    setMessage(null);
    setForm({
      authorizedTotal: Number(account.authorizedTotal) || 0,
      promo: Number(account.promoAuthorized) || 0,
      credit: Number(account.creditAuthorized) || 0,
      provisioned: Number(account.provisioned) || 0,
      status: account.status || "ACTIVE",
      notes: account.notes || "",
    });
  };

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setMessage(null);
    try {
      await godMutation("god.updateCapacityAccount", {
        affiliateId: editing.affiliateId,
        authorizedTotal: Number(form.authorizedTotal),
        promoAuthorized: Number(form.promo),
        creditAuthorized: Number(form.credit),
        provisioned: Number(form.provisioned),
        status: form.status,
        notes: form.notes || undefined,
      });
      setMessage("Capacidad actualizada y registrada en el historial.");
      setEditing(null);
      await loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };

  const previewPurge = async (account: any) => {
    setBusy(true);
    setMessage(null);
    try {
      const p = await godQuery("god.previewSandboxPurge", { affiliateId: account.affiliateId });
      setPreview({ account, ...p });
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo previsualizar la purga");
    } finally {
      setBusy(false);
    }
  };

  const confirmPurge = async () => {
    if (!preview) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await godMutation("god.purgeSandbox", {
        affiliateId: preview.account.affiliateId,
        confirm: true,
      });
      setMessage(`Purga completada: ${res.usersReset} usuario(s) de prueba a cero.`);
      setPreview(null);
      setEditing(null);
      await loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo purgar");
    } finally {
      setBusy(false);
    }
  };

  const runRecon = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const r = await godMutation("god.runBunzReconciliation");
      setMessage(r.status === "OK" ? "Conciliación OK: sin diferencias." : `Conciliación con ${r.alerts?.length ?? 0} alerta(s).`);
      await loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo conciliar");
    } finally {
      setBusy(false);
    }
  };

  const resetPause = async () => {
    setBusy(true);
    setMessage(null);
    try {
      await godMutation("god.resetBunzPause", { note: "Liberado desde Centro económico" });
      setMessage("Pausa liberada.");
      await loadAll();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo liberar");
    } finally {
      setBusy(false);
    }
  };

  const healthy = ledger?.status === "HEALTHY";
  const paused =
    recon?.control?.emissionPaused ||
    recon?.control?.redemptionPaused ||
    recon?.control?.settlementPaused;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-linear-to-tr from-amber-500/20 to-pink-500/20 border border-amber-500/30">
            <Coins className="h-6 w-6 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Centro económico</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-violet-500/15 text-violet-200 border-violet-500/30">
                GOD
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Capacidad, conciliación, contratos e historial en un solo lugar. No aprueba nada por sí solo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void loadAll()} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Link href="/god/ruta">
            <Button variant="secondary">
              <ShieldCheck className="h-4 w-4" />
              <span className="ml-2 text-xs font-bold">Ruta</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold transition-all",
                tab === t.id
                  ? "bg-white/10 border-white/25 text-white"
                  : "bg-white/[0.03] border-white/10 text-gray-400 hover:text-white"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <Card className="p-4 bg-red-500/10 border-red-500/30 text-sm text-red-200">{error}</Card>
      )}
      {message && (
        <Card className="p-4 bg-sky-500/10 border-sky-500/30 text-sm text-sky-100">{message}</Card>
      )}

      {tab === "resumen" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="p-4 bg-white/5 border-white/10">
              <p className="text-[10px] uppercase font-black tracking-[0.16em] text-gray-500">Ledger</p>
              <p className={cn("text-2xl font-black mt-1", healthy ? "text-emerald-300" : "text-amber-300")}>
                {healthy ? "Saludable" : "Revisar"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {ledger?.discrepancies?.length ?? 0} discrepancia(s)
              </p>
            </Card>
            <Card className="p-4 bg-white/5 border-white/10">
              <p className="text-[10px] uppercase font-black tracking-[0.16em] text-gray-500">Conciliación</p>
              <p className={cn("text-2xl font-black mt-1", paused ? "text-red-300" : "text-emerald-300")}>
                {paused ? "Pausada" : "OK"}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">
                {recon?.lastRun?.status ?? "sin ejecutar"}
              </p>
            </Card>
            <Card className="p-4 bg-white/5 border-white/10">
              <p className="text-[10px] uppercase font-black tracking-[0.16em] text-gray-500">Cuentas de capacidad</p>
              <p className="text-2xl font-black mt-1 text-white">{capacity?.accounts?.length ?? 0}</p>
              <p className="text-[11px] text-gray-400 mt-1">
                {capacity?.accounts?.filter((a) => a.sandbox || a.businessSandbox).length ?? 0} sandbox
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 bg-white/5 border-white/10">
              <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-400" /> Accesos rápidos
              </h2>
              <div className="space-y-2 text-xs">
                <Link href="/god/ecosistema" className="flex items-center justify-between text-gray-300 hover:text-white">
                  Métricas del ecosistema <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/god/validacion" className="flex items-center justify-between text-gray-300 hover:text-white">
                  Validación económica <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/god/conciliaciones" className="flex items-center justify-between text-gray-300 hover:text-white">
                  Conciliaciones detalladas <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/god/ruta" className="flex items-center justify-between text-gray-300 hover:text-white">
                  Ruta e historial <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>

            <Card className="p-5 bg-white/5 border-white/10">
              <h2 className="text-sm font-bold text-white mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Regla de oro
              </h2>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                La capacidad se ajusta con motivo, evento y auditoría. Nunca se reduce por debajo de lo
                comprometido con los Rabbitters. Las cuentas sandbox se purgan, no se borran.
              </p>
            </Card>
          </div>
        </div>
      )}

      {tab === "capacidad" && (
        <div className="space-y-4">
          <Card className="p-5 bg-white/5 border-white/10 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-gray-500 uppercase text-[9px] tracking-wider">
                <tr>
                  <th className="text-left py-2">Negocio</th>
                  <th className="text-right py-2">Provisionado</th>
                  <th className="text-right py-2">Autorizado</th>
                  <th className="text-right py-2">Incentivo</th>
                  <th className="text-right py-2">Adelanto</th>
                  <th className="text-right py-2">Pendiente</th>
                  <th className="text-center py-2">Estado</th>
                  <th className="text-right py-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {(capacity?.accounts ?? []).map((a) => (
                  <tr key={a.affiliateId} className="border-t border-white/5">
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-100">{a.name ?? a.affiliateId}</span>
                        {(a.sandbox || a.businessSandbox) && (
                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            Prueba
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 font-mono">{a.affiliateId.slice(0, 8)}…</p>
                    </td>
                    <td className="py-2 text-right text-gray-200">{fmt(a.provisioned)}</td>
                    <td className="py-2 text-right text-gray-200">{fmt(a.authorizedTotal)}</td>
                    <td className="py-2 text-right text-gray-400">{fmt(a.promoAuthorized)}</td>
                    <td className="py-2 text-right text-gray-400">{fmt(a.creditAuthorized)}</td>
                    <td className="py-2 text-right text-amber-300">{fmt(a.creditOutstanding)}</td>
                    <td className="py-2 text-center">
                      <span className="text-[10px] font-bold uppercase text-gray-300">{a.status}</span>
                    </td>
                    <td className="py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" onClick={() => openEdit(a)}>
                          Ajustar
                        </Button>
                        {(a.sandbox || a.businessSandbox) && (
                          <Button variant="ghost" onClick={() => void previewPurge(a)} title="Purgar prueba">
                            <Trash2 className="h-4 w-4 text-red-400" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!capacity?.accounts?.length && (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-gray-500">
                      Sin cuentas de capacidad registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>

          {editing && (
            <Card className="p-5 bg-white/5 border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white">Ajustar {editing.name ?? editing.affiliateId}</h2>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cerrar</Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <label className="text-[11px] text-gray-400">
                  Autorizado
                  <input type="number" value={form.authorizedTotal} onChange={(e) => setForm({ ...form, authorizedTotal: Number(e.target.value) })} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </label>
                <label className="text-[11px] text-gray-400">
                  Incentivo
                  <input type="number" value={form.promo} onChange={(e) => setForm({ ...form, promo: Number(e.target.value) })} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </label>
                <label className="text-[11px] text-gray-400">
                  Adelanto
                  <input type="number" value={form.credit} onChange={(e) => setForm({ ...form, credit: Number(e.target.value) })} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </label>
                <label className="text-[11px] text-gray-400">
                  Provisionado
                  <input type="number" value={form.provisioned} onChange={(e) => setForm({ ...form, provisioned: Number(e.target.value) })} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" />
                </label>
                <label className="text-[11px] text-gray-400">
                  Estado
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white">
                    {["PROPOSED", "AUTHORIZED", "ACTIVE", "SUSPENDED", "CLOSED"].map((s) => (
                      <option key={s} value={s} className="bg-neutral-900">{s}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[11px] text-gray-400 col-span-2 md:col-span-3">
                  Nota / motivo
                  <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="mt-1 w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-white" placeholder="Motivo del ajuste" />
                </label>
              </div>
              <p className="text-[10px] text-gray-500">
                Incentivo + adelanto debe sumar el autorizado. Lo provisionado no puede exceder lo autorizado ni quedar por debajo de lo comprometido.
              </p>
              <Button variant="primary" onClick={() => void save()} disabled={busy}>
                {busy ? "Guardando…" : "Guardar ajuste"}
              </Button>
            </Card>
          )}

          {preview && (
            <Card className="p-5 bg-red-500/5 border-red-500/30 space-y-2">
              <h2 className="text-sm font-bold text-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Purgar cuenta de prueba: {preview.business?.name}
              </h2>
              <p className="text-xs text-gray-300">
                Se pondrán en 0 la capacidad del negocio, la cuenta MCCE y los saldos de {preview.count} usuario(s) de prueba.
                No se borran movimientos: se registra un evento de purga.
              </p>
              <div className="text-[11px] text-gray-400">
                Usuarios: {preview.count} · Ganado: {fmt(preview.totalEarned)} · Gastado: {fmt(preview.totalSpent)}
              </div>
              <div className="flex gap-2">
                <Button variant="danger" onClick={() => void confirmPurge()} disabled={busy}>
                  {busy ? "Purgando…" : "Confirmar purga"}
                </Button>
                <Button variant="ghost" onClick={() => setPreview(null)}>Cancelar</Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "conciliacion" && (
        <div className="space-y-4">
          <Card className="p-5 bg-white/5 border-white/10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald-400" /> Conciliación
              </h2>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => void runRecon()} disabled={busy}>
                  Ejecutar
                </Button>
                <Button variant="ghost" onClick={() => void resetPause()} disabled={busy || !paused}>
                  <Unlock className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-[10px] font-bold uppercase">
              <span className={cn("px-2 py-0.5 rounded-full border", recon?.lastRun?.status === "OK" ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-amber-500/15 text-amber-300 border-amber-500/30")}>
                Última: {recon?.lastRun?.status ?? "sin ejecutar"}
              </span>
              {[
                ["Emisión", recon?.control?.emissionPaused],
                ["Redención", recon?.control?.redemptionPaused],
                ["Liquidación", recon?.control?.settlementPaused],
              ].map(([label, p]) => (
                <span key={String(label)} className={cn("px-2 py-0.5 rounded-full border", p ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30")}>
                  {label}: {p ? "pausado" : "ok"}
                </span>
              ))}
            </div>
            {recon?.control?.reason && <p className="text-[11px] text-amber-300/90">Motivo: {recon.control.reason}</p>}
            {recon?.lastRun?.alerts?.length ? (
              <div className="space-y-1">
                {recon.lastRun.alerts.map((a: any) => (
                  <p key={a.code} className="text-[11px] text-red-200">
                    <span className="font-mono">{a.code}</span> · {a.detail}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">Sin diferencias en libro, obligaciones ni órdenes.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "contratos" && (
        <Card className="p-5 bg-white/5 border-white/10 overflow-x-auto">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-violet-300" /> Aceptaciones de contrato
          </h2>
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase text-[9px] tracking-wider">
              <tr>
                <th className="text-left py-2">Negocio</th>
                <th className="text-left py-2">Versión</th>
                <th className="text-left py-2">Firmante</th>
                <th className="text-left py-2">Método</th>
                <th className="text-left py-2">Hash</th>
                <th className="text-right py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-t border-white/5">
                  <td className="py-2 text-gray-100">
                    {c.businessName ?? c.businessId}
                    {c.sandbox && <span className="ml-2 text-[9px] text-amber-400 font-black">PRUEBA</span>}
                  </td>
                  <td className="py-2 text-gray-400 font-mono text-[10px]">{c.details?.contractVersion ?? "—"}</td>
                  <td className="py-2 text-gray-300">{c.details?.signedBy ?? "—"}</td>
                  <td className="py-2 text-gray-400">{c.details?.signatureMethod ?? "—"}</td>
                  <td className="py-2 text-gray-500 font-mono text-[10px]">
                    {String(c.details?.contractHash ?? "").slice(0, 12)}…
                  </td>
                  <td className="py-2 text-right text-gray-400">
                    {c.createdAt ? new Date(c.createdAt).toISOString().slice(0, 10) : "—"}
                  </td>
                </tr>
              ))}
              {!contracts.length && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">Sin contratos registrados.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "historial" && (
        <Card className="p-5 bg-white/5 border-white/10 overflow-x-auto">
          <h2 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-sky-400" /> Eventos de capacidad
          </h2>
          <table className="w-full text-xs">
            <thead className="text-gray-500 uppercase text-[9px] tracking-wider">
              <tr>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Afiliado</th>
                <th className="text-right py-2">Importe</th>
                <th className="text-left py-2">Actor</th>
                <th className="text-right py-2">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {(capacity?.events ?? []).map((e) => (
                <tr key={e.id} className="border-t border-white/5">
                  <td className="py-2 text-gray-200 font-mono text-[10px]">{e.type}</td>
                  <td className="py-2 text-gray-400 font-mono text-[10px]">{String(e.affiliateId).slice(0, 8)}…</td>
                  <td className="py-2 text-right text-gray-300">{fmt(e.amount)}</td>
                  <td className="py-2 text-gray-400">{e.actor}</td>
                  <td className="py-2 text-right text-gray-400">
                    {e.createdAt ? new Date(e.createdAt).toISOString().slice(0, 19).replace("T", " ") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
