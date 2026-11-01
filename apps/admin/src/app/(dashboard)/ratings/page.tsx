"use client";

/**
 * ── /ratings ── Superficie Affiliate de Rabbitty Score (Fase 1).
 * Muestra: agregado (solo con n≥5), # evaluaciones, comentarios SIN identidad,
 * estado de moderación y cobertura de opiniones (contexto de muestra, NO
 * satisfacción). El comercio puede REPORTAR un comentario (pasa a revisión).
 * La sección de moderación solo funciona para God (proc godAdminProcedure).
 */

import { useState } from "react";
import { Star, MessageSquareText, AlertTriangle, ShieldCheck, RefreshCw } from "lucide-react";
import { Card, Button, Badge, toast, cn } from "@rabbitty/ui";
import { trpc } from "../../../lib/trpc-client";

function StarsRow({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={size}
          className={i <= Math.round(value) ? "text-amber-400 fill-amber-400" : "text-white/20"}
        />
      ))}
    </span>
  );
}

const ATTR_LABEL: Record<string, string> = {
  atencion: "Atención",
  comida: "Comida/Producto",
  tiempo: "Tiempo",
  ambiente: "Ambiente",
};

export default function RatingsPage() {
  const branchesQuery = trpc.admin.getBranches.useQuery(undefined, { retry: false });
  const branches = branchesQuery.data ?? [];
  const [branchId, setBranchId] = useState<string>("");
  const activeBranchId = branchId || branches[0]?.id || "";

  const summary = trpc.ratings.merchantRatingSummary.useQuery(
    { branchId: activeBranchId },
    { enabled: Boolean(activeBranchId), retry: false }
  );

  const report = trpc.ratings.reportRating.useMutation({
    onSuccess: () => { toast.success("Comentario enviado a revisión — quedará fuera del agregado mientras se revisa"); summary.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [reportingId, setReportingId] = useState<string | null>(null);

  // Moderación (solo God — el proc rechaza a no-God con FORBIDDEN)
  const queue = trpc.ratings.moderationQueue.useQuery({ branchId: activeBranchId || undefined }, { retry: false, enabled: Boolean(activeBranchId) });
  const moderate = trpc.ratings.moderateRating.useMutation({
    onSuccess: () => { toast.success("Moderación aplicada"); queue.refetch(); summary.refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [moderating, setModerating] = useState<string | null>(null);
  const [modReason, setModReason] = useState("");

  const data = summary.data;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Star className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reputación de Servicio</h1>
            <p className="text-xs text-white/50">Lo que opinan tus comensales después de pagar — siempre anónimo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {branches.length > 1 && (
            <select
              className="rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none"
              value={activeBranchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((b: { id: string; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <Button variant="secondary" onClick={() => summary.refetch()} className="rounded-xl bg-white/5 border border-white/10 text-xs font-bold">
            <RefreshCw className="h-3.5 w-3.5" /> Refrescar
          </Button>
        </div>
      </header>

      {!activeBranchId && (
        <Card className="p-6 border border-white/10 bg-white/5 text-sm text-white/60">
          Sin sucursales en tu cuenta todavía.
        </Card>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border border-white/10 bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Calificación</p>
              {data.sampleSufficient ? (
                <>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-black text-white">{data.avgStars?.toFixed(1)}</p>
                    <StarsRow value={data.avgStars ?? 0} size={18} />
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">{data.n} evaluaciones verificadas</p>
                </>
              ) : (
                <>
                  <p className="text-lg font-black text-white/70">Aún reuniendo opiniones</p>
                  <p className="text-[11px] text-gray-400 mt-1">Necesitas {Math.max(0, 5 - data.n)} evaluaciones más para mostrar la calificación pública.</p>
                </>
              )}
            </Card>
            <Card className="p-5 border border-white/10 bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">Cobertura de opiniones</p>
              <p className="text-3xl font-black text-white">{data.coverage.pct}%</p>
              <p className="text-[11px] text-gray-400 mt-1">{data.coverage.rated} de {data.coverage.eligible} cuentas evaluadas (90 días)</p>
              <p className="text-[10px] text-gray-500 mt-1 italic">Es contexto de muestra, no un indicador de satisfacción.</p>
            </Card>
            <Card className="p-5 border border-white/10 bg-white/5">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 mb-2">En revisión</p>
              <p className="text-3xl font-black text-white">{data.pendingReview}</p>
              <p className="text-[11px] text-gray-400 mt-1">comentarios reportados por moderar</p>
            </Card>
          </div>

          {/* Comentarios anónimos */}
          <Card className="p-5 border border-white/10 bg-white/5">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquareText className="h-4 w-4 text-cyan-400" />
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Comentarios (sin identidad del comensal)</h2>
            </div>
            {data.comments.length === 0 && <p className="text-sm text-white/50">Todavía no hay comentarios escritos.</p>}
            <div className="space-y-2">
              {data.comments.map((c) => (
                <div key={c.id} className={cn("rounded-xl border p-3", c.visible ? "bg-white/5 border-white/10" : "bg-amber-500/5 border-amber-500/25 opacity-70")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <StarsRow value={c.stars} />
                        {Array.isArray(c.attributes) && c.attributes.map((a: string) => (
                          <Badge key={a} variant="secondary" className="text-[9px] border-white/10 bg-white/5">{ATTR_LABEL[a] ?? a}</Badge>
                        ))}
                        {!c.visible && <Badge className="text-[9px] bg-amber-500/15 text-amber-300 border-amber-500/30">En revisión</Badge>}
                      </div>
                      <p className="text-sm text-white/80 mt-1.5 break-words">{c.comment}</p>
                      <p className="text-[10px] text-white/35 mt-1">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : ""}</p>
                    </div>
                    {c.visible && (
                      reportingId === c.id ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <input
                            className="w-40 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                            placeholder="Motivo del reporte"
                            value={modReason}
                            onChange={(e) => setModReason(e.target.value)}
                          />
                          <button
                            onClick={() => { report.mutate({ ratingId: c.id, reason: modReason.trim() || "Reporte del comercio" }); setReportingId(null); setModReason(""); }}
                            className="text-[10px] font-bold text-amber-300">Enviar</button>
                          <button onClick={() => setReportingId(null)} className="text-[10px] text-white/40">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setReportingId(c.id)} className="flex items-center gap-1 text-[11px] font-bold text-gray-400 hover:text-amber-300 shrink-0">
                          <AlertTriangle size={12} /> Reportar
                        </button>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Moderación God (el API rechaza a no-God con FORBIDDEN → se oculta sola) */}
      {queue.data && queue.data.queue.length > 0 && (
        <Card className="p-5 border border-purple-500/30 bg-purple-500/5">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-black text-white uppercase tracking-wider">Moderación (God) — motivo obligatorio</h2>
          </div>
          <div className="space-y-2">
            {queue.data.queue.map((r: { id: string; stars: number; comment: string | null; moderationStatus: string; reportReason?: string | null; customerUserId?: string }) => (
              <div key={r.id} className="rounded-xl bg-black/30 border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <StarsRow value={r.stars} size={13} />
                    <p className="text-xs text-white/80 mt-1 break-words">{r.comment ?? "(sin comentario)"}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">
                      Estado: {r.moderationStatus} {r.reportReason ? `· Motivo reporte: ${r.reportReason}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {moderating === r.id ? (
                      <>
                        <input
                          className="w-44 rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                          placeholder="Motivo obligatorio (min 5)"
                          value={modReason}
                          onChange={(e) => setModReason(e.target.value)}
                        />
                        <button
                          disabled={modReason.trim().length < 5}
                          onClick={() => { moderate.mutate({ ratingId: r.id, action: "HIDE", reason: modReason.trim() }); setModerating(null); setModReason(""); }}
                          className="text-[10px] font-bold text-red-300 disabled:opacity-40">Ocultar</button>
                        <button onClick={() => setModerating(null)} className="text-[10px] text-white/40">✕</button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="secondary" onClick={() => setModerating(r.id)} className="text-[10px]">Moderar</Button>
                        <Button size="sm" variant="secondary"
                          onClick={() => moderate.mutate({ ratingId: r.id, action: "RESTORE", reason: "Restaurado tras revisión (God)" })}
                          className="text-[10px]">Restaurar</Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}