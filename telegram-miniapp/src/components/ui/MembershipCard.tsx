'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Sparkles, ChevronRight, X, ShieldCheck } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import RabbittyCode from '@/components/ui/RabbittyCode';

interface MembershipCardProps {
  user: any;
  levelName?: string;
  isDark?: boolean;
}

export default function MembershipCard({ user, levelName = '1', isDark = true }: MembershipCardProps) {
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

  return (
    <>
      {/* ── CARD HERO COMPONENT ── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full relative overflow-hidden rounded-[24px] p-5 mb-5 cursor-pointer select-none"
        style={{
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

        {/* Top Header inside Card */}
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-black/40 border border-white/10 flex items-center justify-center p-1 backdrop-blur-md">
              <img src="/logo_conejo.png" alt="Rabbitty" className="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(233,30,99,0.8)]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[#E91E63]">RABBITTY PASS</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/80 border border-white/10">
                  Lvl. {levelName}
                </span>
              </div>
              <p className="text-xs font-bold text-white/50 m-0 leading-tight">{username}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] font-extrabold text-[#E91E63] bg-[#E91E63]/10 px-2.5 py-1 rounded-full border border-[#E91E63]/25">
            <Sparkles size={12} />
            <span>Digital Club</span>
          </div>
        </div>

        {/* Middle: Bunz Balance Display */}
        <div className="my-2 relative z-10">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white/45 block mb-0.5">Saldo acumulado</span>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-black text-white tracking-tight">
              {bunzBalance.toLocaleString()}
            </span>
            <span className="text-lg font-black text-[#E91E63] tracking-wide">BUNZ</span>
          </div>
        </div>

        {/* Bottom Bar: Member info and CTA to show barcode */}
        <div className="flex items-center justify-between pt-3 border-t border-white/10 relative z-10 mt-3">
          <div className="truncate max-w-[200px]">
            <p className="text-[13px] font-extrabold text-white truncate m-0">{memberName}</p>
            <p className="text-[10px] text-white/40 font-mono m-0">ID: {String(qrIdentifier).slice(0, 14)}...</p>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 bg-[#E91E63] hover:bg-[#D81B60] active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-full shadow-[0_4px_14px_rgba(233,30,99,0.4)] transition-all cursor-pointer border-none"
          >
            <QrCode size={14} />
            <span>Ver QR</span>
            <ChevronRight size={12} />
          </button>
        </div>
      </motion.div>

      {/* ── MODAL QR INTERACTIVO FULLSCREEN / PRESENTACIÓN EN CAJA ── */}
      <AnimatePresence>
        {showQrModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-5 select-none"
            onClick={handleCloseModal}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 260 }}
              className="w-full max-w-[340px] bg-[#121214] border border-white/15 rounded-[32px] p-6 flex flex-col items-center shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
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
