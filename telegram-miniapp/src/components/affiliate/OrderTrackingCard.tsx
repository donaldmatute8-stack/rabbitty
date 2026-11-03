'use client';

/**
 * ── OrderTrackingCard + OrderTrackSheet ── H-TRACK: seguimiento de pedido
 * estilo paquetería (Amazon-type) — tarjeta superior sticky en el feed,
 * clickeable a full-screen con timeline de etapa, items, y acciones
 * (Pagar reutiliza el MISMO módulo de pago — InAppPaySheet).
 * Bidireccional: el POS mueve la etapa (kds/setOrderStage), el móvil la ve.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, ChefHat, CheckCircle2, X, Sparkles, ChevronRight, ChevronUp, Wallet, Utensils } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import type { TrackedOrder } from '@/lib/useOrderTracking';
import { InAppPaySheet } from './InAppPaySheet';

const STAGE_ICONS = [ChefHat, Package, Sparkles, CheckCircle2];

interface OrderDetail {
  orderId: string;
  status: string;
  orderType: string | null;
  tableNumber: number | null;
  businessName: string;
  total: number;
  stage: string;
  stageLabel: string;
  stageStep: number;
  stageCount: number;
  canPay: boolean;
  items: Array<{ name: string; quantity: number; totalPrice: number; status: string | null }>;
}

export function OrderTrackingCard({
  orders,
  onRefresh,
}: {
  orders: TrackedOrder[];
  onRefresh?: () => void;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  // ── H-TRACK-GLOBAL: la tarjeta vive en TODAS las pestañas y el Rabbitter
  // puede ocultarla (se guarda por pedido). Al ocultarla NO queda píldora en el
  // feed: el acceso pasa al ícono de pedido de la barra superior. Un pedido
  // NUEVO vuelve a mostrarse solo (no se pierde).
  const [hiddenOrderId, setHiddenOrderId] = useState<string | null>(null);
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('rabbitty_track_hidden_v1');
      if (stored) setHiddenOrderId(stored);
    } catch { /* sin storage */ }
  }, []);

  if (orders.length === 0) return null;
  const order = orders[0]; // más reciente (singular en la práctica)
  const progress = Math.max(0, Math.min(1, order.stageStep / Math.max(1, order.stageCount - 1 + 0.001)));
  const StageIcon = STAGE_ICONS[Math.min(3, order.stageStep)] ?? Package;
  const done = order.stage === 'DONE';

  const openDetail = () => {
    PlatformBridge.hapticFeedback('light');
    setDetailId(order.orderId);
  };

  const hide = (e: React.MouseEvent) => {
    e.stopPropagation();
    PlatformBridge.hapticFeedback('light');
    try { localStorage.setItem('rabbitty_track_hidden_v1', order.orderId); } catch { /* noop */ }
    setHiddenOrderId(order.orderId);
  };

  // ¿Está oculta la tarjeta de ESTE pedido? (page.tsx lo usa para decidir si
  // muestra la tarjeta o solo el ícono de la barra superior)
  const hidden = hiddenOrderId === order.orderId;

  // Oculto: la tarjeta desaparece del feed. El acceso sigue en el ícono del
  // pedido en la barra superior (page.tsx) — no ocupa espacio aquí.
  if (hidden) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-1 mb-3"
      >
        {/* La tarjeta NO es un <button>: dentro vive el botón de ocultar.
            Un <button> anidado provoca clics cruzados (ocultar vs abrir). */}
        <div
          role="button"
          tabIndex={0}
          onClick={openDetail}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(); } }}
          className="relative w-full text-left cursor-pointer active:scale-[0.98] transition-transform rounded-3xl p-3.5"
          style={{
            background: 'linear-gradient(135deg, rgba(233,30,99,0.10) 0%, rgba(20,10,20,0.55) 100%)',
            border: '1px solid rgba(233,30,99,0.30)',
            boxShadow: '0 6px 22px rgba(233,30,99,0.10)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
          }}
        >
          {/* Ocultar: botón propio, esquina superior derecha y con área táctil
              de 36px — separado del resto de la tarjeta (que abre el pedido). */}
          <button
            type="button"
            onClick={hide}
            aria-label="Ocultar seguimiento"
            title="Ocultar (el ícono del pedido queda en la barra superior)"
            className="absolute top-1.5 right-1.5 z-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/15 text-white/55 hover:text-white transition-colors cursor-pointer"
            style={{ width: 36, height: 36, border: '1px solid rgba(255,255,255,0.10)' }}
          >
            <ChevronUp size={16} strokeWidth={2.6} />
          </button>

          <div className="flex items-center gap-3">
            {/* Icono de etapa */}
            <div
              className="relative w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(233,30,99,0.15)', border: '1px solid rgba(233,30,99,0.35)' }}
            >
              {!done && <span className="absolute inset-0 rounded-2xl animate-ping opacity-20 bg-[#E91E63]/40" />}
              <StageIcon size={20} className="text-[#E91E63]" strokeWidth={2.4} />
            </div>

            <div className="flex-1 min-w-0 pr-9">
              <div className="flex items-center gap-1.5">
                {!done && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />}
                <p className="text-[10px] font-black uppercase tracking-[1.2px] m-0 truncate" style={{ color: '#E91E63' }}>
                  {done ? 'Pedido entregado 🎉' : 'Pedido en curso'}
                </p>
              </div>
              {/* Barra de progreso (Pedido → Preparación → Listo → Entregado) */}
              <div className="mt-1.5 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                <motion.div
                  animate={{ width: `${Math.round(progress * 100)}%` }}
                  transition={{ type: 'spring', damping: 20, stiffness: 140 }}
                  className="h-full rounded-full"
                  style={{ background: 'linear-gradient(90deg, #E91E63, #FF2E93)' }}
                />
              </div>
              <p className="text-[11px] font-bold text-white/80 m-0 mt-1 truncate">
                {order.businessName} · {order.stageLabel}
                <span className="text-white/45 font-medium"> · ${order.total.toFixed(0)} MXN</span>
              </p>
            </div>
          </div>

          <p className="text-[9px] text-white/35 m-0 mt-1.5 pl-[52px] pr-9 truncate">
            {order.itemsSummary.slice(0, 3).join(' · ')}{order.itemsSummary.length > 3 ? ` +${order.itemsSummary.length - 3} más` : ''}
          </p>

          {/* Affordance de apertura: fuera del área del botón de ocultar */}
          <span className="absolute bottom-2.5 right-3 flex items-center gap-0.5 text-[9px] font-black text-white/40">
            Ver <ChevronRight size={12} />
          </span>
        </div>
      </motion.div>

      <OrderTrackSheet
        orderId={detailId}
        onClose={() => setDetailId(null)}
        onUpdated={() => onRefresh?.()}
      />
    </>
  );
}

export function OrderTrackSheet({
  orderId,
  onClose,
  onUpdated,
}: {
  orderId: string | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!orderId) { setDetail(null); return; }
      setLoading(true);
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch(`/api/orders/${orderId}`, { headers, cache: 'no-store' });
        const data = await res.json().catch(() => null);
        if (alive && data?.success) setDetail(data.order);
      } catch { /* silencioso */ } finally {
        if (alive) setLoading(false);
      }
    };
    void load();
    const iv = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 10_000);
    return () => { alive = false; clearInterval(iv); };
  }, [orderId]);

  return (
    <AnimatePresence>
      {orderId && (
        <div className="fixed inset-0 z-999 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center">
          <div className="absolute inset-0" onClick={onClose} />
          <motion.div
            initial={{ y: '100%', opacity: 0.7 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-lg bg-[#101019] border border-white/10 rounded-t-4xl sm:rounded-4xl p-6 max-h-[92vh] flex flex-col overflow-hidden text-white"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <h3 className="text-base font-black m-0 flex items-center gap-2">
                  <Utensils size={17} className="text-[#E91E63]" />
                  Seguimiento de pedido
                </h3>
                <p className="text-[11px] text-white/45 m-0 mt-0.5">{detail?.businessName ?? '…'}</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-white/60">
                <X size={17} />
              </button>
            </div>

            {loading && !detail ? (
              <div className="py-12 text-center text-white/40 text-xs">Cargando…</div>
            ) : detail ? (
              <>
                {/* Timeline de etapas (Pedido → Preparación → Listo → Entregado) */}
                <div className="py-5">
                  <div className="flex items-center justify-between mb-3">
                    {[0, 1, 2, 3].map((i) => {
                      const labels = ['Pedido', 'Preparando', 'Listo', 'Entregado'];
                      const reached = detail.stageStep >= i;
                      const isCurrent = detail.stageStep === i && detail.stage !== 'DONE';
                      const Icon = STAGE_ICONS[i];
                      return (
                        <React.Fragment key={i}>
                          {i > 0 && (
                            <div className="flex-1 h-1 mx-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                              {reached && i <= detail.stageStep && (
                                <div className="h-full w-full" style={{ background: 'linear-gradient(90deg,#E91E63,#FF2E93)' }} />
                              )}
                            </div>
                          )}
                          <div className="flex flex-col items-center gap-1 shrink-0">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center border transition-all"
                              style={{
                                background: reached ? 'rgba(233,30,99,0.18)' : 'rgba(255,255,255,0.04)',
                                borderColor: reached ? 'rgba(233,30,99,0.55)' : 'rgba(255,255,255,0.1)',
                              }}
                            >
                              {isCurrent
                                ? <Icon size={17} className="text-[#E91E63] animate-pulse" />
                                : <Icon size={17} className={reached ? 'text-[#E91E63]' : 'text-white/25'} />}
                            </div>
                            <span className={`text-[9px] font-black ${reached ? 'text-white/80' : 'text-white/30'}`}>{labels[i]}</span>
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  <p className="text-center text-[11px] font-bold m-0" style={{ color: detail.canPay ? '#34D399' : '#E91E63' }}>
                    {detail.stageLabel}{detail.tableNumber ? ` · Mesa #${detail.tableNumber}` : ''}
                  </p>
                </div>

                {/* Items */}
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
                  {detail.items.map((it, i) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black m-0 truncate">{it.name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-white/50 m-0">{it.quantity}×</p>
                        <p className="text-xs font-black m-0">${it.totalPrice.toFixed(0)}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total + acciones */}
                <div className="pt-4 border-t border-white/10 mt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black">Total</span>
                    <span className="text-lg font-black">${detail.total.toFixed(2)} MXN</span>
                  </div>
                  {detail.canPay ? (
                    <button
                      type="button"
                      onClick={() => { PlatformBridge.hapticFeedback('medium'); setPayOpen(true); }}
                      className="w-full bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white font-black text-sm py-3.5 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border-none cursor-pointer"
                    >
                      <Wallet size={16} />
                      Pagar ahora ${detail.total.toFixed(2)}
                    </button>
                  ) : (
                    <div className="w-full py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center gap-2">
                      <CheckCircle2 size={15} className="text-emerald-400" />
                      <span className="text-[11px] font-black text-emerald-300">{detail.status === 'PAID' ? 'Pago confirmado' : 'Pedido completado'}</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => { onUpdated(); onClose(); }}
                    className="w-full py-2 text-[10px] font-black text-white/40 cursor-pointer bg-transparent border-none"
                  >
                    Cerrar seguimiento
                  </button>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-white/40 text-xs">Pedido no encontrado</div>
            )}
          </motion.div>
        </div>
      )}

      {orderId && payOpen && detail && (
        <div className="fixed inset-0 z-1000">
          <InAppPaySheet
            isOpen={payOpen}
            onClose={() => { setPayOpen(false); void onUpdated(); }}
            orderId={detail.orderId}
            total={detail.total}
            businessName={detail.businessName}
            onPaid={() => { void onUpdated(); }}
          />
        </div>
      )}
    </AnimatePresence>
  );
}
