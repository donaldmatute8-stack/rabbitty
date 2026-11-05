'use client';

import Link from 'next/link';
import { Sparkles, ArrowUpRight } from 'lucide-react';

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: 'Actualización de producto',
  TIP: 'Tip para tu negocio',
  NEWS: 'Novedad de Rabbitty',
  SYSTEM: 'Aviso importante',
};

export interface BunzyUpdateMessage {
  id: string;
  content: string;
  createdAt?: string | Date | null;
  metadata?: unknown;
}

/** Tarjeta institucional de Bunzy Connect en la bandeja del negocio. */
export function BunzyUpdateCard({ message }: { message: BunzyUpdateMessage }) {
  const meta = (message.metadata ?? {}) as {
    category?: string;
    title?: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
  };
  const category = meta.category || 'PRODUCT';
  const title = meta.title || 'Actualización de Rabbitty';

  return (
    <div className="my-2 flex w-full items-start gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-rose-400 text-base shadow-[0_4px_14px_rgba(233,30,99,0.35)]">
        🐰
      </div>
      <div className="min-w-0 flex-1 rounded-2xl border border-pink-500/30 bg-gradient-to-b from-pink-500/10 to-white/[0.03] p-3.5">
        <div className="mb-1.5 flex items-center gap-1.5">
          <span className="text-xs font-black text-white">Bunzy</span>
          <span className="rounded-full border border-pink-500/35 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-pink-300">
            Oficial
          </span>
        </div>
        <span className="mb-1.5 inline-flex items-center gap-1 text-[9.5px] font-extrabold uppercase tracking-wider text-pink-300">
          <Sparkles size={10} /> {CATEGORY_LABEL[category] || CATEGORY_LABEL.PRODUCT}
        </span>
        <p className="m-0 text-sm font-black leading-snug text-white">{title}</p>
        <p className="m-0 mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-gray-300">
          {message.content}
        </p>
        {meta.ctaLabel && meta.ctaUrl && (
          <a
            href={meta.ctaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-pink-600 px-3 py-1.5 text-[11px] font-black text-white no-underline hover:bg-pink-500"
          >
            {meta.ctaLabel} <ArrowUpRight size={12} />
          </a>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          {message.createdAt ? (
            <span className="text-[9.5px] text-gray-500">
              {new Date(message.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span />
          )}
          <Link href="/settings/bunzy" className="text-[9.5px] font-bold text-pink-300 underline hover:text-pink-200">
            Gestionar preferencias
          </Link>
        </div>
      </div>
    </div>
  );
}
