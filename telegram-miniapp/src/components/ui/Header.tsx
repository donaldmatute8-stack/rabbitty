'use client';

import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';

interface HeaderProps {
  onBack?: () => void;
  showBack?: boolean;
  isScrolled?: boolean;
}

export default function Header({ onBack, showBack = true, isScrolled = false }: HeaderProps) {
  const { balance } = useWallet();

  return (
    <header
      className="relative flex items-center justify-between px-4 bg-white"
      style={{
        height: isScrolled ? '70px' : '100px',
        marginBottom: isScrolled ? '0px' : '0px',
        transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {showBack ? (
        <button
          onClick={onBack || (() => window.history.back())}
          className="p-2 -ml-2 text-[#111111] active:opacity-60 z-10"
          style={{ transition: 'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
        </button>
      ) : (
        <div className="w-10" />
      )}

      {/* Logo Original Centrado/Derecho con animación */}
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
          src="/logo.png"
          alt="Rabbitty"
          className="h-auto object-contain"
          style={{
            width: isScrolled ? '20px' : '40px',
            marginTop: isScrolled ? '0px' : '8px',
            transition: 'all 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        />
      </div>

      {/* Spacer para mantener balance (Right Side, oculto al estar comprimido) */}
      <div className="w-10" style={{ opacity: isScrolled ? 0 : 1, transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }} />
    </header>
  );
}
