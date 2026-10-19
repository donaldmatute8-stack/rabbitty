'use client';

import { useState } from 'react';
import { Smartphone, QrCode, X, ArrowUpRight } from 'lucide-react';
import { SimpleQRCode } from '@/components/SimpleQRCode';

interface SmartAppActionProps {
  affiliateId: string;
  affiliateName: string;
  buttonLabel?: string;
  variant?: 'primary' | 'outline' | 'pill' | 'subtle';
  className?: string;
}

export function SmartAppAction({
  affiliateId,
  affiliateName,
  buttonLabel = 'Abrir en Rabbitty',
  variant = 'primary',
  className = '',
}: SmartAppActionProps) {
  const [showQRModal, setShowQRModal] = useState(false);

  const appDirectLink = `https://app.rabbitty.me/affiliate/${affiliateId}`;
  const appStoreLink = 'https://apps.apple.com/app/rabbitty/id6740000000'; // App Store listing fallback

  const handleClick = (e: React.MouseEvent) => {
    if (typeof window === 'undefined') return;

    // Detect mobile device
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );

    if (isMobile) {
      // In mobile, try opening the Telegram mini-app / native app directly
      window.location.href = appDirectLink;
    } else {
      // In desktop web, open the interactive QR modal so user can scan with their phone
      e.preventDefault();
      setShowQRModal(true);
    }
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'outline':
        return 'border border-amber-900/30 text-amber-950 hover:bg-amber-900/5 bg-transparent';
      case 'pill':
        return 'bg-amber-950 hover:bg-amber-900 text-amber-50 shadow-md shadow-amber-950/20';
      case 'subtle':
        return 'bg-amber-900/10 hover:bg-amber-900/20 text-amber-900';
      case 'primary':
      default:
        return 'bg-[#2C1810] hover:bg-[#3D2318] text-[#FDFBF7] shadow-lg shadow-black/10';
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${getVariantStyles()} ${className}`}
      >
        <span>{buttonLabel}</span>
        <ArrowUpRight size={15} />
      </button>

      {/* Interactive Content-Aware QR Modal for Desktop Visitors */}
      {showQRModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl bg-[#FDFBF7] text-[#2C1810] p-7 shadow-2xl border border-stone-200 text-center space-y-5 animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setShowQRModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full text-stone-400 hover:text-stone-800 hover:bg-stone-100 transition-colors"
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>

            {/* Modal Header */}
            <div className="space-y-1.5 pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-[10px] font-black uppercase tracking-widest">
                <Smartphone size={12} /> Escanea con tu Cámara
              </div>
              <h3 className="text-xl font-black tracking-tight text-stone-900">
                Abre la Sucursal en Rabbitty
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed max-w-xs mx-auto">
                Escanea el código con tu celular para consultar el menú, acumular Bunz y pedir en mesa en{' '}
                <strong>{affiliateName}</strong>.
              </p>
            </div>

            {/* QR Code Container */}
            <div className="flex justify-center py-2">
              <div className="p-3 bg-white rounded-2xl shadow-inner border border-stone-200">
                <SimpleQRCode value={appDirectLink} size={190} color="#2C1810" bgColor="#FFFFFF" />
              </div>
            </div>

            {/* Alternative Action */}
            <div className="pt-2 border-t border-stone-200/80 space-y-2">
              <p className="text-[11px] text-stone-500">¿Estás en tu computadora y quieres ver la app?</p>
              <a
                href={appDirectLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-amber-800 hover:text-amber-900 underline underline-offset-4"
              >
                <span>Continuar a Telegram Web</span>
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
