'use client';

import Image from 'next/image';
import { ChevronLeft } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';

interface HeaderProps {
  onBack?: () => void;
  showBack?: boolean;
}

export default function Header({ onBack, showBack = true }: HeaderProps) {
  const { balance } = useWallet();

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-white sticky top-0 z-[60]">
      {showBack ? (
        <button 
          onClick={onBack || (() => window.history.back())}
          className="p-2 -ml-2 text-[#111111] active:opacity-60 transition-opacity"
        >
          <ChevronLeft className="w-6 h-6" strokeWidth={1.5} />
        </button>
      ) : (
        <div className="w-10" />
      )}
      
      {/* Logo Conejo Centrado */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center">
        <Image 
          src="/logo-main.png" 
          alt="Rabbitty" 
          width={40} 
          height={40} 
          className="object-contain opacity-90"
          priority 
        />
      </div>
      
      {/* Spacer para mantener balance (Right Side) */}
      <div className="w-10" />
    </header>
  );
}
