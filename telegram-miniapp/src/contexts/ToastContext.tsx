'use client';

/**
 * ── Toasts in-app (una sola identidad para toda la app) ─────────────────────
 *
 * Antes: una barra negra opaca con un icono suelto. En tema claro desentonaba y
 * el "GPS activo", los errores del escáner o los avisos de pago se veían como
 * un mensaje del sistema, no como Rabbitty.
 *
 * Ahora: cristal sobre el fondo real de la app (funciona en claro y oscuro),
 * el icono va en una insignia con el degradado del tipo de aviso, y una línea
 * fina marca el tiempo que le queda. Se puede tocar para descartar.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const DURATION_MS = 4000;

const TONE: Record<ToastType, { from: string; to: string; glow: string; label: string }> = {
  success: { from: '#E91E63', to: '#8B5CF6', glow: 'rgba(233,30,99,0.42)', label: 'Listo' },
  error: { from: '#EF4444', to: '#F97316', glow: 'rgba(239,68,68,0.40)', label: 'Aviso' },
  info: { from: '#8B5CF6', to: '#22D3EE', glow: 'rgba(139,92,246,0.40)', label: 'Rabbitty' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastOptions[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    if (timers.current[id]) {
      clearTimeout(timers.current[id]);
      delete timers.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
    timers.current[id] = setTimeout(() => dismiss(id), DURATION_MS);
  }, [dismiss]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return <CheckCircle2 size={17} strokeWidth={2.6} />;
      case 'error': return <AlertCircle size={17} strokeWidth={2.6} />;
      case 'info':
      default: return <Info size={17} strokeWidth={2.6} />;
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      <div
        style={{
          position: 'fixed',
          top: 'calc(max(env(safe-area-inset-top), 12px) + 56px)',
          left: 0,
          right: 0,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '0 16px',
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = TONE[toast.type];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.96, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }}
                onClick={() => dismiss(toast.id)}
                role="status"
                aria-live="polite"
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 380,
                  overflow: 'hidden',
                  borderRadius: 20,
                  padding: '11px 14px 13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 11,
                  pointerEvents: 'auto',
                  cursor: 'pointer',
                  background: 'color-mix(in srgb, var(--bg-elevated, #14101c) 82%, transparent)',
                  backdropFilter: 'blur(26px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(26px) saturate(180%)',
                  border: '1px solid color-mix(in srgb, var(--border-subtle, rgba(255,255,255,0.12)) 85%, transparent)',
                  boxShadow: `0 18px 40px -22px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 -10px 30px -24px ${tone.glow}`,
                }}
              >
                {/* Insignia del tipo de aviso */}
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    borderRadius: 12,
                    color: '#FFFFFF',
                    background: `linear-gradient(140deg, ${tone.from} 0%, ${tone.to} 100%)`,
                    boxShadow: `0 8px 18px -8px ${tone.glow}`,
                  }}
                >
                  {getIcon(toast.type)}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 900,
                      letterSpacing: '0.18em',
                      textTransform: 'uppercase',
                      color: 'color-mix(in srgb, var(--text-muted, rgba(255,255,255,0.55)) 92%, transparent)',
                    }}
                  >
                    {tone.label}
                  </span>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13.5,
                      fontWeight: 650,
                      lineHeight: 1.35,
                      color: 'var(--text-primary, #FFFFFF)',
                    }}
                  >
                    {toast.message}
                  </p>
                </div>

                {/* Tiempo restante */}
                <motion.span
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: DURATION_MS / 1000, ease: 'linear' }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: 2,
                    transformOrigin: 'left center',
                    background: `linear-gradient(90deg, ${tone.from} 0%, ${tone.to} 100%)`,
                    opacity: 0.75,
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
