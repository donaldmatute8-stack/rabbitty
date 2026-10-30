'use client';

import { useState } from "react";
import { trpc } from "../../../../lib/trpc-client";
import { Button, toast } from "@rabbitty/ui";
import { Scale, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  PENDING_AFFILIATE: { label: "Esperando negocio", cls: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" },
  AFFILIATE_APPROVED: { label: "Aprobada por negocio", cls: "bg-green-500/15 text-green-300 border-green-500/30" },
  AFFILIATE_REJECTED: { label: "Disputada por negocio", cls: "bg-orange-500/15 text-orange-300 border-orange-500/30" },
  PENDING_GOD: { label: "Espera God", cls: "bg-pink-500/15 text-pink-300 border-pink-500/30" },
  DELIVERY_PROCESSING: { label: "Entregando…", cls: "bg-blue-500/15 text-blue-300 border-blue-500/30" },
  DELIVERED: { label: "✓ Entregada", cls: "bg-green-600/20 text-green-300 border-green-600/40" },
  GOD_REJECTED: { label: "Rechazada por God", cls: "bg-red-500/15 text-red-300 border-red-500/30" },
};

const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/60";

export default function ConciliacionesPage() {
  const utils = trpc.useUtils();
  const { data: requests, refetch, isLoading } = trpc.reconciliation.listForGod.useQuery(undefined, { refetchInterval: 30000 });
  const authorize = trpc.reconciliation.authorize.useMutation({
    onSuccess: () => { toast.success("✅ Entrega autorizada y acreditada en el ledger"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const godReject = trpc.reconciliation.godReject.useMutation({
    onSuccess: () => { toast.info("Conciliación rechazada"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"OPEN" | "ALL">("OPEN");

  const list = (requests || []).filter((r) => filter === "ALL" || !["DELIVERED", "GOD_REJECTED"].includes(r.status));

  const act = (id: string, mut: typeof authorize | typeof godReject) => {
    if (note.trim().length < 3) { toast.error("Escribe el motivo (mín. 3 caracteres)"); return; }
    mut.mutate({ requestId: id, godNote: note.trim() });
    setNoteFor(null); setNote("");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
            <Scale className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">⚖️ Conciliaciones</h1>
            <p className="text-xs text-white/50">Restitución de recompensas no entregadas — la entrega requiere tu autorización</p>
          </div>
        </div>
        <div className="flex gap-2">
          {(["OPEN", "ALL"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm border ${filter === f ? "bg-pink-500/15 border-pink-500/40 text-white" : "border-white/10 text-white/60"}`}>
              {f === "OPEN" ? "Abiertas" : "Todas"}
            </button>
          ))}
        </div>
      </header>

      {isLoading && <p className="text-white/50 text-sm">Cargando…</p>}
      {!isLoading && list.length === 0 && (
        <p className="text-white/50 text-sm">Sin conciliaciones {filter === "OPEN" ? "abiertas" : "registradas"}.</p>
      )}

      <div className="space-y-3">
        {list.map((r) => {
          const st = STATUS_STYLE[r.status] || { label: r.status, cls: "bg-white/5 text-white/60 border-white/10" };
          const actionable = ["PENDING_GOD", "AFFILIATE_APPROVED", "AFFILIATE_REJECTED"].includes(r.status) && r.claimedBunz > 0;
          return (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-white font-bold text-sm">
                    {r.claimedBunz} Bunz · folio {r.orderId.slice(0, 8).toUpperCase()}-{r.orderId.slice(8, 9).toUpperCase()}
                    <span className="text-white/40 font-normal"> · negocio {r.businessId.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-white/50 mt-0.5">
                    Snapshot: esperaba {r.expectedBunz} · acreditado {r.creditedBunz} · en vault {r.pendingBunz} ({r.rewardRuleRef})
                  </p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border ${st.cls}`}>{st.label}</span>
              </div>
              <p className="text-xs text-white/70">🐰 Motivo: {r.note}</p>
              {r.affiliateNote && <p className="text-xs text-white/60">🏪 Negocio: {r.affiliateNote}</p>}
              {r.godNote && <p className="text-xs text-white/50">👑 God: {r.godNote}</p>}
              {r.status === "DELIVERY_PROCESSING" && (
                <p className="text-xs text-blue-300 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" /> Entrega en proceso (intento {r.deliveryAttempts}) — se reintenta automáticamente
                </p>
              )}
              {r.deliveredAt && <p className="text-xs text-green-400">Acreditada el {new Date(r.deliveredAt).toLocaleString()}</p>}

              {actionable && noteFor !== r.id && (
                <Button className="mt-1" onClick={() => { setNoteFor(r.id); setNote(""); }}>
                  Revisar y decidir
                </Button>
              )}
              {noteFor === r.id && (
                <div className="space-y-2 border-t border-white/10 pt-2">
                  <input className={inputCls} placeholder="Motivo de la decisión (obligatorio, queda en auditoría)" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="flex gap-2">
                    <Button onClick={() => act(r.id, authorize)} disabled={authorize.isPending}>
                      <CheckCircle2 className="w-4 h-4" /> Autorizar entrega de {r.claimedBunz} Bunz
                    </Button>
                    <Button variant="secondary" onClick={() => act(r.id, godReject)} disabled={godReject.isPending}>
                      <XCircle className="w-4 h-4" /> Rechazar
                    </Button>
                    <Button variant="ghost" onClick={() => setNoteFor(null)}>Cancelar</Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
