'use client';

import { useState, useEffect } from 'react';
import { Utensils, MapPin, ExternalLink } from 'lucide-react';
import { SmartAppAction } from './SmartAppAction';

interface StickyMobileBarProps {
  affiliateId: string;
  affiliateName: string;
  address: string;
  hasMenu: boolean;
}

export function StickyMobileBar({
  affiliateId,
  affiliateName,
  address,
  hasMenu,
}: StickyMobileBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky bar after scrolling past 300px
      if (window.scrollY > 280) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${affiliateName} ${address}`
  )}`;

  const scrollToMenu = () => {
    const el = document.getElementById('menu-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden bg-[#FAF8F5]/90 backdrop-blur-xl border-t border-stone-200/80 px-4 py-3 transition-all duration-300 transform ${
        isVisible ? 'translate-y-0 opacity-100 shadow-[0_-8px_25px_rgba(0,0,0,0.08)]' : 'translate-y-full opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
        {hasMenu && (
          <button
            onClick={scrollToMenu}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold transition-colors"
          >
            <Utensils size={14} className="text-amber-800" />
            <span>Menú</span>
          </button>
        )}

        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-900 text-xs font-bold transition-colors no-underline"
        >
          <MapPin size={14} className="text-stone-700" />
          <span>Llegar</span>
        </a>

        <div className="flex-1">
          <SmartAppAction
            affiliateId={affiliateId}
            affiliateName={affiliateName}
            buttonLabel="Pedir"
            className="w-full py-2.5 px-3 text-[11px] justify-center"
          />
        </div>
      </div>
    </div>
  );
}
