'use client';

/**
 * ── PendingChargeCard ── Cobro pendiente del Rabbitter en caja.
 * Distinta de la tarjeta de pedido (caja/paquete): usa un icono de pago
 * (wallet) y aparece cuando el POS generó una solicitud de cobro y el
 * Rabbitter salió del loader o cerró la confirmación.
 */

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Wallet, ChevronRight, Loader2 } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

interface PendingCharge {
  id: string;
  status: 'PENDING' | 'APPROVED';
  method: string;
  amount: number;
  tipAmount: number;
  businessName: string | null;
  expiresAt: string;
}

function methodLabel(method: string) {
  const m = String(method || '').toUpperCase();
  if (m === 'BUNZ') return 'Bunz';
  if (m === 'DIVIDIDA') return 'Efectivo + Bunz';
  if (m === 'TARJETA_EXTERNA') return 'Tarjeta';
  if (m === 'TARJETA') return 'Tarjeta';
  return 'Efectivo';
}

export function PendingChargeCard() {
  const router = useRouter();
  const [request, setRequest] = useState<PendingCharge | null>(null);

  const load = useCallback(async () => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/pay/charge-approval/pending', { headers, cache: 'no-store' });
      const data = await res.json().catch(() => null);
      const first = data?.requests?.[0];
      setRequest(first ?? null);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, 12000);
    return () => clearInterval(interval);
  }, [load]);

  if (!request) return null;

  const approved = request.status === 'APPROVED';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-1 mb-3"
    >
      <button
        type="button"
        onClick={() => {
          PlatformBridge.hapticFeedback('light');
          router.push(`/pay/confirm/${request.id}`);
        }}
        className="w-full text-left rounded-2xl p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
        style={{
          background: approved
            ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, rgba(139,92,246,0.10) 100%)'
            : 'linear-gradient(135deg, rgba(139,92,246,0.14) 0%, rgba(233,30,99,0.10) 100%)',
          border: `1px solid ${approved ? 'rgba(16,185,129,0.35)' : 'rgba(139,92,246,0.35)'}`,
          boxShadow: '0 8px 28px rgba(0,0,0,0.25)',
        }}
      >
        <div
          className="h-11 w-11 shrink-0 rounded-2xl flex items-center justify-center"
          style={{
            background: approved ? 'rgba(16,185,129,0.18)' : 'rgba(139,92,246,0.20)',
            border: `1px solid ${approved ? 'rgba(16,185,129,0.4)' : 'rgba(139,92,246,0.4)'}`,
          }}
        >
          {approved ? (
            <Loader2 size={20} className="text-emerald-300 animate-spin" />
          ) : (
            <Wallet size={20} className="text-violet-200" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-white/40">
            {approved ? 'Pago autorizado' : 'Cobro pendiente'}
          </p>
          <p className="m-0 mt-0.5 text-[14px] font-black text-white leading-tight truncate">
            {request.businessName || 'Tu cuenta en caja'}
          </p>
          <p className="m-0 mt-0.5 text-[11px] text-white/45">
            {methodLabel(request.method)} · ${Number(request.amount || 0).toFixed(2)}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <span className={`text-[10px] font-black ${approved ? 'text-emerald-300' : 'text-violet-200'}`}>
            {approved ? 'Esperando cobro' : 'Confirmar'}
          </span>
          <ChevronRight size={16} className="text-white/35 ml-auto mt-1" />
        </div>
      </button>
    </motion.div>
  );
}
