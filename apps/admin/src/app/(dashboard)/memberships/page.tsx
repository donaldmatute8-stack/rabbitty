"use client";

import RabbitterScannerModal from "@/components/RabbitterScannerModal";
import { useState, useEffect } from "react";
import { trpc } from "../../../lib/trpc-client";
import { Button, cn, toast } from "@rabbitty/ui";
import { Ticket, Plus, Users, ScanLine, X, Trash2, Send, Gift } from "lucide-react";

type Interval = "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "ONE_TIME";
type BenefitType = "INCLUDED_PRODUCT" | "DISCOUNT_PCT" | "CREDIT_BALANCE" | "EVENT_ACCESS" | "BULK_PACK";
type Reset = "DAILY" | "WEEKLY" | "MONTHLY" | "FIXED";

interface RuleDraft {
  type: BenefitType;
  quotaPerCycle: string;   // string: permite borrar/teclear libre — se valida al submit
  cycleResetType: Reset;
  discountPct?: number;
}

const INTERVAL_LABEL: Record<Interval, string> = {
  MONTHLY: "Mensual",
  QUARTERLY: "Trimestral",
  SEMIANNUAL: "Semestral",
  ANNUAL: "Anual",
  ONE_TIME: "Pago único",
};
const BENEFIT_LABEL: Record<BenefitType, string> = {
  INCLUDED_PRODUCT: "Producto incluido",
  DISCOUNT_PCT: "Descuento %",
  CREDIT_BALANCE: "Saldo de crédito",
  EVENT_ACCESS: "Acceso a evento",
  BULK_PACK: "Bolsa de consumos",
};
const RESET_LABEL: Record<Reset, string> = { DAILY: "Diario", WEEKLY: "Semanal", MONTHLY: "Mensual", FIXED: "Toda la vigencia" };

const inputCls = "w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white outline-none focus:border-pink-500/60";

export default function MembershipsPage() {
  const utils = trpc.useUtils();
  const { data: businesses } = trpc.memberships.myBusinesses.useQuery(undefined, { retry: false });
  const [selected, setSelected] = useState<string>("");
  const businessId = selected || businesses?.[0]?.id || "";
  const [tab, setTab] = useState<"plans" | "members" | "courtesy" | "scanner">("plans");
  const [showForm, setShowForm] = useState(false);

  const enabled = !!businessId;
  const { data: plans } = trpc.memberships.listPlansAdmin.useQuery({ businessId }, { enabled });
  const { data: members } = trpc.memberships.listMembers.useQuery({ businessId }, { enabled: enabled && tab === "members" });

  const publish = trpc.memberships.publishPlanVersion.useMutation({
    onSuccess: () => { toast.success("Plan publicado"); utils.memberships.listPlansAdmin.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  // ── Venta en caja: suscribir a un cliente (scanCode o @handle o teléfono) ──
  const [sellOpen, setSellOpen] = useState(false);
  const [sellPlanId, setSellPlanId] = useState<string>("");
  const [sellQuery, setSellQuery] = useState<string>("");
  const [sellResult, setSellResult] = useState<string>("");
  const lookupCustomer = trpc.pos.lookupRabbitter.useQuery(
    { query: sellQuery.trim() },
    { enabled: sellOpen && sellQuery.trim().length > 2, retry: false },
  );
  const sellSub = trpc.memberships.subscribe.useMutation({
    onSuccess: (d) => { setSellResult(`✅ Membresía activada (suscripción ${String(d.subscriptionId).slice(0, 8)}…) — el cliente ya puede mostrarla en su app`); utils.memberships.listMembers.invalidate(); },
    onError: (e) => setSellResult(`⚠️ ${e.message}`),
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center">
            <Ticket className="w-6 h-6 text-pink-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Rabbitty Memberships</h1>
            <p className="text-xs text-white/50">Planes, derechos de consumo y canje en caja</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {businesses && businesses.length > 0 && (businesses.length > 1 || (businesses[0] as { isGod?: boolean }).isGod) && (
            <select className={cn(inputCls, "w-auto")} value={businessId} onChange={(e) => setSelected(e.target.value)}>
              {businesses.map((b) => <option key={b.id} value={b.id}>{(b as { isGod?: boolean }).isGod ? "👑 " : ""}{b.name}</option>)}
            </select>
          )}
          <a
            href={`https://www.rabbitty.me/impresos?line=membership${businessId ? `&businessId=${businessId}` : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-xs font-bold text-amber-300 no-underline transition-all flex items-center gap-1.5"
          >
            🖨️ Impresos del Club
          </a>
          <Button onClick={() => setShowForm(true)} disabled={!enabled}><Plus className="w-4 h-4 mr-1" /> Nuevo plan</Button>
        </div>
      </header>

      <nav className="flex gap-2">
        {([["plans", "Planes", Ticket], ["members", "Miembros", Users], ["courtesy", "Cortesías 🎁", Gift], ["scanner", "Canje en caja", ScanLine]] as const).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn("px-4 py-2 rounded-xl text-sm flex items-center gap-2 border", tab === k ? "bg-pink-500/15 border-pink-500/40 text-white" : "border-white/10 text-white/60 hover:text-white")}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </nav>

      {!enabled && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/60 max-w-lg">
          <p className="font-bold text-white mb-1">Sin negocios asociados</p>
          <p>Tu cuenta no administra ningún negocio. Usa la <b>Vista Tenant</b> (impersonación desde God Shell) para gestionar las membresías de un afiliado.</p>
        </div>
      )}

      {enabled && tab === "plans" && (
        <div className="grid gap-4 md:grid-cols-2">
          {plans?.length === 0 && <p className="text-sm text-white/50">Aún no hay planes. Crea el primero.</p>}
          {plans?.map(({ plan, versions, activeMembers }) => {
            const latest = versions[0];
            const published = plan.currentVersionId === latest?.id;
            return (
              <div key={plan.id} className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-white">{plan.name}</h3>
                    <p className="text-xs text-white/50">{plan.description}</p>
                  </div>
                  <span className={cn("text-[10px] px-2 py-1 rounded-full border", published ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300")}>
                    {published ? "Publicado" : "Borrador"}
                  </span>
                </div>
                {latest && (
                  <p className="text-2xl font-bold text-white">
                    ${latest.priceFiat.toLocaleString()} <span className="text-xs font-normal text-white/50">{latest.currency} · {INTERVAL_LABEL[latest.billingInterval as Interval]} · v{latest.versionNumber}</span>
                  </p>
                )}
                <ul className="text-xs text-white/60 space-y-1">
                  {((latest?.benefitRules as RuleDraft[]) ?? []).map((r, i) => (
                    <li key={i}>• {BENEFIT_LABEL[r.type]} ×{r.quotaPerCycle} / {RESET_LABEL[r.cycleResetType].toLowerCase()}{r.discountPct ? ` (${r.discountPct}%)` : ""}</li>
                  ))}
                </ul>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-white/50">{activeMembers} miembros activos</span>
                  {latest && !published && (
                    <Button size="sm" onClick={() => publish.mutate({ versionId: latest.id })} disabled={publish.isPending}>
                      <Send className="w-3 h-3 mr-1" /> Publicar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {enabled && tab === "members" && (
        <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => { setSellOpen((v) => !v); setSellResult(""); }}><Ticket className="w-4 h-4 mr-1" /> Vender plan en caja</Button>
        </div>
        {sellOpen && (
          <div className="rounded-2xl border border-pink-500/30 bg-pink-500/5 p-4 space-y-3">
            <p className="text-sm font-bold text-white">Suscribir a un cliente (pago CASH_POS en caja)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <select className={inputCls} value={sellPlanId} onChange={(e) => setSellPlanId(e.target.value)}>
                <option value="">Selecciona el plan publicado…</option>
                {plans?.map((p) => {
                  const v = p.versions?.find((x) => x.id === p.plan.currentVersionId);
                  return v?.isPublished ? (
                    <option key={p.plan.id} value={v.id}>{p.plan.name} — ${Number(v.priceFiat ?? 0).toFixed(2)} / {v.billingInterval}</option>
                  ) : null;
                })}
              </select>
              <input className={inputCls} placeholder="Cliente: @handle, teléfono o código numérico" value={sellQuery} onChange={(e) => { setSellQuery(e.target.value); setSellResult(""); }} />
            </div>
            {lookupCustomer.data && (
              <p className="text-sm text-white/70">Cliente: <b className="text-white">{lookupCustomer.data.name}</b>{lookupCustomer.data.phoneNumber ? ` · ${lookupCustomer.data.phoneNumber}` : ""}</p>
            )}
            {!lookupCustomer.data && sellQuery.trim().length > 2 && (
              <p className="text-sm text-white/40">Buscando cliente…</p>
            )}
            <Button disabled={!sellPlanId || !lookupCustomer.data || sellSub.isPending}
              onClick={() => lookupCustomer.data && sellSub.mutate({ planVersionId: sellPlanId, paymentProvider: "CASH_POS", targetUserId: lookupCustomer.data.id })}>
              {sellSub.isPending ? "Activando…" : "Activar membresía"}
            </Button>
            {sellResult && <p className="text-sm text-white/80">{sellResult}</p>}
          </div>
        )}
        <div className="rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-white/50 text-xs">
              <tr><th className="text-left p-3">Plan</th><th className="text-left p-3">Estado</th><th className="text-left p-3">Vence</th><th className="text-left p-3">Pago</th></tr>
            </thead>
            <tbody>
              {members?.length === 0 && <tr><td colSpan={4} className="p-4 text-white/50">Sin miembros todavía.</td></tr>}
              {members?.map((m) => (
                <tr key={m.id} className="border-t border-white/5 text-white/80">
                  <td className="p-3">{m.planName}</td>
                  <td className="p-3">{m.status}{m.cancelAtPeriodEnd ? " (cancela)" : ""}</td>
                  <td className="p-3">{m.currentPeriodEnd ? new Date(m.currentPeriodEnd).toLocaleDateString() : 'Indefinida'}</td>
                  <td className="p-3">{m.paymentProvider}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}


      {enabled && tab === "courtesy" && <CourtesyPanel businessId={businessId} />}

      {enabled && tab === "scanner" && <RedeemPanel businessId={businessId} />}

      {showForm && (
        <PlanForm
          businessId={businessId}
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); utils.memberships.listPlansAdmin.invalidate(); }}
        />
      )}
    </div>
  );
}

function PlanForm({ businessId, onClose, onCreated }: { businessId: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("299");
  const [interval, setInterval_] = useState<Interval>("MONTHLY");
  const [rules, setRules] = useState<RuleDraft[]>([{ type: "INCLUDED_PRODUCT", quotaPerCycle: "1", cycleResetType: "DAILY" }]);

  const create = trpc.memberships.createPlan.useMutation({
    onSuccess: () => { toast.success("Plan creado como borrador"); onCreated(); },
    onError: (e) => toast.error(e.message),
  });

  const updateRule = (i: number, patch: Partial<RuleDraft>) => setRules(rules.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-zinc-950 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Nuevo plan</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-white/60" /></button>
        </div>
        <input className={inputCls} placeholder="Nombre (ej. Plan Mensual)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputCls} placeholder="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <input
            className={inputCls}
            type="text"
            inputMode="decimal"
            placeholder="Precio MXN"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1").slice(0, 10))}
          />
          <select className={inputCls} value={interval} onChange={(e) => setInterval_(e.target.value as Interval)}>
            {(Object.keys(INTERVAL_LABEL) as Interval[]).map((k) => <option key={k} value={k}>{INTERVAL_LABEL[k]}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-white/50">Beneficios</p>
          {rules.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_1fr_auto] gap-2 items-center">
              <select className={inputCls} value={r.type} onChange={(e) => updateRule(i, { type: e.target.value as BenefitType })}>
                {(Object.keys(BENEFIT_LABEL) as BenefitType[]).map((k) => <option key={k} value={k}>{BENEFIT_LABEL[k]}</option>)}
              </select>
              <input
                className={inputCls}
                type="text"
                inputMode="numeric"
                placeholder="Cantidad"
                value={r.quotaPerCycle}
                onChange={(e) => updateRule(i, { quotaPerCycle: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              />
              <select className={inputCls} value={r.cycleResetType} onChange={(e) => updateRule(i, { cycleResetType: e.target.value as Reset })}>
                {(Object.keys(RESET_LABEL) as Reset[]).map((k) => <option key={k} value={k}>{RESET_LABEL[k]}</option>)}
              </select>
              <button onClick={() => setRules(rules.filter((_, idx) => idx !== i))} disabled={rules.length === 1}><Trash2 className="w-4 h-4 text-white/40" /></button>
            </div>
          ))}
          <button className="text-xs text-pink-400" onClick={() => setRules([...rules, { type: "INCLUDED_PRODUCT", quotaPerCycle: "1", cycleResetType: "MONTHLY" }])}>+ Añadir beneficio</button>
        </div>

        <Button
          className="w-full"
          disabled={create.isPending || name.trim().length < 2}
          onClick={() => create.mutate({
            businessId,
            name: name.trim(),
            description: description.trim() || undefined,
            priceFiat: Number(price) || 0,
            currency: "MXN",
            billingInterval: interval,
            benefitRules: rules.map((r) => ({ ...r, quotaPerCycle: Math.max(1, parseInt(r.quotaPerCycle || "0", 10) || 1) })),
            branchesAllowed: [],
          })}
        >
          Crear plan
        </Button>
      </div>
    </div>
  );
}

function RedeemPanel({ businessId }: { businessId: string }) {
  const [token, setToken] = useState("");
  const [subId, setSubId] = useState("");
  const [entitlementId, setEntitlementId] = useState("");
  const [branchId, setBranchId] = useState("main");

  const redeem = trpc.memberships.redeemAtPOS.useMutation({
    onSuccess: (r) => {
      toast.success(r.duplicate ? "Canje ya registrado" : `Canje exitoso${"remaining" in r ? ` · quedan ${r.remaining}` : ""}`);
      setToken("");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3 max-w-xl">
      <p className="text-xs text-white/50">
        Pega el token del QR del Membership Pass del cliente y el ID del beneficio a canjear.
        El escaneo con cámara se añadirá junto al POS.
      </p>
      <input className={inputCls} placeholder="Token QR" value={token} onChange={(e) => { setToken(e.target.value.trim()); setSubId(e.target.value.split(".")[0] ?? ""); }} />
      {subId && <p className="text-[11px] text-white/40">Membresía: {subId}</p>}
      <input className={inputCls} placeholder="ID del beneficio (entitlementId)" value={entitlementId} onChange={(e) => setEntitlementId(e.target.value.trim())} />
      <input className={inputCls} placeholder="Sucursal" value={branchId} onChange={(e) => setBranchId(e.target.value)} />
      <Button
        disabled={redeem.isPending || token.length < 10 || !entitlementId}
        onClick={() => redeem.mutate({ businessId, qrToken: token, branchId, entitlementId, quantity: 1, idempotencyKey: crypto.randomUUID() })}
      >
        Canjear
      </Button>
    </div>
  );
}

function CourtesyPanel({ businessId }: { businessId: string }) {
  const utils = trpc.useUtils();
  const { data: courtesies, refetch } = trpc.memberships.listCourtesies.useQuery({ businessId }, { refetchInterval: 30000 });
  const [wizardOpen, setWizardOpen] = useState(false);
  const [targetQuery, setTargetQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [targetUserId, setTargetUserId] = useState<string | null>(null);
  const [targetName, setTargetName] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  // Debounce del lookup (evita tormenta de queries mientras se escribe)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(targetQuery.trim()), 400);
    return () => clearTimeout(t);
  }, [targetQuery]);

  // Payload decodificado (QR: rabbitty://pay?to=@x / user=/phone= · neón: scanCode numérico)
  const applyDecoded = async (decoded: string) => {
    let q = decoded;
    if (q.includes("to=")) { const m = q.match(/[?&]to=([^&]+)/); if (m) q = decodeURIComponent(m[1]); }
    else if (q.includes("user=")) { const m = q.match(/[?&]user=([^&]+)/); if (m) q = decodeURIComponent(m[1]); }
    else if (q.includes("phone=")) { const m = q.match(/[?&]phone=([^&]+)/); if (m) q = decodeURIComponent(m[1]); }
    q = q.replace(/^@/, "").trim();
    setTargetQuery(q);
    setDebouncedQuery(q);
    try {
      const res = await utils.pos.lookupRabbitter.fetch({ query: q });
      if (res) { setTargetUserId(res.id); setTargetName(res.name); toast.success(`🐰 ${res.name} identificado por escaneo`); }
      else toast.error("Código leído, pero no se encontró al rabbitter");
    } catch { toast.error("No se pudo resolver el código escaneado"); }
  };
  const [duration, setDuration] = useState<0 | 3 | 6 | 12>(12);
  const [giftNote, setGiftNote] = useState("");
  const [rules, setRules] = useState<RuleDraft[]>([{ type: "INCLUDED_PRODUCT", quotaPerCycle: "1", cycleResetType: "MONTHLY" }]);

  const lookupCustomer = trpc.pos.lookupRabbitter.useQuery(
    { query: debouncedQuery },
    { enabled: wizardOpen && debouncedQuery.length > 0 && !targetUserId, retry: false },
  );
  const grant = trpc.memberships.grantCourtesy.useMutation({
    onSuccess: (d) => {
      toast.success(d.indefinite ? "🎁 Cortesía indefinida otorgada — el destinatario ya la tiene" : "🎁 Cortesía otorgada — el destinatario recibió la notificación");
      setWizardOpen(false); setTargetQuery(""); setTargetUserId(null); setTargetName(""); setGiftNote("");
      utils.memberships.listCourtesies.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const revoke = trpc.memberships.revokeCourtesy.useMutation({
    onSuccess: () => { toast.info("Cortesía revocada — su QR dejó de funcionar"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const activeCount = (courtesies || []).filter((c) => c.status === "ACTIVE").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-white/60">
          Membresías individuales sin pago, <b className="text-white">personalizables</b> y revocables. Tope: <b className="text-white">{activeCount}/10 activas</b> (configurable por God).
        </p>
        <Button onClick={() => setWizardOpen((v) => !v)}>
          <Gift className="w-4 h-4 mr-1" /> {wizardOpen ? "Cerrar" : "Otorgar cortesía"}
        </Button>
      </div>

      {wizardOpen && (
        <div className="rounded-2xl border border-pink-500/30 bg-pink-500/5 p-4 space-y-3">
          <p className="text-sm font-bold text-white">1 · Destinatario</p>
          <div className="flex gap-2">
            <input className={inputCls} placeholder="@handle, teléfono, código o nombre del rabbitter" value={targetQuery}
              onChange={(e) => { setTargetQuery(e.target.value); setTargetUserId(null); setTargetName(""); }} />
            <button onClick={() => setShowScanner(true)} title="Escanear su código (QR o neón)"
              className="shrink-0 px-3 py-2 rounded-xl bg-pink-500/20 border border-pink-500/40 text-pink-200 hover:bg-pink-500/30">
              <ScanLine className="w-4 h-4" />
            </button>
          </div>
          {lookupCustomer.isFetching && debouncedQuery.length > 0 && !targetUserId && (
            <p className="text-xs text-white/40 px-1">Buscando rabbitter…</p>
          )}
          {lookupCustomer.data && !targetUserId && (lookupCustomer.data as any).id ? (
            <button onClick={() => { const lk = lookupCustomer.data as any; setTargetUserId(lk.id); setTargetName(lk.name); }}
              className="w-full text-left px-3 py-2 rounded-xl bg-white/5 border border-pink-500/40 text-sm text-white hover:bg-white/10">
              🐰 {lookupCustomer.data!.name}{lookupCustomer.data!.phoneNumber ? ` · ${lookupCustomer.data!.phoneNumber}` : ""} — click para elegir
            </button>
          ) : (
            debouncedQuery.length > 0 && !lookupCustomer.isFetching && !targetUserId && (
              <p className="text-xs text-white/50 px-1">
                Sin coincidencia para "<span className="text-white/80">{debouncedQuery}</span>" — prueba @handle, teléfono, código numérico o escanea su código 📷.
              </p>
            )
          )}

          {showScanner && (
            <RabbitterScannerModal onDecoded={applyDecoded} onClose={() => setShowScanner(false)} />
          )}

          <p className="text-sm font-bold text-white pt-1">2 · Beneficios personalizados (solo para esta persona)</p>
          {rules.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_70px_1fr_auto] gap-2 items-center">
              <select className={inputCls} value={r.type} onChange={(e) => setRules(rules.map((x, idx) => idx === i ? { ...x, type: e.target.value as BenefitType } : x))}>
                {(Object.keys(BENEFIT_LABEL) as BenefitType[]).map((k) => <option key={k} value={k}>{BENEFIT_LABEL[k]}</option>)}
              </select>
              <input
                className={inputCls}
                type="text"
                inputMode="numeric"
                placeholder="Cantidad"
                value={r.quotaPerCycle}
                onChange={(e) => setRules(rules.map((x, idx) => idx === i ? { ...x, quotaPerCycle: e.target.value.replace(/\D/g, "").slice(0, 4) } : x))}
              />
              <select className={inputCls} value={r.cycleResetType} onChange={(e) => setRules(rules.map((x, idx) => idx === i ? { ...x, cycleResetType: e.target.value as Reset } : x))}>
                {(Object.keys(RESET_LABEL) as Reset[]).map((k) => <option key={k} value={k}>{RESET_LABEL[k]}</option>)}
              </select>
              <button onClick={() => setRules(rules.length > 1 ? rules.filter((_, idx) => idx !== i) : rules)}><Trash2 className="w-4 h-4 text-white/40" /></button>
            </div>
          ))}
          <button className="text-xs text-pink-400" onClick={() => setRules([...rules, { type: "INCLUDED_PRODUCT", quotaPerCycle: "1", cycleResetType: "MONTHLY" }])}>+ Añadir beneficio</button>

          <p className="text-sm font-bold text-white pt-1">3 · Duración y nota</p>
          <div className="flex gap-2 flex-wrap">
            {([3, 6, 12, 0] as const).map((d) => (
              <button key={d} onClick={() => setDuration(d)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border ${duration === d ? "bg-pink-500/20 border-pink-500/50 text-white" : "border-white/10 text-white/50"}`}>
                {d === 0 ? "♾️ Indefinida (revocable)" : `${d} meses`}
              </button>
            ))}
          </div>
          <input className={inputCls} placeholder="Nota de regalo (opcional) — ej. 'Para mi hermana ☕'" value={giftNote} onChange={(e) => setGiftNote(e.target.value)} maxLength={300} />

          <Button className="w-full" disabled={!targetUserId || grant.isPending}
            onClick={() => targetUserId && grant.mutate({ businessId, targetUserId, benefitRules: rules.map((r) => ({ ...r, quotaPerCycle: Math.max(1, parseInt(r.quotaPerCycle || "0", 10) || 1) })), durationMonths: duration, giftNote: giftNote.trim() || undefined })}>
            {grant.isPending ? "Otorgando…" : `🎁 Otorgar a ${targetName || "…"}`}
          </Button>
        </div>
      )}

      {(!courtesies || courtesies.length === 0) && <p className="text-sm text-white/50">Sin cortesías todavía. Otorga la primera con el botón de arriba.</p>}

      <div className="space-y-2">
        {courtesies?.map((c) => (
          <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-white font-bold text-sm">🎁 {c.memberName}{c.memberUsername ? ` (@${c.memberUsername})` : ""}</p>
              <p className="text-xs text-white/50">
                {c.noExpiration ? "♾️ Indefinida" : c.currentPeriodEnd ? `Vence ${new Date(c.currentPeriodEnd).toLocaleDateString()}` : "—"}
                {" · "}{c.entitlements.length} beneficio(s)
                {c.giftNote ? ` · "${c.giftNote}"` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2.5 py-1 rounded-full border ${c.status === "ACTIVE" ? "bg-green-500/15 text-green-300 border-green-500/30" : c.status === "REVOKED" ? "bg-red-500/15 text-red-300 border-red-500/30" : "bg-white/5 text-white/50 border-white/10"}`}>
                {c.status === "ACTIVE" ? "Activa" : c.status === "REVOKED" ? "Revocada" : c.status}
              </span>
              {c.status === "ACTIVE" && revokingId !== c.id && (
                <button onClick={() => setRevokingId(c.id)} className="text-xs text-red-300 hover:text-red-200 font-bold">Revocar</button>
              )}
              {revokingId === c.id && (
                <div className="flex items-center gap-1.5">
                  <input className={inputCls + " !w-40 !py-1 text-xs"} placeholder="Motivo (opcional)" id={`reason-${c.id}`} />
                  <button onClick={() => { const el = document.getElementById(`reason-${c.id}`) as HTMLInputElement | null; revoke.mutate({ subscriptionId: c.id, reason: el?.value || undefined }); setRevokingId(null); }}
                    className="text-xs font-bold text-red-300">Confirmar</button>
                  <button onClick={() => setRevokingId(null)} className="text-xs text-white/40">✕</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
