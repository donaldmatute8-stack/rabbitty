'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Trash2, ChevronRight, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { CatalogModifier } from './ProductDetailModal';

export interface CartItem {
  id: string; // unique cart entry key
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  modifiers: CatalogModifier[];
  notes?: string;
}

interface OrderCartSheetProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  onRemoveItem: (id: string) => void;
  onUpdateQuantity: (id: string, delta: number) => void;
  onClearCart: () => void;
  onSubmitOrder: (orderType: 'DINE_IN' | 'PICKUP') => Promise<void>;
  tableNumber?: number | null;
  currency?: string;
  rewardPercentage?: number;
  businessName: string;
}

export function OrderCartSheet({
  isOpen,
  onClose,
  cart,
  onRemoveItem,
  onUpdateQuantity,
  onClearCart,
  onSubmitOrder,
  tableNumber,
  currency = 'MXN',
  rewardPercentage = 10,
  businessName,
}: OrderCartSheetProps) {
  const [submitting, setSubmitting] = React.useState(false);
  const [orderSuccess, setOrderSuccess] = React.useState(false);
  const [orderType, setOrderType] = React.useState<'DINE_IN' | 'PICKUP'>(
    tableNumber ? 'DINE_IN' : 'PICKUP'
  );

  const subtotal = cart.reduce((acc, item) => {
    const modsTotal = (item.modifiers || []).reduce((mAcc, m) => mAcc + (Number(m.priceAdjust) || 0), 0);
    return acc + (item.price + modsTotal) * item.quantity;
  }, 0);

  const estimatedBunz = Math.round(subtotal * (rewardPercentage / 100));

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onSubmitOrder(orderType);
      setOrderSuccess(true);
      setTimeout(() => {
        setOrderSuccess(false);
        onClose();
        onClearCart();
      }, 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-999 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-0 sm:p-4">
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-[#14141E] border border-white/10 rounded-t-4xl sm:rounded-4xl p-6 max-h-[88vh] flex flex-col overflow-hidden shadow-2xl z-10 text-white"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#E91E63]/15 border border-[#E91E63]/20 flex items-center justify-center text-[#E91E63]">
                <ShoppingBag size={20} />
              </div>
              <div>
                <h3 className="text-base font-black tracking-tight">Tu Pedido</h3>
                <p className="text-xs text-white/50">{businessName}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>

          {orderSuccess ? (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center animate-bounce">
                <CheckCircle2 size={36} />
              </div>
              <h4 className="text-xl font-black text-white">¡Orden Recibida!</h4>
              <p className="text-xs text-white/60 max-w-xs leading-relaxed">
                El establecimiento ha sido notificado y comenzará a preparar tus consumos.
              </p>
            </div>
          ) : (
            <>
              {/* Order Mode Selector */}
              <div className="grid grid-cols-2 gap-2 my-4 bg-white/5 p-1 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setOrderType('DINE_IN')}
                  className={`py-2 text-xs font-black rounded-xl transition-all ${
                    orderType === 'DINE_IN'
                      ? 'bg-[#E91E63] text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  En Mesa {tableNumber ? `(#${tableNumber})` : ''}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('PICKUP')}
                  className={`py-2 text-xs font-black rounded-xl transition-all ${
                    orderType === 'PICKUP'
                      ? 'bg-[#E91E63] text-white shadow-md'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  Para Recoger
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
                {cart.length === 0 ? (
                  <div className="text-center py-12 text-white/40 text-xs">
                    Tu carrito está vacío. Agrega tus platillos y bebidas preferidos.
                  </div>
                ) : (
                  cart.map(item => {
                    const modsTotal = (item.modifiers || []).reduce((acc, m) => acc + (Number(m.priceAdjust) || 0), 0);
                    const itemUnit = item.price + modsTotal;
                    const itemTotal = itemUnit * item.quantity;

                    return (
                      <div
                        key={item.id}
                        className="bg-white/5 border border-white/5 rounded-2xl p-3.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex-1 min-w-0">
                          <h5 className="text-sm font-black text-white line-clamp-1">{item.name}</h5>
                          {item.modifiers && item.modifiers.length > 0 && (
                            <p className="text-[11px] text-pink-300 line-clamp-1 mt-0.5">
                              {item.modifiers.map(m => m.name).join(', ')}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-[10px] text-white/40 italic line-clamp-1 mt-0.5">
                              &ldquo;{item.notes}&rdquo;
                            </p>
                          )}
                          <span className="text-xs font-bold text-white/70 block mt-1">
                            ${itemUnit} {currency} × {item.quantity} = ${itemTotal} {currency}
                          </span>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/10">
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white"
                            >
                              -
                            </button>
                            <span className="w-6 text-center text-xs font-black">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => onUpdateQuantity(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white"
                            >
                              +
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            className="w-8 h-8 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Summary & Checkout Button */}
              {cart.length > 0 && (
                <div className="pt-4 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>Recompensa estimada:</span>
                    <span className="font-bold text-pink-400 flex items-center gap-1">
                      <Sparkles size={12} /> +{estimatedBunz} Bunz al pagar
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-base font-black text-white">
                    <span>Total:</span>
                    <span>${subtotal.toFixed(2)} {currency}</span>
                  </div>

                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={submitting}
                    className="w-full bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-[#E91E63]/30 active:scale-98 transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>{submitting ? 'Enviando orden...' : 'Confirmar y Enviar Pedido'}</span>
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
