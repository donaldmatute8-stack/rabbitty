'use client';

/**
 * ── Tienda del negocio (pestaña "Tienda") ─────────────────────────────────
 *
 * Para nichos de comida (café, panadería, restaurante) el negocio ya vende
 * platillos en el menú; aquí vende lo que se lleva a casa: café en grano,
 * pan para llevar, botellas, merch. No se inventó un modelo aparte: son las
 * mismas filas de `menu_items` con `kind = 'PRODUCT'`, así que comparten
 * carrito, orden, ticket, contabilidad e inventario con el resto del menú.
 *
 * Lo único distinto en la UI: se presenta como escaparate (grid de tarjetas),
 * avisa si el producto se envía a domicilio y respeta el tope por pedido.
 */

import React from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Package, Truck, Plus, ShoppingBag, Search, X } from 'lucide-react';
import { CatalogItem } from './ProductDetailModal';

interface StoreCatalogProps {
  products: CatalogItem[];
  currency?: string;
  onSelectProduct: (item: CatalogItem) => void;
  /** Productos que necesitan dirección de entrega. */
  showsShippingNote?: boolean;
}

function formatPrice(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

export function StoreCatalog({
  products,
  currency = 'MXN',
  onSelectProduct,
  showsShippingNote = true,
}: StoreCatalogProps) {
  const [query, setQuery] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState<string | null>(null);

  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const p of products) if (p.categoryName) set.add(p.categoryName);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [products]);

  const visible = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory && p.categoryName !== activeCategory) return false;
      if (!q) return true;
      return `${p.name} ${p.description ?? ''}`.toLowerCase().includes(q);
    });
  }, [products, query, activeCategory]);
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
        <Package size={26} className="mx-auto mb-3 text-white/30" />
        <p className="text-sm font-bold text-white/70">La tienda está vacía por ahora</p>
        <p className="mt-1 text-xs text-white/40">
          Este negocio todavía no publicó productos para llevar.
        </p>
      </div>
    );
  }

  const anyShipping = showsShippingNote && products.some((p) => p.requiresShipping);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
        <ShoppingBag size={16} className="shrink-0 text-[#FF8FB8]" />
        <p className="text-[11.5px] leading-snug text-white/60">
          Productos para llevar. Se pagan en el local o con Bunz, según el medio que elijas al
          confirmar.
          {anyShipping ? ' Los marcados con envío piden dirección.' : ''}
        </p>
      </div>

      {/* Buscador y categorías propias de la tienda. La tienda reusa el catálogo
          del menú, pero aquí se navega como escaparate: por nombre o por tipo. */}
      {products.length > 3 && (
        <div className="space-y-2">
          <div className="relative">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en la tienda…"
              className="w-full rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] py-2.5 pl-10 pr-9 text-xs text-white placeholder-white/40 focus:border-[var(--rabbitty-pink)]/60 focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white/60"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {categories.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black ${
                  activeCategory === null
                    ? 'border-transparent bg-[image:var(--brand-gradient)] text-white'
                    : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-secondary)]'
                }`}
              >
                Todo
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory((prev) => (prev === cat ? null : cat))}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-black ${
                    activeCategory === cat
                      ? 'border-transparent bg-[image:var(--brand-gradient)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-secondary)]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
          <p className="text-sm font-bold text-white/70">Sin resultados</p>
          <p className="mt-1 text-xs text-white/40">Prueba con otro nombre o quita el filtro.</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 gap-3">
        {visible.map((product, index) => {
          // Agotado si el comercio lo ocultó o si no quedan existencias contadas.
          const outOfStock = typeof product.stock === 'number' && product.stock <= 0;
          const soldOut = product.isAvailable === false || outOfStock;
          const showLeft =
            typeof product.stock === 'number' && product.stock > 0 && Boolean(product.lowStock);
          return (
            <motion.button
              key={product.id}
              type="button"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.24) }}
              whileTap={{ scale: 0.98 }}
              onClick={() => !soldOut && onSelectProduct(product)}
              disabled={soldOut}
              className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141420] text-left disabled:opacity-50"
            >
              <div className="relative aspect-square w-full overflow-hidden bg-black/40">
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 240px"
                    className="object-cover transition-transform duration-300 group-active:scale-105"
                  />
                ) : (
                  // Sin foto del afiliado: el logo de Rabbitty en escala de grises,
                  // igual que el POS cuando un producto no tiene imagen. Discreto,
                  // no compite con las tarjetas que sí tienen foto.
                  <div className="flex h-full w-full items-center justify-center bg-[var(--surface-1)] p-6">
                    <Image
                      src="/Ra.png"
                      alt=""
                      width={96}
                      height={96}
                      aria-hidden
                      className="h-full w-full object-contain opacity-25 grayscale select-none"
                    />
                  </div>
                )}

                {product.requiresShipping && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[9.5px] font-black uppercase tracking-wide text-white/80 backdrop-blur">
                    <Truck size={10} /> Envío
                  </span>
                )}
                {soldOut && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[11px] font-black uppercase tracking-wide text-white/80">
                    Agotado
                  </span>
                )}
              </div>

              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="line-clamp-2 text-[12.5px] font-black leading-tight text-white">
                  {product.name}
                </p>
                {product.description && (
                  <p className="line-clamp-2 text-[10.5px] leading-snug text-white/45">
                    {product.description}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-1.5">
                  <span className="text-[13px] font-black text-white">
                    {formatPrice(product.price, currency)}
                  </span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-[#FF2E93] to-[#E91E63] text-white">
                    <Plus size={14} />
                  </span>
                </div>
                {showLeft ? (
                  <p className="text-[9.5px] font-bold uppercase tracking-wide text-amber-300/90">
                    Quedan {product.stock}
                  </p>
                ) : product.maxPerOrder ? (
                  <p className="text-[9.5px] font-bold uppercase tracking-wide text-white/35">
                    Máx. {product.maxPerOrder} por pedido
                  </p>
                ) : null}
              </div>
            </motion.button>
          );
        })}
      </div>
      )}
    </div>
  );
}
