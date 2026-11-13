"use client";

import { useEdgeSwipeBack } from "../hooks/useEdgeSwipeBack";

/**
 * Activa los gestos nativos emulados (swipe desde el borde izquierdo = atrás).
 * Se monta una sola vez en el layout raíz; no renderiza nada.
 */
export function NativeGestures() {
  useEdgeSwipeBack();
  return null;
}
