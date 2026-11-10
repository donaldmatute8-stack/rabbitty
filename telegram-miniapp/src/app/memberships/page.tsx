'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';
import { MembershipCard } from '@rabbitty/ui';
import MembershipMarketplace from '@/features/memberships/Marketplace';

interface Entitlement {
  id: string;
  benefitType: string;
  quotaPerCycle: number;
  used: number;
  cycleResetType: string;
  cycleEndDate: string;
  discountPct: number | null;
}

interface Membership {
  id: string;
  status: string;
  currentPeriodEnd: string | null;
  noExpiration: boolean;
  membershipOrigin: string | null;
  giftNote: string | null;
  cancelAtPeriodEnd: boolean;
  planName: string | null;
  planDescription: string | null;
  badgeColor: string | null;
  coverImageUrl: string | null;
  cardNiche: string | null;
  cardDetail: string | null;
  cardTagline: string | null;
  businessName: string;
  businessLogoUrl: string | null;
  maxMembersLimit: number | null;
  createdAt: string | null;
  priceFiat: number | null;
  currency: string | null;
  billingInterval: string | null;
  entitlements: Entitlement[];
}

interface Usage {
  id: string;
  benefitType: string;
  quantityUsed: number;
  redeemedAt: string;
  orderId: string | null;
  branchId: string | null;
}

const BENEFIT_LABEL: Record<string, string> = {
  INCLUDED_PRODUCT: 'Producto incluido',
  DISCOUNT_PCT: 'Descuento',
  CREDIT_BALANCE: 'Crédito',
  EVENT_ACCESS: 'Acceso a evento',
  BULK_PACK: 'Bolsa de consumos',
  MEMBER_CONSUMPTION: '1 café por visita',
};
const RESET_LABEL: Record<string, string> = { DAILY: 'hoy', WEEKLY: 'esta semana', MONTHLY: 'este mes', FIXED: 'en total' };
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activa', PAST_DUE: 'Pago pendiente', GRACE_PERIOD: 'Periodo de gracia', CANCELLED: 'Cancelada', EXPIRED: 'Vencida',
};

/** Token QR dinámico (rota cada 30 s) para el reverso de la tarjeta. */
function usePassToken(membershipId: string | null, enabled: boolean) {
  const [token, setToken] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!membershipId) return;
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/memberships/${membershipId}/pass`, { headers, cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo generar el pase');
      setToken(data.qrToken);
      setSeconds(data.expiresInSeconds);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
  }, [membershipId]);

  useEffect(() => {
    if (!enabled) return;
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [enabled, load]);

  useEffect(() => {
    if (!enabled || !token) return;
    const tick = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { load(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [enabled, token, load]);

  return { token, seconds, error };
}

function cardData(m: Membership, memberName: string | null) {
  const since = m.createdAt
    ? new Date(m.createdAt).toLocaleDateString('es-MX', { month: 'short', year: 'numeric' })
    : null;
  const validity = m.noExpiration
    ? 'Vigencia Indefinida'
    : m.currentPeriodEnd
      ? `Vigente hasta ${new Date(m.currentPeriodEnd).toLocaleDateString('es-MX')}`
      : 'Vigencia Indefinida';
  return {
    planName: m.planName || 'Membresía',
    businessName: m.businessName,
    branchLabel: `Solo en ${m.businessName}`,
    validityLabel: validity,
    membersLabel: m.maxMembersLimit ? `Hasta ${m.maxMembersLimit} miembros` : 'Miembros ilimitados',
    transferableLabel: 'Intransferible',
    tagline: m.cardTagline || 'Una familia, más beneficios',
    niche: m.cardNiche,
    detail: m.cardDetail,
    heroImageUrl: m.coverImageUrl,
    memberName,
    memberSince: since ? since.toUpperCase() : null,
    accentColor: m.badgeColor,
  };
}

export default function MembershipsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Membership | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);
  const [tab, setTab] = useState<'mine' | 'discover'>('mine');
  const [celebrate, setCelebrate] = useState<{ planName?: string } | null>(null);
  const [activating, setActivating] = useState(false);
  const dragControls = useDragControls();

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'discover' || t === 'mine') setTab(t);
  }, []);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const refreshMemberships = useCallback(async () => {
    const headers = await PlatformBridge.getAuthHeaders();
    const res = await fetch('/api/memberships', { headers, cache: 'no-store' });
    const data = await res.json();
    if (data.success) {
      setMemberships(data.memberships ?? []);
      setMemberName(data.memberName ?? null);
    }
  }, []);

  // Post-checkout: celebrar la membresía en vez de recargar a ciegas.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joined = params.get('joined') === '1';
    const success = params.get('checkout') === 'success';
    const cancelled = params.get('checkout') === 'cancelled';
    const planName = params.get('plan') || undefined;

    if (cancelled) {
      showToast('Pago cancelado', 'error');
      window.history.replaceState({}, '', '/memberships');
      return;
    }
    if (!joined && !success) return;

    window.history.replaceState({}, '', '/memberships');
    if (joined) {
      setCelebrate({ planName });
      void refreshMemberships();
      return;
    }

    setActivating(true);
    let attempts = 0;
    const tick = async () => {
      attempts += 1;
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch('/api/memberships', { headers, cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          setMemberships(data.memberships ?? []);
          setMemberName(data.memberName ?? null);
          const activeSubs = (data.memberships ?? []).filter((m: any) => m.status === 'ACTIVE');
          if (activeSubs.length > 0) {
            setCelebrate({ planName: activeSubs[0].planName });
            setActivating(false);
            return;
          }
        }
      } catch { /* reintentar */ }
      if (attempts < 8) setTimeout(tick, 2000);
      else setActivating(false);
    };
    void tick();
  }, [refreshMemberships, showToast]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    refreshMemberships()
      .catch((err) => console.error('[Memberships] fetch error:', err))
      .finally(() => setLoading(false));
  }, [user?.id, refreshMemberships]);

  const activeCard = useMemo(
    () => (active ? cardData(active, memberName) : null),
    [active, memberName],
  );
  const celebrated = useMemo(() => {
    if (!celebrate) return null;
    const activeOnes = memberships.filter((m) => m.status === 'ACTIVE');
    return (
      (celebrate.planName ? activeOnes.find((m) => m.planName === celebrate.planName) : null) ??
      activeOnes[0] ??
      null
    );
  }, [celebrate, memberships]);
  const pass = usePassToken(active?.id ?? null, Boolean(active));

  useEffect(() => {
    if (!historyOpen) return;
    const t = setTimeout(() => {
      panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
    return () => clearTimeout(t);
  }, [historyOpen]);

  useEffect(() => {
    if (!active) {
      setFlipped(false);
      setHistoryOpen(false);
      setUsage([]);
    }
  }, [active]);

  useEffect(() => {
    if (!historyOpen || !active) return;
    let alive = true;
    setUsageLoading(true);
    PlatformBridge.getAuthHeaders()
      .then((headers) => fetch(`/api/memberships/${active.id}/usage`, { headers, cache: 'no-store' }))
      .then((res) => res.json())
      .then((data) => { if (alive && data.success) setUsage(data.usages ?? []); })
      .catch((err) => console.error('[Memberships] usage error:', err))
      .finally(() => { if (alive) setUsageLoading(false); });
    return () => { alive = false; };
  }, [historyOpen, active]);

  return (
    <ProfileSubpageLayout title="Mis Membresías">
      <div className="mb-4 flex rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-1">
        <button
          type="button"
          onClick={() => { setTab('mine'); PlatformBridge.hapticFeedback('light'); }}
          className={`flex-1 rounded-xl py-2.5 text-[12px] font-extrabold transition-all ${
            tab === 'mine' ? 'bg-[#E91E63] text-white shadow-[0_4px_14px_rgba(233,30,99,.35)]' : 'text-(--text-muted)'
          }`}
        >
          Mis pases
        </button>
        <button
          type="button"
          onClick={() => { setTab('discover'); PlatformBridge.hapticFeedback('light'); }}
          className={`flex-1 rounded-xl py-2.5 text-[12px] font-extrabold transition-all ${
            tab === 'discover' ? 'bg-[#E91E63] text-white shadow-[0_4px_14px_rgba(233,30,99,.35)]' : 'text-(--text-muted)'
          }`}
        >
          Descubrir
        </button>
      </div>

      {tab === 'discover' ? (
        <MembershipMarketplace />
      ) : loading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" /></div>
      ) : memberships.length === 0 ? (
        <EmptyState icon={<div className="text-[32px]">🎟️</div>} title="Sin membresías" description="Cuando te suscribas a un plan de un negocio, tu pase aparecerá aquí." />
      ) : (
        <div className="flex flex-col gap-3">
          {memberships.map((m, i) => {
            const activeStatus = m.status === 'ACTIVE';
            const isCourtesy = m.membershipOrigin === 'COURTESY' || m.membershipOrigin === 'INVITATION';
            const accent = m.badgeColor || (isCourtesy ? '#A855F7' : '#E91E63');
            return (
              <motion.button
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setActive(m)}
                className="w-full text-left rounded-2xl overflow-hidden cursor-pointer"
                style={{
                  border: `1px solid ${activeStatus ? accent + '55' : 'rgba(255,255,255,.08)'}`,
                  background: 'linear-gradient(135deg, rgba(255,255,255,.045), rgba(255,255,255,.015))',
                }}
              >
                <div className="flex gap-3 p-3">
                  <div className="w-[122px] shrink-0">
                    <MembershipCard data={cardData(m, memberName)} preview />
                  </div>
                  <div className="min-w-0 flex-1 py-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[15px] font-extrabold text-(--text-primary) truncate">{m.planName || 'Membresía'}</p>
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-full shrink-0"
                        style={{
                          background: activeStatus ? 'rgba(76,175,80,.15)' : 'rgba(239,68,68,.15)',
                          color: activeStatus ? '#4CAF50' : '#F87171',
                        }}
                      >
                        {m.status === 'REVOKED' ? 'Revocada' : STATUS_LABEL[m.status] ?? m.status}
                      </span>
                    </div>
                    <p className="text-[12px] text-(--text-muted) mt-0.5 truncate">{m.businessName}</p>
                    <p className="text-[12px] text-(--text-muted) mt-1">
                      {m.noExpiration ? '♾️ Vigencia indefinida' : m.currentPeriodEnd ? `Vigente hasta ${new Date(m.currentPeriodEnd).toLocaleDateString('es-MX')}` : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.entitlements.slice(0, 3).map((e) => (
                        <span key={e.id} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,.06)', color: 'var(--text-secondary)' }}>
                          {BENEFIT_LABEL[e.benefitType] ?? e.benefitType}
                        </span>
                      ))}
                    </div>
                    <p className="text-[11px] font-bold mt-2" style={{ color: accent }}>Abrir pase →</p>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* ── Fullscreen: tarjeta animada + QR al reverso ── */}
      <AnimatePresence>
        {active && activeCard && (
          <motion.div
            className="fixed inset-0 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setActive(null)} />

            {/* Navegación fija: siempre visible */}
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                onClick={() => setActive(null)}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.07] px-3 py-2 text-[11px] font-bold text-white/70 backdrop-blur-md active:scale-95 transition-all"
                aria-label="Volver"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 18l-6-6 6-6" />
                </svg>
                Volver
              </button>
            </div>

            {/* Contenido desplazable; el wrapper con my-auto centra cuando cabe */}
            <div className="relative h-full overflow-y-auto overscroll-contain">
              <div className="min-h-full flex flex-col items-center px-4 pt-20 pb-[max(2rem,env(safe-area-inset-bottom))]">
                <div className="flex w-full flex-col items-center">
              <motion.div
                drag="y"
                dragListener={false}
                dragControls={dragControls}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.55 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 110 || info.velocity.y > 700) setActive(null);
                }}
                whileDrag={{ scale: 0.985 }}
                initial={{ scale: 0.92, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.94, y: 16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                className="w-[min(82vw,370px)]"
              >
                <div
                  className="mb-2 flex cursor-grab touch-none justify-center px-8 py-1 active:cursor-grabbing"
                  onPointerDown={(e) => dragControls.start(e)}
                >
                  <span className="h-1 w-10 rounded-full bg-white/25" />
                </div>
                <MembershipCard
                  data={activeCard}
                  flipped={flipped}
                  onFlip={() => setFlipped((v) => !v)}
                  qr={
                    pass.error ? (
                      <span className="text-[11px] text-center" style={{ color: '#6B5568' }}>{pass.error}</span>
                    ) : pass.token ? (
                      <QRCodeSVG value={pass.token} size={220} level="M" />
                    ) : (
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
                    )
                  }
                />
              </motion.div>

              <button
                onClick={() => setFlipped((v) => !v)}
                className="text-[12px] text-white/60 mt-3 underline-offset-4 hover:underline"
              >
                {flipped ? 'Toca para volver al frente' : 'Toca la tarjeta para ver tu QR'}
                {flipped && pass.token ? ` · se renueva en ${pass.seconds}s` : ''}
              </button>

              {/* Historial + beneficios en un solo panel desplegable */}
              <div className="w-[min(82vw,370px)] mt-3">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  aria-expanded={historyOpen}
                  aria-controls="membership-info-panel"
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-[12px] font-bold text-white/80 cursor-pointer hover:bg-white/[.07] active:scale-[0.99] transition-all"
                >
                  <span>Historial y beneficios</span>
                  <span className="text-white/40">{historyOpen ? '▲' : '▼'}</span>
                </button>
                {historyOpen && (
                  <div
                    ref={panelRef}
                    id="membership-info-panel"
                    className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3 max-h-[42vh] overflow-y-auto overscroll-contain space-y-4"
                  >
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-2">Beneficios de este ciclo</p>
                      <div className="space-y-2.5">
                        {active.entitlements.map((e) => {
                          const left = Math.max(0, e.quotaPerCycle - e.used);
                          const pct = Math.min(100, Math.round((e.used / Math.max(1, e.quotaPerCycle)) * 100));
                          return (
                            <div key={e.id}>
                              <div className="flex items-center justify-between text-[12px] text-white/85 mb-1">
                                <span className="font-semibold">
                                  {BENEFIT_LABEL[e.benefitType] ?? e.benefitType}{e.discountPct ? ` ${e.discountPct}%` : ''}
                                </span>
                                <span className="text-white/45">{left}/{e.quotaPerCycle} · {RESET_LABEL[e.cycleResetType] ?? ''}</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden bg-white/10">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${active.badgeColor || '#E91E63'}, #FF2E93)` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-white/50 mb-2">Últimos usos</p>
                      {usageLoading ? (
                        <div className="flex justify-center py-3"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500" /></div>
                      ) : usage.length === 0 ? (
                        <p className="text-[12px] text-white/45 text-center py-2">Todavía no hay usos registrados.</p>
                      ) : (
                        <ul className="space-y-2">
                          {usage.map((u) => (
                            <li key={u.id} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="text-white/80">
                                {BENEFIT_LABEL[u.benefitType] ?? u.benefitType}
                                {u.orderId ? <span className="text-white/35"> · #{u.orderId.slice(0, 6)}</span> : null}
                              </span>
                              <span className="text-white/35 shrink-0">
                                {new Date(u.redeemedAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
              </div>
                </div>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activating && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/85 p-6 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-[#E91E63]/25 bg-[#120B1D] p-7 text-center shadow-[0_0_50px_rgba(233,30,99,.25)]">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#E91E63]/25 border-t-[#E91E63]" />
            <p className="mt-4 text-[15px] font-black text-white">Activando tu pase…</p>
            <p className="mt-1 text-[12px] text-white/45">Esto puede tardar unos segundos mientras Stripe confirma el pago.</p>
          </div>
        </div>
      )}

      <AnimatePresence>
        {celebrate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[140] overflow-y-auto bg-[#070308]"
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#E91E63]/25 blur-3xl" />
              <div className="absolute -right-20 bottom-10 h-56 w-56 rounded-full bg-[#7C3AED]/20 blur-3xl" />
              {Array.from({ length: 18 }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ y: -30, opacity: 1 }}
                  animate={{ y: 360, opacity: 0 }}
                  transition={{ duration: 1.7, delay: i * 0.04, ease: 'easeIn' }}
                  style={{
                    position: 'absolute',
                    left: `${(i * 53) % 100}%`,
                    top: '16%',
                    width: 6,
                    height: 10,
                    borderRadius: 2,
                    background: ['#E91E63', '#FFD700', '#A855F7', '#22D3EE'][i % 4],
                  }}
                />
              ))}
            </div>

            <div className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 py-10">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#FF5FA8]">BIENVENIDO A</p>
              <h2 className="mt-1 text-center text-[26px] font-black leading-tight text-white">
                {celebrate.planName || 'Tu membresía'}
              </h2>
              <div className="mt-5 w-[min(84vw,360px)]">
                <MembershipCard
                  preview
                  data={
                    celebrated
                      ? cardData(celebrated, memberName)
                      : {
                          planName: celebrate.planName || 'Tu membresía',
                          businessName: 'Rabbitty',
                          branchLabel: 'Miembro',
                          validityLabel: 'Activa',
                          membersLabel: 'Miembro',
                          transferableLabel: 'Intransferible',
                          tagline: 'Bienvenido a Rabbitty',
                          accentColor: '#FF2D95',
                        }
                  }
                />
              </div>
              <p className="mt-5 text-center text-[13px] text-white/55">Tu pase ya está activo. Muéstralo en caja cuando lo necesites.</p>
              <button
                type="button"
                onClick={() => { setCelebrate(null); setTab('mine'); }}
                className="mt-5 w-[min(84vw,360px)] rounded-2xl bg-gradient-to-r from-[#E91E63] to-[#FF2E93] py-3.5 text-[14px] font-black text-white shadow-[0_12px_30px_-12px_rgba(233,30,99,.7)] active:scale-[0.98]"
              >
                Ver mi pase
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </ProfileSubpageLayout>
  );
}
