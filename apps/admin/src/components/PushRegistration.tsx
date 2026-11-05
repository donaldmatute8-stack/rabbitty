'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Registro de push para la app nativa del POS (bundle com.rabbitty.pos).
 *
 * Solo corre en nativo: en web no cambia nada (ahí manda el aviso del navegador
 * de EnableNotificationsBanner). Guarda el token APNs con su `appId` para que
 * el sender sepa qué `apns-topic` usar.
 */
export function PushRegistration() {
  useEffect(() => {
    let disposed = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    (async () => {
      try {
        if (!Capacitor.isNativePlatform()) return;
        const platform = Capacitor.getPlatform();
        if (platform !== 'ios' && platform !== 'android') return;

        const { PushNotifications } = await import('@capacitor/push-notifications');

        const permission = await PushNotifications.requestPermissions();
        if (permission.receive !== 'granted' || disposed) return;

        handles.push(
          await PushNotifications.addListener('registration', (token) => {
            fetch('/api/push/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: token.value,
                platform,
                appId: 'com.rabbitty.pos',
              }),
            }).catch((err) => console.warn('[POS push] no se pudo guardar el token:', err));
          }),
        );

        handles.push(
          await PushNotifications.addListener('registrationError', (err) => {
            console.warn('[POS push] registrationError:', err);
          }),
        );

        await PushNotifications.register();
      } catch (err) {
        // Sin plugin (web o build viejo) no debe romper el POS.
        console.warn('[POS push] no disponible:', err);
      }
    })();

    return () => {
      disposed = true;
      handles.forEach((h) => void h.remove().catch(() => undefined));
    };
  }, []);

  return null;
}
