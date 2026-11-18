"use client";

/**
 * ── Candado de overlays ───────────────────────────────────────────────────
 *
 * Problema real: con el panel de Rabbitty Mood abierto, un swipe hacia abajo
 * "atravesaba" el panel y disparaba el *pull to refresh* de la página de atrás
 * (y el swipe de borde podía sacarte de la pantalla). El panel no tenía gesto
 * propio y los gestos globales seguían escuchando.
 *
 * Este módulo es la fuente única de verdad: mientras haya al menos un overlay
 * abierto, los gestos de página (`PullToRefresh`, `useEdgeSwipeBack`) se
 * inhiben. El contador permite overlays anidados (un modal dentro de un panel)
 * sin que el primero en cerrarse desbloquee el scroll.
 *
 * También centraliza el bloqueo de scroll del body: antes cada componente lo
 * escribía por su cuenta y dos overlays se pisaban `overflow`.
 */

let openOverlays = 0;
let previousBodyOverflow: string | null = null;

export const OVERLAY_ATTR = "data-overlay-open";

function syncDomState(): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (openOverlays > 0) {
    root.setAttribute(OVERLAY_ATTR, "true");
  } else {
    root.removeAttribute(OVERLAY_ATTR);
  }

  if (openOverlays > 0) {
    if (previousBodyOverflow === null) previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else if (previousBodyOverflow !== null) {
    document.body.style.overflow = previousBodyOverflow;
    previousBodyOverflow = null;
  }
}

/** ¿Hay algún panel/diálogo abierto ahora mismo? */
export function isOverlayOpen(): boolean {
  return openOverlays > 0;
}

/**
 * Marca un overlay como abierto y devuelve la función para liberarlo.
 * Idempotente por llamada: siempre libera lo que tomó, aunque se llame dos veces.
 */
export function acquireOverlayLock(): () => void {
  openOverlays += 1;
  syncDomState();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    openOverlays = Math.max(0, openOverlays - 1);
    syncDomState();
  };
}
