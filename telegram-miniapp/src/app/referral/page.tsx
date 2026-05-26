'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Copy, Share2, Users, Gift, Star, ShieldAlert } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';

const REFERRALS = [
  { id: '1', name: 'María G.', date: 'Hace 2 días', earned: 50, avatar: 'M' },
  { id: '2', name: 'Carlos R.', date: 'Hace 5 días', earned: 50, avatar: 'C' },
  { id: '3', name: 'Ana L.', date: 'Hace 1 semana', earned: 50, avatar: 'A' },
];

const TIERS = [
  { level: 'Bronce', referrals: 0, bonus: 50, color: 'bg-amber-600' },
  { level: 'Plata', referrals: 5, bonus: 75, color: 'bg-gray-400' },
  { level: 'Oro', referrals: 15, bonus: 100, color: 'bg-yellow-500' },
  { level: 'Platino', referrals: 50, bonus: 200, color: 'bg-teal-400' },
];

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  // Detectar scroll para comprimir header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const code = 'RABBIT2026';
  const totalReferrals = REFERRALS.length;
  const earnedFromReferrals = REFERRALS.reduce((s, r) => s + r.earned, 0);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-wrap pb-28 bg-white">
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 pt-2" style={{ backgroundColor: '#FFFFFF' }}>
        <h1 className="text-2xl font-normal text-[#111111] mb-1 px-1">Referidos</h1>
        <p className="text-[#8A8A8A] text-[14px] font-light mb-6 px-1">
          Gana <strong className="text-[#111111] font-medium">50 bunz</strong> por cada amigo que se una.
        </p>

        {/* Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-gradient-to-br from-[#E91E63] to-[#C2185B] rounded-3xl p-6 text-white mb-6 overflow-hidden shadow-[0_12px_24px_rgba(233,30,99,0.15)]"
        >
          {/* Subtle backgrounds visual accents */}
          <div className="absolute top-[-50%] right-[-30%] w-72 h-72 rounded-full bg-white/5 blur-2xl" />
          
          <div className="text-center mb-6 relative z-10">
            <p className="text-white/60 text-[13px] font-light mb-2">Tu código de referido</p>
            <p className="text-3xl font-bold tracking-[0.2em] ml-[0.2em]">{code}</p>
          </div>

          <div className="flex gap-4 relative z-10">
            <button
              onClick={copyCode}
              className="flex-1 bg-white/10 backdrop-blur-md border border-white/20 text-white py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
            >
              <Copy className="w-4 h-4" />
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
            <button className="flex-1 bg-white text-[#E91E63] py-3.5 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.97] shadow-sm transition-transform">
              <Share2 className="w-4 h-4" />
              Compartir
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white border border-[#F0F0F0] rounded-2xl p-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                <Users className="w-4 h-4 text-[#8A8A8A]" />
              </div>
              <span className="text-xs text-[#8A8A8A] font-light">Referidos</span>
            </div>
            <p className="text-2xl font-semibold text-[#111111]">{totalReferrals} <span className="text-[13px] font-normal text-[#8A8A8A]">amigos</span></p>
          </div>
          <div className="bg-white border border-[#F0F0F0] rounded-2xl p-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-[#E91E63]/5 flex items-center justify-center">
                <Gift className="w-4 h-4 text-[#E91E63]" />
              </div>
              <span className="text-xs text-[#8A8A8A] font-light">Ganado</span>
            </div>
            <p className="text-2xl font-semibold text-[#111111]">{earnedFromReferrals} <span className="text-[13px] font-normal text-[#8A8A8A]">bunz</span></p>
          </div>
        </div>

        {/* Tiers */}
        <div className="mb-8">
          <h2 className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-4 px-1">Niveles de recompensa</h2>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {TIERS.map((tier) => {
              const isUnlocked = totalReferrals >= tier.referrals;
              return (
                <div
                  key={tier.level}
                  className={`flex-shrink-0 w-28 p-4 rounded-2xl border transition-all duration-300 ${
                    isUnlocked
                      ? 'border-[#E91E63] bg-[#E91E63]/[0.02] shadow-[0_4px_12px_rgba(233,30,99,0.02)]'
                      : 'border-[#F0F0F0] bg-white'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full ${tier.color} mb-3 flex items-center justify-center`}>
                    {isUnlocked && <Star className="w-1.5 h-1.5 text-white fill-white" />}
                  </div>
                  <p className="text-[14px] font-medium text-[#111111] mb-0.5">{tier.level}</p>
                  <p className="text-[11px] text-[#8A8A8A] font-light mb-2">{tier.referrals} refs necesarios</p>
                  <p className="text-[13px] font-bold text-[#E91E63]">+{tier.bonus} <span className="text-[10px] font-normal text-[#8A8A8A]">bunz</span></p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Referrals List */}
        <div>
          <h2 className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-4 px-1">Tus referidos</h2>
          <div className="space-y-3">
            {REFERRALS.map((ref, i) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="bg-white border border-[#F0F0F0] rounded-2xl p-4 flex items-center gap-4 active:scale-[0.99] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-[14px] font-semibold shadow-sm flex-shrink-0">
                  {ref.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-normal text-[#111111] text-[15px] truncate">{ref.name}</p>
                  <p className="text-[13px] text-[#8A8A8A] font-light truncate">{ref.date}</p>
                </div>
                <Badge variant="bunz">+{ref.earned} bunz</Badge>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
