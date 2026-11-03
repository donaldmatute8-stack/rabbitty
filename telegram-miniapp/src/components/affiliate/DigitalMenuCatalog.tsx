'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Sparkles, Plus, Info, SlidersHorizontal, Flame, Utensils, Coffee, X } from 'lucide-react';
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
  const [showCategoryFilters, setShowCategoryFilters] = useState<boolean>(true);

  // Identificar dinámicamente los items TOP (con sortOrder más bajo o marcados como primeros de categoría)
  const topItemIds = useMemo(() => {
    const ids = new Set<string>();
    categories.forEach(cat => {
      if (cat.items.length > 0) {
        // Tomamos los primeros 1 o 2 items destacados de cada categoría
        cat.items.slice(0, cat.items.length > 3 ? 2 : 1).forEach(it => ids.add(it.id));
      }
    });
    return ids;
  }, [categories]);

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
    <div className="space-y-4">
      {/* Buscador + toggle de filtros: STICKY bajo las tabs segmentadas.
          Antes la barra de categorías era sticky; al rediseñar se perdió y al
          hacer scroll se iba con el contenido. El buscador y el toggle quedan
          siempre alcanzables y las píldoras se colapsan debajo. */}
      <div className="sticky top-[calc(max(var(--safe-top,0px),env(safe-area-inset-top,0px))+112px)] z-20 -mx-5 px-5 py-2 bg-[#0D0D15]/95 backdrop-blur-xl border-b border-white/5 space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar platillo, bebida o servicio..."
              className="w-full bg-[#161622] border border-white/10 rounded-2xl py-2.5 pl-10 pr-9 text-xs text-white placeholder-white/40 focus:outline-none focus:border-[#E91E63] transition-colors shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/60 bg-white/10 h-5 w-5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Botón funcional de filtrado: alternar visibilidad de categorías */}
          <button
            type="button"
            onClick={() => setShowCategoryFilters(!showCategoryFilters)}
            aria-expanded={showCategoryFilters}
            className={`h-10 w-10 shrink-0 rounded-2xl border flex items-center justify-center transition-all cursor-pointer active:scale-95 ${
              showCategoryFilters
                ? 'bg-[#E91E63]/15 border-[#E91E63]/40 text-[#FF2E93] shadow-[0_0_15px_rgba(233,30,99,0.25)]'
                : 'bg-white/[0.04] border-white/10 text-white/60 hover:text-white'
            }`}
            title={showCategoryFilters ? "Ocultar filtros de categorías" : "Mostrar filtros de categorías"}
          >
            <SlidersHorizontal size={16} />
          </button>
        </div>

        {/* Category Pills (Colapsable con animación suave) */}
        <AnimatePresence initial={false}>
          {showCategoryFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategoryId('all')}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide transition-all border cursor-pointer ${
                    selectedCategoryId === 'all'
                      ? 'bg-gradient-to-r from-[#FF2E93] to-[#E91E63] text-white border-transparent shadow-md shadow-[#E91E63]/30 scale-[1.02]'
                      : 'bg-[#161622] text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  Todos ({totalItemsCount})
                </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategoryId(cat.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black tracking-wide transition-all border cursor-pointer ${
                    selectedCategoryId === cat.id
                      ? 'bg-gradient-to-r from-[#FF2E93] to-[#E91E63] text-white border-transparent shadow-md shadow-[#E91E63]/30 scale-[1.02]'
                      : 'bg-[#161622] text-white/70 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {cat.name} ({cat.items.length})
                </button>
              ))}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Structured Category Listings con Tarjetas Rediseñadas */}
      <div className="space-y-6 pt-2">
        {filteredCategories.map(cat => (
          <div key={cat.id} className="space-y-3">
            <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#E91E63]" />
                <h3 className="text-sm font-black text-white tracking-wider uppercase">
                  {cat.name}
                </h3>
              </div>
              {cat.description && (
                <span className="text-[11px] text-white/40 line-clamp-1 max-w-[200px]">
                  {cat.description}
                </span>
              )}
            </div>

            {/* Product Cards Grid */}
            <div className="grid grid-cols-1 gap-3">
              {cat.items.map(item => {
                const estimatedBunz = Math.round(item.price * (rewardPercentage / 100));
                const itemImg = item.imageUrl || null;
                const isDrink = cat.name.toLowerCase().includes('bebida') || cat.name.toLowerCase().includes('café') || item.name.toLowerCase().includes('café');
                const isTop = topItemIds.has(item.id);

                return (
                  <motion.div
                    key={item.id}
                    whileTap={{ scale: 0.985 }}
                    onClick={() => setActiveItem(item)}
                    className="group relative bg-gradient-to-b from-white/[0.05] to-white/[0.02] hover:from-white/[0.08] hover:to-white/[0.04] border border-white/10 hover:border-[#E91E63]/30 rounded-2xl p-3.5 flex gap-3.5 items-center cursor-pointer transition-all shadow-md hover:shadow-[#E91E63]/10 overflow-hidden"
                  >
                    {/* Item Thumbnail */}
                    {itemImg ? (
                      <div className="relative w-22 h-22 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10 shadow-inner">
                        <Image
                          src={itemImg}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        {isTop && (
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#E91E63]/90 backdrop-blur-md text-[8px] font-black uppercase tracking-wider text-white flex items-center gap-0.5 shadow-sm">
                            <Flame size={10} className="text-amber-300" />
                            <span>Top</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="relative w-22 h-22 rounded-xl bg-gradient-to-br from-white/5 to-white/10 border border-white/10 flex flex-col items-center justify-center text-pink-400 shrink-0">
                        {isDrink ? <Coffee size={24} className="text-pink-400 mb-1" /> : <Utensils size={24} className="text-pink-400 mb-1" />}
                        <span className="text-[9px] font-black uppercase tracking-wider text-white/50">
                          {isDrink ? 'Bebida' : 'Especial'}
                        </span>
                        {isTop && (
                          <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[#E91E63]/90 backdrop-blur-md text-[8px] font-black uppercase tracking-wider text-white flex items-center gap-0.5 shadow-sm">
                            <Flame size={10} className="text-amber-300" />
                            <span>Top</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Details */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-black text-white leading-tight line-clamp-1 group-hover:text-pink-300 transition-colors">
                            {item.name}
                          </h4>
                          <span className="text-sm font-black text-white whitespace-nowrap">
                            ${item.price}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/50 line-clamp-2 mt-1 leading-relaxed">
                          {item.description || 'Consulta ingredientes y opciones disponibles.'}
                        </p>
                      </div>

                      {/* Badges / Add action */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-lg border border-pink-500/20">
                          <Sparkles size={11} className="text-pink-400" />
                          <span>+{estimatedBunz} Bunz</span>
                        </span>

                        <div className="flex items-center gap-1 text-xs font-black text-white bg-gradient-to-r from-[#FF2E93] to-[#E91E63] group-hover:brightness-110 px-3 py-1 rounded-xl transition-all shadow-sm shadow-pink-500/20">
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
