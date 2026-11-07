"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Copy,
  Download,
  FileSearch,
  GitCompare,
  ListChecks,
  Loader2,
  Lock,
  Play,
  RefreshCw,
  Scale,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Card, Button, cn } from "@rabbitty/ui";

/**
 * Panel de Validación (READ-ONLY).
 *
 * Muestra snapshots generados por `scripts/validation-snapshot.mjs`.
 * No escribe, no calcula economía y no toma decisiones: solo presenta el parte
 * que produce el pipeline, con sus hashes y sus huecos declarados.
 */

interface Summary {
  id: string;
  export_id: string;
  generated_at: string | null;
  dataset_kind: string;
  dataset_hash: string | null;
  status: { valid: boolean; calibration_ready: boolean; audit_verdict: string; next_step: string } | null;
  active_affiliates: number | null;
  datasets_missing: string[];
  rules_not_checked: string[];
}

interface Snapshot {
  export_id?: string;
  generated_at?: string;
  source_commit?: string | null;
  dataset_kind?: string;
  dataset_hash?: string;
  status?: { valid?: boolean; calibration_ready?: boolean; audit_verdict?: string; next_step?: string };
  counts?: Record<string, number>;
  coverage?: {
    active_affiliates?: number;
    inactive_affiliates?: number;
    cells?: Array<{ cell: string; affiliates: number }>;
    insufficient_cells?: Array<{ cell: string; affiliates: number }>;
    sample_top3_sales_share?: number;
    limitations?: string[];
  };
  pilot?: { datasets_present?: string[]; datasets_missing?: string[]; rules_not_checked?: string[]; note?: string } | null;
  metrics?: Record<string, number | null>;
  rules?: { errors?: unknown[]; warnings?: unknown[]; not_checked?: string[] };
  backtest?: {
    skipped?: boolean;
    reason?: string;
    verdict?: string;
    in_sample?: boolean;
    failed_checks?: string[];
    series?: Record<string, { mape: number | null; mae: number | null; bias: number | null }>;
    calibration?: { cut?: string; export_hash?: string };
    evaluation?: { cut?: string; export_hash?: string };
  };
  audit?: { verdict?: string; manifest_hash?: string; determinism?: boolean; leakage_mitigated?: boolean; findings?: Array<{ code: string; severity: string; msg: string }> };
  decisions?: Array<{ id: string; label: string; status: string; owner?: string }>;
  roadmap?: Array<{ id: string; label: string; status: string }>;
  checklist?: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  alerts?: Array<{ code: string; severity: string; message: string }>;
  artifacts?: Record<string, string | null>;
}

const pct = (x: number | null | undefined) => (typeof x === "number" ? `${(x * 100).toFixed(1)}%` : "n/d");
const num = (x: number | null | undefined) =>
  typeof x === "number" ? Math.round(x).toLocaleString("en-US") : "n/d";

function Badge({ tone, children }: { tone: "ok" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  const tones = {
    ok: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    warn: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    bad: "bg-red-500/15 text-red-300 border-red-500/30",
    info: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border", tones[tone])}>
      {children}
    </span>
  );
}

function Row({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "warn" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <span className="text-xs text-gray-400">{label}</span>
      <span
        className={cn(
          "text-xs font-semibold text-right",
          tone === "bad" ? "text-red-300" : tone === "warn" ? "text-amber-300" : tone === "ok" ? "text-emerald-300" : "text-white"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function GodValidationPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [list, setList] = useState<Summary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [dir, setDir] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captureLines, setCaptureLines] = useState<string[]>([]);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [compare, setCompare] = useState<Snapshot | null>(null);
  const [comparing, setComparing] = useState(false);

  const fetchList = useCallback(async () => {
    const res = await fetch(
      "/api/trpc/god.getValidationSnapshots?batch=1&input=" + encodeURIComponent(JSON.stringify({ "0": { json: null } }))
    ).then((r) => r.json());
    const data = res?.[0]?.result?.data?.json;
    if (!data) throw new Error("respuesta inválida del servidor");
    setEnabled(Boolean(data.enabled));
    setList(data.snapshots ?? []);
    setDir(data.dir ?? null);
    if (!selected && data.snapshots?.length) setSelected(data.snapshots[0].id);
    return data as { enabled: boolean; snapshots: Summary[] };
  }, [selected]);

  const fetchSnapshot = useCallback(async (id: string) => {
    const input = { "0": { json: { id } } };
    const res = await fetch(
      "/api/trpc/god.getValidationSnapshot?batch=1&input=" + encodeURIComponent(JSON.stringify(input))
    ).then((r) => r.json());
    return (res?.[0]?.result?.data?.json?.snapshot ?? null) as Snapshot | null;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchList();
      if (data.enabled) {
        const id = selected ?? data.snapshots?.[0]?.id;
        if (id) setSnapshot(await fetchSnapshot(id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "no se pudo cargar");
    } finally {
      setLoading(false);
    }
  }, [fetchList, fetchSnapshot, selected]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelect = async (id: string) => {
    setSelected(id);
    setSnapshot(await fetchSnapshot(id));
  };

  /**
   * Ejecuta la captura ahora (misma ruta que el cron, autenticada con la sesión
   * God + 2FA). Solo hace SELECT en la base y escribe un snapshot JSON.
   */
  const runCapture = async () => {
    setCapturing(true);
    setCaptureError(null);
    setCaptureLines([]);
    try {
      const res = await fetch("/api/trpc/god.runValidationCapture?batch=1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ "0": { json: null } }),
      });
      const payload = await res.json();
      const data = payload?.[0]?.result?.data?.json;
      if (!res.ok || !data?.ok) {
        throw new Error(payload?.[0]?.error?.json?.message ?? "la captura falló");
      }
      setCaptureLines(Array.isArray(data.output) ? data.output : []);
      const fresh = await fetchList();
      const id = data.label ?? fresh.snapshots?.[0]?.id;
      if (id) {
        setSelected(id);
        setSnapshot(await fetchSnapshot(id));
      }
    } catch (e) {
      setCaptureError(e instanceof Error ? e.message : "la captura falló");
    } finally {
      setCapturing(false);
    }
  };

  const prevSummary = useMemo(() => {
    const idx = list.findIndex((s) => s.id === selected);
    return idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  }, [list, selected]);

  /** Compara la captura seleccionada con la anterior (solo lectura). */
  const toggleCompare = async () => {
    if (compare) {
      setCompare(null);
      return;
    }
    if (!prevSummary) return;
    setComparing(true);
    try {
      setCompare(await fetchSnapshot(prevSummary.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "no se pudo cargar la captura anterior");
    } finally {
      setComparing(false);
    }
  };

  const copyReport = async () => {
    if (!snapshot) return;
    const st = snapshot.status ?? {};
    const missing = snapshot.pilot?.datasets_missing ?? [];
    const lines = [
      `Semana: ${snapshot.generated_at?.slice(0, 10) ?? "n/d"} · export ${snapshot.export_id ?? "n/d"}`,
      `Válido: ${st.valid ? "SÍ" : "NO"} · Calibrable: ${st.calibration_ready ? "SÍ" : "NO"}`,
      `Datasets: ${snapshot.pilot ? `${snapshot.pilot.datasets_present?.length ?? 0}/10` : "completo"}${missing.length ? ` · faltan: ${missing.join(", ")}` : ""}`,
      `Errores: ${snapshot.rules?.errors?.length ?? 0} · Avisos: ${snapshot.rules?.warnings?.length ?? 0} · Reglas no evaluables: ${snapshot.pilot?.rules_not_checked?.length ?? 0}`,
      `Siguiente paso: ${st.next_step ?? "n/d"}`,
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError("no se pudo copiar al portapapeles");
    }
  };

  const download = () => {
    if (!snapshot) return;
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `validacion-${snapshot.export_id ?? "snapshot"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const status = snapshot?.status ?? null;
  const metrics = snapshot?.metrics ?? {};
  const backtest = snapshot?.backtest ?? null;
  const decisions = useMemo(() => snapshot?.decisions ?? [], [snapshot]);

  if (enabled === false) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <Card className="p-6 bg-white/5 border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <Lock className="h-5 w-5 text-amber-400" />
            <h1 className="text-lg font-bold text-white">Panel de validación deshabilitado</h1>
          </div>
          <p className="text-sm text-gray-400">
            Actívalo con <code className="text-amber-300">GOD_VALIDATION_PANEL=true</code> y coloca los snapshots en{" "}
            <code className="text-amber-300">documents/validation/</code>.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            El panel es read-only: no escribe, no migra y no calcula economía.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-linear-to-tr from-emerald-500/20 to-sky-500/20 border border-emerald-500/30">
            <FileSearch className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-white tracking-tight">Validación económica</h1>
              <Badge tone="info">solo lectura</Badge>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Parte semanal del pipeline: cobertura, huecos, reglas, backtest y compuertas. No aprueba nada.
              La captura solo hace SELECT y escribe el snapshot; no toca economía.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {list.length > 1 && (
            <select
              value={selected ?? ""}
              onChange={(e) => void onSelect(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white"
            >
              {list.map((s) => (
                <option key={s.id} value={s.id} className="bg-neutral-900">
                  {s.generated_at?.slice(0, 10) ?? s.id} · {s.dataset_kind}
                </option>
              ))}
            </select>
          )}
          <Button
            variant="primary"
            onClick={() => void runCapture()}
            disabled={capturing || loading}
            title="Ejecutar la captura semanal ahora (solo SELECT)"
          >
            {capturing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            <span className="ml-2 text-xs font-bold">
              {capturing ? "Capturando…" : "Ejecutar captura"}
            </span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => void toggleCompare()}
            disabled={!prevSummary || comparing}
            title={prevSummary ? `Comparar con ${prevSummary.id}` : "No hay captura anterior"}
          >
            {comparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" onClick={() => void load()} disabled={loading || capturing}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
          <Button variant="ghost" onClick={copyReport} disabled={!snapshot} title="Copiar reporte de 5 líneas">
            {copied ? <ClipboardCheck className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" onClick={download} disabled={!snapshot} title="Descargar snapshot JSON">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 bg-red-500/10 border-red-500/30 text-sm text-red-200">
          {error}
        </Card>
      )}

      {captureError && (
        <Card className="p-4 bg-red-500/10 border-red-500/30 text-sm text-red-200">
          <div className="font-semibold mb-1">La captura falló</div>
          <p className="text-xs text-red-300/90">{captureError}</p>
        </Card>
      )}

      {captureLines.length > 0 && (
        <Card className="p-4 bg-emerald-500/10 border-emerald-500/30">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-200">Captura ejecutada</span>
          </div>
          <pre className="text-[11px] leading-relaxed text-emerald-100/90 whitespace-pre-wrap m-0">
            {captureLines.join("\n")}
          </pre>
        </Card>
      )}

      {compare && snapshot && (
        <Card className="p-5 bg-white/5 border-white/10 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-sky-400" /> Comparación con {compare.export_id ?? "anterior"}
            </h2>
            <Button variant="ghost" onClick={() => setCompare(null)} title="Cerrar comparación">
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1">
            {[...new Set([...Object.keys(snapshot.counts ?? {}), ...Object.keys(compare.counts ?? {})])]
              .sort()
              .map((key) => {
                const now = snapshot.counts?.[key];
                const before = compare.counts?.[key];
                const delta = typeof now === "number" && typeof before === "number" ? now - before : null;
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5">
                    <span className="text-xs text-gray-400">{key}</span>
                    <span className="text-xs font-mono text-gray-200">
                      {num(now)} <span className="text-gray-500">← {num(before)}</span>{" "}
                      {delta !== null && delta !== 0 && (
                        <span className={delta > 0 ? "text-emerald-300" : "text-amber-300"}>
                          ({delta > 0 ? "+" : ""}
                          {delta})
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
          <p className="text-[11px] text-gray-500">
            Comparación de conteos entre capturas. No interpreta la economía ni aprueba nada.
          </p>
        </Card>
      )}

      {!snapshot && !loading && !error && (
        <Card className="p-6 bg-white/5 border-white/10">
          <div className="flex items-center gap-2 text-amber-300 mb-2">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-semibold">No hay snapshots en {dir ?? "documents/validation"}</span>
          </div>
          <p className="text-xs text-gray-400">
            Genera el primero con:
            <code className="block mt-2 text-amber-300">
              node scripts/validation-snapshot.mjs dataset.json --out documents/validation/AAAA-MM-DD.json
            </code>
          </p>
        </Card>
      )}

      {snapshot && (
        <>
          {(snapshot.alerts ?? []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(snapshot.alerts ?? []).map((a) => (
                <span
                  key={a.code}
                  className={cn(
                    "text-[11px] px-2 py-1 rounded-lg border",
                    a.severity === "alto"
                      ? "bg-red-500/10 border-red-500/30 text-red-200"
                      : a.severity === "medio"
                        ? "bg-amber-500/10 border-amber-500/30 text-amber-200"
                        : "bg-sky-500/10 border-sky-500/30 text-sky-200"
                  )}
                >
                  <b>{a.code}</b> {a.message}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
            <span className="text-white font-semibold">{snapshot.export_id}</span>
            <span>{snapshot.generated_at?.slice(0, 19).replace("T", " ")}</span>
            <Badge tone={snapshot.dataset_kind === "pilot" ? "warn" : "info"}>{snapshot.dataset_kind}</Badge>
            {snapshot.source_commit && <span>commit {snapshot.source_commit.slice(0, 8)}</span>}
            {snapshot.dataset_hash && <span className="font-mono">{snapshot.dataset_hash.slice(0, 16)}…</span>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* 1 · Estado */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Estado
                </h2>
                {status?.valid ? <Badge tone="ok">válido</Badge> : <Badge tone="bad">inválido</Badge>}
              </div>
              <Row
                label="Calibrable"
                value={status?.calibration_ready ? "sí" : "no"}
                tone={status?.calibration_ready ? "ok" : "warn"}
              />
              <Row label="Auditoría" value={status?.audit_verdict ?? "n/d"} />
              <div className="pt-2">
                <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Siguiente paso</p>
                <p className="text-xs text-white">{status?.next_step ?? "n/d"}</p>
              </div>
            </Card>

            {/* 1b · Checklist del viernes */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-emerald-300" /> Checklist del viernes
              </h2>
              {(snapshot.checklist ?? []).map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 py-1 border-b border-white/5 last:border-0">
                  <span className="text-[11px] text-gray-300 leading-tight">
                    {c.ok ? (
                      <CheckCircle2 className="inline h-3.5 w-3.5 text-emerald-400 mr-1" />
                    ) : (
                      <XCircle className="inline h-3.5 w-3.5 text-red-400 mr-1" />
                    )}
                    {c.label}
                  </span>
                  <span className={cn("text-[10px] uppercase whitespace-nowrap", c.ok ? "text-emerald-300" : "text-red-300")}>
                    {c.detail}
                  </span>
                </div>
              ))}
            </Card>

            {/* 2 · Cobertura */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-sky-400" /> Cobertura
              </h2>
              <Row label="Afiliados activos" value={num(snapshot.coverage?.active_affiliates)} />
              <Row label="Inactivos" value={num(snapshot.coverage?.inactive_affiliates)} />
              <Row
                label="Top-3 ventas"
                value={pct(snapshot.coverage?.sample_top3_sales_share)}
                tone={(snapshot.coverage?.sample_top3_sales_share ?? 0) > 0.6 ? "warn" : undefined}
              />
              <Row
                label="Celdas insuficientes"
                value={snapshot.coverage?.insufficient_cells?.length ?? 0}
                tone={(snapshot.coverage?.insufficient_cells?.length ?? 0) > 0 ? "warn" : "ok"}
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {(snapshot.coverage?.cells ?? []).map((c) => (
                  <span key={c.cell} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-300">
                    {c.cell}: {c.affiliates}
                  </span>
                ))}
              </div>
            </Card>

            {/* 3 · Huecos */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-400" /> Huecos declarados
              </h2>
              {snapshot.pilot ? (
                <>
                  <Row
                    label="Datasets"
                    value={`${snapshot.pilot.datasets_present?.length ?? 0}/10`}
                    tone={(snapshot.pilot.datasets_missing?.length ?? 0) > 0 ? "warn" : "ok"}
                  />
                  <div className="pt-1">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Faltan</p>
                    <div className="flex flex-wrap gap-1">
                      {(snapshot.pilot.datasets_missing ?? []).map((d) => (
                        <span key={d} className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/20">
                          {d}
                        </span>
                      ))}
                      {!snapshot.pilot.datasets_missing?.length && (
                        <span className="text-xs text-emerald-300">ninguno</span>
                      )}
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Reglas no evaluables</p>
                    <p className="text-xs text-gray-300">
                      {(snapshot.pilot.rules_not_checked ?? []).join(", ") || "ninguna"}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">Export completo: sin huecos de dataset declarados.</p>
              )}
            </Card>

            {/* 4 · Métricas */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-300" /> Métricas reconstruidas
              </h2>
              <Row label="Emitido" value={`${num(metrics.emitted_bunz)} Bunz`} />
              <Row label="Redimido" value={`${num(metrics.redeemed_bunz)} Bunz`} />
              <Row
                label="No atendido económico"
                value={`${num(metrics.unmet_economic_bunz)} Bunz`}
                tone={(metrics.unmet_economic_bunz ?? 0) > 0 ? "warn" : undefined}
              />
              <Row label="No atendido operativo" value={`${num(metrics.unmet_operational_bunz)} Bunz`} />
              <Row label="Motivo desconocido" value={`${num(metrics.unmet_unknown_bunz)} Bunz`} />
              <Row label="Fiat cobrado (conciliado)" value={`${num(metrics.fiat_collected_mxn)} MXN`} />
              <Row label="CE (ratio)" value={metrics.ce === null || metrics.ce === undefined ? "n/d" : Number(metrics.ce).toFixed(3)} />
            </Card>

            {/* 5 · Reglas */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-violet-400" /> Reglas
              </h2>
              <Row
                label="Errores"
                value={snapshot.rules?.errors?.length ?? 0}
                tone={(snapshot.rules?.errors?.length ?? 0) > 0 ? "bad" : "ok"}
              />
              <Row
                label="Avisos"
                value={snapshot.rules?.warnings?.length ?? 0}
                tone={(snapshot.rules?.warnings?.length ?? 0) > 0 ? "warn" : "ok"}
              />
              <Row label="No comprobadas" value={snapshot.rules?.not_checked?.length ?? 0} />
              <div className="space-y-1 pt-1">
                {[...(snapshot.rules?.errors ?? []), ...(snapshot.rules?.warnings ?? [])].slice(0, 3).map((x, i) => {
                  const item = x as { code?: string; msg?: string };
                  return (
                    <p key={i} className="text-[11px] text-gray-400">
                      <span className="text-gray-500">{item.code}</span> {item.msg}
                    </p>
                  );
                })}
              </div>
            </Card>

            {/* 6 · Auditoría */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Scale className="h-4 w-4 text-emerald-300" /> Reproducibilidad
              </h2>
              <Row label="Veredicto" value={snapshot.audit?.verdict ?? "n/d"} />
              <Row
                label="Determinismo"
                value={snapshot.audit?.determinism ? "OK" : "FALLA"}
                tone={snapshot.audit?.determinism ? "ok" : "bad"}
              />
              <Row label="LKG-01" value={snapshot.audit?.leakage_mitigated ? "mitigado" : "alto"} tone={snapshot.audit?.leakage_mitigated ? "ok" : "bad"} />
              <Row label="Manifest" value={<span className="font-mono">{snapshot.audit?.manifest_hash?.slice(0, 12) ?? "n/d"}…</span>} />
              <div className="space-y-1 pt-1">
                {(snapshot.audit?.findings ?? []).slice(0, 3).map((f) => (
                  <p key={f.code + f.msg} className="text-[11px] text-gray-400">
                    <span className={f.severity === "alto" ? "text-red-300" : f.severity === "medio" ? "text-amber-300" : "text-gray-500"}>
                      [{f.severity}]
                    </span>{" "}
                    {f.code}: {f.msg}
                  </p>
                ))}
              </div>
            </Card>

            {/* 7 · Backtest */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2 lg:col-span-2 xl:col-span-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="h-4 w-4 text-pink-400" /> Backtest
              </h2>
              {backtest && "skipped" in backtest && backtest.skipped ? (
                <p className="text-xs text-gray-400">
                  No ejecutado: {backtest.reason}. Un piloto no calibra.
                </p>
              ) : backtest ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={backtest.verdict === "ajuste-aceptable" ? "ok" : "warn"}>{backtest.verdict}</Badge>
                    <span className="text-[11px] text-gray-400">
                      {backtest.in_sample ? "en muestra (cota optimista)" : "fuera de muestra"}
                    </span>
                    {backtest.calibration?.cut && (
                      <span className="text-[11px] text-gray-500">
                        calibración hasta {backtest.calibration.cut} · evaluación hasta {backtest.evaluation?.cut}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                    {Object.entries(backtest.series ?? {}).map(([name, s]) => (
                      <div key={name} className="p-2 rounded-lg bg-black/20 border border-white/5">
                        <p className="text-[10px] uppercase text-gray-500">{name}</p>
                        <p className="text-xs text-white font-semibold">MAPE {pct(s.mape)}</p>
                        <p className="text-[10px] text-gray-400">MAE {num(s.mae)} · sesgo {num(s.bias)}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-400">Sin datos de backtest.</p>
              )}
            </Card>

            {/* 8 · Compuertas */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="h-4 w-4 text-amber-400" /> Compuertas (RP-2)
              </h2>
              <div className="space-y-1">
                {decisions.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 py-1 border-b border-white/5 last:border-0">
                    <span className="text-[11px] text-gray-300">
                      <span className="text-gray-500">{d.id}</span> {d.label}
                    </span>
                    <span className="flex items-center gap-1">
                      {d.status === "hecho" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : d.status === "en-curso" ? (
                        <Activity className="h-3.5 w-3.5 text-amber-400" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                      )}
                      <span className="text-[10px] uppercase text-gray-500">{d.status}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 9 · Plan */}
            <Card className="p-5 bg-white/5 border-white/10 space-y-2 lg:col-span-2 xl:col-span-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-sky-300" /> Plan (OT)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {(snapshot.roadmap ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/20 border border-white/5">
                    <span className="text-[11px] text-gray-300">
                      <span className="text-gray-500">{r.id}</span> {r.label}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border whitespace-nowrap",
                        r.status === "hecho"
                          ? "text-emerald-300 border-emerald-500/30 bg-emerald-500/10"
                          : "text-amber-300 border-amber-500/30 bg-amber-500/10"
                      )}
                    >
                      {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <p className="text-[11px] text-gray-500">
            Este panel no aprueba la economía ni desbloquea RP-2. Los hashes identifican el export; si falta un
            dato se muestra «n/d», nunca un cero que parezca real.
          </p>
        </>
      )}
    </div>
  );
}
