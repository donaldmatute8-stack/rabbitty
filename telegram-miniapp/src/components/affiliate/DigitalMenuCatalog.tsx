'use client';

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Search, Sparkles, Plus, Info } from 'lucide-react';
import Image from 'next/image';
import { ProductDetailModal, CatalogItem, CatalogModifier } from './ProductDetailModal';

export interface CatalogCategory {
  id: string;
  name: string;
  description?: string | null;
  items: CatalogItem[];
}

interface DigitalMenuCatalogProps {
  categories: CatalogCategory[];
  currency?: string;
  rewardPercentage?: number;
  onAddToCart?: (item: CatalogItem, quantity: number, modifiers: CatalogModifier[], notes: string) => void;
  digitalOrderingEnabled?: boolean;
}

export function DigitalMenuCatalog({
  categories,
  currency = 'MXN',
  rewardPercentage = 10,
  onAddToCart,
  digitalOrderingEnabled = true,
}: DigitalMenuCatalogProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeItem, setActiveItem] = useState<CatalogItem | null>(null);

  // Filter items based on active category and search
  const filteredCategories = useMemo(() => {
    return categories
      .map(cat => {
        if (selectedCategoryId !== 'all' && cat.id !== selectedCategoryId) {
          return null;
        }

        const filteredItems = cat.items.filter(item => {
          if (!searchQuery.trim()) return true;
          const query = searchQuery.toLowerCase();
          const nameMatches = item.name.toLowerCase().includes(query);
          const descMatches = (item.description || '').toLowerCase().includes(query);
          return nameMatches || descMatches;
        });

        if (filteredItems.length === 0) return null;

        return {
          ...cat,
          items: filteredItems,
        };
      })
      .filter((cat): cat is CatalogCategory => cat !== null);
  }, [categories, selectedCategoryId, searchQuery]);

  const totalItemsCount = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.items.length, 0);
  }, [categories]);

  if (!categories || categories.length === 0) {
    return (
      <div className="bg-[#161622] rounded-3xl p-8 text-center border border-white/5 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-white/40 mx-auto">
          <Info size={24} />
        </div>
        <h4 className="text-base font-bold text-white">Catálogo en sincronización</h4>
        <p className="text-xs text-white/50 max-w-xs mx-auto">
          El establecimiento está actualizando sus especialidades y servicios disponibles para hoy.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Input */}
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar platillo, bebida o servicio..."
          className="w-full bg-[#161622] border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder-white/40 focus:outline-none focus:border-[#E91E63] transition-colors shadow-inner"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-white/50 bg-white/10 px-2 py-0.5 rounded-full"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Category Pills (Sticky Subheader under segmented tabs) */}
      <div className="sticky top-[calc(max(var(--safe-top,0px),env(safe-area-inset-top,0px))+112px)] z-20 -mx-6 px-6 py-2 bg-[#0D0D15]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategoryId('all')}
            className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide transition-all border ${
              selectedCategoryId === 'all'
                ? 'bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white border-transparent shadow-md shadow-[#E91E63]/30'
                : 'bg-[#161622] text-white/70 border-white/10 hover:bg-white/10'
            }`}
          >
            Todos ({totalItemsCount})
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide transition-all border ${
                selectedCategoryId === cat.id
                  ? 'bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white border-transparent shadow-md shadow-[#E91E63]/30'
                  : 'bg-[#161622] text-white/70 border-white/10 hover:bg-white/10'
              }`}
            >
              {cat.name} ({cat.items.length})
            </button>
          ))}
        </div>
      </div>

      {/* Structured Category Listings */}
      <div className="space-y-7">
        {filteredCategories.map(cat => (
          <div key={cat.id} className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#E91E63]" />
                <h3 className="text-base font-black text-white tracking-wide uppercase">
                  {cat.name}
                </h3>
              </div>
              {cat.description && (
                <span className="text-[11px] text-white/40 line-clamp-1 max-w-[200px]">
                  {cat.description}
                </span>
              )}
            </div>

            {/* Product Grid / Cards */}
            <div className="grid grid-cols-1 gap-3">
              {cat.items.map(item => {
                const estimatedBunz = Math.round(item.price * (rewardPercentage / 100));
                const itemImg = item.imageUrl || null;
                const isDrink = cat.name.toLowerCase().includes('bebida') || cat.name.toLowerCase().includes('café') || item.name.toLowerCase().includes('café') || item.name.toLowerCase().includes('capuccino');

                return (
                  <motion.div
                    key={item.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveItem(item)}
                    className="group bg-[#161622]/90 hover:bg-[#1a1a29] border border-white/10 rounded-2xl p-3.5 flex gap-3.5 items-center cursor-pointer transition-all shadow-sm hover:border-[#E91E63]/30"
                  >
                    {/* Item Thumbnail */}
                    {itemImg ? (
                      <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10">
                        <Image
                          src={itemImg}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-linear-to-br from-white/5 to-white/10 border border-white/10 flex flex-col items-center justify-center text-pink-400 shrink-0">
                        <span className="text-2xl mb-1">{isDrink ? '☕' : '🍽️'}</span>
                        <span className="text-[9px] font-black uppercase tracking-wider text-white/50">
                          {isDrink ? 'Bebida' : 'Especial'}
                        </span>
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black text-white leading-snug line-clamp-1 group-hover:text-pink-400 transition-colors">
                            {item.name}
                          </h4>
                          <span className="text-sm font-black text-white whitespace-nowrap">
                            ${item.price}
                          </span>
                        </div>
                        <p className="text-xs text-white/50 line-clamp-1 mt-0.5 leading-relaxed">
                          {item.description || 'Consulta ingredientes y opciones disponibles.'}
                        </p>
                      </div>

                      {/* Badges / Add action */}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-md border border-pink-500/20">
                          +{estimatedBunz} Bunz
                        </span>

                        <div className="flex items-center gap-1 text-xs font-black text-white bg-white/10 group-hover:bg-[#E91E63] group-hover:text-white px-2.5 py-1 rounded-xl transition-all shadow-sm">
                          <Plus size={13} className="shrink-0" />
                          <span>{digitalOrderingEnabled ? 'Pedir' : 'Ver'}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="py-12 text-center text-white/40 text-sm">
            No se encontraron productos que coincidan con tu búsqueda.
          </div>
        )}
      </div>

      {/* Modal Detail & Customization */}
      <ProductDetailModal
        item={activeItem}
        onClose={() => setActiveItem(null)}
        onAddToCart={onAddToCart}
        currency={currency}
        rewardPercentage={rewardPercentage}
      />
    </div>
  );
}
