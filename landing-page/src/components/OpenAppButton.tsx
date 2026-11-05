'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

interface OpenAppButtonProps {
  children: React.ReactNode;
  className?: string;
  affiliateId?: string;
}

function detectPlatform(): 'ios' | 'android' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = window.navigator.userAgent || '';
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isIOS) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
}

/**
 * Botón "Abrir App" content-aware.
 *
 * - iOS (iPhone/iPad/Mac Catalyst): TestFlight hoy (o App Store al cambiar
 *   NEXT_PUBLIC_IOS_APP_URL).
 * - Android: APK / Play Store vía NEXT_PUBLIC_ANDROID_APP_URL.
 * - Desktop: NO abre la web app embebida; manda a /download con el QR para
 *   instalar en el teléfono.
 */
export default function OpenAppButton({ children, className = '', affiliateId }: OpenAppButtonProps) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  const IOS_APP_URL =
    process.env.NEXT_PUBLIC_IOS_APP_URL || 'https://testflight.apple.com/join/HyY1eVSU';
  const ANDROID_APP_URL =
    process.env.NEXT_PUBLIC_ANDROID_APP_URL || 'https://rabbitty.me/rabbitty-app.apk';
  const downloadUrl = affiliateId
    ? `/download?ref=${encodeURIComponent(affiliateId)}`
    : '/download';

  useEffect(() => {
    queueMicrotask(() => setPlatform(detectPlatform()));
  }, []);

  const handleClick = () => {
    if (platform === 'ios') {
      window.location.href = IOS_APP_URL;
      return;
    }
    if (platform === 'android') {
      window.location.href = ANDROID_APP_URL;
      return;
    }
    // Desktop: no hay app de escritorio; mostramos la página de descarga con QR.
    window.location.href = downloadUrl;
  };

  return (
    <button
      onClick={handleClick}
      className={className}
      aria-label={
        platform === 'ios'
          ? 'Instalar la app en iPhone'
          : platform === 'android'
            ? 'Descargar la app en Android'
            : 'Ver cómo instalar la app'
      }
    >
      {children}
      {platform === 'desktop' && <ArrowUpRight size={18} className="ml-1 inline" />}
    </button>
  );
}
