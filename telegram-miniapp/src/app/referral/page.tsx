'use client';

import { useEffect, useState } from 'react';
import { Share2, Copy, Users, CheckCircle2, Trophy, Star } from 'lucide-react';
import Header from '@/components/ui/Header';
import BottomNav from '@/components/BottomNav';
import { useWallet } from '@/contexts/WalletContext';

export default function ReferralPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { address } = useWallet();

  useEffect(() => {
    if (address) {
      fetchProfile();
    }
  }, [address]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/auth/profile?wallet=${address}`);
      const data = await res.json();
      if (data.profile) {
        setProfile(data.profile);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const referralLink = profile?.referral_code 
    ? `https://t.me/RabbittyBot/app?startapp=ref_${profile.referral_code}` 
    : '';

  const copyToClipboard = () => {
    if (referralLink) {
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="page-wrap bg-gray-50 min-h-screen pb-28">
      <div className="bg-white sticky top-0 z-50 shadow-sm">
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} />
      </div>

      <main className="p-4 max-w-[600px] mx-auto flex flex-col gap-5 mt-4">
        {loading ? (
          <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div></div>
        ) : (
          <>
            {/* Level & Pending Bunz Card */}
            <div className="bg-gradient-to-br from-indigo-900 to-purple-800 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              
              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-1">Tu Nivel</p>
                  <div className="flex items-center gap-2">
                    <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                    <span className="text-4xl font-black">{profile?.level || 1}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/70 text-sm font-bold uppercase tracking-wider mb-1">Bunz Pendientes</p>
                  <p className="text-3xl font-black text-pink-400">{profile?.pending_bunz || 0}</p>
                </div>
              </div>

              <div className="mt-6 bg-black/20 rounded-2xl p-4">
                <p className="text-sm leading-snug">
                  <span className="font-bold text-yellow-400">¿Cómo usar los pendientes?</span> Sube de nivel consumiendo en negocios afiliados para desbloquear tus Bunz de referidos.
                </p>
              </div>
            </div>

            {/* Share Link Card */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mt-2 text-center">
              <div className="w-16 h-16 bg-pink-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-pink-500" />
              </div>
              <h2 className="text-2xl font-black text-gray-900 mb-2">Invita Amigos</h2>
              <p className="text-gray-500 text-sm mb-6">
                Obtén <span className="font-bold text-pink-500">50 Bunz Pendientes</span> por cada amigo que se una usando tu link. Ellos también recibirán 50 Bunz.
              </p>

              <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tu Link Único</p>
                <div className="flex items-center justify-between bg-white rounded-xl p-3 border shadow-sm">
                  <p className="text-sm font-medium text-gray-700 truncate mr-2">
                    {referralLink || 'Generando...'}
                  </p>
                  <button 
                    onClick={copyToClipboard}
                    className="bg-pink-500 text-white p-2 rounded-lg active:scale-95 transition-transform flex-shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button 
                className="w-full bg-black text-white font-bold py-4 rounded-xl mt-4 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                onClick={() => {
                  // @ts-ignore
                  if (window.Telegram?.WebApp?.openTelegramLink) {
                    // @ts-ignore
                    window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('¡Únete a Rabbitty y gana 50 Bunz gratis para comprar en la ciudad!')}`);
                  }
                }}
              >
                <Share2 className="w-5 h-5" />
                Compartir en Telegram
              </button>
            </div>
            
            {/* Gamification / Achievements Empty State */}
            <div className="flex items-center gap-2 mt-6 mb-2">
              <Trophy className="w-5 h-5 text-gray-400" />
              <h3 className="font-bold text-gray-700">Tus Medallas</h3>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-100 text-center shadow-sm">
              <p className="text-gray-400 text-sm">Realiza consumos para empezar a desbloquear insignias y recompensas exclusivas.</p>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
