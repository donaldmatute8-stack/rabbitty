'use client';

import { useEffect, useState } from 'react';
import { Share2, Copy, CheckCircle2, Trophy } from 'lucide-react';
import Header from '@/components/ui/Header';
import BottomNav from '@/components/BottomNav';
import { useWallet } from '@/contexts/WalletContext';

export default function ReferralPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const { address } = useWallet();

  useEffect(() => {
    if (address) fetchProfile();
    else setLoading(false);
  }, [address]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/auth/profile?wallet=${address}`);
      const data = await res.json();
      if (data.profile) setProfile(data.profile);
    } catch (err) {
      console.error('[Referral] profile fetch error:', err);
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

  const shareOnTelegram = () => {
    // @ts-ignore
    if (window.Telegram?.WebApp?.openTelegramLink) {
      const url = encodeURIComponent(referralLink);
      const text = encodeURIComponent('¡Únete a Rabbitty y gana 50 Bunz gratis para comprar en la ciudad!');
      // @ts-ignore
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`);
    }
  };

  return (
    <div className="page-wrap bg-[#F8F8F8] min-h-screen pb-28">
      <div className="bg-white sticky top-0 z-50 border-b border-[#F0F0F0]">
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} />
      </div>

      <main className="px-4 max-w-[600px] mx-auto flex flex-col gap-4 mt-4">
        {loading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E91E63]" />
          </div>
        ) : (
          <>
            {/* Level + Pending Bunz card */}
            <div className="bg-gradient-to-br from-[#1A0540] via-[#2D1060] to-[#3D0F80] rounded-[28px] p-6 text-white relative overflow-hidden border border-white/5 shadow-xl">
              <div className="absolute right-[-10%] top-[-10%] w-44 h-44 bg-white/6 rounded-full blur-[30px]" />

              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-white/50 text-[10px] font-black uppercase tracking-[1.5px] mb-2">Tu Nivel</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[52px] font-black leading-none tracking-[-2px]">{profile?.level ?? 1}</span>
                    <span className="text-yellow-400 text-xl">⭐</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/50 text-[10px] font-black uppercase tracking-[1.5px] mb-2">Bunz Pendientes</p>
                  <p className="text-[42px] font-black text-[#E91E63] tracking-[-1px] leading-none">
                    {profile?.pending_bunz ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-5 bg-black/25 rounded-[16px] p-3.5 relative z-10">
                <p className="text-[12px] leading-snug text-white/70">
                  <span className="font-bold text-yellow-400">💡 </span>
                  Sube de nivel consumiendo en negocios afiliados para desbloquear tus Bunz de referidos.
                </p>
              </div>
            </div>

            {/* Invite card */}
            <div className="bg-white rounded-[28px] p-6 border border-[#F0F0F0] shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-center">
              <div className="w-16 h-16 bg-pink-50 rounded-[20px] flex items-center justify-center mx-auto mb-4 text-3xl">👥</div>
              <h2 className="text-[22px] font-black text-[#111] mb-2 tracking-tight">Invita y Gana</h2>
              <p className="text-[#888] text-[13px] mb-6 leading-relaxed">
                Obtén <span className="font-black text-[#E91E63]">50 Bunz Pendientes</span> por cada amigo.
                Ellos también reciben 50 Bunz de bienvenida.
              </p>

              <div className="bg-[#F8F8F8] border-2 border-dashed border-[#E8E8E8] rounded-[20px] p-4 flex flex-col gap-3 mb-4">
                <p className="text-[9px] font-black text-[#BBB] uppercase tracking-[1.5px]">Tu Link Único</p>
                <div className="flex items-center justify-between bg-white rounded-[14px] p-3 border border-[#F0F0F0] shadow-sm gap-2">
                  <p className="text-[12px] font-medium text-[#666] truncate flex-1">
                    {referralLink || (address ? 'Generando...' : 'Conecta tu billetera')}
                  </p>
                  <button
                    onClick={copyToClipboard}
                    disabled={!referralLink}
                    className="bg-[#E91E63] disabled:bg-[#E0E0E0] text-white p-2 rounded-[10px] active:scale-95 transition-transform flex-shrink-0"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                onClick={shareOnTelegram}
                disabled={!referralLink}
                className="w-full bg-[#111] disabled:bg-[#E0E0E0] disabled:text-[#999] text-white font-black py-4 rounded-[100px] flex items-center justify-center gap-2 active:scale-95 transition-transform text-[14px]"
              >
                <Share2 className="w-4 h-4" />
                Compartir en Telegram
              </button>
            </div>

            {/* Medals — real empty state */}
            <div className="flex items-center gap-2 mt-2">
              <Trophy className="w-5 h-5 text-[#AAA]" />
              <h3 className="font-black text-[#111] text-[15px]">Tus Medallas</h3>
            </div>
            <div className="bg-white rounded-[24px] p-6 border border-[#F0F0F0] text-center shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
              <span className="text-4xl mb-3 block">🐇</span>
              <p className="text-[#999] text-[13px] leading-snug">
                Realiza consumos en negocios afiliados para empezar a desbloquear insignias y recompensas exclusivas.
              </p>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
