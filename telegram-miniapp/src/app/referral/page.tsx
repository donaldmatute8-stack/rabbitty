'use client';

import { useState, useEffect } from 'react';
import { Share2, Copy, CheckCircle2 } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';



import { openInviteChannel, shareInvite } from '@/lib/invite';
import { Gift } from 'lucide-react';
import { PremiumHero } from '@/components/premium/PremiumUI';
type TelegramWebApp = { openTelegramLink?: (url: string) => void };

const getTelegram = (): TelegramWebApp | null => {
  if (typeof window === 'undefined') return null;
  const tg = (window as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram;
  return tg?.WebApp ?? null;
};

type ReferralUser = {
  id?: string;
  username?: string;
  telegramId?: string | number;
  pendingBunz?: number;
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
        .then((data: { level?: { name?: string } }) => {
          if (data?.level?.name) setLevelName(data.level.name);
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const profile = user as unknown as ReferralUser;
  const loading = !user;

  // Smart referral link: Generates native web link (https://rabbitty.me/download?ref=...) on mobile/web,
  // or Telegram Mini App link (https://t.me/Rabbittyme_bot/app?startapp=...) when inside Telegram.
  const referralCode = profile?.username || profile?.telegramId || profile?.id || 'rabbitty';
  const referralLink = PlatformBridge.getShareableLink(
    `/download?ref=${referralCode}`,
    `ref_${profile?.telegramId || referralCode}`
  );

  const copyToClipboard = () => {
    if (referralLink) {
      PlatformBridge.hapticFeedback('success');
      navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Primario: hoja de compartir del sistema (incluye WhatsApp, Telegram, Mensajes…)
  const shareNative = async () => {
    PlatformBridge.hapticFeedback('medium');
    const ok = await shareInvite({ username: profile?.username, telegramId: profile?.telegramId ? String(profile.telegramId) : null, id: profile?.id });
    if (!ok) {
      // Sin hoja nativa (o canceló): abrimos WhatsApp como plan B.
      openInviteChannel('whatsapp', { username: profile?.username, telegramId: profile?.telegramId ? String(profile.telegramId) : null, id: profile?.id });
    }
  };

  const shareOnTelegram = () => {
    PlatformBridge.hapticFeedback('medium');
    const url = encodeURIComponent(referralLink);
    const tg = getTelegram();
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(`https://t.me/share/url?url=${url}&text=${encodeURIComponent('¡Qué onda! Te invito a Rabbitty:')}`);
    } else {
      void PlatformBridge.openExternalUrl(`https://t.me/share/url?url=${url}&text=${encodeURIComponent('¡Qué onda! Te invito a Rabbitty:')}`);
    }
  };

  const shareOnWhatsApp = () => {
    PlatformBridge.hapticFeedback('medium');
    const text = encodeURIComponent(`¡Únete a Rabbitty y descubre los mejores comercios de la ciudad! ${referralLink}`);
    void PlatformBridge.openExternalUrl(`https://wa.me/?text=${text}`);
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
            <PremiumHero
              icon={Gift}
              eyebrow="PROGRAMA DE REFERIDOS"
              title="Invita y gana"
              subtitle="Comparte Rabbitty y gana Bunz con cada amigo"
            >
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-white/45">Tu nivel</p>
                  <p className="text-lg font-black text-white">{levelName}</p>
                </div>
                <div className="rounded-xl border border-[#E91E63]/25 bg-[#E91E63]/15 px-3 py-2">
                  <p className="text-[9px] font-black uppercase tracking-wider text-[#FF8BC2]">Bunz pendientes</p>
                  <p className="text-lg font-black text-[#FF5FA8]">{profile?.pendingBunz ?? 0}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-normal text-white/50">
                💡 Sube de nivel consumiendo en negocios afiliados para desbloquear tus Bunz de referidos.
              </p>
            </PremiumHero>

            {/* Invite card */}
            <div className="bg-(--bg-elevated) rounded-[28px] p-6 border border-(--border-subtle) shadow-(--shadow-sm) text-center">
              <div className="w-16 h-16 bg-[#E91E63]/15 border border-[#E91E63]/25 rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[28px]">👥</div>
              <h2 className="text-[22px] font-black text-(--text-primary) mb-2 tracking-[-0.5px]">Invita y Gana</h2>
              <p className="text-(--text-secondary) text-[13px] leading-[1.6] mb-6">
                Obtén <span className="font-black text-[#E91E63]">50 Bunz</span> por cada amigo que invites,
                una vez que realicen su primer consumo.
              </p>

              {/* Link box */}
              <div className="bg-(--bg-subtle) border-2 border-dashed border-(--border-subtle) rounded-[20px] p-4 flex flex-col gap-3 mb-4">
                <p className="text-[9px] font-black text-(--text-muted) tracking-[1.5px] uppercase m-0">Tu Link Único</p>
                <div className="flex items-center justify-between gap-2 bg-(--bg-elevated) rounded-[14px] p-3 border border-(--border-subtle)">
                  <div className="overflow-hidden text-left">
                    <span className="text-[11px] font-black text-[#E91E63] uppercase tracking-[0.5px] block mb-1">TU CÓDIGO</span>
                    <span className="text-xl font-black text-(--text-primary) font-mono truncate block">{referralCode}</span>
                  </div>
                  <button
                    onClick={copyToClipboard}
                    disabled={!referralLink}
                    className="w-12 h-12 rounded-full bg-(--bg-subtle) border border-(--border-subtle) text-(--text-primary) flex items-center justify-center shrink-0 cursor-pointer active:scale-95 transition-transform"
                    style={{
                      color: copied ? '#4CAF50' : 'var(--text-primary)',
                    }}
                  >
                    {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                  </button>
                </div>

              {/* Título de compartir (sin estilo botón) */}
              <p
                className="text-[12px] font-black uppercase tracking-[1.5px] text-center mb-3 m-0 text-(--text-muted)"
              >
                Compartir con amigos
              </p>

              <div className="flex gap-3">
                <button
                  onClick={shareOnTelegram}
                  disabled={!referralLink}
                  className="flex-1 font-black text-[13px] py-3.5 rounded-2xl border-0 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{
                    background: referralLink ? '#2AABEE' : 'var(--bg-subtle)',
                    color: referralLink ? '#fff' : 'var(--text-muted)',
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
                  className="flex-1 font-black text-[13px] py-3.5 rounded-2xl border-0 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  style={{
                    background: referralLink ? '#25D366' : 'var(--bg-subtle)',
                    color: referralLink ? '#fff' : 'var(--text-muted)',
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
