'use client';

/**
 * ── PaySheetShell ── Contenedor FULL-SCREEN del módulo de pago (identidad dark
 * minimalista). Reutilizable para cualquier pantalla de cobro/acción.
 */

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';

export default function PaySheetShell({
  title,
  subtitle,
  onClose,
  children,
  footer,
  overlay,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Capa superpuesta (se renderiza sobre todo, fuera del scroll) */
  overlay?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ type: 'spring', damping: 30, stiffness: 320 }}
      className="fixed inset-0 z-999 flex flex-col bg-[#0B0B10] text-white overflow-hidden"
    >
      {/* Fondo glass: orbes suaves (no interfieren con el contenido) */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-72 w-72 rounded-full bg-pink-600/20 blur-[90px]" />
      <div className="pointer-events-none absolute top-1/3 -left-28 h-72 w-72 rounded-full bg-violet-600/20 blur-[90px]" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-72 w-72 rounded-full bg-sky-600/15 blur-[90px]" />

      {/* Header minimal */}
      <div className="relative flex items-start justify-between px-5 pt-[calc(var(--safe-top,0px)+14px)] pb-3">
        <div>
          <h2 className="text-[15px] font-black tracking-tight m-0 flex items-center gap-2">
            {title}
          </h2>
          {subtitle && <p className="text-[11px] text-white/40 m-0 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 active:scale-90 transition-transform"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-4 flex flex-col">{children}</div>

      {footer && <div className="px-5 pb-[calc(var(--safe-bottom,0px)+16px)] pt-2">{footer}</div>}

      {/* Overlay (propina, diálogos): fuera del scroll, cubre el sheet */}
      {overlay}
    </motion.div>
  );
}