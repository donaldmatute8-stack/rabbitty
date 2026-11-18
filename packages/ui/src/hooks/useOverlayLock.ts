"use client";

import { useEffect } from "react";
import { acquireOverlayLock } from "../overlayLock";

/**
 * Bloquea gestos de página y scroll del body mientras `active` sea true.
 * Se apoya en el contador compartido de `overlayLock` (overlays anidados sanos).
 */
export function useOverlayLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const release = acquireOverlayLock();
    return release;
  }, [active]);
}
