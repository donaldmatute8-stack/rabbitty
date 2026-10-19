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

      {/* Category Pills (Horizontal Scroll) */}
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide -mx-6 px-6">
        <button
          onClick={() => setSelectedCategoryId('all')}
          className={`shrink-0 px-4 py-2 rounded-full text-xs font-black tracking-wide transition-all border ${
            selectedCategoryId === 'all'
              ? 'bg-[#E91E63] text-white border-[#E91E63] shadow-md shadow-[#E91E63]/30'
              : 'bg-[#161622] text-white/70 border-white/10 hover:bg-white/10'
          }`}
        >
          Todos ({totalItemsCount})
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(cat.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-black tracking-wide transition-all border ${
              selectedCategoryId === cat.id
                ? 'bg-[#E91E63] text-white border-[#E91E63] shadow-md shadow-[#E91E63]/30'
                : 'bg-[#161622] text-white/70 border-white/10 hover:bg-white/10'
            }`}
          >
            {cat.name} ({cat.items.length})
          </button>
        ))}
      </div>

      {/* Structured Category Listings */}
      <div className="space-y-8">
        {filteredCategories.map(cat => (
          <div key={cat.id} className="space-y-3.5">
            <div className="flex items-baseline justify-between border-b border-white/5 pb-2">
              <h3 className="text-lg font-black text-white tracking-tight uppercase">
                {cat.name}
              </h3>
              {cat.description && (
                <span className="text-xs text-white/40 line-clamp-1 max-w-50">
                  {cat.description}
                </span>
              )}
            </div>

            {/* Product Grid / Cards */}
            <div className="grid grid-cols-1 gap-3">
              {cat.items.map(item => {
                const estimatedBunz = Math.round(item.price * (rewardPercentage / 100));
                const itemImg = item.imageUrl || null;

                return (
                  <motion.div
                    key={item.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setActiveItem(item)}
                    className="group bg-[#161622] hover:bg-[#1a1a29] border border-white/10 rounded-2xl p-3.5 flex gap-3.5 items-center cursor-pointer transition-colors shadow-sm"
                  >
                    {/* Item Thumbnail */}
                    {itemImg ? (
                      <div className="relative w-22 h-22 rounded-xl overflow-hidden bg-black/40 shrink-0 border border-white/10">
                        <Image
                          src={itemImg}
                          alt={item.name}
                          fill
                          unoptimized
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-xl bg-linear-to-br from-pink-500/10 to-purple-500/10 border border-white/5 flex flex-col items-center justify-center text-pink-400 shrink-0">
                        <Sparkles size={20} className="mb-1 opacity-70" />
                        <span className="text-[10px] font-black uppercase text-white/40">Platillo</span>
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
                        <p className="text-xs text-white/50 line-clamp-2 mt-1 leading-relaxed">
                          {item.description || 'Consulta ingredientes y variantes disponibles.'}
                        </p>
                      </div>

                      {/* Badges / Add action */}
                      <div className="flex items-center justify-between mt-2.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-md">
                          +{estimatedBunz} Bunz
                        </span>

                        <div className="flex items-center gap-1.5 text-xs font-bold text-white/80 bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-xl transition-colors">
                          <Plus size={14} className="text-pink-400" />
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
