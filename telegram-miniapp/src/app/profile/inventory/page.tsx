'use client';

import { useEffect, useState } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { QRCodeSVG } from 'qrcode.react';

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
      <div className="flex flex-col gap-6 flex-1 min-h-[calc(100vh-220px)]">
        
        {/* Reservations Section */}
        <div>
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Tus Reservas Activas</h2>
          {loading ? (
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mt-4"></div>
          ) : reservations.length === 0 ? (
            <div className="bg-[#161622] rounded-2xl p-4 text-center border border-dashed border-white/10">
              <p className="text-white/40 text-sm m-0">No tienes reservas activas de Bunz.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reservations.map(res => (
                <div key={res.id} className="bg-[#161622] border border-white/10 shadow-lg rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-white text-base m-0">{res.business.name}</h3>
                    <p className="text-xs text-white/40 mt-1 mb-0">Expira: {new Date(res.expires_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-[#E91E63] text-base m-0">{res.reserved_bunz} Bunz</p>
                    <p className="text-[10px] font-bold uppercase text-[#34D399] m-0">Reservado</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coupons Section */}
        <div className="flex-1 flex flex-col">
          <h2 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Certificados Comprados</h2>
          {loading ? null : coupons.length === 0 ? (
            <div className="flex-1 flex items-center justify-center py-10">
              <EmptyState icon={<div className="text-[32px]">🎟️</div>} title="Sin Cupones" description="Aún no has adquirido certificados en el Stock." />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {coupons.map(coupon => (
                <div key={coupon.id} className="bg-[#161622] border border-white/10 shadow-xl rounded-3xl overflow-hidden relative">
                  {/* Card Header */}
                  <div className="bg-black/40 border-b border-white/5 text-white p-4 flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-lg text-white m-0">{coupon.offer.title}</h3>
                      <p className="text-sm text-white/50 m-0 mt-0.5">{coupon.offer.business.name}</p>
                    </div>
                  </div>
                  
                  {/* Card Body - QR Code */}
                  <div className="p-6 flex flex-col items-center justify-center bg-radial from-[#1A1A28] to-[#12121E]">
                    <div className="bg-white p-4 rounded-2xl shadow-md border border-white/10">
                      <QRCodeSVG value={coupon.qr_code_data} size={150} level="H" />
                    </div>
                    <p className="text-xs text-center text-white/50 mt-4 max-w-55">
                      Muestra este QR en la caja de {coupon.offer.business.name} para canjear tu certificado.
                    </p>
                  </div>

                  {/* Cutout details */}
                  <div className="absolute left-0 top-1/2 -mt-4 -ml-4 w-8 h-8 bg-(--bg-primary) rounded-full border-r border-white/10"></div>
                  <div className="absolute right-0 top-1/2 -mt-4 -mr-4 w-8 h-8 bg-(--bg-primary) rounded-full border-l border-white/10"></div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
