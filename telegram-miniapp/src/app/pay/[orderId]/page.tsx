'use client';

/**
 * Página de pago in-app para el enlace /pay/[orderId] (Rabbitty Pay).
 * Destino al tocar la notificación "🧾 Cuenta lista en <comercio>" que envía el POS
 * (pos.sendBillToCustomer → route: /pay/[orderId]) — el Rabbitter continúa y
 * liquida su cuenta 100% dentro de la app (propina → tarjeta → cashback Bunz).
 * Fallback: si no hay sesión (comensal anónimo), abre la web universal en el admin.
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { InAppPaySheet } from '@/components/affiliate/InAppPaySheet';

export default function PayBillPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const orderId = params?.orderId;

  if (!orderId) {
    return (
      <div className="bg-[#0D0D15] min-h-screen flex flex-col items-center justify-center gap-3 text-white px-6 text-center">
        <p className="text-sm text-gray-400">Enlace de pago no válido.</p>
        <Link href="/" className="text-pink-400 font-bold text-sm">Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className="bg-[#0D0D15] min-h-screen flex items-center justify-center">
      <div className="text-center text-gray-500 text-xs">
        <div className="w-8 h-8 mx-auto mb-3 rounded-full border-2 border-white/10 border-t-[#E91E63] animate-spin" />
        Abriendo tu cuenta…
      </div>
      <InAppPaySheet
        isOpen={!!orderId}
        onClose={() => router.replace('/')}
        orderId={orderId}
        total={0}
        businessName="Tu cuenta en el local"
        onPaid={() => {
          // Misma experiencia que el cobro desde el POS: nos quedamos en el
          // módulo (rating incluido) en lugar de saltar a la cartera.
        }}
      />
    </div>
  );
}