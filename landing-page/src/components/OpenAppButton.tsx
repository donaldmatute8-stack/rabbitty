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
 * Content-aware "Open App" button:
 * - iOS (iPhone/iPad/Mac Catalyst): App Store / TestFlight via NEXT_PUBLIC_IOS_APP_URL
 * - Android: APK or Play Store via NEXT_PUBLIC_ANDROID_APP_URL
 * - Desktop: native app deep link (app.rabbitty.me) — opens the desktop app; falls back to /download
 */
export default function OpenAppButton({ children, className = '', affiliateId }: OpenAppButtonProps) {
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  const IOS_APP_URL =
    process.env.NEXT_PUBLIC_IOS_APP_URL || 'https://apps.apple.com/app/rabbitty/id6739891234';
  const ANDROID_APP_URL =
    process.env.NEXT_PUBLIC_ANDROID_APP_URL || 'https://rabbitty.me/rabbitty-app.apk';
  const appLink = affiliateId
    ? `https://app.rabbitty.me/affiliate/${affiliateId}`
    : 'https://app.rabbitty.me';

  useEffect(() => {
    queueMicrotask(() => setPlatform(detectPlatform()));
  }, []);

  const handleClick = (e: React.MouseEvent) => {
    if (platform === 'ios') {
      window.location.href = IOS_APP_URL;
      return;
    }
    if (platform === 'android') {
      window.location.href = ANDROID_APP_URL;
      return;
    }
    // Desktop: try the native app deep link, then fall back to /download
    e.preventDefault();
    const t = window.setTimeout(() => {
      window.location.href = '/download';
    }, 1500);
    const clear = () => window.clearTimeout(t);
    window.addEventListener('pagehide', clear, { once: true });
    window.addEventListener('blur', clear, { once: true });
    window.location.href = appLink;
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
      {platform === 'desktop' && <ArrowUpRight size={18} className="inline ml-1" />}
    </button>
  );
}