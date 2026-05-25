'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { Copy, Share2, Users, Gift, TrendingUp } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

const REFERRALS = [
  { id: '1', name: 'María G.', date: 'Hace 2 días', earned: 50, avatar: 'M' },
  { id: '2', name: 'Carlos R.', date: 'Hace 5 días', earned: 50, avatar: 'C' },
  { id: '3', name: 'Ana L.', date: 'Hace 1 semana', earned: 50, avatar: 'A' },
];

const TIERS = [
  { level: 'Bronce', referrals: 0, bonus: 50, color: 'bg-amber-700' },
  { level: 'Plata', referrals: 5, bonus: 75, color: 'bg-gray-400' },
  { level: 'Oro', referrals: 15, bonus: 100, color: 'bg-yellow-500' },
  { level: 'Platino', referrals: 50, bonus: 200, color: 'bg-cyan-400' },
];

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
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
      <div style={{ height: 'var(--safe-top)' }} />

      <Header />

      <main className="flex-1 px-4 pt-2">
        <h1 className="text-2xl font-semibold text-[#111111] mb-2">Referidos</h1>
        <p className="text-[#8A8A8A] text-sm mb-6">
          Gana <strong className="text-[#111111]">50 bunz</strong> por cada amigo que se una
        </p>

        {/* Code Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-[#E91E63] to-[#C2185B] rounded-2xl p-6 text-white mb-6 shadow-lg shadow-[#E91E63]/20"
        >
          <div className="text-center mb-6">
            <p className="text-white/70 text-sm mb-2">Tu código de referido</p>
            <p className="text-3xl font-bold tracking-[0.15em]">{code}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copyCode}
              className="flex-1 bg-white/20 backdrop-blur-sm text-white py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              <Copy className="w-4 h-4" />
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
            <button className="flex-1 bg-white text-[#E91E63] py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
              <Share2 className="w-4 h-4" />
              Compartir
            </button>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[#F5F5F5] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-[#8A8A8A]" />
              <span className="text-xs text-[#8A8A8A]">Referidos</span>
            </div>
            <p className="text-2xl font-bold text-[#111111]">{totalReferrals}</p>
          </div>
          <div className="bg-[#F5F5F5] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-[#E91E63]" />
              <span className="text-xs text-[#8A8A8A]">Ganado</span>
            </div>
            <p className="text-2xl font-bold text-[#111111]">{earnedFromReferrals} bunz</p>
          </div>
        </div>

        {/* Tiers */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">Niveles</h2>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {TIERS.map((tier) => (
              <div
                key={tier.level}
                className={`flex-shrink-0 p-3 rounded-xl border ${
                  totalReferrals >= tier.referrals
                    ? 'border-[#E91E63] bg-[#E91E63]/5'
                    : 'border-gray-100 bg-[#F5F5F5]'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${tier.color} mb-2`} />
                <p className="text-xs font-semibold text-[#111111]">{tier.level}</p>
                <p className="text-[11px] text-[#8A8A8A]">{tier.referrals} refs</p>
                <p className="text-xs font-bold text-[#E91E63]">+{tier.bonus}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Referrals List */}
        <div>
          <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3">Tus referidos</h2>
          <div className="space-y-2">
            {REFERRALS.map((ref, i) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#F5F5F5] rounded-xl p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-sm font-bold">
                  {ref.avatar}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-[#111111] text-[15px]">{ref.name}</p>
                  <p className="text-[13px] text-[#8A8A8A]">{ref.date}</p>
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
