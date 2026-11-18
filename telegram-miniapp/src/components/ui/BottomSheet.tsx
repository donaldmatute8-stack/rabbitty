'use client';

import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { shouldDismissSwipe, useOverlayLock } from '@rabbitty/ui';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showHandle?: boolean;
  showCloseButton?: boolean;
  maxHeight?: string;
  /** Glassmorphism para menús de contactos/settings del chat. */
  glass?: boolean;
  /** Ocupa toda la pantalla en lugar de una hoja inferior. */
  fullScreen?: boolean;
  /** Arrastrar hacia abajo para cerrar (por defecto sí, salvo pantalla completa). */
  swipeToDismiss?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  className,
  showHandle = true,
  showCloseButton = true,
  maxHeight = '80vh',
  glass = false,
  fullScreen = false,
  swipeToDismiss = true,
}: BottomSheetProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, handleEscape]);

  // Candado compartido: bloquea scroll del body y, sobre todo, inhibe los
  // gestos de la pantalla de atrás mientras la hoja está abierta.
  useOverlayLock(isOpen);

  // ── Swipe hacia abajo para cerrar ──
  // Se usa el `drag` de framer-motion en vez de transformar el estilo a mano:
  // la hoja ya anima `y` al entrar/salir y mezclar ambos rompería la animación.
  // El gesto sólo arranca desde el asa/cabecera, para no pelear con el scroll
  // del contenido. La decisión de cerrar es la misma regla que en `Dialog`.
  const dragControls = useDragControls();
  const canDrag = swipeToDismiss && !fullScreen;

  const onDragEnd = useCallback(
    (_: unknown, info: { offset: { y: number }; velocity: { y: number } }) => {
      // framer entrega la velocidad en px/s; la regla compartida usa px/ms.
      if (shouldDismissSwipe(info.offset.y, info.velocity.y / 1000)) onClose();
    },
    [onClose]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[200] bg-[var(--bg-scrim)] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag={canDrag ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            dragSnapToOrigin
            onDragEnd={onDragEnd}
            className={cn(
              'fixed z-[200]',
              fullScreen ? 'inset-0 rounded-none' : 'bottom-0 left-0 right-0 rounded-t-[var(--radius-xl)]',
              'bg-[var(--bg-elevated)]',
              'flex flex-col',
              className
            )}
            style={{
              maxHeight: fullScreen ? '100dvh' : maxHeight,
              height: fullScreen ? '100dvh' : undefined,
              // Evita que arrastrar al tope del contenido encadene el scroll a
              // la página de atrás (iOS).
              overscrollBehavior: 'contain',
              ...(fullScreen
                ? {
                    paddingTop: 'var(--safe-top, 0px)',
                    paddingBottom: 'var(--safe-bottom, 0px)',
                  }
                : {}),
              ...(glass
                ? {
                    background: 'var(--glass-bg)',
                    backdropFilter: 'blur(28px) saturate(160%)',
                    WebkitBackdropFilter: 'blur(28px) saturate(160%)',
                    borderTop: fullScreen ? 'none' : '1px solid var(--glass-border)',
                    boxShadow: fullScreen ? 'none' : '0 -24px 60px rgba(0,0,0,0.45)',
                  }
                : {}),
            }}
          >
            {/* Asa + cabecera: zona donde nace el gesto de arrastre */}
            <div
              onPointerDown={(event) => {
                if (canDrag) dragControls.start(event);
              }}
              style={{ touchAction: 'none' }}
            >
              {/* Handle */}
              {showHandle && !fullScreen && (
                <div className="flex justify-center pt-3 pb-1">
                  <div className="w-10 h-1 rounded-full bg-[var(--border-strong)]" />
                </div>
              )}

              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3">
                {title && (
                  <h2 className="text-[var(--text-h3)] font-semibold text-[var(--text-primary)]">{title}</h2>
                )}
                {showCloseButton && (
                  <button
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="p-1 rounded-full hover:bg-[var(--bg-pressed)] transition-colors"
                  >
                    <X className="w-5 h-5 text-[var(--text-muted)]" />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-6" style={{ overscrollBehavior: 'contain' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
