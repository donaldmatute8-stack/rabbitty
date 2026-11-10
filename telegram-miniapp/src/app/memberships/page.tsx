'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';
import { MembershipCard } from '@rabbitty/ui';

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

  // Post-checkout Stripe (?checkout=success|cancelled) → toast + recarga
  useEffect(() => {
    const q = typeof window !== 'undefined' ? window.location.search : '';
    if (q.includes('checkout=success')) {
      showToast('🎉 ¡Pago confirmado! Tu membresía ya está activa', 'success');
      if (typeof window !== 'undefined') {
        window.history.replaceState({}, '', '/memberships');
        const t = setTimeout(() => window.location.reload(), 1200);
        return () => clearTimeout(t);
      }
    }
    if (q.includes('checkout=cancelled')) {
      showToast('Pago cancelado', 'error');
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/memberships');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    if (!user?.id) return;
    PlatformBridge.getAuthHeaders()
      .then((headers) => fetch('/api/memberships', { headers }))
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        if (data.success) {
          setMemberships(data.memberships ?? []);
          setMemberName(data.memberName ?? null);
        }
      })
      .catch((err) => console.error('[Memberships] fetch error:', err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [user?.id]);

  const activeCard = useMemo(
    () => (active ? cardData(active, memberName) : null),
    [active, memberName],
  );
  const pass = usePassToken(active?.id ?? null, Boolean(active));

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
      {loading ? (
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
            className="fixed inset-0 z-[100] overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0 bg-black/85 backdrop-blur-md" onClick={() => setActive(null)} />
            <div className="relative min-h-full flex flex-col items-center justify-center p-4 py-8">
              <button
                onClick={() => setActive(null)}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center"
                aria-label="Cerrar"
              >
                ✕
              </button>

              <motion.div
                initial={{ scale: 0.92, y: 24, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.94, y: 16, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 160, damping: 20 }}
                className="w-[min(92vw,420px)]"
              >
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

              {/* Historial integrado: se despliega hacia abajo */}
              <div className="w-[min(92vw,420px)] mt-3">
                <button
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[.04] px-3 py-2.5 text-[12px] font-bold text-white/80"
                >
                  <span>Historial de uso</span>
                  <span className="text-white/40">{historyOpen ? '▲' : '▼'}</span>
                </button>
                {historyOpen && (
                  <div className="mt-2 rounded-2xl border border-white/10 bg-black/30 p-3 max-h-[220px] overflow-y-auto">
                    {usageLoading ? (
                      <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500" /></div>
                    ) : usage.length === 0 ? (
                      <p className="text-[12px] text-white/45 text-center py-3">Todavía no hay usos registrados.</p>
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
                )}
              </div>

              {/* Beneficios del ciclo */}
              <div className="w-[min(92vw,420px)] mt-4 rounded-2xl border border-white/10 bg-white/[.035] p-3 space-y-2.5">
                <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Beneficios de este ciclo</p>
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
          </motion.div>
        )}
      </AnimatePresence>
    </ProfileSubpageLayout>
  );
}
