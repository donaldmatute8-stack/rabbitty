'use client';

import { ChevronLeft } from 'lucide-react';

interface HeaderProps {
  onBack?: () => void;
  showBack?: boolean;
  isScrolled?: boolean;
  isDark?: boolean;
}

export default function Header({ onBack, showBack, isScrolled = false, isDark = false }: HeaderProps) {
  return (
    <header
      className={`relative flex items-center justify-between px-4 transition-all duration-500 ${isDark ? 'bg-transparent text-white' : 'bg-white text-[#111111]'}`}
      style={{
        height: isScrolled ? '70px' : '100px',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {showBack !== false ? (
        <button
          onClick={onBack || (() => window.history.back())}
          className={`p-2 -ml-2 active:opacity-60 z-10 transition-all duration-500 ${isDark ? 'text-white' : 'text-[#111111]'}`}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none" style={{ display: 'block' }}>
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        <div className="w-10" />
      )}

      <div
        className="absolute flex items-center justify-center pointer-events-none"
        style={{
          left: isScrolled ? 'auto' : '50%',
          right: isScrolled ? '16px' : 'auto',
          transform: isScrolled ? 'translateY(-50%)' : 'translate(-50%, -50%)',
          top: '50%',
          transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <svg
          viewBox="0 0 38 48"
          fill="none"
          className="transition-all duration-500"
          style={{
            width: isScrolled ? '18px' : '36px',
            height: isScrolled ? '22px' : '44px',
            marginTop: isScrolled ? '0px' : '8px',
          }}
        >
          <path d="M11 1C11 1 7 4 7 14C7 20 9.5 23 13 23C16.5 23 18 19 18 14C18 6.5 14 1 11 1Z" fill={isDark ? "#FFF" : "#111"}/>
          <path d="M27 1C27 1 31 4 31 14C31 20 28.5 23 25 23C21.5 23 20 19 20 14C20 6.5 24 1 27 1Z" fill={isDark ? "#FFF" : "#111"}/>
          <ellipse cx="19" cy="33" rx="14" ry="12" fill={isDark ? "#FFF" : "#111"}/>
        </svg>
      </div>

      <div className="w-10" style={{ opacity: isScrolled ? 0 : 1, transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
    </header>
  );
}
