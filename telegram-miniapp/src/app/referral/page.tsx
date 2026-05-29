'use client';

import { useState } from 'react';
import { Share2, Copy, CheckCircle2, Trophy } from 'lucide-react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useAuth } from '@/features/auth/AuthProvider';

export default function ReferralPage() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);

  const profile = user; // Use auth user profile directly
  const loading = !user;

  const referralLink = profile?.telegramId
    ? `https://t.me/RabbittyBot/app?startapp=ref_${profile.telegramId}`
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(233,30,99,0.3)', borderTopColor: '#E91E63', animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <>
            {/* Level + Pending Bunz */}
            <div style={{
              background: 'linear-gradient(135deg, #1A0540 0%, #2D1060 55%, #3D0F80 100%)',
              borderRadius: 28, padding: '24px 20px',
              position: 'relative', overflow: 'hidden',
              border: '1px solid rgba(255,255,255,0.05)',
              boxShadow: '0 12px 40px rgba(45,16,96,0.4)',
            }}>
              <div style={{ position: 'absolute', right: '-10%', top: '-10%', width: 176, height: 176, background: 'rgba(255,255,255,0.06)', borderRadius: '50%', filter: 'blur(30px)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                <div>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Tu Nivel</p>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: 52, fontWeight: 900, lineHeight: 1, letterSpacing: -2, color: '#fff' }}>{profile?.level ?? 1}</span>
                    <span style={{ fontSize: 20, color: '#FCD34D' }}>⭐</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 900, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Bunz Pendientes</p>
                  <p style={{ fontSize: 42, fontWeight: 900, color: '#E91E63', letterSpacing: -1, lineHeight: 1, margin: 0 }}>
                    {profile?.pending_bunz ?? 0}
                  </p>
                </div>
              </div>

              <div style={{
                marginTop: 20, background: 'rgba(0,0,0,0.25)', borderRadius: 16, padding: 14,
                position: 'relative', zIndex: 1,
              }}>
                <p style={{ fontSize: 12, lineHeight: 1.5, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                  <span style={{ fontWeight: 700, color: '#FCD34D' }}>💡 </span>
                  Sube de nivel consumiendo en negocios afiliados para desbloquear tus Bunz de referidos.
                </p>
              </div>
            </div>

            {/* Invite card */}
            <div style={{
              background: '#fff', borderRadius: 28, padding: 24,
              border: '1px solid #F0F0F0',
              boxShadow: '0 2px 16px rgba(0,0,0,0.04)',
              textAlign: 'center',
            }}>
              <div style={{ width: 64, height: 64, background: '#FFF0F5', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 28 }}>👥</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#111', marginBottom: 8, letterSpacing: '-0.5px' }}>Invita y Gana</h2>
              <p style={{ color: '#888', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
                Obtén <span style={{ fontWeight: 900, color: '#E91E63' }}>50 Bunz</span> por cada amigo que invites,
                una vez que realicen su primer consumo.
              </p>

              {/* Link box */}
              <div style={{
                background: '#F8F8F8', border: '2px dashed #E8E8E8',
                borderRadius: 20, padding: 16,
                display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16,
              }}>
                <p style={{ fontSize: 9, fontWeight: 900, color: '#BBB', letterSpacing: 1.5, textTransform: 'uppercase', margin: 0 }}>Tu Link Único</p>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                  background: '#fff', borderRadius: 14, padding: 12,
                  border: '1px solid #F0F0F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <div>
                    <span style={{ fontSize: 11, fontWeight: 900, color: '#E91E63', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>TU CÓDIGO</span>
                    <span style={{ fontSize: 24, fontWeight: 900, color: '#111', fontFamily: 'monospace' }}>{profile?.telegramId || '------'}</span>
                  </div>
                <button
                  onClick={copyToClipboard}
                  disabled={!referralLink}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', background: '#fff',
                    border: '1px solid #F0F0F0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: referralLink ? 'pointer' : 'not-allowed', color: copied ? '#4CAF50' : '#111',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
                  }}
                >
                  {copied ? <CheckCircle2 size={20} /> : <Copy size={20} />}
                </button>
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={shareOnTelegram}
                  disabled={!referralLink}
                  style={{
                    flex: 1, background: referralLink ? '#2AABEE' : '#E0E0E0',
                    color: referralLink ? '#fff' : '#999',
                    fontWeight: 900, fontSize: 13,
                    padding: '14px 0', borderRadius: 16,
                    border: 'none', cursor: referralLink ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: referralLink ? '0 4px 12px rgba(42,171,238,0.3)' : 'none'
                  }}
                >
                  <Share2 size={16} />
                  Telegram
                </button>
                <button
                  onClick={shareOnWhatsApp}
                  disabled={!referralLink}
                  style={{
                    flex: 1, background: referralLink ? '#25D366' : '#E0E0E0',
                    color: referralLink ? '#fff' : '#999',
                    fontWeight: 900, fontSize: 13,
                    padding: '14px 0', borderRadius: 16,
                    border: 'none', cursor: referralLink ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: referralLink ? '0 4px 12px rgba(37,211,102,0.3)' : 'none'
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
