'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PlatformBridge } from '@/lib/platform';

/**
 * El portal de negocio no vive en la app nativa (Apple 2.1/3.1.1): es una app
 * de consumo. En nativo se regresa al inicio; en web/Telegram sigue igual.
 */
export default function BusinessDashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (PlatformBridge.isNative()) router.replace('/');
  }, [router]);

  return <>{children}</>;
}
