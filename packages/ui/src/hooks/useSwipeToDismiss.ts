"use client";

/**
 * ── `useSwipeToDismiss` ── gesto de "arrastrar hacia abajo para cerrar" ────
 *
 * Una sola implementación para todos los paneles de Rabbitty (hojas inferiores,
 * diálogos, Rabbitty Mood). Antes vivía dentro de `Dialog` y los demás paneles
 * no lo tenían, así que cada uno lo reinventaba (o no lo tenía).
 *
 * Reglas del gesto, aprendidas de los bugs reales:
 * - **Sólo nace en la cabecera** (o con el contenido arriba del todo). Si se
 *   permite desde cualquier punto, el paneo del contenido se siente "pegajoso"
 *   y el usuario no puede leer una lista larga.
 * - **No secuestra gestos horizontales**: si el primer movimiento es más ancho
 *   que alto, se cancela (deja pasar carruseles y swipes laterales).
 * - **Cierra por distancia o por velocidad**: un "fling" corto y rápido cierra;
 *   un arrastre lento necesita recorrer el umbral. Sin esto el gesto se siente
 *   impredecible.
 * - Al no llegar al umbral, vuelve a su sitio con transición (no salta).
 */

import { useCallback, useRef, useState } from "react";

export interface SwipeToDismissOptions {
  onDismiss: () => void;
  /** Alto (px) de la franja superior desde la que puede empezar el gesto. */
  headerZone?: number;
  /** Distancia (px) que cierra sin importar la velocidad. */
  threshold?: number;
  /** Distancia (px) mínima para cerrar con un gesto rápido. */
  flingThreshold?: number;
  /** Velocidad (px/ms) que cuenta como fling. */
  flingVelocity?: number;
  /** Devolver false cancela el gesto (p. ej. el contenido no está arriba). */
  canStart?: () => boolean;
  disabled?: boolean;
}

export interface SwipeToDismissHandlers {
  onTouchStart: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchMove: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: React.TouchEvent<HTMLElement>) => void;
  onTouchCancel: () => void;
}

export interface SwipeToDismissResult {
  /** Desplazamiento actual (px, sólo positivo hacia abajo). */
  dragY: number;
  isDragging: boolean;
  handlers: SwipeToDismissHandlers;
  /** Estilo listo para el contenedor que se arrastra. */
  style: React.CSSProperties;
}

const DEFAULTS = {
  headerZone: 96,
  threshold: 110,
  flingThreshold: 48,
  flingVelocity: 0.5,
};

/** Valores por defecto compartidos por todos los paneles de la app. */
export const SWIPE_DISMISS_DEFAULTS = DEFAULTS;

/**
 * Regla única de cierre, compartida por el hook (superficies sin framer-motion)
 * y por las hojas que usan `drag` de framer-motion. Sin esto habría dos
 * comportamientos distintos para el mismo gesto.
 *
 * @param distance px recorridos hacia abajo
 * @param velocity px/ms (si tienes px/s, divide entre 1000)
 */
export function shouldDismissSwipe(
  distance: number,
  velocity: number,
  options: { threshold?: number; flingThreshold?: number; flingVelocity?: number } = {},
): boolean {
  const threshold = options.threshold ?? DEFAULTS.threshold;
  const flingThreshold = options.flingThreshold ?? DEFAULTS.flingThreshold;
  const flingVelocity = options.flingVelocity ?? DEFAULTS.flingVelocity;
  if (distance <= 0) return false;
  return distance > threshold || (distance > flingThreshold && velocity > flingVelocity);
}

export function useSwipeToDismiss({
  onDismiss,
  headerZone = DEFAULTS.headerZone,
  threshold = DEFAULTS.threshold,
  flingThreshold = DEFAULTS.flingThreshold,
  flingVelocity = DEFAULTS.flingVelocity,
  canStart,
  disabled = false,
}: SwipeToDismissOptions): SwipeToDismissResult {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startY = useRef<number | null>(null);
  const startX = useRef(0);
  const startedAt = useRef(0);
  // undefined = aún no decidido; "vertical" = arrastrando; "horizontal" = ignorado
  const axis = useRef<"vertical" | "horizontal" | null>(null);

  const reset = useCallback(() => {
    startY.current = null;
    axis.current = null;
    setIsDragging(false);
    setDragY(0);
  }, []);

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLElement>) => {
      if (disabled) return;
      const touch = event.touches[0];
      if (!touch) return;

      // Cabecera: sólo desde la franja superior del panel.
      if (headerZone > 0) {
        const rect = event.currentTarget.getBoundingClientRect();
        if (touch.clientY - rect.top > headerZone) return;
      }
      if (canStart && !canStart()) return;

      startY.current = touch.clientY;
      startX.current = touch.clientX;
      startedAt.current = Date.now();
      axis.current = null;
      setIsDragging(true);
    },
    [canStart, disabled, headerZone],
  );

  const onTouchMove = useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (startY.current == null) return;
    const touch = event.touches[0];
    if (!touch) return;

    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // Primer movimiento: decide si el gesto es nuestro o de un carrusel.
    if (axis.current == null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      axis.current = Math.abs(dy) >= Math.abs(dx) ? "vertical" : "horizontal";
      if (axis.current === "horizontal") {
        reset();
        return;
      }
    }
    if (axis.current !== "vertical") return;

    // Hacia arriba no se arrastra: el panel se queda quieto.
    setDragY(Math.max(0, dy));
  }, [reset]);

  const onTouchEnd = useCallback(() => {
    if (startY.current == null) {
      reset();
      return;
    }
    const distance = dragY;
    const elapsed = Math.max(1, Date.now() - startedAt.current);
    const velocity = distance / elapsed;
    const shouldDismiss = shouldDismissSwipe(distance, velocity, {
      threshold,
      flingThreshold,
      flingVelocity,
    });

    reset();
    if (shouldDismiss) onDismiss();
  }, [dragY, flingThreshold, flingVelocity, onDismiss, reset, threshold]);

  return {
    dragY,
    isDragging,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel: reset,
    },
    style: {
      transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
      transition: isDragging ? "none" : "transform 0.22s cubic-bezier(0.22, 1, 0.36, 1)",
      // Sin esto, arrastrar hacia abajo dentro del panel puede encadenar el
      // scroll al contenedor de atrás en iOS.
      overscrollBehavior: "contain",
    },
  };
}
