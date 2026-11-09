'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Store, LogOut } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

/**
 * ── Espera de cobro en caja ──
 * El Rabbitter escanea el QR de mostrador y espera aquí mientras el POS
 * procesa el cobro. En cuanto el POS crea la solicitud, salta a la
 * confirmación (/pay/confirm/[id]). "Salir" solo cierra la pantalla; la
 * transacción sigue pendiente y aparece en la tarjeta de cobro pendiente.
 */
export default function PayWaitPage() {
  const router = useRouter();
  const params = useSearchParams();
  const branchId = params?.get('branchId') || '';
  const businessId = params?.get('businessId') || '';
  const businessName = params?.get('business') || 'el negocio';

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [checkinDone, setCheckinDone] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Logo del comercio (best-effort).
  useEffect(() => {
    if (!businessId) return;
    let alive = true;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/business/${encodeURIComponent(businessId)}`, { headers });
        const data = await res.json().catch(() => null);
        if (alive && data?.business) {
          setLogoUrl(data.business.logoUrl || data.business.gallery?.[0] || null);
        }
      } catch { /* logo opcional */ }
    })();
    return () => { alive = false; };
  }, [businessId]);

  // Check-in: el POS lo ve en "clientes en el local" y puede vincular el cobro.
  useEffect(() => {
    if (!businessId || checkinDone) return;
    let alive = true;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        if (!headers?.Authorization) return;
        await fetch('/api/business/checkin', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId }),
        });
        if (alive) setCheckinDone(true);
      } catch { /* no bloquea la espera */ }
    })();
    return () => { alive = false; };
  }, [businessId, checkinDone]);

  // Poll de la solicitud de cobro.
  const poll = useCallback(async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const qs = new URLSearchParams();
      if (branchId) qs.set('branchId', branchId);
      const res = await fetch(`/api/pay/charge-approval/pending?${qs.toString()}`, {
        headers,
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      const request = data?.requests?.[0];
      if (request?.id) {
        PlatformBridge.hapticFeedback('medium');
        router.replace(`/pay/confirm/${request.id}`);
      }
    } catch { /* seguimos esperando */ }
  }, [branchId, router]);

  useEffect(() => {
    void poll();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, 2000);
    const tick = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => { clearInterval(interval); clearInterval(tick); };
  }, [poll]);

  const salir = () => {
    PlatformBridge.hapticFeedback('light');
    router.replace('/');
  };

  return (
    <div className="min-h-dvh bg-[#0B0B10] text-white flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-28 -right-20 h-72 w-72 rounded-full bg-pink-600/20 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-violet-600/20 blur-[100px]" />

      <div className="relative flex flex-col items-center text-center">
        {/* Logo del comercio con anillos de espera (identidad Rabbitty) */}
        <div className="relative w-36 h-36 flex items-center justify-center">
          <motion.span
            animate={{ scale: [0.72, 1.6], opacity: [0.55, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
            className="absolute inset-0 rounded-full border-2 border-pink-400/40"
          />
          <motion.span
            animate={{ scale: [1, 1.18, 1], opacity: [0.3, 0.08, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: 0.2, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full border border-violet-400/30"
          />
          <div
            className="relative w-24 h-24 rounded-full overflow-hidden flex items-center justify-center"
            style={{
              background: 'radial-gradient(circle at 32% 26%, rgba(255,255,255,0.16), rgba(40,16,50,0.75) 62%, rgba(6,4,16,0.95))',
              border: '1px solid rgba(233,30,99,0.45)',
              boxShadow: '0 0 46px rgba(233,30,99,0.3), inset 0 0 24px rgba(139,92,246,0.15)',
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={businessName} className="w-full h-full object-cover" />
            ) : (
              <Store size={38} className="text-pink-300" />
            )}
          </div>
        </div>

        <h1 className="mt-6 text-[22px] font-black leading-tight">
          Esperando que caja procese tu pago…
        </h1>
        <p className="mt-2 text-[12px] text-white/50 max-w-xs leading-relaxed">
          {businessName} está preparando el cobro. En cuanto lo envíe, te pediremos confirmarlo aquí mismo.
        </p>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-white/35">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-400" />
          {seconds < 60 ? `Puedes esperar aquí (${seconds}s)` : `Sigue pendiente (${Math.floor(seconds / 60)}m)`}
        </div>

        {checkinDone && (
          <p className="mt-2 text-[10px] text-emerald-300/80">
            ✓ Ya avisamos al negocio que estás en caja.
          </p>
        )}

        <button
          type="button"
          onClick={salir}
          className="mt-10 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 text-[12px] font-black text-white/75 active:scale-[0.98]"
        >
          <LogOut size={15} /> Salir
        </button>
        <p className="mt-2 text-[10px] text-white/30 max-w-[240px]">
          Salir no cancela el cobro. Queda pendiente y lo verás en tu inicio.
        </p>
      </div>
    </div>
  );
}
