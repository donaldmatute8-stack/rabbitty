'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, ScanLine, User } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const isFeed = pathname === '/';
  const isDiscover = pathname === '/chat';
  const isScan = pathname === '/scan';
  const isProfile = pathname === '/profile' || pathname === '/business';

  const getColor = (isActive: boolean) => isActive ? '#E91E63' : '#111111';

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white z-[100]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 20px)' }}
    >
      <div className="flex items-center justify-between px-6 py-3">

        {/* Home / Feed */}
        <Link href="/" className="flex flex-col items-center justify-center w-16 h-16">
          <div className="w-[80px] h-[80px] flex items-center justify-center">
            <img
              src="/Ra.png"
              alt="Ra"
              className="w-full h-full object-contain scale-110"
              style={{ filter: isFeed ? 'none' : 'grayscale(100%) opacity(0.5)' }}
            />
          </div>
        </Link>

        {/* Chat / Mensajes */}
        <Link href="/chat" className="flex flex-col items-center justify-center w-16 h-16 transition-colors" style={{ color: getColor(isDiscover) }}>
          <MessageCircle className="w-[30px] h-[30px]" strokeWidth={1.8} />
        </Link>

        {/* Scan */}
        <Link href="/scan" className="flex flex-col items-center justify-center w-16 h-16 transition-colors" style={{ color: getColor(isScan) }}>
          <ScanLine className="w-[30px] h-[30px]" strokeWidth={1.8} />
        </Link>

        {/* Profile */}
        <Link href="/profile" className="flex flex-col items-center justify-center w-16 h-16 transition-colors" style={{ color: getColor(isProfile) }}>
          <User className="w-[30px] h-[30px]" strokeWidth={1.8} />
        </Link>

      </div>
    </nav>
  );
}
