'use client';

import { useState, useEffect } from 'react';
import { Share2, Copy, CheckCircle2, Trophy } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';

const LEVEL_NAMES: Record<string, string> = {
  '1': 'Bronce', '2': 'Plata', '3': 'Oro', '4': 'Rubí', '5': 'Diamante',
};

export default function ReferralPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [levelName, setLevelName] = useState('Bronce');

  useEffect(() => {
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/gamification`, { headers }))
        .then(r => r.json())
        .then((data: any) => {
          if (data?.level?.name) setLevelName(data.level.name);
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const profile = user as any;
  const loading = !user;

  const referralLink = profile?.telegramId
    ? `https://t.me/Rabbittyme_bot/app?startapp=ref_${profile.telegramId}`
    : '';

  const handleNativeShare = async () => {
    if (!referralLink) return;
    await PlatformBridge.share({
      title: 'Únete a Rabbitty 🐰',
      text: `¡Qué onda! Te invito a Rabbitty. Regístrate con mi enlace para desbloquear recompensas y multiplicar bunz en los mejores comercios:`,
      url: referralLink,
      dialogTitle: 'Invitar amigos a Rabbitty',
    });
  };

  const copyToClipboard = () => {
    if (referralLink) {
      PlatformBridge.hapticFeedback('success');
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareOnTelegram = () => {
    PlatformBridge.hapticFeedback('medium');
    const url = encodeURIComponent(referralLink);
    const text = encodeURIComponent('¡Únete a Rabbitty y descubre negocios con cashback en bunz!');
    // @ts-ignore
    if (window.Telegram?.WebApp?.openTelegramLink) {
      // @ts-ignore
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`);
    } else {
      window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    }
  };

  const shareOnWhatsApp = () => {
    PlatformBridge.hapticFeedback('medium');
    const text = encodeURIComponent(`¡Únete a Rabbitty y descubre los mejores comercios de la ciudad! ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <ProfileSubpageLayout title="Programa de referidos">
      <div className="flex flex-col gap-6">
        {loading ? (
          <div className="flex justify-center p-8">
            <div
              className="w-8 h-8 rounded-full border-2 border-[rgba(233,30,99,0.3)] border-t-[#E91E63]"
              style={{ animation: 'spin 0.8s linear infinite' }}
            />
          </div>
        ) : (
          <>
            {/* Level + Pending Bunz */}
            <div
              className="rounded-[28px] px-5 py-6 relative overflow-hidden border border-white/[0.05] shadow-[0_12px_40px_rgba(45,16,96,0.4)]"
              style={{ background: 'linear-gradient(135deg, #1A0540 0%, #2D1060 55%, #3D0F80 100%)' }}
            >
              <div className="absolute right-[-10%] top-[-10%] w-44 h-44 bg-white/[0.06] rounded-full blur-[30px]" />

              <div className="flex justify-between items-start relative z-10">
                <div>
                  <p className="text-white/50 text-[10px] font-black tracking-[1.5px] uppercase mb-2">Tu Nivel</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[52px] font-black leading-none tracking-[-2px] text-white">{levelName}</span>
                    <span className="text-xl text-[#FCD34D]">⭐</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/50 text-[10px] font-black tracking-[1.5px] uppercase mb-2">Bunz Pendientes</p>
                  <p className="text-[42px] font-black text-[#E91E63] tracking-[-1px] leading-none m-0">
                    {profile?.pendingBunz ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-5 bg-black/25 rounded-2xl p-3.5 relative z-10">
                <p className="text-xs leading-normal text-white/70 m-0">
                  <span className="font-bold text-[#FCD34D]">💡 </span>
                  Sube de nivel consumiendo en negocios afiliados para desbloquear tus Bunz de referidos.
                </p>
              </div>
            </div>

            {/* Invite card */}
            <div className="bg-[#161022] rounded-[28px] p-6 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.35)] text-center">
              <div className="w-16 h-16 bg-[#E91E63]/15 border border-[#E91E63]/25 rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[28px]">👥</div>
              <h2 className="text-[22px] font-black text-white mb-2 tracking-[-0.5px]">Invita y Gana</h2>
              <p className="text-white/60 text-[13px] leading-[1.6] mb-6">
                Obtén <span className="font-black text-[#E91E63]">50 Bunz</span> por cada amigo que invites,
                una vez que realicen su primer consumo.
              </p>

              {/* Link box */}
              <div className="bg-black/25 border-2 border-dashed border-white/10 rounded-[20px] p-4 flex flex-col gap-3 mb-4">
                <p className="text-[9px] font-black text-white/40 tracking-[1.5px] uppercase m-0">Tu Link Único</p>
                <div className="flex items-center justify-between gap-2 bg-white/[0.06] rounded-[14px] p-3 border border-white/10">
                  <div>
                    <span className="text-[11px] font-black text-[#E91E63] uppercase tracking-[0.5px] block mb-1">TU CÓDIGO</span>
                    <span className="text-2xl font-black text-white font-mono">{profile?.telegramId || '------'}</span>
                  </div>
                <button
                  onClick={copyToClipboard}
                  disabled={!referralLink}
                  className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center"
                  style={{
                    cursor: referralLink ? 'pointer' : 'not-allowed',
                    color: copied ? '#4CAF50' : '#fff',
                  }}
                >
                  {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                </button>
              </div>

              {/* Primary Native iOS/Android Share Button */}
              <button
                onClick={handleNativeShare}
                disabled={!referralLink}
                className="w-full font-black text-sm py-4 rounded-2xl border-0 flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95 transition-all text-white"
                style={{
                  background: 'linear-gradient(135deg, #FF2E93 0%, #FF8A00 100%)',
                  boxShadow: '0 8px 24px rgba(255, 46, 147, 0.4)',
                }}
              >
                <Share2 size={18} />
                <span>Compartir con Amigos (Native)</span>
              </button>

              <div className="flex gap-3">
                <button
                  onClick={shareOnTelegram}
                  disabled={!referralLink}
                  className="flex-1 font-black text-[13px] py-3.5 rounded-[16px] border-0 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{
                    background: referralLink ? '#2AABEE' : 'rgba(255,255,255,0.08)',
                    color: referralLink ? '#fff' : 'rgba(255,255,255,0.35)',
                    cursor: referralLink ? 'pointer' : 'not-allowed',
                    boxShadow: referralLink ? '0 4px 12px rgba(42,171,238,0.3)' : 'none',
                  }}
                >
                  <Share2 size={16} />
                  Telegram
                </button>
                <button
                  onClick={shareOnWhatsApp}
                  disabled={!referralLink}
                  className="flex-1 font-black text-[13px] py-3.5 rounded-[16px] border-0 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{
                    background: referralLink ? '#25D366' : 'rgba(255,255,255,0.08)',
                    color: referralLink ? '#fff' : 'rgba(255,255,255,0.35)',
                    cursor: referralLink ? 'pointer' : 'not-allowed',
                    boxShadow: referralLink ? '0 4px 12px rgba(37,211,102,0.3)' : 'none',
                  }}
                >
                  <Share2 size={16} />
                  WhatsApp
                </button>
              </div>
            </div>
            </div>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `@keyframes spin { to { transform: rotate(360deg); } }`}} />
    </ProfileSubpageLayout>
  );
}
