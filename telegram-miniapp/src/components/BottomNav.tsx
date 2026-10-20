'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { MessageCircle, ScanLine, User } from 'lucide-react';
import useSWR from 'swr';

import { PlatformBridge } from '@/lib/platform';
import { useTheme } from '@/contexts/ThemeContext';

const unreadFetcher = async (url: string) => {
  const headers = await PlatformBridge.getAuthHeaders();
  return fetch(url, { headers }).then((res) => res.json());
};

interface BottomNavProps {
  isDark?: boolean;
}

export default function BottomNav({ isDark }: BottomNavProps = {}) {
  const pathname = usePathname();
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const accumulatedDelta = useRef(0);

  const { isDark: themeIsDark } = useTheme();

  const { data: unreadData } = useSWR<{ totalUnread?: number }>('/api/chat/unread', unreadFetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });
  const unreadCount = unreadData?.totalUnread || 0;

  const isFeed = pathname === '/';
  const isDiscover = pathname === '/chat';
  const isScan = pathname === '/scan';
  const isProfile = pathname?.startsWith('/profile') || false;

  const effectiveDark = isDark ?? themeIsDark;

  // Scan page requires persistent controls (derived, not set in an effect)
  const navVisible = isScan || isVisible;

  useEffect(() => {
    if (isScan) return;

    const handleScroll = () => {
      const currentScrollY = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const diff = currentScrollY - lastScrollY.current;

      // Always show when close to top
      if (currentScrollY < 60) {
        setIsVisible(true);
        accumulatedDelta.current = 0;
        lastScrollY.current = currentScrollY;
        return;
      }

      // Check scroll direction
      if (diff > 8) {
        // Scrolling DOWN -> accumulate and hide
        accumulatedDelta.current += diff;
        if (accumulatedDelta.current > 25) {
          setIsVisible(false);
          accumulatedDelta.current = 0;
        }
      } else if (diff < -5) {
        // Scrolling UP -> reveal immediately
        accumulatedDelta.current = 0;
        setIsVisible(true);
      }

      lastScrollY.current = Math.max(0, currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    document.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('scroll', handleScroll);
    };
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
      className="fixed bottom-0 left-0 right-0 z-100 pointer-events-none flex justify-center px-4 transition-transform duration-300 ease-out"
      style={{
        transform: navVisible ? 'translateY(0)' : 'translateY(120%)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)',
      }}
    >
      <nav
        className="pointer-events-auto w-full max-w-97.5 rounded-[28px] select-none transition-all duration-300 shadow-[0_10px_35px_rgba(0,0,0,0.45)]"
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
            onClick={(e) => {
              handleTabPress();
              if (pathname === '/') {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent('rabbitty:refresh-feed'));
              }
            }}
            className="flex items-center justify-center w-12 h-12 active:scale-90 transition-transform"
          >
            <div className="w-13 h-13 flex items-center justify-center overflow-visible">
              <Image
                src="/Ra.png"
                alt="Ra"
                width={52}
                height={52}
                priority
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
          <Link href="/chat" onClick={handleTabPress} className="relative flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isDiscover) }}>
            <MessageCircle className="w-6.25 h-6.25" strokeWidth={2.2} />
            {unreadCount > 0 && (
              <span
                className="absolute top-1 right-1 min-w-4.5 h-4.5 px-1 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                style={{ background: '#E91E63', boxShadow: '0 0 10px rgba(233,30,99,0.5)' }}
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>

          {/* Scan */}
          <Link href="/scan" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isScan) }}>
            <ScanLine className="w-6.25 h-6.25" strokeWidth={2.2} />
          </Link>

          {/* Perfil */}
          <Link href="/profile" onClick={handleTabPress} className="flex items-center justify-center w-12 h-12 active:scale-90 transition-all" style={{ color: getColor(isProfile) }}>
            <User className="w-6.25 h-6.25" strokeWidth={2.2} />
          </Link>

        </div>
      </nav>
    </div>
  );
}
