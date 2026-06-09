'use client';

import { useState } from 'react';
import { Share2, Copy, CheckCircle2, Trophy } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ReferralPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const profile = user;
  const loading = !user;

  const referralLink = profile?.telegramId
    ? `https://t.me/Rabbittyme_bot/app?startapp=ref_${profile.telegramId}`
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
      const text = encodeURIComponent('¡Únete a Rabbitty y descubre negocios en la ciudad!');
      // @ts-ignore
      window.Telegram.WebApp.openTelegramLink(`https://t.me/share/url?url=${url}&text=${text}`);
    }
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`¡Únete a Rabbitty y descubre negocios en la ciudad! ${referralLink}`);
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
                    <span className="text-[52px] font-black leading-none tracking-[-2px] text-white">{profile?.level ?? 1}</span>
                    <span className="text-xl text-[#FCD34D]">⭐</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white/50 text-[10px] font-black tracking-[1.5px] uppercase mb-2">Bunz Pendientes</p>
                  <p className="text-[42px] font-black text-[#E91E63] tracking-[-1px] leading-none m-0">
                    {profile?.pending_bunz ?? 0}
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
            <div className="bg-white rounded-[28px] p-6 border border-[#F0F0F0] shadow-[0_2px_16px_rgba(0,0,0,0.04)] text-center">
              <div className="w-16 h-16 bg-[#FFF0F5] rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[28px]">👥</div>
              <h2 className="text-[22px] font-black text-[#111] mb-2 tracking-[-0.5px]">Invita y Gana</h2>
              <p className="text-[#888] text-[13px] leading-[1.6] mb-6">
                Obtén <span className="font-black text-[#E91E63]">50 Bunz</span> por cada amigo que invites,
                una vez que realicen su primer consumo.
              </p>

              {/* Link box */}
              <div className="bg-[#F8F8F8] border-2 border-dashed border-[#E8E8E8] rounded-[20px] p-4 flex flex-col gap-3 mb-4">
                <p className="text-[9px] font-black text-[#BBB] tracking-[1.5px] uppercase m-0">Tu Link Único</p>
                <div className="flex items-center justify-between gap-2 bg-white rounded-[14px] p-3 border border-[#F0F0F0] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                  <div>
                    <span className="text-[11px] font-black text-[#E91E63] uppercase tracking-[0.5px] block mb-1">TU CÓDIGO</span>
                    <span className="text-2xl font-black text-[#111] font-mono">{profile?.telegramId || '------'}</span>
                  </div>
                <button
                  onClick={copyToClipboard}
                  disabled={!referralLink}
                  className="w-12 h-12 rounded-full bg-white border border-[#F0F0F0] flex items-center justify-center shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
                  style={{
                    cursor: referralLink ? 'pointer' : 'not-allowed',
                    color: copied ? '#4CAF50' : '#111',
                  }}
                >
                  {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={shareOnTelegram}
                  disabled={!referralLink}
                  className="flex-1 font-black text-[13px] py-3.5 rounded-[16px] border-0 flex items-center justify-center gap-2"
                  style={{
                    background: referralLink ? '#2AABEE' : '#E0E0E0',
                    color: referralLink ? '#fff' : '#999',
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
                  className="flex-1 font-black text-[13px] py-3.5 rounded-[16px] border-0 flex items-center justify-center gap-2"
                  style={{
                    background: referralLink ? '#25D366' : '#E0E0E0',
                    color: referralLink ? '#fff' : '#999',
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
