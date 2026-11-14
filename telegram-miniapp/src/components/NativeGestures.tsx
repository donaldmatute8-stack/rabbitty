"use client";

import { useEdgeSwipeBack } from "@/hooks/useEdgeSwipeBack";

/**
 * Gestos nativos emulados para la app (Capacitor):
 * - swipe desde el borde izquierdo → volver atrás.
 * El swipe hacia abajo para cerrar modales vive en el `Dialog` compartido
 * de @rabbitty/ui.
 */
export function NativeGestures() {
  useEdgeSwipeBack();
  return null;
}
