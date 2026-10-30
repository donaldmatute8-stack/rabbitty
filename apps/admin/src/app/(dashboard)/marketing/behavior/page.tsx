'use client';

import { useEffect, useState } from "react";
import { trpc } from "../../../../lib/trpc-client";
import { Button, toast } from "@rabbitty/ui";
import { Brain, Plus, Send, Trash2, Target, Timer, UserRound, Wand2 } from "lucide-react";

const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/60";

const TRIGGER_META: Record<string, { label: string; desc: string }> = {
  HIGH_DWELL_LOW_SPEND: { label: "MUCHA permanencia, poco consumo", desc: "Rabbitters que se quedan horas aquí pero gastan poco en Bunz" },
  CHURNED_REGULAR: { label: "Recurrentes que dejaron de venir", desc: "Venían seguido y llevan días sin aparecer" },
  CROSS_AFFINITY: { label: "Afinidad cruzada (otro rubro)", desc: "Rabbitters afines a OTRA categoría que no me conocen" },
};

interface Match { userId: string; name: string; username: string | null; metrics: any }

export default function BehaviorRulesPage() {
  const utils = trpc.useUtils();
  const { data: businesses } = trpc.memberships.myBusinesses.useQuery(undefined, { retry: false });
  const [businessId, setBusinessId] = useState("");
  const selected = businessId || businesses?.find((b: any) => !b.isGod)?.id || businesses?.[0]?.id || "";

  const { data: rules, refetch } = trpc.behaviorRules.listRules.useQuery(
    { businessId: selected }, { enabled: !!selected, retry: false }
  );

  // ── Wizard de regla ──
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<"HIGH_DWELL_LOW_SPEND" | "CHURNED_REGULAR" | "CROSS_AFFINITY">("HIGH_DWELL_LOW_SPEND");
  const [minDwell, setMinDwell] = useState("60");
  const [windowDays, setWindowDays] = useState("14");
  const [maxSpend, setMaxSpend] = useState("0");
  const [minVisits, setMinVisits] = useState("3");
  const [daysSilent, setDaysSilent] = useState("21");
  const [targetCategory, setTargetCategory] = useState("Cafetería");
  const [actionType, setActionType] = useState<"PROMO" | "BUNZ">("PROMO");
  const [bunzAmount, setBunzAmount] = useState("20");
  const [budget, setBudget] = useState("200");
  const [promTitle, setPromTitle] = useState("");
  const [promMessage, setPromMessage] = useState("");

  const saveRule = trpc.behaviorRules.saveRule.useMutation({
    onSuccess: () => { toast.success("Regla guardada"); setCreating(false); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.behaviorRules.toggleRule.useMutation({ onSuccess: () => refetch(), onError: (e) => toast.error(e.message) });

  // ── Matches + envíos ──
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);
  const matchesQuery = trpc.behaviorRules.getRuleMatches.useQuery(
    { ruleId: openRuleId ?? "__none__" },
    { enabled: !!openRuleId, retry: false }
  );
  const execute = trpc.behaviorRules.executeAction.useMutation({
    onSuccess: (d) => {
      toast.success(d.bunzSent > 0 ? `✅ Enviado +${d.bunzSent} Bunz y notificación` : "✅ Promo enviada");
      matchesQuery.refetch(); refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const save = () => {
    if (!selected) { toast.error("Selecciona tu negocio"); return; }
    if (name.trim().length < 3) { toast.error("Nombre demasiado corto"); return; }
    if (promTitle.trim().length < 3 || promMessage.trim().length < 3) { toast.error("Título y mensaje de la promo son obligatorios"); return; }
    saveRule.mutate({
      businessId: selected,
      name: name.trim(),
      triggerType,
      triggerParams: {
        ...(triggerType === "HIGH_DWELL_LOW_SPEND" ? { minDwellMinutes: Number(minDwell) || 60, windowDays: Number(windowDays) || 14, maxSpendBunz: Number(maxSpend) || 0 } : {}),
        ...(triggerType === "CHURNED_REGULAR" ? { minVisits: Number(minVisits) || 3, daysSinceLastVisit: Number(daysSilent) || 21 } : {}),
        ...(triggerType === "CROSS_AFFINITY" ? { targetCategory: targetCategory.trim() || "Cafetería", minDwellMinutes: Number(minDwell) || 30 } : {}),
      },
      action: { type: actionType, bunzAmount: actionType === "BUNZ" ? Number(bunzAmount) || 20 : undefined, title: promTitle.trim(), message: promMessage.trim() },
      budgetBunz: actionType === "BUNZ" ? Number(budget) || 200 : 0,
    });
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Brain className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Reglas de Comportamiento</h1>
            <p className="text-xs text-white/50">Detecta patrones de tus rabbitters y envíales ofertas, Bunz o promos — con presupuesto</p>
          </div>
        </div>
        {businesses && businesses.length > 1 && (
          <select className={inputCls + " w-auto"} value={selected} onChange={(e) => setBusinessId(e.target.value)}>
            {businesses.map((b: any) => <option key={b.id} value={b.id}>{b.isGod ? "👑 " : ""}{b.name}</option>)}
          </select>
        )}
      </header>

      {/* Wizard */}
      {(!creating && (
        <Button onClick={() => setCreating(true)} disabled={!selected}><Plus className="w-4 h-4 mr-1" /> Nueva regla</Button>
      )) || (
        <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 space-y-4">
          <p className="text-sm font-black text-white">1 · Trigger (comportamiento a detectar)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {Object.entries(TRIGGER_META).map(([k, m]) => (
              <button key={k} onClick={() => setTriggerType(k as any)}
                className={`text-left p-3 rounded-xl border transition-all ${triggerType === k ? "bg-purple-500/20 border-purple-500/50" : "bg-white/5 border-white/10 hover:border-white/25"}`}>
                <p className="text-sm font-bold text-white">{m.label}</p>
                <p className="text-[11px] text-white/50 mt-0.5">{m.desc}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {triggerType === "HIGH_DWELL_LOW_SPEND" && (<>
              <label className="text-xs text-white/60">Estancia ≥ (min)<input className={inputCls} type="text" inputMode="numeric" value={minDwell} onChange={(e) => setMinDwell(e.target.value.replace(/\D/g, ""))} /></label>
              <label className="text-xs text-white/60">Ventana (días)<input className={inputCls} type="text" inputMode="numeric" value={windowDays} onChange={(e) => setWindowDays(e.target.value.replace(/\D/g, ""))} /></label>
              <label className="text-xs text-white/60">Ha gastado ≤ (Bunz)<input className={inputCls} type="text" inputMode="numeric" value={maxSpend} onChange={(e) => setMaxSpend(e.target.value.replace(/\D/g, ""))} /></label>
            </>)}
            {triggerType === "CHURNED_REGULAR" && (<>
              <label className="text-xs text-white/60">Visitó ≥ (veces)<input className={inputCls} type="text" inputMode="numeric" value={minVisits} onChange={(e) => setMinVisits(e.target.value.replace(/\D/g, ""))} /></label>
              <label className="text-xs text-white/60">Silencio desde (días)<input className={inputCls} type="text" inputMode="numeric" value={daysSilent} onChange={(e) => setDaysSilent(e.target.value.replace(/\D/g, ""))} /></label>
            </>)}
            {triggerType === "CROSS_AFFINITY" && (<>
              <label className="text-xs text-white/60">Categoría objetivo (ej. Cafetería)<input className={inputCls} value={targetCategory} onChange={(e) => setTargetCategory(e.target.value)} /></label>
              <label className="text-xs text-white/60">Su permanencia ≥ (min)<input className={inputCls} type="text" inputMode="numeric" value={minDwell} onChange={(e) => setMinDwell(e.target.value.replace(/\D/g, ""))} /></label>
            </>)}
          </div>

          <p className="text-sm font-black text-white pt-1">2 · Acción a ejecutar</p>
          <div className="flex gap-2">
            <button onClick={() => setActionType("PROMO")} className={`px-3 py-2 rounded-xl text-xs font-bold border ${actionType === "PROMO" ? "bg-pink-500/20 border-pink-500/50 text-white" : "bg-white/5 border-white/10 text-white/50"}`}>💌 Promo push</button>
            <button onClick={() => setActionType("BUNZ")} className={`px-3 py-2 rounded-xl text-xs font-bold border ${actionType === "BUNZ" ? "bg-pink-500/20 border-pink-500/50 text-white" : "bg-white/5 border-white/10 text-white/50"}`}>🎁 Regalar Bunz + promo</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <label className="text-xs text-white/60 md:col-span-3">Título de la notificación<input className={inputCls} placeholder="¡Te extrañamos! Ven hoy y…" value={promTitle} onChange={(e) => setPromTitle(e.target.value)} maxLength={80} /></label>
            <label className="text-xs text-white/60 md:col-span-3">Mensaje<input className={inputCls} placeholder="Texto de la oferta (concreto, con vigencia)" value={promMessage} onChange={(e) => setPromMessage(e.target.value)} maxLength={300} /></label>
            {actionType === "BUNZ" && (<>
              <label className="text-xs text-white/60">Bunz por rabbitter<input className={inputCls} type="text" inputMode="numeric" value={bunzAmount} onChange={(e) => setBunzAmount(e.target.value.replace(/\D/g, ""))} /></label>
              <label className="text-xs text-white/60">Presupuesto total (Bunz)<input className={inputCls} type="text" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} /></label>
            </>)}
          </div>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saveRule.isPending}>{saveRule.isPending ? "Guardando…" : "Guardar regla"}</Button>
            <Button variant="secondary" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Lista de reglas con matches en vivo */}
      <div className="space-y-3">
        {(!rules || rules.length === 0) && <p className="text-sm text-white/50">Sin reglas todavía — crea la primera para detectar patrones.</p>}
        {rules?.map((r: any) => {
          const t = TRIGGER_META[r.triggerType];
          const open = openRuleId === r.id;
          return (
            <div key={r.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-white font-bold text-sm">{r.name}</p>
                  <p className="text-[11px] text-white/50">{t?.label ?? r.triggerType}
                    {r.triggerType === "CROSS_AFFINITY" && r.triggerParams?.targetCategory ? ` → ${r.triggerParams.targetCategory}` : ""}
                    {r.action?.type === "BUNZ" ? ` · 🎁 ${r.triggerParams?.bunzAmount ?? r.action?.bunzAmount ?? 0} BZ/rabbitter · presupuesto ${r.budgetSpent}/${r.budgetBunz}` : " · 💌 promo"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full ${r.isActive ? "bg-green-500/15 text-green-300" : "bg-white/5 text-white/40"}`}>{r.isActive ? "ACTIVA" : "PAUSADA"}</span>
                  <button onClick={() => toggle.mutate({ id: r.id, isActive: !r.isActive })} className="text-xs font-bold text-pink-300 hover:text-pink-200">{r.isActive ? "Pausar" : "Activar"}</button>
                  <button onClick={() => setOpenRuleId(open ? null : r.id)} className="text-xs font-bold text-white hover:text-pink-300">{open ? "Ocultar matches" : "Ver matches"}</button>
                </div>
              </div>
              {open && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  {matchesQuery.isFetching && <p className="text-xs text-white/40">Escaneando comportamientos…</p>}
                  {matchesQuery.data && matchesQuery.data.matches.length === 0 && (
                    <p className="text-xs text-white/50">Sin rabbitters que matcheen este comportamiento aún — la regla se activa cuando aparezca el patrón.</p>
                  )}
                  {matchesQuery.data?.matches.map((m: Match) => (
                    <div key={m.userId} className="flex items-center justify-between gap-3 py-2 border-b border-white/5 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white">{m.name}{m.username ? ` (@${m.username})` : ""}</p>
                        <p className="text-[11px] text-white/50">
                          {r.triggerType === "HIGH_DWELL_LOW_SPEND" && `~${Number(m.metrics?.avgMin ?? 0)} min/visita · ha gastado ${Number(m.metrics?.spent ?? 0)} BZ aquí · ${m.metrics?.sessions} sesiones`}
                          {r.triggerType === "CHURNED_REGULAR" && `${m.metrics?.visits} visitas · última hace ${m.metrics?.daysSilent} días`}
                          {r.triggerType === "CROSS_AFFINITY" && `${Number(m.metrics?.dwellMin ?? 0)} min en ${r.triggerParams?.targetCategory} · ${m.metrics?.venues} lugares`}
                        </p>
                      </div>
                      <Button className="shrink-0" onClick={() => execute.mutate({ ruleId: r.id, userId: m.userId })} disabled={execute.isPending}>
                        <Send className="w-3.5 h-3.5 mr-1" /> Enviar
                      </Button>
                    </div>
                  ))}
                  {(matchesQuery.data?.matches?.length ?? 0) > 0 && (
                    <p className="text-[10px] text-white/40 mt-2">Envía individual — 1 oferta por rabbitter cada 7 días (anti-spam). Con <Send className="inline w-3 h-3" /> el rabbitter recibe push + notificación con deep-link a tu perfil.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Roadmap */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-start gap-3">
        <Wand2 className="w-5 h-5 text-white/40 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-black text-white/70">Próximo en el motor (Coming soon)</p>
          <p className="text-[11px] text-white/40 mt-0.5">
            Auto-ejecución programada (sin click), sección "Para Ti" en la app del rabbitter con ofertas cruzadas,
            y recomendaciones generadas del grafo Vibe (comportamiento ↔ categorías afines).
          </p>
        </div>
      </div>
    </div>
  );
}
