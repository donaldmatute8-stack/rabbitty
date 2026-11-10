'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Gift, Search, Sparkles } from 'lucide-react';
import { MembershipCard } from '@rabbitty/ui';
import { PlatformBridge } from '@/lib/platform';
import { PremiumHero } from '@/components/premium/PremiumUI';

type Benefit = { type: string; quotaPerCycle?: number; discountPct?: number | null };

export interface MarketPlan {
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
  versionId: string;
  priceFiat: number;
  currency: string;
  billingInterval: string;
  trialDays: number;
  benefits: Benefit[];
  maxMembersLimit?: number | null;
  memberCount: number;
  featured: boolean;
  foundingSlots?: number | null;
  foundingAvailable: boolean;
  alreadySubscribed: boolean;
}

const INTERVAL_LABEL: Record<string, string> = {
  MONTHLY: 'mes',
  QUARTERLY: 'trimestre',
  SEMIANNUAL: 'semestre',
  ANNUAL: 'año',
  ONE_TIME: 'único',
};

const CATEGORY_LABEL: Record<string, string> = {
  cafe: 'Café',
  restaurant: 'Restaurante',
  gym: 'Gym',
  bakery: 'Panadería',
  bar: 'Bar',
  beauty: 'Belleza',
  retail: 'Retail',
  other: 'Otros',
};

const BENEFIT_LABEL: Record<string, string> = {
  MEMBER_CONSUMPTION: 'Consumo del socio',
  DISCOUNT_PCT: 'Descuento',
  INCLUDED_PRODUCT: 'Producto incluido',
  CREDIT_BALANCE: 'Crédito',
  EVENT_ACCESS: 'Acceso a evento',
  BULK_PACK: 'Bolsa de consumos',
};

function priceLabel(plan: MarketPlan) {
  if (plan.priceFiat <= 0) return 'Gratis';
  const amount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: plan.currency || 'MXN',
    maximumFractionDigits: 0,
  }).format(plan.priceFiat);
  return `${amount} / ${INTERVAL_LABEL[plan.billingInterval] ?? 'mes'}`;
}

function cardData(plan: MarketPlan) {
  return {
    planName: plan.name,
    businessName: plan.businessName,
    branchLabel: `Solo en ${plan.businessName}`,
    validityLabel: priceLabel(plan),
    membersLabel: plan.maxMembersLimit ? `Hasta ${plan.maxMembersLimit} miembros` : 'Miembros ilimitados',
    transferableLabel: 'Intransferible',
    tagline: plan.cardTagline || 'Una membresía, más beneficios',
    niche: plan.cardNiche,
    detail: plan.cardDetail,
    heroImageUrl: plan.coverImageUrl,
    accentColor: plan.badgeColor,
  };
}

export default function MembershipMarketplace({
  businessId,
  compact = false,
  onOpen,
}: {
  businessId?: string;
  compact?: boolean;
  onOpen?: (plan: MarketPlan) => void;
}) {
  const router = useRouter();
  const [plans, setPlans] = useState<MarketPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    PlatformBridge.getAuthHeaders()
      .then((headers) => {
        const qs = new URLSearchParams();
        if (businessId) qs.set('businessId', businessId);
        return fetch(`/api/memberships/marketplace?${qs.toString()}`, { headers, cache: 'no-store' });
      })
      .then((res) => res.json())
      .then((data) => {
        if (alive && data.success) setPlans(data.plans ?? []);
      })
      .catch((err) => console.error('[Marketplace] fetch error:', err))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [businessId]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    plans.forEach((p) => { if (p.category) set.add(p.category); });
    return ['Todas', 'Gratis', ...Array.from(set)];
  }, [plans]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plans.filter((p) => {
      if (category === 'Gratis' && p.priceFiat > 0) return false;
      if (category !== 'Todas' && category !== 'Gratis' && p.category !== category) return false;
      if (q && !`${p.name} ${p.businessName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [plans, query, category]);

  const featured = useMemo(
    () => filtered.filter((p) => p.featured).slice(0, 6),
    [filtered],
  );

  const open = (plan: MarketPlan) => {
    PlatformBridge.hapticFeedback('light');
    if (onOpen) onOpen(plan);
    else router.push(`/memberships/plan/${plan.id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-pink-500" />
      </div>
    );
  }

  if (compact) {
    if (plans.length === 0) return null;
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-(--text-muted)">Membresías</p>
          <span className="text-[10px] font-bold text-[#E91E63]">{plans.length} planes</span>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => open(plan)}
              className="w-[240px] shrink-0 rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-3 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-2">
                {plan.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={plan.coverImageUrl} alt="" className="h-12 w-12 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#E91E63]/15 text-[#E91E63]">
                    <BadgeCheck size={20} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-black text-(--text-primary)">{plan.name}</p>
                  <p className="truncate text-[10px] text-(--text-muted)">{plan.businessName}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[12px] font-black text-[#E91E63]">{priceLabel(plan)}</span>
                <span className="text-[10px] font-bold text-(--text-muted)">
                  {plan.alreadySubscribed ? 'Ya eres miembro' : plan.foundingAvailable ? 'Fundador' : 'Ver'}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PremiumHero
        icon={Sparkles}
        eyebrow="DESCUBRIR"
        title="Membresías que abren puertas"
        subtitle="Beneficios reales en tus lugares favoritos"
      >
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar negocio o membresía…"
            className="w-full rounded-xl border border-white/10 bg-white/[.06] py-2.5 pl-9 pr-3 text-[12px] text-white outline-none placeholder:text-white/35"
          />
        </div>
      </PremiumHero>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {categories.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setCategory(c); PlatformBridge.hapticFeedback('light'); }}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all ${
              category === c
                ? 'border-[#E91E63] bg-[#E91E63] text-white'
                : 'border-(--border-subtle) bg-(--bg-elevated) text-(--text-muted)'
            }`}
          >
            {c === 'Todas' || c === 'Gratis' ? c : (CATEGORY_LABEL[c] ?? c)}
          </button>
        ))}
      </div>

      {featured.length > 0 && (
        <section className="space-y-2">
          <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-(--text-muted)">Destacadas</p>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {featured.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => open(plan)}
                className="w-[220px] shrink-0 text-left active:scale-[0.98] transition-transform"
              >
                <MembershipCard data={cardData(plan)} preview />
                <div className="mt-2 flex items-center justify-between px-1">
                  <span className="text-[12px] font-black text-[#E91E63]">{priceLabel(plan)}</span>
                  <span className="text-[10px] font-bold text-(--text-muted)">
                    {plan.alreadySubscribed ? 'Ya eres miembro' : `${plan.memberCount} miembros`}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-(--text-muted)">
          Todas las membresías
        </p>
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) px-4 py-8 text-center">
            <Gift size={26} className="mx-auto mb-2 text-[#E91E63]" />
            <p className="text-[13px] font-black text-(--text-primary)">Aún no hay membresías aquí</p>
            <p className="mt-1 text-[11px] text-(--text-muted)">Prueba otra categoría o invita a tu negocio favorito.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => open(plan)}
                className="flex w-full items-center gap-3 rounded-2xl border border-(--border-subtle) bg-(--bg-elevated) p-3 text-left active:scale-[0.99] transition-transform"
              >
                {plan.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={plan.coverImageUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#E91E63]/15 text-[#E91E63]">
                    <BadgeCheck size={22} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-[13px] font-black text-(--text-primary)">{plan.name}</p>
                    {plan.featured && <Sparkles size={11} className="shrink-0 text-[#E91E63]" />}
                  </div>
                  <p className="truncate text-[10px] text-(--text-muted)">{plan.businessName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(plan.benefits ?? []).slice(0, 2).map((b, i) => (
                      <span key={i} className="rounded-full bg-white/[.06] px-1.5 py-0.5 text-[9px] text-(--text-muted)">
                        {BENEFIT_LABEL[b.type] ?? b.type}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[12px] font-black text-[#E91E63]">{priceLabel(plan)}</p>
                  <p className="text-[9px] font-bold text-(--text-muted)">
                    {plan.alreadySubscribed ? 'Miembro' : plan.foundingAvailable ? 'Fundador' : `${plan.memberCount} miembros`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
