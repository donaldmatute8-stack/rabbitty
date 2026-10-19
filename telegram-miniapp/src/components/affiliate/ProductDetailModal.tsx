'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Check, Sparkles } from 'lucide-react';
import Image from 'next/image';

export interface CatalogModifier {
  id: string;
  name: string;
  type?: string;
  priceAdjust: number;
}

export interface CatalogItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  imageUrl?: string | null;
  isAvailable?: boolean;
  modifiers?: CatalogModifier[];
}

interface ProductDetailModalProps {
  item: CatalogItem | null;
  onClose: () => void;
  onAddToCart?: (item: CatalogItem, quantity: number, selectedModifiers: CatalogModifier[], notes: string) => void;
  currency?: string;
  rewardPercentage?: number;
}

export function ProductDetailModal({
  item,
  onClose,
  onAddToCart,
  currency = 'MXN',
  rewardPercentage = 10,
}: ProductDetailModalProps) {
  // Use item ID as key or reset state on item transition
  const [prevItemId, setPrevItemId] = React.useState<string | null>(null);
  const [quantity, setQuantity] = React.useState(1);
  const [selectedModifiers, setSelectedModifiers] = React.useState<CatalogModifier[]>([]);
  const [specialInstructions, setSpecialInstructions] = React.useState('');

  if (item && item.id !== prevItemId) {
    setPrevItemId(item.id);
    setQuantity(1);
    setSelectedModifiers([]);
    setSpecialInstructions('');
  }

  if (!item) return null;

  const toggleModifier = (mod: CatalogModifier) => {
    setSelectedModifiers(prev => {
      const exists = prev.some(m => m.id === mod.id);
      if (exists) {
        return prev.filter(m => m.id !== mod.id);
      } else {
        return [...prev, mod];
      }
    });
  };

  const modifiersTotal = selectedModifiers.reduce((acc, m) => acc + (Number(m.priceAdjust) || 0), 0);
  const unitPrice = item.price + modifiersTotal;
  const totalPrice = unitPrice * quantity;
  const estimatedBunzReward = Math.round(totalPrice * (rewardPercentage / 100));

  const fallbackImage = 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=600&q=80';
  const displayImage = item.imageUrl || fallbackImage;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-999 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-0 sm:p-4">
        {/* Backdrop click */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          className="relative w-full max-w-lg bg-[#14141E] border border-white/10 rounded-t-4xl sm:rounded-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl z-10"
        >
          {/* Header image / Close button */}
          <div className="relative w-full h-56 bg-black/40 shrink-0">
            <Image
              src={displayImage}
              alt={item.name}
              fill
              unoptimized
              className="object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-[#14141E] via-[#14141E]/40 to-transparent" />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/60 backdrop-blur-md text-white/80 hover:text-white flex items-center justify-center border border-white/10 active:scale-95 transition-transform"
              aria-label="Cerrar"
            >
              <X size={20} />
            </button>

            {/* Bunz reward pill */}
            <div className="absolute bottom-3 left-4 flex items-center gap-2 bg-[#E91E63]/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/20 shadow-lg">
              <Sparkles size={14} className="text-white animate-pulse" />
              <span className="text-xs font-black text-white tracking-wide">
                +{rewardPercentage}% Bunz ({estimatedBunzReward} Bunz)
              </span>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5 text-white">
            {/* Title & Description */}
            <div>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="text-2xl font-black tracking-tight text-white">{item.name}</h3>
                <span className="text-xl font-black text-white whitespace-nowrap">
                  ${item.price} <span className="text-xs font-bold text-white/50">{currency}</span>
                </span>
              </div>
              <p className="mt-2 text-sm text-white/70 leading-relaxed">
                {item.description || 'Preparado fresco con ingredientes seleccionados de primera calidad.'}
              </p>
            </div>

            {/* Modifiers / Options */}
            {item.modifiers && item.modifiers.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-pink-400">
                    Opciones y Personalización
                  </span>
                  <span className="text-[11px] text-white/50">Opcional</span>
                </div>

                <div className="space-y-2">
                  {item.modifiers.map(mod => {
                    const isSelected = selectedModifiers.some(m => m.id === mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleModifier(mod)}
                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all ${
                          isSelected
                            ? 'bg-[#E91E63]/15 border-[#E91E63] text-white'
                            : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/8'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
                              isSelected ? 'bg-[#E91E63] border-[#E91E63]' : 'border-white/30'
                            }`}
                          >
                            {isSelected && <Check size={14} className="text-white" />}
                          </div>
                          <span className="text-sm font-semibold">{mod.name}</span>
                        </div>
                        {Number(mod.priceAdjust) > 0 ? (
                          <span className="text-xs font-bold text-pink-300">
                            +${mod.priceAdjust} {currency}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-white/40">Gratis</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Special Instructions Note */}
            <div className="space-y-2 pt-2 border-t border-white/10">
              <label htmlFor="notes" className="block text-xs font-black uppercase tracking-wider text-white/70">
                Notas especiales para el establecimiento
              </label>
              <textarea
                id="notes"
                rows={2}
                value={specialInstructions}
                onChange={e => setSpecialInstructions(e.target.value)}
                placeholder="Ej. Sin hielo, salsa aparte, término medio..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl p-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#E91E63] transition-colors"
              />
            </div>
          </div>

          {/* Bottom Action Footer */}
          <div className="p-5 border-t border-white/10 bg-[#161622] flex items-center gap-4">
            {/* Quantity Stepper */}
            <div className="flex items-center bg-white/10 rounded-2xl p-1 border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white disabled:opacity-30 active:scale-90 transition-transform"
                aria-label="Restar uno"
              >
                <Minus size={16} />
              </button>
              <span className="w-8 text-center text-sm font-black text-white">{quantity}</span>
              <button
                type="button"
                onClick={() => setQuantity(q => q + 1)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-white/80 hover:text-white active:scale-90 transition-transform"
                aria-label="Sumar uno"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Add to order / consult button */}
            <button
              type="button"
              onClick={() => {
                if (onAddToCart) {
                  onAddToCart(item, quantity, selectedModifiers, specialInstructions);
                }
                onClose();
              }}
              className="flex-1 bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white py-3.5 px-4 rounded-2xl font-black text-sm tracking-wide shadow-lg shadow-[#E91E63]/30 active:scale-98 transition-transform flex items-center justify-between"
            >
              <span>{onAddToCart ? 'Agregar al pedido' : 'Listo'}</span>
              <span className="font-extrabold text-base">
                ${totalPrice.toFixed(0)} {currency}
              </span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
