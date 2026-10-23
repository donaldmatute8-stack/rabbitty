'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Smartphone, X, ArrowUpRight } from 'lucide-react';
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

    const downloadUrl = `https://rabbitty.me/download?ref=${affiliateId}`;

    return (
      <>
        <button
          onClick={handleClick}
          className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-xs uppercase tracking-wider transition-all duration-300 active:scale-95 cursor-pointer ${getVariantStyles()} ${className}`}
        >
          <span>{buttonLabel}</span>
          <ArrowUpRight size={15} />
        </button>

        {/* Interactive Content-Aware QR Modal for Desktop Visitors (Portaled to document.body) */}
        {showQRModal && typeof document !== 'undefined' && createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
            onClick={() => setShowQRModal(false)}
          >
            <div
              className="relative w-full max-w-sm rounded-3xl bg-[#121218] text-white p-7 sm:p-8 shadow-2xl border border-pink-500/30 text-center space-y-5 animate-in zoom-in-95 duration-200 my-auto"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setShowQRModal(false)}
                className="absolute top-4 right-4 p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>

              {/* Modal Header */}
              <div className="space-y-1.5 pt-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/15 text-pink-400 border border-pink-500/30 text-[10px] font-mono font-bold uppercase tracking-widest">
                  <Smartphone size={12} /> Escanea con tu iPhone / Celular
                </div>
                <h3 className="text-xl font-black tracking-tight text-white">
                  Abre la Sucursal en Rabbitty
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                  Apunta con la cámara de tu celular para abrir en <strong>{affiliateName}</strong>, acumular <strong className="text-pink-400">bunz</strong> y ver promociones exclusivas.
                </p>
              </div>

              {/* QR Code Container - Ultra sharp and centered */}
              <div className="flex justify-center py-2">
                <div className="p-4 bg-white rounded-3xl shadow-2xl border border-white/20">
                  <SimpleQRCode value={downloadUrl} size={200} color="#000000" bgColor="#FFFFFF" />
                </div>
              </div>

              {/* Alternative Action */}
              <div className="pt-3 border-t border-zinc-800 space-y-2">
                <p className="text-[11px] text-zinc-400">¿Estás en tu computadora y quieres abrir el enlace?</p>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-black text-pink-400 hover:text-pink-300 underline underline-offset-4"
                >
                  <span>Abrir enlace de descarga directa</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
}
