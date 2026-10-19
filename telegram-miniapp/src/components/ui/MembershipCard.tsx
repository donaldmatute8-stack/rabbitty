'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Sparkles, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import RabbittyCode from '@/components/ui/RabbittyCode';
import { useTheme } from '@/contexts/ThemeContext';

import Image from 'next/image';

interface MembershipCardProps {
  user: {
    id?: string;
    telegramId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    totalBunzEarned?: number;
    totalBunzSpent?: number;
  } | null;
  levelName?: string;
  isDark?: boolean;
}

export default function MembershipCard({ user, levelName = '1', isDark: isDarkProp }: MembershipCardProps) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = isDarkProp ?? themeIsDark;
  const [showQrModal, setShowQrModal] = useState(false);

  const bunzBalance = (user?.totalBunzEarned || 0) - (user?.totalBunzSpent || 0);
  const qrIdentifier = user?.id || user?.telegramId || 'rabbitty_guest';
  const memberName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Explorador Rabbitty';
  const username = user?.username ? `@${user.username}` : '@miembro';

  const handleOpenModal = () => {
    PlatformBridge.hapticFeedback('medium');
    setShowQrModal(true);
  };

  const handleCloseModal = () => {
    PlatformBridge.hapticFeedback('light');
    setShowQrModal(false);
  };

  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('rabbitty_pass_collapsed') === 'true';
      } catch {}
    }
    return false;
  });

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    PlatformBridge.hapticFeedback('light');
    setIsCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem('rabbitty_pass_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  return (
    <>
      {/* ── CARD HERO COMPONENT ── */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="w-full relative overflow-hidden rounded-3xl mb-5 cursor-pointer select-none"
        style={{
          padding: isCollapsed ? '12px 16px 18px' : '20px 20px 26px',
          background: isDark
            ? 'linear-gradient(135deg, #18181B 0%, #111113 45%, #240C1A 100%)'
            : 'linear-gradient(135deg, #FFFFFF 0%, #FFF5F8 50%, #FFE4EE 100%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(233, 30, 99, 0.15)',
          boxShadow: isDark
            ? '0 12px 36px -10px rgba(0, 0, 0, 0.7), 0 0 24px -6px rgba(233, 30, 99, 0.15)'
            : '0 12px 30px -10px rgba(233, 30, 99, 0.15), 0 4px 12px rgba(0, 0, 0, 0.04)',
        }}
        onClick={handleOpenModal}
      >
        {/* Holographic glowing orb background effect */}
        <div 
          className="absolute -right-8 -top-8 w-44 h-44 rounded-full pointer-events-none blur-3xl opacity-30" 
          style={{ background: 'radial-gradient(circle, #E91E63 0%, transparent 70%)' }}
        />

        {/* Top Header inside Card (Only when expanded) */}
        {!isCollapsed && (
          <div className="flex items-center justify-between relative z-10 mb-4">
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center p-1 backdrop-blur-md relative ${isDark ? 'bg-black/40 border border-white/10' : 'bg-pink-500/10 border border-pink-500/20'}`}>
                <Image src="/logo_conejo.png" alt="Rabbitty" width={24} height={24} priority className="object-contain filter drop-shadow-[0_0_8px_rgba(233,30,99,0.8)]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[#E91E63]">RABBITTY PASS</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-slate-900/5 text-slate-800 border border-slate-900/10'}`}>
                    Lvl. {levelName}
                  </span>
                </div>
                <p className={`text-xs font-bold m-0 leading-tight ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{username}</p>
              </div>
            </div>

            <div className={`flex items-center gap-1 text-[11px] font-extrabold text-[#E91E63] px-2.5 py-1 rounded-full border ${isDark ? 'bg-[#E91E63]/10 border-[#E91E63]/25' : 'bg-[#E91E63]/15 border-[#E91E63]/30'}`}>
              <Sparkles size={12} />
              <span>Digital Club</span>
            </div>
          </div>
        )}

        {/* Essential / Collapsible View */}
        {isCollapsed ? (
          <div className="flex items-center justify-between relative z-10">
            {/* Left: Brand + Level + Username */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center p-1 backdrop-blur-md shrink-0 relative ${isDark ? 'bg-black/40 border border-white/10' : 'bg-pink-500/10 border border-pink-500/20'}`}>
                <Image src="/logo_conejo.png" alt="Rabbitty" width={22} height={22} priority className="object-contain filter drop-shadow-[0_0_8px_rgba(233,30,99,0.8)]" />
              </div>
              <div className="min-w-0 truncate">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#E91E63]">RABBITTY PASS</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-slate-900/5 text-slate-800 border border-slate-900/10'}`}>
                    Lvl. {levelName}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white/45' : 'text-slate-500'}`}>Saldo:</span>
                  <span className={`text-sm font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {bunzBalance.toLocaleString()}
                  </span>
                  <span className="text-[10px] font-black text-[#E91E63]">BUNZ</span>
                </div>
              </div>
            </div>

            {/* Right: Quick Action QR Button */}
            <button
              type="button"
              onClick={handleOpenModal}
              className="flex items-center gap-1.5 bg-[#E91E63] hover:bg-[#D81B60] active:scale-95 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-[0_4px_12px_rgba(233,30,99,0.35)] cursor-pointer border-none shrink-0"
            >
              <QrCode size={13} />
              <span>Ver QR</span>
            </button>
          </div>
        ) : (
          <>
            {/* Middle: Bunz Balance Display */}
            <div className="my-2 relative z-10">
              <span className={`text-[11px] font-bold uppercase tracking-wider block mb-0.5 ${isDark ? 'text-white/45' : 'text-slate-500'}`}>Saldo acumulado</span>
              <div className="flex items-baseline gap-2">
                <span className={`text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {bunzBalance.toLocaleString()}
                </span>
                <span className="text-lg font-black text-[#E91E63] tracking-wide">BUNZ</span>
              </div>
            </div>

            {/* Bottom Bar: Member info and CTA to show barcode */}
            <div className={`flex items-center justify-between pt-3 border-t relative z-10 mt-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
              <div className="truncate max-w-50">
                <p className={`text-[13px] font-extrabold truncate m-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>{memberName}</p>
                <p className={`text-[10px] font-mono m-0 ${isDark ? 'text-white/40' : 'text-slate-400'}`}>ID: {String(qrIdentifier).slice(0, 14)}...</p>
              </div>

              <button
                type="button"
                className="flex items-center gap-1.5 bg-[#E91E63] hover:bg-[#D81B60] active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-full shadow-[0_4px_14px_rgba(233,30,99,0.35)] transition-all cursor-pointer border-none"
              >
                <QrCode size={14} />
                <span>Ver QR</span>
                <ChevronRight size={12} />
              </button>
            </div>
          </>
        )}

        {/* Pill triangular en el centro inferior para comprimir/expandir */}
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? 'Expandir tarjeta Rabbitty Pass' : 'Comprimir tarjeta Rabbitty Pass'}
          title={isCollapsed ? 'Expandir tarjeta' : 'Comprimir tarjeta'}
          className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center cursor-pointer border-none"
          style={{
            background: 'transparent',
            padding: 0,
            outline: 'none',
          }}
        >
          <div
            className="flex items-center justify-center px-3.5 py-0.5 rounded-t-lg transition-transform active:scale-90"
            style={{
              background: isDark ? 'rgba(36, 36, 44, 0.95)' : 'rgba(255, 235, 242, 0.95)',
              border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(233, 30, 99, 0.25)',
              borderBottom: 'none',
              boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.15)',
            }}
          >
            {/* Triángulo indicador (apuntando arriba al expandir, abajo al comprimir) */}
            <svg
              width="10"
              height="6"
              viewBox="0 0 10 6"
              fill="none"
              style={{
                transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease',
              }}
            >
              <path
                d="M1 1L5 5L9 1"
                stroke="#E91E63"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </button>
      </motion.div>

      {/* ── MODAL QR INTERACTIVO FULLSCREEN / PRESENTACIÓN EN CAJA ── */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-150 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-5 select-none"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="w-full max-w-85 bg-[#121214] border border-white/15 rounded-4xl p-6 flex flex-col items-center shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-transform cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="text-center mb-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E91E63]/15 text-[#E91E63] text-[10px] font-black uppercase tracking-[1.5px] border border-[#E91E63]/30 mb-2">
                  <ShieldCheck size={12} /> Membresía Oficial
                </div>
                <h3 className="text-xl font-black text-white m-0">Escanea en Caja</h3>
                <p className="text-xs text-white/50 mt-1 mb-0 leading-relaxed">
                  Presenta tu código en el terminal del negocio para sumar Bunz en tu consumo.
                </p>
              </div>

              {/* Rabbitty Holographic Code presentation */}
              <div className="py-2 flex items-center justify-center w-full">
                <RabbittyCode
                  data={String(qrIdentifier)}
                  size={190}
                  showCardFrame={false}
                />
              </div>

              {/* Member credentials snippet */}
              <div className="w-full bg-white/5 rounded-2xl p-3 border border-white/10 text-center mt-3">
                <p className="text-xs font-black text-white uppercase tracking-wider m-0">{memberName}</p>
                <p className="text-[11px] text-gray-400 font-mono tracking-widest mt-0.5 m-0">
                  {username} • {bunzBalance.toLocaleString()} BUNZ
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
