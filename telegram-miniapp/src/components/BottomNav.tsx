'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, ScanLine, User } from 'lucide-react';

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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[100] transition-colors duration-300"
      style={{
        background: effectiveDark ? 'rgba(15, 15, 15, 0.96)' : 'rgba(255, 255, 255, 0.96)',
        backdropFilter: 'blur(20px)',
        borderTop: effectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.06)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
      }}
    >
      <div className="flex items-center justify-around max-w-[420px] mx-auto px-4 pt-2 pb-1">

        {/* Home / Feed */}
        <Link href="/" className="flex items-center justify-center w-12 h-12">
          <div className="w-[44px] h-[44px] flex items-center justify-center">
            <img
              src="/Ra.png"
              alt="Ra"
              className="w-full h-full object-contain"
              style={{
                filter: isFeed 
                  ? 'none' 
                  : (effectiveDark ? 'grayscale(100%) opacity(0.4) brightness(1.6)' : 'grayscale(100%) opacity(0.35)')
              }}
            />
          </div>
        </Link>

        {/* Chat / Mensajes */}
        <Link href="/chat" className="flex items-center justify-center w-12 h-12 transition-colors" style={{ color: getColor(isDiscover) }}>
          <MessageCircle className="w-[24px] h-[24px]" strokeWidth={2} />
        </Link>

        {/* Scan */}
        <Link href="/scan" className="flex items-center justify-center w-12 h-12 transition-colors" style={{ color: getColor(isScan) }}>
          <ScanLine className="w-[24px] h-[24px]" strokeWidth={2} />
        </Link>

        {/* Profile */}
        <Link href="/profile" className="flex items-center justify-center w-12 h-12 transition-colors" style={{ color: getColor(isProfile) }}>
          <User className="w-[24px] h-[24px]" strokeWidth={2} />
        </Link>

      </div>
    </nav>
  );
}
