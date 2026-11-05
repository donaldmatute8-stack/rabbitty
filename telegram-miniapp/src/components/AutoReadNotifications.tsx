'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';

/**
 * Marca como leídas las notificaciones in-app cuya ruta destino ya se visitó.
 *
 * Antes había que abrir la campana y tocar cada tarjeta para apagar el punto,
 * aunque el usuario ya hubiera entrado a la función (wallet, pedido, etc.).
 * Ahora, al cambiar de pantalla, el servidor apaga las notificaciones cuya
 * `route` coincide con la ruta actual.
 */
export default function AutoReadNotifications() {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastSent = useRef<string>('');

  useEffect(() => {
    if (!pathname || !user?.id) return;
    // La propia campana no marca nada: ahí se decide manualmente.
    if (pathname.startsWith('/notifications')) return;
    if (lastSent.current === pathname) return;
    lastSent.current = pathname;

    let cancelled = false;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        if (cancelled) return;
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({ route: pathname }),
        });
      } catch {
        /* best-effort: no bloquea la navegación */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, user?.id]);

  return null;
}
