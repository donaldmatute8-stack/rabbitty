'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle, ScanLine, User } from 'lucide-react';

import { PlatformBridge } from '@/lib/platform';

interface BottomNavProps {
  isDark?: boolean;
}

export default function BottomNav({ isDark }: BottomNavProps = {}) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);

  const isFeed = pathname === '/';
  const isDiscover = pathname === '/chat';
  const isScan = pathname === '/scan';
  const isProfile = pathname === '/profile' || pathname === '/business';

  const effectiveDark = isDark !== undefined ? isDark : isScan;

  useEffect(() => {
    // Scan page requires persistent controls
    if (isScan) {
      setIsVisible(true);
      return;
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || 0;
      const diff = currentScrollY - lastScrollY.current;

      // Always show when close to top
      if (currentScrollY < 40) {
        setIsVisible(true);
        accumulatedDelta.current = 0;
        lastScrollY.current = currentScrollY;
        return;
      }

      // Check scroll direction with threshold buffer to avoid jitter
      if (diff > 12) {
        // Scrolling DOWN -> Hide
        accumulatedDelta.current += diff;
        if (accumulatedDelta.current > 35) {
          setIsVisible(false);
          accumulatedDelta.current = 0;
        }
      } else if (diff < -10) {
        // Scrolling UP -> Show
        accumulatedDelta.current = 0;
        setIsVisible(true);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isScan]);

  const getColor = (isActive: boolean) => {
    if (isActive) return '#E91E63';
    return effectiveDark ? 'rgba(255, 255, 255, 0.55)' : '#777777';
  };

  const handleTabPress = () => {
    PlatformBridge.hapticFeedback('light');
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[100] pointer-events-none flex justify-center px-4 transition-transform duration-300 ease-out"
      style={{
        transform: isVisible ? 'translateY(0)' : 'translateY(120%)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}
    >
      <nav
        className="pointer-events-auto w-full max-w-[390px] rounded-[28px] select-none transition-all duration-300 shadow-[0_10px_35px_rgba(0,0,0,0.45)]"
        style={{
          background: effectiveDark ? 'rgba(18, 18, 22, 0.88)' : 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          border: effectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.08)',
        }}
      >
        <div className="flex items-center justify-around px-3 py-1.5">

          {/* Home / Feed con Ra más grande (tap to top & refresh) */}
          <Link
            href="/"
            onClick={() => {
              handleTabPress();
              if (pathname === '/') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
                window.dispatchEvent(new CustomEvent('rabbitty:refresh-feed'));
              }
            }}
            className="flex items-center justify-center w-12 h-12 active:scale-90 transition-transform"
          >
            <div className="w-[52px] h-[52px] flex items-center justify-center overflow-visible">
              <img
                src="/Ra.png"
                alt="Ra"
                className="w-full h-full object-contain scale-[1.65] transition-transform"
                style={{
                  filter: isFeed 
                    ? 'drop-shadow(0 0 10px rgba(233, 30, 99, 0.45))' 
                    : (effectiveDark ? 'grayscale(100%) opacity(0.45) brightness(1.7)' : 'grayscale(100%) opacity(0.35)')
                }}
              />
            </div>
          </Link>

          {/* Chat / Mensajes */}
          <Link href="/chat" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isDiscover) }}>
            <MessageCircle className="w-[25px] h-[25px]" strokeWidth={2.2} />
          </Link>

          {/* Scan */}
          <Link href="/scan" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isScan) }}>
            <ScanLine className="w-[25px] h-[25px]" strokeWidth={2.2} />
          </Link>

          {/* Profile */}
          <Link href="/profile" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isProfile) }}>
            <User className="w-[25px] h-[25px]" strokeWidth={2.2} />
          </Link>

        </div>
      </nav>
    </div>
  );
}
