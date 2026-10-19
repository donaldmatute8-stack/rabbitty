'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Bookmark, Share2, Sparkles, X, Check, Heart, ExternalLink } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import { useToast } from '@/contexts/ToastContext';

interface FeedCardProps {
  id: string;
  user: string;
  device: string;
  label: string;
  bunz: number;
  imageUrl?: string;
  index: number;
}

export default function FeedCard({ id, user, device, label, bunz, imageUrl, index }: FeedCardProps) {
  const router = useRouter();
  const { showToast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = JSON.parse(localStorage.getItem('rabbitty_madrigueras') || '[]');
        return saved.includes(id);
      } catch {}
    }
    return false;
  });
  const [hopsCount, setHopsCount] = useState<number | null>(null);
  const [hasHopped, setHasHopped] = useState(false);

  // Long press detection ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const startPress = () => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      PlatformBridge.hapticFeedback('medium');
      setMenuOpen(true);
    }, 550);
  };

  const cancelPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    router.push(`/affiliate/${id}`);
  };

  // Toggle "Madriguera" (Guardar negocio)
  const handleToggleMadriguera = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    PlatformBridge.hapticFeedback('medium');
    const nextSaved = !isSaved;
    setIsSaved(nextSaved);
    try {
      const saved = JSON.parse(localStorage.getItem('rabbitty_madrigueras') || '[]');
      const updated = nextSaved ? [...saved, id] : saved.filter((item: string) => item !== id);
      localStorage.setItem('rabbitty_madrigueras', JSON.stringify(updated));
    } catch {}

    showToast(nextSaved ? '🐰 ¡Guardado en tus Madrigueras!' : 'Eliminado de tus Madrigueras', 'success');

    // Registrar en analíticas de negocio
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      fetch('/api/business/interaction', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: id, action: 'SAVE', meta: { saved: nextSaved } })
      }).catch(() => {});
    } catch {}
  };

  // Dar Hop (Like con impacto en recompensas/hops de comunidad)
  const handleHop = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (hasHopped) {
      showToast('Ya diste tu Hop a este negocio hoy 🐾', 'info');
      return;
    }
    PlatformBridge.hapticFeedback('success');
    setHasHopped(true);
    setHopsCount(prev => (prev !== null ? prev + 1 : 1));
    showToast('🐾 ¡Hop registrado! Sumaste a la popularidad de este negocio', 'success');

    try {
      const headers = await PlatformBridge.getAuthHeaders();
      fetch('/api/business/interaction', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: id, action: 'HOP' })
      }).then(r => r.json()).then(data => {
        if (data?.hops) setHopsCount(data.hops);
      }).catch(() => {});
    } catch {}
  };

  // Compartir in-app, whatsapp, telegram o copiar enlace
  const handleShare = async (method: 'native' | 'whatsapp' | 'telegram' | 'copy') => {
    PlatformBridge.hapticFeedback('light');
    const shareUrl = `https://rabbitty.me/affiliate/${id}`;
    const shareText = `¡Mira ${user} en Rabbitty 🐰! Gana +${bunz}% en BUNZ por tus consumos: ${shareUrl}`;

    // Registrar analítica de compartir
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      fetch('/api/business/interaction', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId: id, action: 'SHARE', meta: { channel: method } })
      }).catch(() => {});
    } catch {}

    if (method === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank');
      setMenuOpen(false);
      return;
    }
    if (method === 'telegram') {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(`¡Conoce ${user} en Rabbitty 🐰!`)}`, '_blank');
      setMenuOpen(false);
      return;
    }
    if (method === 'copy') {
      try {
        await navigator.clipboard.writeText(shareUrl);
        showToast('Enlace copiado al portapapeles 📋', 'success');
      } catch {
        showToast('Enlace: ' + shareUrl, 'info');
      }
      setMenuOpen(false);
      return;
    }

    // Native share fallback
    const nav = typeof window !== 'undefined' ? (window.navigator as unknown as { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void>; clipboard?: { writeText: (text: string) => Promise<void> } }) : null;
    if (nav?.share) {
      try {
        await nav.share({ title: user, text: shareText, url: shareUrl });
      } catch {}
    } else if (nav?.clipboard?.writeText) {
      try {
        await nav.clipboard.writeText(shareUrl);
        showToast('Enlace copiado al portapapeles 📋', 'success');
      } catch {}
    } else {
      showToast('Enlace: ' + shareUrl, 'info');
    }
    setMenuOpen(false);
  };

  return (
    <>
      <motion.div
        onClick={handleClick}
        onMouseDown={startPress}
        onMouseUp={cancelPress}
        onMouseLeave={cancelPress}
        onTouchStart={startPress}
        onTouchEnd={cancelPress}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.07, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          width: '100%',
          marginBottom: 16,
          overflow: 'hidden',
          borderRadius: 24,
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          WebkitTouchCallout: 'none',
        }}
        className="active:scale-[0.99] transition-transform select-none"
      >
        {/* Image */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', overflow: 'hidden', background: 'var(--bg-pressed)' }}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={label}
              loading={index < 2 ? 'eager' : 'lazy'}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
            />
          ) : (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, rgba(233,30,99,0.1) 0%, rgba(233,30,99,0.2) 100%)',
              fontSize: 48,
            }}>
              🏪
            </div>
          )}

          {/* Bunz badge */}
          {bunz > 0 && (
            <div style={{
              position: 'absolute', top: 12, right: 12,
              background: 'var(--rabbitty-pink)', color: '#fff',
              fontSize: 11, fontWeight: 900,
              padding: '6px 12px', borderRadius: 999,
              boxShadow: '0 4px 12px rgba(233,30,99,0.4)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />
              +{bunz}% BUNZ
            </div>
          )}

          {/* Pill compartido: Ubicación / Cerca + Tres puntos (...) funcionales */}
          <div 
            style={{
              position: 'absolute', top: 12, left: 12,
              background: 'rgba(12, 12, 16, 0.82)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 999,
              display: 'flex',
              alignItems: 'center',
              padding: '2px 4px 2px 10px',
              gap: 6,
              boxShadow: '0 4px 14px rgba(0,0,0,0.4)',
              zIndex: 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <span style={{ fontSize: 11, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.2px' }}>
              📍 {label}
            </span>

            {/* Separador vertical tenue */}
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.15)' }} />

            {/* Botón de 3 puntos (...) que abre el menú contextual */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                PlatformBridge.hapticFeedback('medium');
                setMenuOpen(true);
              }}
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              className="active:scale-80 transition-transform"
              aria-label="Opciones del negocio"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontWeight: 900, color: 'var(--text-primary)', fontSize: 17, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>{device}</p>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/affiliate/${id}`);
            }}
            style={{
              flexShrink: 0,
              background: 'var(--rabbitty-pink)', color: '#fff',
              fontSize: 12, fontWeight: 700,
              padding: '10px 18px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(233,30,99,0.3)',
            }}
          >
            Ver oferta
          </button>
        </div>
      </motion.div>

      {/* Menú Contextual (Click-hold / 3 puntos) estilo Telegram/iOS */}
      <AnimatePresence>
        {menuOpen && (
          <div 
            className="fixed inset-0 z-200 flex flex-col justify-end p-4 bg-black/75 backdrop-blur-md"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="w-full max-w-sm mx-auto bg-[#18181F] border border-white/10 rounded-[28px] p-4 text-white shadow-2xl flex flex-col gap-2.5"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header del Negocio */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-xl">🐰</span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-black m-0 leading-tight truncate">{user}</h3>
                    <p className="text-[11px] text-white/50 m-0 mt-0.5 truncate">{device} • {label}</p>
                  </div>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/70 border-none cursor-pointer active:scale-90"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Acciones principales */}
              <div className="flex flex-col gap-1.5 pt-1">
                {/* 1. Guardar en Madrigueras */}
                <button
                  type="button"
                  onClick={handleToggleMadriguera}
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-left active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSaved ? 'bg-[#E91E63] text-white' : 'bg-white/10 text-white/80'}`}>
                    <Bookmark size={18} fill={isSaved ? '#fff' : 'none'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-white m-0">
                      {isSaved ? 'En tus Madrigueras' : 'Guardar en Madrigueras'}
                    </p>
                    <p className="text-[11px] text-white/50 m-0">Acceso rápido a tus comercios favoritos</p>
                  </div>
                  {isSaved && <Check size={16} className="text-[#E91E63]" />}
                </button>

                {/* 2. Dar Hop (Like de comunidad para subir en el ranking de afiliados) */}
                <button
                  type="button"
                  onClick={handleHop}
                  className="flex items-center gap-3.5 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 text-left active:scale-[0.98] transition-all cursor-pointer"
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${hasHopped ? 'bg-amber-400 text-black' : 'bg-white/10 text-amber-400'}`}>
                    <Heart size={18} fill={hasHopped ? '#000' : 'none'} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-white m-0">Dar un Hop 🐾</p>
                    <p className="text-[11px] text-white/50 m-0">Recomienda y apoya a este comercio</p>
                  </div>
                  {hopsCount !== null && (
                    <span className="text-xs font-black text-amber-400 px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30">
                      +{hopsCount}
                    </span>
                  )}
                </button>

                {/* 3. Compartir con amigos */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Share2 size={16} className="text-[#E91E63]" />
                    <span className="text-[13px] font-bold text-white">Compartir negocio</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => handleShare('whatsapp')}
                      className="py-2 px-2.5 rounded-xl bg-[#25D366]/15 border border-[#25D366]/30 text-[#25D366] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare('telegram')}
                      className="py-2 px-2.5 rounded-xl bg-[#229ED9]/15 border border-[#229ED9]/30 text-[#229ED9] text-xs font-bold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      Telegram
                    </button>
                    <button
                      type="button"
                      onClick={() => handleShare('copy')}
                      className="py-2 px-2.5 rounded-xl bg-white/10 border border-white/15 text-white text-xs font-bold flex items-center justify-center gap-1 active:scale-95 cursor-pointer"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                {/* 4. Ver perfil completo */}
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    router.push(`/affiliate/${id}`);
                  }}
                  className="w-full py-3 rounded-xl bg-[#E91E63] text-white font-black text-[13px] flex items-center justify-center gap-2 active:scale-98 transition-transform cursor-pointer border-none mt-1"
                >
                  <ExternalLink size={15} />
                  <span>Ver perfil de comercio</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

