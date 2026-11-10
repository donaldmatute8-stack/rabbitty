'use client';

import { useEffect, useState } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { QRCodeSVG } from 'qrcode.react';
import { Ticket, Clock, QrCode } from 'lucide-react';
import { PremiumHero, PremiumSection, PremiumCard } from '@/components/premium/PremiumUI';

interface BusinessRef {
  name: string;
}

interface ReservationItem {
  id: string;
  expires_at: string;
  reserved_bunz: number;
  business: BusinessRef;
}

interface CouponOffer {
  title: string;
  business: BusinessRef;
}

interface CouponItem {
  id: string;
  qr_code_data: string;
  offer: CouponOffer;
}

export default function InventoryPage() {
  const { user } = useAuth();
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!user?.id) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/inventory`, { headers });
        const data = await res.json();
        if (isMounted && data.success) {
          setCoupons(data.coupons || []);
          setReservations(data.reservations || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  return (
    <ProfileSubpageLayout title="Mis Cupones">
      <div className="space-y-5 pb-4">
        <PremiumHero
          icon={Ticket}
          eyebrow="MIS CUPONES"
          title="Tus beneficios"
          subtitle="Reservas y certificados listos para canjear"
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-white/45">Reservas</p>
              <p className="text-xl font-black text-white">{reservations.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-white/45">Certificados</p>
              <p className="text-xl font-black text-white">{coupons.length}</p>
            </div>
          </div>
        </PremiumHero>

        <PremiumSection title="Reservas activas">
          {loading ? (
            <div className="flex justify-center py-6"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-pink-500" /></div>
          ) : reservations.length === 0 ? (
            <PremiumCard>
              <p className="px-4 py-5 text-center text-[12px] text-(--text-muted)">No tienes reservas activas de Bunz.</p>
            </PremiumCard>
          ) : (
            <div className="space-y-2">
              {reservations.map((res) => (
                <PremiumCard key={res.id}>
                  <div className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-black text-(--text-primary)">{res.business.name}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-(--text-muted)">
                        <Clock size={11} /> Expira: {new Date(res.expires_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[15px] font-black text-[#E91E63]">{res.reserved_bunz} Bunz</p>
                      <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300">Reservado</p>
                    </div>
                  </div>
                </PremiumCard>
              ))}
            </div>
          )}
        </PremiumSection>

        <PremiumSection title="Certificados comprados">
          {loading ? null : coupons.length === 0 ? (
            <EmptyState icon={<div className="text-[32px]">🎟️</div>} title="Sin Cupones" description="Aún no has adquirido certificados en el Stock." />
          ) : (
            <div className="space-y-4">
              {coupons.map((coupon) => (
                <PremiumCard key={coupon.id} className="relative">
                  <div className="border-b border-white/10 bg-gradient-to-r from-[#E91E63]/25 via-[#E91E63]/10 to-transparent p-4">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white">
                        <Ticket size={18} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[15px] font-black text-white">{coupon.offer.title}</p>
                        <p className="truncate text-[11px] text-white/55">{coupon.offer.business.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center bg-gradient-to-b from-white/[.03] to-transparent p-5">
                    <div className="rounded-2xl border border-white/10 bg-white p-4 shadow-[0_0_30px_rgba(233,30,99,.15)]">
                      <QRCodeSVG value={coupon.qr_code_data} size={150} level="H" />
                    </div>
                    <p className="mt-3 flex items-center gap-1.5 text-center text-[11px] text-(--text-muted)">
                      <QrCode size={12} /> Muéstralo en caja de {coupon.offer.business.name} para canjearlo.
                    </p>
                  </div>

                  <div className="absolute left-0 top-1/2 -ml-4 h-8 w-8 -translate-y-1/2 rounded-full border-r border-white/10 bg-(--bg-primary)" />
                  <div className="absolute right-0 top-1/2 -mr-4 h-8 w-8 -translate-y-1/2 rounded-full border-l border-white/10 bg-(--bg-primary)" />
                </PremiumCard>
              ))}
            </div>
          )}
        </PremiumSection>
      </div>
    </ProfileSubpageLayout>
  );
}
