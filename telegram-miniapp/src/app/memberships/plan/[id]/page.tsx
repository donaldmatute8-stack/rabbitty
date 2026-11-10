'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { BadgeCheck, Check, Crown, Gift, Loader2, Share2, ShieldCheck, Sparkles } from 'lucide-react';
import { MembershipCard } from '@rabbitty/ui';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { PremiumCard, PremiumSection } from '@/components/premium/PremiumUI';
import { PlatformBridge } from '@/lib/platform';
import { useAuth } from '@/features/auth/AuthProvider';

type Plan = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  coverImageUrl?: string | null;
  badgeColor?: string | null;
  category?: string | null;
  tags?: string[];
  cardNiche?: string | null;
  cardDetail?: string | null;
  cardTagline?: string | null;
  businessId: string;
  businessName: string;
  businessLogoUrl?: string | null;
  businessCategory?: string | null;
  businessDescription?: string | null;
  versionId: string;
  priceFiat: number;
  currency: string;
  billingInterval: string;
  trialDays: number;
  benefits: Array<{ type: string; quotaPerCycle?: number; discountPct?: number | null }>;
  maxMembersLimit?: number | null;
  memberCount: number;
  featured: boolean;
  foundingSlots?: number | null;
  foundingAvailable: boolean;
  alreadySubscribed: boolean;
};

const INTERVAL_LABEL: Record<string, string> = {
  MONTHLY: 'mes',
  QUARTERLY: 'trimestre',
  SEMIANNUAL: 'semestre',
  ANNUAL: 'año',
  ONE_TIME: 'pago único',
};

const BENEFIT_LABEL: Record<string, string> = {
  MEMBER_CONSUMPTION: 'Consumo del socio',
  DISCOUNT_PCT: 'Descuento',
  INCLUDED_PRODUCT: 'Producto incluido',
  CREDIT_BALANCE: 'Crédito',
  EVENT_ACCESS: 'Acceso a evento',
  BULK_PACK: 'Bolsa de consumos',
};

function price(plan: Plan) {
  if (plan.priceFiat <= 0) return 'Gratis';
  const amount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: plan.currency || 'MXN',
    maximumFractionDigits: 0,
  }).format(plan.priceFiat);
  return `${amount} / ${INTERVAL_LABEL[plan.billingInterval] ?? 'mes'}`;
}

export default function MembershipPlanPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const ref = searchParams.get('ref') || '';
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftMessage, setGiftMessage] = useState('');
  const [gifting, setGifting] = useState(false);
  const [giftResult, setGiftResult] = useState('');

  useEffect(() => {
    let alive = true;
    if (!params?.id) return;
    setLoading(true);
    PlatformBridge.getAuthHeaders()
      .then((headers) => fetch(`/api/memberships/plans/${params.id}`, { headers, cache: 'no-store' }))
      .then((res) => res.json())
      .then((data) => {
        if (!alive) return;
        if (data.success) setPlan(data.plan);
        else setError(data.error || 'No se encontró la membresía');
      })
      .catch(() => { if (alive) setError('No se pudo cargar la membresía'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [params?.id]);

  const joinFree = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/memberships/join-free', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planVersionId: plan.versionId, ref }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo activar');
      PlatformBridge.hapticFeedback('success');
      router.push(`/memberships?joined=1&plan=${encodeURIComponent(plan.name)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo activar');
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    if (!plan) return;
    setBusy(true);
    setError(null);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/memberships/checkout', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ planVersionId: plan.versionId, source: 'MARKETPLACE', ref }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'No se pudo iniciar el pago');
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar el pago');
      setBusy(false);
    }
  };

  const sharePlan = async () => {
    if (!plan) return;
    const url = `https://app.rabbitty.me/memberships/plan/${plan.id}${user?.id ? `?ref=${user.id}` : ''}`;
    const shared = await PlatformBridge.share({
      title: plan.name,
      text: `Te invito a ${plan.name} en ${plan.businessName}`,
      url,
    });
    if (!shared) {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const sendGift = async () => {
    if (!plan || !giftRecipient.trim()) return;
    setGifting(true);
    setGiftResult('');
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/memberships/gift', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planVersionId: plan.versionId,
          recipient: giftRecipient.trim(),
          message: giftMessage.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'No se pudo enviar el regalo');
      setGiftResult(`🎁 Regalo enviado a ${data.recipientName}`);
      setGiftRecipient('');
      setGiftMessage('');
    } catch (e) {
      setGiftResult(e instanceof Error ? e.message : 'No se pudo enviar el regalo');
    } finally {
      setGifting(false);
    }
  };

  if (loading) {
    return (
      <ProfileSubpageLayout title="Membresía">
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#E91E63]" /></div>
      </ProfileSubpageLayout>
    );
  }

  if (!plan) {
    return (
      <ProfileSubpageLayout title="Membresía">
        <PremiumCard><p className="p-6 text-center text-[13px] text-(--text-muted)">{error || 'Membresía no encontrada'}</p></PremiumCard>
      </ProfileSubpageLayout>
    );
  }

  return (
    <ProfileSubpageLayout title="Membresía">
      <div className="space-y-4 pb-6">
        <div className="mx-auto w-[min(80vw,350px)]">
          <MembershipCard
            preview
            data={{
              planName: plan.name,
              businessName: plan.businessName,
              branchLabel: `Solo en ${plan.businessName}`,
              validityLabel: price(plan),
              membersLabel: plan.maxMembersLimit ? `Hasta ${plan.maxMembersLimit} miembros` : 'Miembros ilimitados',
              transferableLabel: 'Intransferible',
              tagline: plan.cardTagline || 'Una membresía, más beneficios',
              niche: plan.cardNiche,
              detail: plan.cardDetail,
              heroImageUrl: plan.coverImageUrl,
              accentColor: plan.badgeColor,
            }}
          />
        </div>

        <div className="text-center">
          <div className="flex flex-wrap items-center justify-center gap-1.5">
            {plan.featured && (
              <span className="rounded-full border border-[#E91E63]/30 bg-[#E91E63]/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#FF7DBB]">
                <Sparkles size={9} className="mr-1 inline" /> Destacada
              </span>
            )}
            {plan.foundingAvailable && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-300">
                <Crown size={9} className="mr-1 inline" /> Miembro fundador
              </span>
            )}
            {plan.alreadySubscribed && (
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-emerald-300">
                Ya eres miembro
              </span>
            )}
          </div>
          <p className="mt-2 text-[12px] text-(--text-muted)">
            {plan.businessName} · {plan.memberCount} miembros
          </p>
        </div>

        <div className="flex justify-center">
          <button
            type="button"
            onClick={sharePlan}
            className="flex items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-elevated) px-3 py-1.5 text-[10px] font-bold text-(--text-muted)"
          >
            <Share2 size={12} /> Invitar a un amigo
          </button>
        </div>

        <PremiumSection title="Qué incluye">
          <PremiumCard>
            <div className="divide-y divide-(--border-subtle)">
              {(plan.benefits ?? []).map((b, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E91E63]/12 text-[#E91E63]">
                    <Check size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-extrabold text-(--text-primary)">
                      {BENEFIT_LABEL[b.type] ?? b.type}
                      {b.discountPct ? ` · ${b.discountPct}%` : ''}
                    </p>
                    <p className="text-[10px] text-(--text-muted)">
                      {b.quotaPerCycle ? `${b.quotaPerCycle} por ciclo` : 'Beneficio de la membresía'}
                    </p>
                  </div>
                </div>
              ))}
              {(!plan.benefits || plan.benefits.length === 0) && (
                <p className="px-4 py-4 text-[12px] text-(--text-muted)">Este plan aún no detalla beneficios.</p>
              )}
            </div>
          </PremiumCard>
        </PremiumSection>

        <PremiumSection title="Cómo funciona">
          <PremiumCard>
            <div className="space-y-2 p-4 text-[11px] text-(--text-muted)">
              <p className="flex items-start gap-2"><ShieldCheck size={14} className="mt-0.5 shrink-0 text-[#E91E63]" /> Pago seguro con Stripe. Apple Pay y Google Pay disponibles.</p>
              <p className="flex items-start gap-2"><BadgeCheck size={14} className="mt-0.5 shrink-0 text-[#E91E63]" /> Tu pase se activa al confirmar el pago y vive en Mis Membresías.</p>
              <p className="flex items-start gap-2"><Gift size={14} className="mt-0.5 shrink-0 text-[#E91E63]" /> Cancela cuando quieras; conservas el acceso hasta el final del periodo.</p>
            </div>
          </PremiumCard>
        </PremiumSection>

        {error && (
          <p className="rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-300">{error}</p>
        )}

        <div className="sticky bottom-[calc(92px+env(safe-area-inset-bottom))] z-20 -mx-4 bg-gradient-to-t from-[#070308] via-[#070308]/95 to-transparent px-4 pb-2 pt-4">
          {plan.alreadySubscribed ? (
            <button
              type="button"
              onClick={() => router.push('/memberships')}
              className="w-full rounded-2xl border border-emerald-400/25 bg-emerald-400/15 py-3.5 text-[13px] font-black text-emerald-300"
            >
              Ver mi pase
            </button>
          ) : plan.priceFiat <= 0 ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={joinFree}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E91E63] to-[#FF2E93] py-3.5 text-[14px] font-black text-white shadow-[0_12px_30px_-12px_rgba(233,30,99,.7)] disabled:opacity-60"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Gift size={16} />} Unirme gratis
              </button>
              <button
                type="button"
                onClick={() => { setGiftOpen(true); setGiftResult(''); }}
                className="rounded-2xl border border-[#E91E63]/30 bg-[#E91E63]/10 px-4 text-[12px] font-black text-[#FF7DBB]"
              >
                Regalar
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={checkout}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#E91E63] to-[#FF2E93] py-3.5 text-[14px] font-black text-white shadow-[0_12px_30px_-12px_rgba(233,30,99,.7)] disabled:opacity-60"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {plan.trialDays > 0 ? `Empezar ${plan.trialDays} días gratis` : `Hacerme miembro · ${price(plan)}`}
            </button>
          )}
          {plan.trialDays > 0 && plan.priceFiat > 0 && !plan.alreadySubscribed && (
            <p className="mt-1.5 text-center text-[10px] text-(--text-muted)">Luego {price(plan)}. Cancela cuando quieras.</p>
          )}
        </div>
      </div>

      {giftOpen && (
        <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-4 backdrop-blur-md sm:items-center" onClick={() => setGiftOpen(false)}>
          <div className="w-full max-w-sm rounded-3xl border border-[#E91E63]/25 bg-[#120B1D] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-[#FF5FA8]">REGALAR</p>
                <h3 className="mt-0.5 text-lg font-black text-white">{plan.name}</h3>
              </div>
              <button onClick={() => setGiftOpen(false)} className="text-white/50" aria-label="Cerrar">✕</button>
            </div>
            <p className="mt-2 text-[11px] text-white/50">Le enviaremos el pase directamente a su cuenta. Sin costo para ti.</p>
            <input
              className="mt-3 w-full rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/30"
              placeholder="@handle, teléfono o ID"
              value={giftRecipient}
              onChange={(e) => setGiftRecipient(e.target.value)}
            />
            <textarea
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/[.05] px-3 py-2.5 text-[12px] text-white outline-none placeholder:text-white/30"
              rows={2}
              placeholder="Mensaje (opcional)"
              value={giftMessage}
              onChange={(e) => setGiftMessage(e.target.value)}
            />
            {giftResult && <p className="mt-2 text-[11px] text-[#FF7DBB]">{giftResult}</p>}
            <button
              type="button"
              onClick={sendGift}
              disabled={gifting || !giftRecipient.trim()}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-[#E91E63] to-[#FF2E93] py-3 text-[13px] font-black text-white disabled:opacity-50"
            >
              {gifting ? 'Enviando…' : 'Enviar regalo'}
            </button>
          </div>
        </div>
      )}
    </ProfileSubpageLayout>
  );
}
