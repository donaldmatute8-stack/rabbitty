'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ScanLine, MapPin, User } from 'lucide-react';

export default function BottomNav() {
  const pathname = usePathname();

  const isFeed = pathname === '/';
  const isDiscover = pathname === '/discover';
  const isScan = pathname === '/scan';
  const isProfile = pathname === '/profile' || pathname === '/business';

  const getColor = (isActive: boolean) => isActive ? '#E91E63' : '#8A8A8A';

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 pb-[env(safe-area-inset-bottom,20px)] z-[100]">
      <div className="flex items-center justify-between px-6 py-2">
        
        {/* Home / Feed */}
        <Link href="/" className="flex flex-col items-center justify-center w-14 h-14">
          <div className="w-8 h-8 flex items-center justify-center">
            <img 
              src="/logo-main.png" 
              alt="Ra"
              className="w-full h-full object-contain opacity-80"
              style={{ filter: isFeed ? 'brightness(0) saturate(100%) invert(27%) sepia(85%) saturate(3015%) hue-rotate(325deg) brightness(97%) contrast(93%)' : 'none' }}
            />
          </div>
        </Link>
        
        {/* Discover / Mapa / Explorar */}
        <Link href="/discover" className="flex flex-col items-center justify-center w-14 h-14 transition-colors" style={{ color: getColor(isDiscover) }}>
          <MapPin className="w-6 h-6" strokeWidth={1.5} />
        </Link>
        
        {/* Scan — QR Scanner destacado */}
        <Link href="/scan" className="flex flex-col items-center justify-center w-14 h-14">
          <div 
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${isScan ? 'bg-[#E91E63] text-white shadow-lg shadow-[#E91E63]/25' : 'bg-gray-100 text-[#8A8A8A]'}`}
          >
            <ScanLine className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </Link>
        
        {/* Profile */}
        <Link href="/profile" className="flex flex-col items-center justify-center w-14 h-14 transition-colors" style={{ color: getColor(isProfile) }}>
          <User className="w-6 h-6" strokeWidth={1.5} />
        </Link>

      </div>
    </nav>
  );
}
