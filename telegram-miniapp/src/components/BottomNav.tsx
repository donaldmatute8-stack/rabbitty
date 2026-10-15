'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, ScanLine, User } from 'lucide-react';

import { PlatformBridge } from '@/lib/platform';

interface BottomNavProps {
  isDark?: boolean;
}

export default function BottomNav({ isDark }: BottomNavProps = {}) {
  const pathname = usePathname();

  const isFeed = pathname === '/';
  const isDiscover = pathname === '/chat';
  const isScan = pathname === '/scan';
  const isProfile = pathname === '/profile' || pathname === '/business';

  const effectiveDark = isDark !== undefined ? isDark : isScan;

  const getColor = (isActive: boolean) => {
    if (isActive) return '#E91E63';
    return effectiveDark ? 'rgba(255, 255, 255, 0.45)' : '#777777';
  };

  const handleTabPress = () => {
    PlatformBridge.hapticFeedback('light');
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] transition-colors duration-300 select-none"
      style={{
        background: effectiveDark ? 'rgba(12, 12, 12, 0.94)' : 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: effectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}
    >
      <div className="flex items-center justify-around max-w-[420px] mx-auto px-4 pt-2 pb-1">

        {/* Home / Feed */}
        <Link href="/" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-transform">
          <div className="w-[46px] h-[46px] flex items-center justify-center">
            <img
              src="/Ra.png"
              alt="Ra"
              className="w-full h-full object-contain scale-[1.38] transition-transform"
              style={{
                filter: isFeed 
                  ? 'none' 
                  : (effectiveDark ? 'grayscale(100%) opacity(0.4) brightness(1.6)' : 'grayscale(100%) opacity(0.35)')
              }}
            />
          </div>
        </Link>

        {/* Chat / Mensajes */}
        <Link href="/chat" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isDiscover) }}>
          <MessageCircle className="w-[24px] h-[24px]" strokeWidth={2} />
        </Link>

        {/* Scan */}
        <Link href="/scan" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isScan) }}>
          <ScanLine className="w-[24px] h-[24px]" strokeWidth={2} />
        </Link>

        {/* Profile */}
        <Link href="/profile" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isProfile) }}>
          <User className="w-[24px] h-[24px]" strokeWidth={2} />
        </Link>

      </div>
    </nav>
  );
}
