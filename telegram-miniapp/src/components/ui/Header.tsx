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
        height: isScrolled ? 'calc(80px + env(safe-area-inset-top))' : 'calc(100px + env(safe-area-inset-top))',
        paddingTop: 'env(safe-area-inset-top)',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'hidden'
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
        <img
          src="/logo_conejo.png"
          alt="Rabbitty Logo"
          className="transition-all duration-500 object-contain"
          style={{
            width: isScrolled ? '120px' : '180px',
            height: isScrolled ? '120px' : '180px',
            marginRight: '-20px',
            filter: 'brightness(0) invert(0.9)',
          }}
        />
      </div>

      <div className="w-10" style={{ opacity: isScrolled ? 0 : 1, transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
    </header>
  );
}
