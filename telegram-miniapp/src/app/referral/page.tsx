'use client';

import { useEffect, useState } from 'react';

interface ReferralStats {
  code: string;
  totalReferrals: number;
  earnedFromReferrals: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
}

interface Referral {
  id: string;
  name: string;
  date: string;
  earned: number;
  avatar: string;
}

const MY_STATS: ReferralStats = {
  code: 'RABBIT2026',
  totalReferrals: 12,
  earnedFromReferrals: 600,
  tier: 'Silver'
};

const REFERRALS: Referral[] = [
  { id: '1', name: 'María G.', date: 'Hace 2 días', earned: 50, avatar: '👩' },
  { id: '2', name: 'Carlos R.', date: 'Hace 5 días', earned: 50, avatar: '👨' },
  { id: '3', name: 'Ana L.', date: 'Hace 1 semana', earned: 50, avatar: '👩‍🦱' },
  { id: '4', name: 'Pedro M.', date: 'Hace 2 semanas', earned: 50, avatar: '👨‍🦰' },
];

const TIERS = [
  { name: 'Bronze', min: 0, color: 'bg-orange-400', icon: '🥉' },
  { name: 'Silver', min: 500, color: 'bg-gray-400', icon: '🥈' },
  { name: 'Gold', min: 2000, color: 'bg-yellow-400', icon: '🥇' },
  { name: 'Platinum', min: 5000, color: 'bg-purple-400', icon: '💎' },
];

export default function ReferralPage() {
  const [copied, setCopied] = useState(false);
  const [WebApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      setWebApp(app);
    });
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(MY_STATS.code);
    setCopied(true);
    if (WebApp) {
      WebApp.showPopup({
        title: '✅ Copiado',
        message: 'Tu código de referido está listo para compartir',
        buttons: [{ type: 'ok' }]
      });
    }
    setTimeout(() => setCopied(false), 2000);
  };

  const shareReferral = () => {
    const text = `🐰 Únete a Rabbitty y empieza a ganar bunz!\n\nUsa mi código: ${MY_STATS.code}\n\nDescarga la app: https://t.me/rabbitty_bot`;
    if (WebApp) {
      WebApp.openLink(`https://t.me/share/url?url=https://t.me/rabbitty_bot&text=${encodeURIComponent(text)}`);
    }
  };

  const currentTier = TIERS.find(t => MY_STATS.earnedFromReferrals >= t.min) || TIERS[0];
  const nextTier = TIERS.find(t => t.min > MY_STATS.earnedFromReferrals);
  const progress = nextTier 
    ? ((MY_STATS.earnedFromReferrals - currentTier.min) / (nextTier.min - currentTier.min)) * 100 
    : 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FF6B35] to-[#FF4081]">
      <div className="text-white p-4 pt-8 text-center">
        <span className="text-5xl">🎁</span>
        <h1 className="text-2xl font-bold mt-2">Invita y Gana</h1>
        <p className="text-white/80">50 bunz por cada amigo que invites</p>
      </div>

      <div className="mx-4 bg-white rounded-3xl p-6 shadow-2xl -mt-2">
        <p className="text-gray-500 text-center mb-4">Tu código de referido</p>
        
        <div 
          onClick={copyCode}
          className="bg-gradient-to-r from-orange-100 to-pink-100 rounded-2xl p-4 text-center cursor-pointer active:scale-95 transition"
        >
          <p className="text-3xl font-bold text-[#FF6B35] tracking-wider">{MY_STATS.code}</p>
          <p className="text-sm text-[#FF6B35] mt-1">{copied ? '✅ Copiado' : 'Toca para copiar'}</p>
        </div>

        <button
          onClick={shareReferral}
          className="w-full mt-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
        >
          <span>📤</span>
          <span>Compartir en Telegram</span>
        </button>
      </div>

      <div className="mx-4 mt-4">
        <div className="bg-white/10 backdrop-blur rounded-2xl p-4 text-white">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-3xl font-bold">{MY_STATS.totalReferrals}</p>
              <p className="text-sm opacity-80">Amigos invitados</p>
            </div>
            <div>
              <p className="text-3xl font-bold">{MY_STATS.earnedFromReferrals}</p>
              <p className="text-sm opacity-80">Bunz ganados</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{currentTier.icon}</span>
            <div>
              <p className="font-bold text-gray-800">Nivel {currentTier.name}</p>
              <p className="text-xs text-gray-500">{nextTier ? `${nextTier.min - MY_STATS.earnedFromReferrals} bunz para ${nextTier.name}` : '¡Máximo nivel!'}</p>
            </div>
          </div>
        </div>

        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className={`h-full ${currentTier.color} transition-all duration-500`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between mt-2 text-xs text-gray-400">
          {TIERS.map(tier => (
            <span key={tier.name}>{tier.icon}</span>
          ))}
        </div>
      </div>

      <div className="mx-4 mt-4 bg-white rounded-2xl p-5 shadow-lg pb-24">
        <h2 className="font-bold text-gray-800 mb-4">Tus referidos</h2>
        
        <div className="space-y-3">
          {REFERRALS.map((ref) => (
            <div 
              key={ref.id}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-orange-200 to-pink-200 rounded-full flex items-center justify-center text-xl">
                {ref.avatar}
              </div>
              
              <div className="flex-1">
                <p className="font-bold text-gray-800">{ref.name}</p>
                <p className="text-xs text-gray-500">{ref.date}</p>
              </div>
              
              <span className="text-green-500 font-bold">+{ref.earned}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
