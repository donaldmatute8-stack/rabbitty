'use client';

import { useEffect, useState } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useWallet } from '@/contexts/WalletContext';
import { QRCodeSVG } from 'qrcode.react';

export default function InventoryPage() {
  const { address } = useWallet();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (address) {
      fetchInventory();
    } else {
      setLoading(false);
    }
  }, [address]);

  const fetchInventory = async () => {
    try {
      const res = await fetch(`/api/inventory?wallet=${address}`);
      const data = await res.json();
      if (data.success) {
        setCoupons(data.coupons);
        setReservations(data.reservations);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProfileSubpageLayout title="Mis Cupones">
      <div className="flex flex-col gap-6">
        
        {/* Reservations Section */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Tus Reservas Activas</h2>
          {loading ? (
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500 mx-auto mt-4"></div>
          ) : reservations.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-4 text-center border border-dashed border-gray-200">
              <p className="text-gray-400 text-sm">No tienes reservas activas de Bunz.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {reservations.map(res => (
                <div key={res.id} className="bg-white border shadow-sm rounded-2xl p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-gray-900">{res.business.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">Expira: {new Date(res.expires_at).toLocaleTimeString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-pink-500">{res.reserved_bunz} Bunz</p>
                    <p className="text-[10px] font-bold uppercase text-green-500">Reservado</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Coupons Section */}
        <div>
          <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-3">Certificados Comprados</h2>
          {loading ? null : coupons.length === 0 ? (
            <EmptyState icon={<div className="text-[32px]">🎟️</div>} title="Sin Cupones" description="Aún no has adquirido certificados en el Stock." />
          ) : (
            <div className="flex flex-col gap-4">
              {coupons.map(coupon => (
                <div key={coupon.id} className="bg-white border border-gray-100 shadow-md rounded-3xl overflow-hidden relative">
                  {/* Card Header */}
                  <div className="bg-black text-white p-4 flex justify-between items-start">
                    <div>
                      <h3 className="font-black text-lg">{coupon.offer.title}</h3>
                      <p className="text-sm text-gray-400">{coupon.offer.business.name}</p>
                    </div>
                  </div>
                  
                  {/* Card Body - QR Code */}
                  <div className="p-6 flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white to-gray-50">
                    <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                      <QRCodeSVG value={coupon.qr_code_data} size={150} level="H" />
                    </div>
                    <p className="text-xs text-center text-gray-400 mt-4 max-w-[200px]">
                      Muestra este QR en la caja de {coupon.offer.business.name} para canjear tu certificado.
                    </p>
                  </div>

                  {/* Cutout details */}
                  <div className="absolute left-0 top-1/2 -mt-4 -ml-4 w-8 h-8 bg-gray-50 rounded-full"></div>
                  <div className="absolute right-0 top-1/2 -mt-4 -mr-4 w-8 h-8 bg-gray-50 rounded-full"></div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
