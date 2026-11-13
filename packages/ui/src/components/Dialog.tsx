"use client";

import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../cn";

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** Kicker corto sobre el título (uppercase tracking — evidencia de sistema). */
  kicker?: string;
  /** Oculta la X para flujos que exigen decisión explícita (bloqueantes). */
  hideClose?: boolean;
  children: ReactNode;
}

/**
 * ── Dialog (primitiva v2) ── Glassmorphism Rabbitty:
 * - Backdrop oscuro con blur medio (44% + crema en el card) — profundidad real.
 * - Card glass: superficie translúcida #0B0B12/85, borde 1px blanco/10,
 *   highlight superior con gradiente de la marca (rosa E91E63 → violeta 8B5CF6)
 *   como "luz de sigilletado" — sube el premium sin bailar de colores.
 * - Radios 3xl usar (24px), sombra doble (negra + glow de la marca al 8%).
 * - Header v2: kicker uppercase + título negro + X ghost compartida. Todo modal
 *   POS (Caja, corte X/Y, Tabs, Rabbitter, Historial, Tickets) hereda esto.
 * - Evolución tranquila: props previas siguen vivas (title, className...).
 */
function Dialog({ open, onClose, title, kicker, hideClose, children, className }: DialogProps) {
  const [mounted, setMounted] = useState(false);

  // ── Swipe hacia abajo para cerrar (gesto nativo, ADR-025) ──
  // Solo se inicia en la cabecera del modal, para no pelear con el scroll
  // del contenido.
  const dragStartY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const HEADER_ZONE = 96;
  const DISMISS_AT = 110;

  const onTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    const y = event.touches[0]?.clientY;
    if (y == null) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (y - rect.top > HEADER_ZONE) return;
    dragStartY.current = y;
  };

  const onTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (dragStartY.current == null) return;
    const y = event.touches[0]?.clientY ?? dragStartY.current;
    const delta = y - dragStartY.current;
    if (delta > 0) setDragY(delta);
  };

  const onTouchEnd = () => {
    if (dragY > DISMISS_AT) onClose();
    dragStartY.current = null;
    setDragY(0);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#050508]/70 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={
          dragY > 0
            ? {
                transform: `translateY(${dragY}px)`,
                opacity: Math.max(0.45, 1 - dragY / 380),
                transition: "none",
              }
            : undefined
        }
        className={cn(
          "relative z-10 w-full max-w-md rounded-3xl overflow-hidden p-6",
          "bg-[#0B0B12]/85 backdrop-blur-xl",
          "border border-white/10",
          "shadow-[0_24px_80px_-16px_rgba(0,0,0,0.8),0_0_60px_-20px_rgba(233,30,99,0.25)]",
          "transition-all duration-200",
          open ? "scale-100 opacity-100" : "scale-95 opacity-0",
          className
        )}
      >
        {/* Highlight superior de la marca (glass lip) */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-[#FF2E93] via-[#E91E63] to-[#8B5CF6] opacity-90"
        />
        {title && (
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              {kicker && (
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#E91E63]/80 mb-1 leading-none">
                  {kicker}
                </p>
              )}
              <h2 className="text-base font-black text-white tracking-tight leading-tight truncate">{title}</h2>
            </div>
            {!hideClose && (
              <button
                onClick={onClose}
                className="shrink-0 -mr-1 -mt-1 rounded-full p-1.5 text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                aria-label="Cerrar"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body
  );
}

export { Dialog };
