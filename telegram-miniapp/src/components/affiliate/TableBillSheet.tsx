'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Receipt, X, Wallet, Banknote, CheckCircle2 } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { toast } from '@rabbitty/ui';

interface TableBillSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tableId: string | null;
  tableNumber: number | null;
  businessName: string;
  /** Base del web checkout del comensal (Fase C) — pago fuera de la app por ahora */
  payBase?: string;
}

interface BillItem {
  id: string;
  name?: string;
  quantity: number;
  totalPrice?: number;
  unitPrice?: number;
}

export function TableBillSheet({
  isOpen,
  onClose,
  tableId,
  tableNumber,
  businessName,
  payBase = 'https://admin.rabbitty.me',
}: TableBillSheetProps) {
  const [loading, setLoading] = useState(false);
  const [bill, setBill] = useState<{
    hasActiveOrder: boolean;
    orderId?: string | null;
    total?: number;
    items?: BillItem[];
    status?: string;
  } | null>(null);
  const [requestingCash, setRequestingCash] = useState(false);
  const [cashRequested, setCashRequested] = useState(false);

  const loadBill = useCallback(async () => {
    if (!tableId) return;
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/pos/table-bill?tableId=${encodeURIComponent(tableId)}`, {
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        cache: 'no-store',
      });
      const data = await res.json().catch(() => null);
      if (data?.success !== false) {
        setBill(data);
        if (data?.order?.status === 'CASH_PAYMENT_REQUESTED' || data?.status === 'CASH_PAYMENT_REQUESTED') {
          setCashRequested(true);
        }
      }
    } catch {
      /* silencioso: reintenta en el próximo poll */
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  // Carga + polling 10s mientras el sheet esté abierto
  useEffect(() => {
    if (!isOpen) { setBill(null); setCashRequested(false); return; }
    setLoading(true);
    let alive = true;
    const initial = setTimeout(() => { if (alive) void loadBill(); }, 200);
    const iv = setInterval(() => { if (alive) void loadBill(); }, 10_000);
    return () => { alive = false; clearTimeout(initial); clearInterval(iv); };
  }, [isOpen, loadBill]);

  const handleRequestCash = async () => {
    if (!bill?.orderId || requestingCash) return;
    setRequestingCash(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/pos/request-cash', {
        method: 'POST',
        headers: { ...(headers || {}), 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: bill.orderId }),
      });
      const data = await res.json().catch(() => null);
      if (data?.success) {
        PlatformBridge.hapticFeedback('success');
        toast.success('💵 El cajero ya recibió tu petición de pago en efectivo');
        setCashRequested(true);
        void loadBill();
      } else {
        toast.error(data?.error || 'No se pudo pedir la cuenta');
      }
    } catch {
      toast.error('Error de conexión');
    } finally {
      setRequestingCash(false);
    }
  };

  const handlePayDigital = () => {
    if (!bill?.orderId) return;
    PlatformBridge.hapticFeedback('medium');
    window.open(`${payBase}/pay/${bill.orderId}`, '_blank');
  };

  const total = Number(bill?.total ?? 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-999 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md">
        <div className="absolute inset-0" onClick={onClose} />
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md bg-[#14141E] border border-white/10 rounded-t-4xl sm:rounded-4xl p-6 max-h-[85vh] flex flex-col overflow-hidden shadow-2xl z-10 text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-400">
                <Receipt size={20} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Mi Cuenta</h3>
                <p className="text-xs text-white/50">
                  {businessName}{tableNumber != null ? ` · Mesa #${tableNumber}` : ''}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {/* Contenido */}
          <div className="flex-1 overflow-y-auto py-4 space-y-3">
            {loading && !bill ? (
              <div className="py-10 text-center">
                <div className="animate-pulse text-sm text-white/50">Cargando tu cuenta…</div>
              </div>
            ) : !bill?.hasActiveOrder ? (
              <div className="py-10 px-4 text-center bg-white/5 rounded-2xl border border-white/5">
                <p className="text-sm font-black text-white">Aún no tienes consumo</p>
                <p className="text-xs text-white/50 mt-1">Tu cuenta aparecerá aquí en cuanto ordenes algo 🐰</p>
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {(bill.items || []).map((it) => (
                    <div key={it.id} className="flex items-center justify-between text-sm px-1">
                      <span className="text-gray-300">
                        {it.quantity}x {it.name || 'Producto'}
                      </span>
                      <span className="text-white font-bold">${Number(it.totalPrice ?? 0).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/10">
                  <span className="text-[11px] font-black uppercase tracking-widest text-white/50">Total</span>
                  <span className="text-xl font-black text-emerald-400">${total.toFixed(2)} MXN</span>
                </div>

                {cashRequested && (
                  <div className="p-3 bg-amber-500/15 border border-amber-500/40 rounded-2xl text-amber-300 text-xs font-bold flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                    Le avisamos al cajero — viene con tu PIN a cobrarte. También puedes pagar con tarjeta abajo.
                  </div>
                )}

                <p className="text-[10px] text-white/35 text-center">
                  Se actualiza en vivo cada 10s · La propina se elige en el siguiente paso del pago.
                </p>
              </>
            )}
          </div>

          {/* Acciones */}
          {bill?.hasActiveOrder && !cashRequested && (
            <div className="pt-3 border-t border-white/10 space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePayDigital}
                className="w-full py-3.5 rounded-2xl bg-linear-to-r from-[#FF2E93] to-[#E91E63] text-white font-black text-sm shadow-[0_6px_20px_rgba(233,30,99,0.4)] flex items-center justify-center gap-2 active:brightness-95"
              >
                <Wallet size={18} />
                Pagar ahora con tarjeta / Apple Pay
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRequestCash}
                disabled={requestingCash || !bill.orderId}
                className="w-full py-3 rounded-2xl bg-white/5 border border-white/15 text-white font-bold text-xs flex items-center justify-center gap-2 active:brightness-110 disabled:opacity-50"
              >
                <Banknote size={16} className="text-amber-400" />
                Pedir cuenta al cajero (efectivo)
              </motion.button>
            </div>
          )}
          {bill?.hasActiveOrder && cashRequested && (
            <div className="pt-3 border-t border-white/10">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handlePayDigital}
                className="w-full py-3.5 rounded-2xl bg-linear-to-r from-[#FF2E93] to-[#E91E63] text-white font-black text-sm shadow-[0_6px_20px_rgba(233,30,99,0.4)] flex items-center justify-center gap-2 active:brightness-95"
              >
                <CheckCircle2 size={18} />
                Mejor pago con tarjeta / Apple Pay
              </motion.button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}