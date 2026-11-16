"use client";

/**
 * ── Cola de expansión a otros nichos ────────────────────────────────────────
 *
 * Aquí llegan los negocios cuyo giro todavía no cubrimos. El panel permite
 * priorizar por demanda, contactar y marcar el estado, sin tocar onboarding ni
 * los negocios existentes.
 */

import { useMemo, useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { toast } from "@rabbitty/ui";
import { Compass, Mail, MessageCircle, RefreshCw, Check, X, Rocket, PhoneCall } from "lucide-react";

const STATUSES = ["PENDING", "CONTACTED", "LAUNCHED", "DISCARDED"] as const;
type Status = (typeof STATUSES)[number];

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "Pendiente",
  CONTACTED: "Contactado",
  LAUNCHED: "Lanzado",
  DISCARDED: "Descartado",
};

const STATUS_COLOR: Record<Status, string> = {
  PENDING: "#F59E0B",
  CONTACTED: "#38BDF8",
  LAUNCHED: "#34D399",
  DISCARDED: "#94A3B8",
};

export default function NichesPage() {
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<Status | "ALL">("ALL");

  const { data: summary } = trpc.admin.nicheRequestsSummary.useQuery();
  const { data: requests, isFetching } = trpc.admin.listNicheRequests.useQuery({
    status: filter === "ALL" ? undefined : filter,
    limit: 150,
  });

  const setStatus = trpc.admin.updateNicheRequestStatus.useMutation({
    onSuccess: () => {
      toast.success("Solicitud actualizada");
      utils.admin.listNicheRequests.invalidate();
      utils.admin.nicheRequestsSummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rows = useMemo(() => requests ?? [], [requests]);

  return (
    <div className="mx-auto max-w-6xl space-y-5 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/15">
            <Compass className="h-6 w-6 text-fuchsia-300" />
          </div>
          <div>
            <h1 className="m-0 text-2xl font-bold text-white">Expansión a otros nichos</h1>
            <p className="m-0 mt-0.5 text-[12px] text-white/45">
              Solicitudes de giros que aún no cubrimos. Prioriza por demanda, no por intuición.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { utils.admin.listNicheRequests.invalidate(); utils.admin.nicheRequestsSummary.invalidate(); }}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-white/70 hover:text-white"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </header>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total", summary?.totals.total ?? 0, "text-white"],
          ["Pendientes", summary?.totals.pending ?? 0, "text-amber-300"],
          ["Contactadas", summary?.totals.contacted ?? 0, "text-sky-300"],
          ["Lanzadas", summary?.totals.launched ?? 0, "text-emerald-300"],
        ].map(([label, value, tone]) => (
          <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="m-0 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">{label}</p>
            <p className={`m-0 mt-1 text-2xl font-black ${tone}`}>{String(value)}</p>
          </div>
        ))}
      </div>

      {/* Demanda por giro */}
      {(summary?.byNiche?.length ?? 0) > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-white/35">Demanda por giro</p>
          <div className="flex flex-wrap gap-2">
            {summary?.byNiche.map((n) => (
              <span key={n.label} className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] font-bold text-white/70">
                {n.label} · {n.total}
                {n.pending > 0 && <span className="ml-1 text-amber-300">({n.pending} sin contactar)</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-1.5">
        {(["ALL", ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className="rounded-full px-3 py-1.5 text-[11px] font-black transition-colors"
            style={{
              background: filter === s ? "rgba(233,30,99,0.18)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${filter === s ? "rgba(233,30,99,0.45)" : "rgba(255,255,255,0.10)"}`,
              color: filter === s ? "#FF7DBB" : "rgba(255,255,255,0.55)",
            }}
          >
            {s === "ALL" ? "Todas" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {/* Lista */}
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="m-0 text-sm font-bold text-white">Sin solicitudes todavía</p>
          <p className="m-0 mt-1 text-[12px] text-white/45">
            Cuando un negocio use “No veo mi tipo de negocio” en el onboarding, aparecerá aquí.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const status = (r.status as Status) ?? "PENDING";
            const color = STATUS_COLOR[status];
            return (
              <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-black text-white">{r.nicheLabel}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
                        style={{ color, background: `${color}1f`, border: `1px solid ${color}55` }}
                      >
                        {STATUS_LABEL[status]}
                      </span>
                      {r.businessName && <span className="text-[11px] text-white/45">{r.businessName}</span>}
                    </div>
                    <p className="m-0 mt-1 text-[11px] text-white/50">
                      {r.contactName || "Sin nombre"} ·{" "}
                      <a href={`mailto:${r.email}`} className="inline-flex items-center gap-1 text-sky-300 hover:underline">
                        <Mail className="h-3 w-3" /> {r.email}
                      </a>{" "}
                      ·{" "}
                      <a
                        href={`https://wa.me/${r.phone}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-300 hover:underline"
                      >
                        <MessageCircle className="h-3 w-3" /> +{r.phone}
                      </a>
                    </p>
                    {r.message && <p className="m-0 mt-1 text-[11px] italic text-white/40">“{r.message}”</p>}
                    <p className="m-0 mt-1 text-[10px] text-white/30">
                      {new Date(r.createdAt as unknown as string).toLocaleString("es-MX")} · {r.source}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      title="Marcar contactado"
                      onClick={() => setStatus.mutate({ id: r.id, status: "CONTACTED" })}
                      className="flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[10px] font-black text-sky-300"
                    >
                      <PhoneCall className="h-3 w-3" /> Contactado
                    </button>
                    <button
                      type="button"
                      title="Marcar lanzado"
                      onClick={() => setStatus.mutate({ id: r.id, status: "LAUNCHED" })}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-300"
                    >
                      <Rocket className="h-3 w-3" /> Lanzado
                    </button>
                    <button
                      type="button"
                      title="Descartar"
                      onClick={() => setStatus.mutate({ id: r.id, status: "DISCARDED" })}
                      className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-black text-white/50"
                    >
                      <X className="h-3 w-3" /> Descartar
                    </button>
                    <button
                      type="button"
                      title="Volver a pendiente"
                      onClick={() => setStatus.mutate({ id: r.id, status: "PENDING" })}
                      className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-300"
                    >
                      <Check className="h-3 w-3" /> Pendiente
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
