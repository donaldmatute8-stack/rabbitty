'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

/**
 * Enruta Universal Links (https://app.rabbitty.me/scan?...) y el esquema
 * rabbitty://scan?... al interior de la app nativa. Sin esto, la app se abre
 * pero se queda en la pantalla anterior y el claimToken se pierde.
 */
export default function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const route = (rawUrl: string) => {
      try {
        const url = new URL(rawUrl);
        const isScheme = url.protocol === 'rabbitty:';
        const path = isScheme ? `/${url.host}${url.pathname}`.replace(/\/+$/, '') : url.pathname;
        if (path.startsWith('/download')) {
          // Miembro existente escanea un póster: ya tiene la app → su Mi Código
          router.push('/scan?tab=my-code');
          return;
        }
        if (path.startsWith('/kiosk-confirm')) {
          router.push(`${path}${url.search}`);
          return;
        }
        if (path.startsWith('/affiliate')) {
          router.push(`${path}${url.search}`);
          return;
        }
        if (path.startsWith('/scan') || path.startsWith('/qr') || path.startsWith('/pay')) {
          router.push(`${path}${url.search}`);
        }
      } catch {
        // URL inválida: ignorar
      }
    };

    const handle = App.addListener('appUrlOpen', (event) => route(event.url));
    // Cold start: la app se abrió desde el link
    App.getLaunchUrl().then((launch) => { if (launch?.url) route(launch.url); }).catch(() => {});

    return () => { handle.then((h) => h.remove()).catch(() => {}); };
  }, [router]);

  return null;
}
