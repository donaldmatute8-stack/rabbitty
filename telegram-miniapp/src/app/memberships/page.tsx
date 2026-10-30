'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';

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
  badgeColor: string | null;
  businessName: string;
  priceFiat: number | null;
  currency: string | null;
  billingInterval: string | null;
  entitlements: Entitlement[];
}

const BENEFIT_LABEL: Record<string, string> = {
  INCLUDED_PRODUCT: 'Producto incluido',
  DISCOUNT_PCT: 'Descuento',
  CREDIT_BALANCE: 'Crédito',
  EVENT_ACCESS: 'Acceso a evento',
  BULK_PACK: 'Bolsa de consumos',
};
const RESET_LABEL: Record<string, string> = { DAILY: 'hoy', WEEKLY: 'esta semana', MONTHLY: 'este mes', FIXED: 'en total' };
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activa', PAST_DUE: 'Pago pendiente', GRACE_PERIOD: 'Periodo de gracia', CANCELLED: 'Cancelada', EXPIRED: 'Vencida',
};

function PassQr({ membershipId }: { membershipId: string }) {
  const [token, setToken] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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

  // Primer token y refresco justo cuando expira la ventana de 30s.
  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  useEffect(() => {
    if (!token) return;
    const tick = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) { load(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [token, load]);

  if (error) return <p className="text-[13px] text-[#E91E63] text-center py-4">{error}</p>;
  if (!token) return <div className="flex justify-center p-6"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" /></div>;

  return (
    <div className="flex flex-col items-center gap-2 py-3">
      <div className="bg-white p-3 rounded-2xl">
        <QRCodeSVG value={token} size={196} level="M" />
      </div>
      <p className="text-[12px] text-(--text-muted)">Muéstralo en caja · se renueva en {seconds}s</p>
    </div>
  );
}

export default function MembershipsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

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
      showToast('Pago cancelado. Puedes intentarlo de nuevo.', 'info');
      if (typeof window !== 'undefined') window.history.replaceState({}, '', '/memberships');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
    PlatformBridge.getAuthHeaders()
      .then((headers) => fetch('/api/memberships', { headers }))
      .then((res) => res.json())
      .then((data) => { if (active && data.success) setMemberships(data.memberships); })
      .catch((err) => console.error('[Memberships] fetch error:', err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.id]);

  const toggle = (id: string) => {
    PlatformBridge.hapticFeedback('light');
    setOpenId((cur) => (cur === id ? null : id));
  };

  return (
    <ProfileSubpageLayout title="Mis Membresías">
      {loading ? (
        <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" /></div>
      ) : memberships.length === 0 ? (
        <EmptyState icon={<div className="text-[32px]">🎟️</div>} title="Sin membresías" description="Cuando te suscribas a un plan de un negocio, tu pase aparecerá aquí." />
      ) : (
        <div className="flex flex-col gap-3">
          {memberships.map((m, i) => {
            const active = m.status === 'ACTIVE';
            const open = openId === m.id;
            const isCourtesy = m.membershipOrigin === 'COURTESY';
            const accent = m.badgeColor || (isCourtesy ? '#A855F7' : '#E91E63');
            const gradient = isCourtesy
              ? `linear-gradient(135deg, rgba(168,85,247,.14) 0%, rgba(233,30,99,.10) 100%)`
              : `linear-gradient(135deg, rgba(233,30,99,.10) 0%, rgba(168,85,247,.06) 100%)`;
            const planTitle = isCourtesy ? 'Cortesía' : (m.planName || 'Membresía');
            const daysLeft = m.currentPeriodEnd ? Math.max(0, Math.ceil((new Date(m.currentPeriodEnd).getTime() - Date.now()) / 86400000)) : null;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl overflow-hidden"
                style={{ border: `1px solid ${active ? accent + '55' : 'rgba(255,255,255,.08)'}`, background: gradient, boxShadow: open ? `0 8px 32px ${accent}22` : 'none' }}
              >
                <button onClick={() => toggle(m.id)} className="w-full text-left p-4 cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[16px] font-extrabold text-(--text-primary)">{planTitle}</p>
                        {isCourtesy && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(168,85,247,.2)', color: '#C084FC' }}>
                            🎁 CORTESÍA
                          </span>
                        )}
                        {m.membershipOrigin === 'PURCHASED' && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(233,30,99,.15)', color: '#F472B6' }}>
                            ★ MI PLAN
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] text-(--text-muted) mt-0.5">{m.businessName}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0" style={{ background: active ? 'rgba(76,175,80,.15)' : m.status === 'REVOKED' ? 'rgba(239,68,68,.15)' : 'rgba(233,30,99,.15)', color: active ? '#4CAF50' : m.status === 'REVOKED' ? '#F87171' : '#E91E63' }}>
                      {m.status === 'REVOKED' ? 'Revocada' : STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </div>
                  {m.giftNote && (
                    <p className="text-[12px] italic mt-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,.05)', borderLeft: `2px solid ${accent}` }}>
                      "{m.giftNote}"
                    </p>
                  )}
                  <p className="text-[12px] text-(--text-muted) mt-2">
                    {m.status === 'REVOKED'
                      ? 'Esta membresía fue revocada'
                      : m.noExpiration
                        ? '♾️ Vigencia indefinida'
                        : m.currentPeriodEnd
                          ? `${m.cancelAtPeriodEnd ? 'Termina' : 'Vigente hasta'} el ${new Date(m.currentPeriodEnd).toLocaleDateString()}${daysLeft !== null && active ? ` · ${daysLeft} día${daysLeft !== 1 ? 's' : ''}` : ''}`
                          : ''}
                  </p>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4">
                      <ul className="flex flex-col gap-2.5 mb-2">
                        {m.entitlements.map((e) => {
                          const left = Math.max(0, e.quotaPerCycle - e.used);
                          const pct = Math.min(100, Math.round((e.used / Math.max(1, e.quotaPerCycle)) * 100));
                          return (
                            <li key={e.id}>
                              <div className="flex items-center justify-between text-[13px] text-(--text-primary) mb-1">
                                <span className="font-semibold">{BENEFIT_LABEL[e.benefitType] ?? e.benefitType}{e.discountPct ? ` ${e.discountPct}%` : ''}</span>
                                <span className="text-(--text-muted)">{left}/{e.quotaPerCycle} · {RESET_LABEL[e.cycleResetType] ?? ''}</span>
                              </div>
                              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,.08)' }}>
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${accent}, #FF2E93)` }} />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {active ? <PassQr membershipId={m.id} /> : <p className="text-[12px] text-(--text-muted) text-center py-3">Este pase no está vigente.</p>}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </ProfileSubpageLayout>
  );
}

