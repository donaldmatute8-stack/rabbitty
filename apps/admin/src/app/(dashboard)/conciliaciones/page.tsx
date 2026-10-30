'use client';

import { useState } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Button, toast } from "@rabbitty/ui";
import { Scale } from "lucide-react";

const STATUS_LABEL: Record<string, string> = {
  PENDING_AFFILIATE: "⏳ Espera tu resolución",
  AFFILIATE_APPROVED: "✓ Aprobaste — espera God",
  AFFILIATE_REJECTED: "⚖️ Disputaste — God la revisará",
  PENDING_GOD: "👑 En revisión de God",
  DELIVERY_PROCESSING: "⏱️ Entregando…",
  DELIVERED: "✅ Conciliada y entregada",
  GOD_REJECTED: "❌ Rechazada por God",
};

const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/60";

export default function ConciliacionesPage() {
  const { data: businesses } = trpc.memberships.myBusinesses.useQuery(undefined, { retry: false });
  const [businessId, setBusinessId] = useState("");
  const selected = businessId || businesses?.[0]?.id || "";
  const { data: requests, refetch } = trpc.reconciliation.listForBusiness.useQuery(
    { businessId: selected },
    { enabled: !!selected, refetchInterval: 30000 }
  );
  const decide = trpc.reconciliation.decide.useMutation({
    onSuccess: () => { toast.success("Resolución registrada — God la revisará"); setNoteFor(null); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
          <Scale className="w-6 h-6 text-pink-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">⚖️ Conciliaciones</h1>
          <p className="text-xs text-white/50">Reclamos de clientes por Bunz no acreditados — tú reconoces o disputas; God autoriza la entrega</p>
        </div>
      </header>

      {businesses && businesses.length > 1 && (
        <select className={inputCls + " max-w-sm"} value={selected} onChange={(e) => setBusinessId(e.target.value)}>
          {businesses.map((b) => <option key={b.id} value={b.id}>{(b as { isGod?: boolean }).isGod ? "👑 " : ""}{b.name}</option>)}
        </select>
      )}

      {(!requests || requests.length === 0) && (
        <p className="text-sm text-white/50">Sin conciliaciones por ahora. Cuando un cliente reclame Bunz no acreditados, aparecerá aquí.</p>
      )}

      <div className="space-y-3">
        {requests?.map((r) => (
          <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-white font-bold text-sm">
                {r.claimedBunz} Bunz · folio {r.orderId.slice(0, 8).toUpperCase()}-{r.orderId.slice(8, 9).toUpperCase()}
              </p>
              <span className="text-xs text-white/60">{STATUS_LABEL[r.status] || r.status}</span>
            </div>
            <p className="text-xs text-white/70">🐰 Cliente: {r.note}</p>
            <p className="text-xs text-white/40">Cálculo del sistema: correspondían {r.expectedBunz} · acreditados {r.creditedBunz} · en bóveda {r.pendingBunz}</p>

            {r.status === "PENDING_AFFILIATE" && noteFor !== r.id && (
              <Button className="mt-1" onClick={() => { setNoteFor(r.id); setNote(""); }}>Resolver</Button>
            )}
            {noteFor === r.id && (
              <div className="space-y-2 border-t border-white/10 pt-2">
                <input className={inputCls} placeholder="Nota (obligatoria — queda registrada y la verá God)" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="flex gap-2">
                  <Button onClick={() => { if (note.trim().length < 3) { toast.error("Escribe la nota"); return; } decide.mutate({ requestId: r.id, decision: "APPROVED", note: note.trim() }); }}>
                    Aprobar (reconozco la falla)
                  </Button>
                  <Button variant="secondary" onClick={() => { if (note.trim().length < 3) { toast.error("Escribe la nota"); return; } decide.mutate({ requestId: r.id, decision: "REJECTED", note: note.trim() }); }}>
                    Disputar (explico por qué)
                  </Button>
                  <Button variant="ghost" onClick={() => setNoteFor(null)}>Cancelar</Button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
