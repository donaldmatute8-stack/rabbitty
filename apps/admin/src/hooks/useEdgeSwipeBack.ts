"use client";

/**
 * ── Gestos nativos (Capacitor) ─────────────────────────────────────────────
 *
 * El POS corre dentro de un WKWebView, así que los gestos de iOS no existen por
 * defecto. Se emulan aquí, en la capa web, para que funcionen igual en la app
 * nativa y en el navegador:
 *
 * - **Swipe desde el borde izquierdo hacia la derecha** → volver atrás.
 * - El swipe hacia abajo para cerrar modales vive en el componente `Dialog`
 *   (afecta a todos los modales de la app).
 */

import { useEffect } from "react";

const EDGE_PX = 28;
const MIN_DISTANCE = 80;
const MAX_VERTICAL = 60;

export function useEdgeSwipeBack() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      // Solo si el gesto nace pegado al borde izquierdo.
      if (touch.clientX <= EDGE_PX) {
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
      } else {
        tracking = false;
      }
    };

    const onEnd = (event: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = Math.abs(touch.clientY - startY);
      if (dx >= MIN_DISTANCE && dy <= MAX_VERTICAL) {
        // history.back() respeta el router de Next y no saca de la app si hay
        // historial; sin historial no hace nada (no cierra la app).
        if (window.history.length > 1) window.history.back();
      }
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);
}
