"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  ClipboardCheck,
  Clock,
  Copy,
  FileSearch,
  Flag,
  History,
  ListChecks,
  Lock,
  RefreshCw,
  Route,
  ShieldCheck,
  Unlock,
  Zap,
} from "lucide-react";
import { Card, Button, cn } from "@rabbitty/ui";
import {
  FLAGS,
  GATES,
  HISTORY,
  NEXT_ACTIONS,
  PHASES,
  ROADMAP_VERSION,
  type RoadmapStatus,
} from "@/lib/god-roadmap";

/**
 * Hoja de ruta + historial de la economía Bunny.
 *
 * Solo accesible en /god/* (allowlist + 2FA + no impersonación).
 * Contenido estático versionado en `lib/god-roadmap.ts`; no toca DB ni economía.
 */

interface PilotRow {
  affiliateId: string;
  pilotEnabled: boolean;
  periodDays: number;
  maxEmissionBunz: number;
  maxRedemptionBunz: number;
  maxSettlementBunz: number;
  notes?: string | null;
}

interface PilotControls {
  pilotMode: boolean;
  emissionEnabled: boolean;
  redemptionEnabled: boolean;
  rows: PilotRow[];
}

interface ReconAlert {
  code: string;
  severity: string;
  count: number;
  detail: string;
}

interface ReconRun {
  id: string;
  startedAt: string;
  finishedAt?: string | null;
  status: string;
  checks?: Record<string, number>;
  alerts?: ReconAlert[];
}

interface ReconControl {
  emissionPaused: boolean;
  redemptionPaused: boolean;
  settlementPaused: boolean;
  reason: string | null;
  updatedAt: string;
}

const statusTone: Record<RoadmapStatus, string> = {
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  active: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  pending: "bg-white/5 text-gray-300 border-white/15",
  blocked: "bg-red-500/15 text-red-300 border-red-500/30",
};

const statusLabel: Record<RoadmapStatus, string> = {
  done: "hecho",
  active: "en curso",
  pending: "pendiente",
  blocked: "bloqueado",
};

function StatusPill({ status }: { status: RoadmapStatus }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border whitespace-nowrap",
        statusTone[status]
      )}
    >
      {statusLabel[status]}
    </span>
  );
}

function ItemIcon({ status }: { status: RoadmapStatus }) {
  if (status === "done") return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "active") return <Clock className="h-4 w-4 text-sky-400 shrink-0" />;
  if (status === "blocked") return <Lock className="h-4 w-4 text-red-400 shrink-0" />;
  return <Circle className="h-4 w-4 text-gray-500 shrink-0" />;
}

export default function GodRoadmapPage() {
  const [copied, setCopied] = useState(false);
  const [controls, setControls] = useState<PilotControls | null>(null);
  const [recon, setRecon] = useState<{ lastRun: ReconRun | null; control: ReconControl | null } | null>(null);
  const [reconBusy, setReconBusy] = useState(false);
  const [reconMsg, setReconMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(
      "/api/trpc/god.listBunzControls?batch=1&input=" +
        encodeURIComponent(JSON.stringify({ "0": { json: null } }))
    )
      .then((r) => r.json())
      .then((payload) => {
        if (alive) setControls(payload?.[0]?.result?.data?.json ?? null);
      })
      .catch(() => {
        /* el panel sigue funcionando sin datos en vivo */
      });
    return () => {
      alive = false;
    };
  }, []);

  const fetchRecon = useCallback(async () => {
    try {
      const res = await fetch(
        "/api/trpc/god.getBunzReconciliation?batch=1&input=" +
          encodeURIComponent(JSON.stringify({ "0": { json: null } }))
      );
      const payload = await res.json();
      setRecon(payload?.[0]?.result?.data?.json ?? null);
    } catch {
      /* sin datos de conciliación */
    }
  }, []);

  useEffect(() => {
    void fetchRecon();
  }, [fetchRecon]);

  const runRecon = async () => {
    setReconBusy(true);
    setReconMsg(null);
    try {
      const res = await fetch("/api/trpc/god.runBunzReconciliation?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: null } }),
      });
      const payload = await res.json();
      const data = payload?.[0]?.result?.data?.json;
      if (!res.ok || !data) throw new Error(payload?.[0]?.error?.json?.message ?? "conciliación falló");
      setReconMsg(
        data.status === "OK"
          ? "Conciliación OK: sin diferencias."
          : `Conciliación con ${data.alerts?.length ?? 0} alerta(s): ${(data.alerts ?? [])
              .map((a: ReconAlert) => a.code)
              .join(", ")}`
      );
      await fetchRecon();
    } catch (e) {
      setReconMsg(e instanceof Error ? e.message : "conciliación falló");
    } finally {
      setReconBusy(false);
    }
  };

  const resetPause = async () => {
    setReconBusy(true);
    setReconMsg(null);
    try {
      const res = await fetch("/api/trpc/god.resetBunzPause?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: { note: "Liberado desde /god/ruta" } } }),
      });
      if (!res.ok) throw new Error("no se pudo liberar la pausa");
      setReconMsg("Pausa liberada. Revisa el motivo antes de reanudar operaciones.");
      await fetchRecon();
    } catch (e) {
      setReconMsg(e instanceof Error ? e.message : "no se pudo liberar la pausa");
    } finally {
      setReconBusy(false);
    }
  };

  const summary = useMemo(() => {
    const done = PHASES.filter((p) => p.status === "done").length;
    const active = PHASES.filter((p) => p.status === "active").length;
    const blocked = PHASES.filter((p) => p.status === "blocked").length;
    const pendingGates = GATES.filter((g) => g.status !== "done").length;
    const offFlags = FLAGS.filter((f) => !f.on).length;
    return { done, active, blocked, pendingGates, offFlags };
  }, []);

  const copySummary = async () => {
    const lines = [
      `Ruta economía Bunny · ${ROADMAP_VERSION}`,
      ...PHASES.map((p) => `${p.id} ${p.title}: ${statusLabel[p.status]} (${p.progress}%)`),
      `Compuertas pendientes: ${GATES.filter((g) => g.status !== "done").map((g) => g.id).join(", ") || "ninguna"}`,
      `Flags apagados: ${FLAGS.filter((f) => !f.on).map((f) => f.name).join(", ") || "ninguno"}`,
      "Próximos:",
      ...NEXT_ACTIONS.map((a) => `- ${a.id} ${a.title}: ${a.detail}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard no disponible */
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-linear-to-tr from-violet-500/20 to-sky-500/20 border border-violet-500/30">
            <Route className="h-6 w-6 text-violet-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Ruta de la economía Bunny</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border bg-violet-500/15 text-violet-200 border-violet-500/30">
                solo GOD
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Hoja de ruta, compuertas, flags e historial. Versión {ROADMAP_VERSION}. No aprueba nada.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => void copySummary()} title="Copiar resumen de seguimiento">
            {copied ? <ClipboardCheck className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Link href="/god/validacion">
            <Button variant="secondary">
              <FileSearch className="h-4 w-4" />
              <span className="ml-2 text-xs font-bold">Ver validación</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 bg-white/5 border-white/10">
          <p className="text-[10px] uppercase font-black tracking-[0.16em] text-gray-500">Fases cerradas</p>
          <p className="text-2xl font-black text-emerald-300 mt-1">{summary.done}/{PHASES.length}</p>
        </Card>
        <Card className="p-4 bg-white/5 border-white/10">
          <p className="text-[10px] uppercase font-black tracking-[0.16em] text-gray-500">En curso</p>
          <p className="text-2xl font-black text-sky-300 mt-1">{summary.active}</p>
        </Card>
        <Card className="p-4 bg-white/5 border-white/10">
          <p className="text-[10px] uppercase font-black tracking-[0.16em] text-gray-500">Compuertas abiertas</p>
          <p className="text-2xl font-black text-amber-300 mt-1">{summary.pendingGates}</p>
        </Card>
        <Card className="p-4 bg-white/5 border-white/10">
          <p className="text-[10px] uppercase font-black tracking-[0.16em] text-gray-500">Flags apagados</p>
          <p className="text-2xl font-black text-red-300 mt-1">{summary.offFlags}</p>
        </Card>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-black uppercase tracking-[0.16em] text-gray-400 flex items-center gap-2">
          <Flag className="h-4 w-4 text-violet-300" /> Hoja de ruta
        </h2>

        {PHASES.map((phase) => (
          <Card key={phase.id} className="p-5 bg-white/5 border-white/10 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-black text-gray-300">
                  {phase.id}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">{phase.title}</h3>
                  <p className="text-[11px] text-gray-400">{phase.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 min-w-[180px]">
                <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      phase.status === "blocked"
                        ? "bg-red-500/60"
                        : phase.status === "done"
                          ? "bg-emerald-500/70"
                          : "bg-sky-500/70"
                    )}
                    style={{ width: `${phase.progress}%` }}
                  />
                </div>
                <span className="text-[11px] font-mono text-gray-300">{phase.progress}%</span>
                <StatusPill status={phase.status} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2">
              {phase.items.map((item) => (
                <div key={item.id} className="flex items-start gap-2 py-1.5 border-b border-white/5">
                  <ItemIcon status={item.status} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-100">
                      {item.title} <span className="text-gray-500 font-normal">· {item.id}</span>
                    </p>
                    <p className="text-[11px] text-gray-400 leading-snug">{item.detail}</p>
                    {item.evidence && (
                      <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.evidence}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 bg-white/5 border-white/10 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" /> Compuertas G1–G9
          </h2>
          <div className="space-y-1">
            {GATES.map((g) => (
              <div key={g.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5">
                <div className="min-w-0">
                  <p className="text-xs text-gray-200">
                    <span className="font-mono text-gray-400">{g.id}</span> {g.label}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {g.owner} · {g.type}
                  </p>
                </div>
                <StatusPill status={g.status} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 bg-white/5 border-white/10 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-400" /> Flags económicos
          </h2>
          <div className="space-y-1">
            {FLAGS.map((f) => (
              <div key={f.name} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5">
                <div className="min-w-0">
                  <p className="text-[11px] font-mono text-gray-200 truncate">{f.name}</p>
                  <p className="text-[10px] text-gray-500">{f.what}</p>
                </div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border",
                    f.on
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                      : "bg-red-500/15 text-red-300 border-red-500/30"
                  )}
                >
                  {f.value}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-gray-500">
            Un flag en <span className="text-red-300">false</span> es una puerta cerrada, no un fallo.
          </p>
        </Card>
      </div>

      <Card className="p-5 bg-white/5 border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-400" /> Piloto económico (RP-2B)
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase">
            {[
              ["Piloto", controls?.pilotMode],
              ["Emisión", controls?.emissionEnabled],
              ["Redención", controls?.redemptionEnabled],
            ].map(([label, on]) => (
              <span
                key={String(label)}
                className={cn(
                  "px-2 py-0.5 rounded-full border",
                  on
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : "bg-red-500/15 text-red-300 border-red-500/30"
                )}
              >
                {label}: {on ? "on" : "off"}
              </span>
            ))}
          </div>
        </div>

        {!controls ? (
          <p className="text-[11px] text-gray-500">Cargando estado del piloto…</p>
        ) : controls.rows.length === 0 ? (
          <p className="text-[11px] text-gray-400">
            Sin afiliados en el piloto. Con <code className="text-amber-300">RABBITTY_BUNZ_PILOT=false</code> no hay
            topes; al encenderlo, solo entran los afiliados con <code>pilotEnabled=true</code>.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="text-gray-500 uppercase text-[9px] tracking-wider">
                <tr>
                  <th className="text-left py-1.5">Afiliado</th>
                  <th className="text-right py-1.5">Periodo</th>
                  <th className="text-right py-1.5">Emisión</th>
                  <th className="text-right py-1.5">Redención</th>
                  <th className="text-right py-1.5">Liquidación</th>
                  <th className="text-right py-1.5">Estado</th>
                </tr>
              </thead>
              <tbody>
                {controls.rows.map((r) => (
                  <tr key={r.affiliateId} className="border-t border-white/5 text-gray-300">
                    <td className="py-1.5 font-mono truncate max-w-[180px]">{r.affiliateId}</td>
                    <td className="py-1.5 text-right">{r.periodDays}d</td>
                    <td className="py-1.5 text-right">{r.maxEmissionBunz}</td>
                    <td className="py-1.5 text-right">{r.maxRedemptionBunz}</td>
                    <td className="py-1.5 text-right">{r.maxSettlementBunz}</td>
                    <td className="py-1.5 text-right">
                      <span className={r.pilotEnabled ? "text-emerald-300" : "text-gray-500"}>
                        {r.pilotEnabled ? "en piloto" : "fuera"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[11px] text-gray-500">
          Topes y lista blanca viven en <code className="text-gray-400">bunz_economic_limits</code>. Este panel solo lee.
        </p>
      </Card>

      <Card className="p-5 bg-white/5 border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-emerald-400" /> Conciliación (RP-2B)
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => void runRecon()} disabled={reconBusy}>
              <RefreshCw className={cn("h-4 w-4", reconBusy && "animate-spin")} />
              <span className="ml-2 text-xs font-bold">Ejecutar</span>
            </Button>
            <Button
              variant="ghost"
              onClick={() => void resetPause()}
              disabled={
                reconBusy ||
                !(
                  recon?.control?.emissionPaused ||
                  recon?.control?.redemptionPaused ||
                  recon?.control?.settlementPaused
                )
              }
              title="Liberar pausa de conciliación"
            >
              <Unlock className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {reconMsg && <p className="text-[11px] text-gray-300">{reconMsg}</p>}

        {!recon ? (
          <p className="text-[11px] text-gray-500">Cargando estado de conciliación…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase">
              <span
                className={cn(
                  "px-2 py-0.5 rounded-full border",
                  recon.lastRun?.status === "OK"
                    ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                    : recon.lastRun?.status === "ALERTS"
                      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                      : "bg-red-500/15 text-red-300 border-red-500/30"
                )}
              >
                Última: {recon.lastRun?.status ?? "sin ejecutar"}
              </span>
              {recon.lastRun && (
                <span className="text-gray-500 font-normal normal-case">
                  {recon.lastRun.startedAt?.slice(0, 19).replace("T", " ")}
                </span>
              )}
              {(
                [
                  ["Emisión", recon.control?.emissionPaused],
                  ["Redención", recon.control?.redemptionPaused],
                  ["Liquidación", recon.control?.settlementPaused],
                ] as const
              ).map(([label, paused]) => (
                <span
                  key={label}
                  className={cn(
                    "px-2 py-0.5 rounded-full border",
                    paused
                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                      : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                  )}
                >
                  {label}: {paused ? "pausado" : "ok"}
                </span>
              ))}
            </div>

            {recon.control?.reason && (
              <p className="text-[11px] text-amber-300/90">Motivo de pausa: {recon.control.reason}</p>
            )}

            {recon.lastRun?.alerts && recon.lastRun.alerts.length > 0 ? (
              <div className="space-y-1">
                {recon.lastRun.alerts.map((a) => (
                  <div key={a.code} className="text-[11px] text-red-200">
                    <span className="font-mono text-red-300">{a.code}</span> · {a.detail}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-gray-400">
                Sin diferencias en libro, obligaciones ni órdenes con Bunz.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5 bg-white/5 border-white/10 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-sky-400" /> Próximos movimientos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {NEXT_ACTIONS.map((a, i) => (
            <div key={a.id} className="rounded-xl bg-white/[0.03] border border-white/10 p-3.5 space-y-1">
              <div className="flex items-center gap-2">
                <span className="h-5 w-5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 text-[10px] font-black flex items-center justify-center">
                  {i + 1}
                </span>
                <p className="text-xs font-bold text-white">{a.title}</p>
                <span className="ml-auto text-[10px] text-gray-500">{a.owner}</span>
              </div>
              <p className="text-[11px] text-gray-400 leading-snug">{a.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 bg-white/5 border-white/10 space-y-4">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <History className="h-4 w-4 text-violet-300" /> Historial
        </h2>
        <div className="relative pl-5">
          <div className="absolute left-1.5 top-1 bottom-1 w-px bg-white/10" />
          {HISTORY.map((h) => (
            <div key={`${h.date}-${h.title}`} className="relative pb-4 last:pb-0">
              <span className="absolute -left-[15px] top-1.5 h-2 w-2 rounded-full bg-violet-400/80 ring-4 ring-violet-500/10" />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono text-gray-500">{h.date}</span>
                <p className="text-xs font-bold text-white">{h.title}</p>
                {h.ref && <span className="text-[10px] font-mono text-gray-500">{h.ref}</span>}
              </div>
              <p className="text-[11px] text-gray-400 leading-snug mt-0.5">{h.detail}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2 text-[11px] text-gray-500">
        <span>Contenido versionado en</span>
        <code className="text-gray-400">apps/admin/src/lib/god-roadmap.ts</code>
        <ArrowRight className="h-3 w-3" />
        <Link href="/god" className="text-violet-300 hover:text-violet-200">
          volver al God Shell
        </Link>
      </div>
    </div>
  );
}
