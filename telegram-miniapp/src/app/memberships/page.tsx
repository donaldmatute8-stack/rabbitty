'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
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
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  planName: string;
  badgeColor: string;
  businessName: string;
  priceFiat: number;
  currency: string;
  billingInterval: string;
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
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

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
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-(--bg-elevated) rounded-2xl border border-(--border-subtle) overflow-hidden"
              >
                <button onClick={() => toggle(m.id)} className="w-full text-left p-4 cursor-pointer" style={{ borderLeft: `4px solid ${m.badgeColor}` }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[16px] font-extrabold text-(--text-primary)">{m.planName}</p>
                      <p className="text-[12px] text-(--text-muted)">{m.businessName}</p>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full" style={{ background: active ? 'rgba(76,175,80,.15)' : 'rgba(233,30,99,.15)', color: active ? '#4CAF50' : '#E91E63' }}>
                      {STATUS_LABEL[m.status] ?? m.status}
                    </span>
                  </div>
                  <p className="text-[12px] text-(--text-muted) mt-2">
                    {m.cancelAtPeriodEnd ? 'Termina' : 'Vigente hasta'} el {new Date(m.currentPeriodEnd).toLocaleDateString()}
                  </p>
                </button>

                <AnimatePresence initial={false}>
                  {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="px-4 pb-4">
                      <ul className="flex flex-col gap-2 mb-2">
                        {m.entitlements.map((e) => {
                          const left = Math.max(0, e.quotaPerCycle - e.used);
                          return (
                            <li key={e.id} className="flex items-center justify-between text-[13px] text-(--text-primary)">
                              <span>{BENEFIT_LABEL[e.benefitType] ?? e.benefitType}{e.discountPct ? ` ${e.discountPct}%` : ''}</span>
                              <span className="text-(--text-muted)">{left}/{e.quotaPerCycle} {RESET_LABEL[e.cycleResetType] ?? ''}</span>
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

