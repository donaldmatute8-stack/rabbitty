'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import AdminPanel from '@/features/admin/AdminPanel';
import BunzGuide from '@/features/business/BunzGuide';

const MENU_ITEMS = [
  { icon: "💳", label: "Mi Billetera", badge: null, href: '/profile/wallet' },
  { icon: "📜", label: "Historial de transacciones", badge: null, href: '/history' },
  { icon: "👥", label: "Programa de referidos", badge: null, href: '/referral' },
  { icon: "🔔", label: "Notificaciones", badge: null, href: '/notifications' },
  { icon: "🛡", label: "Seguridad y Privacidad", badge: null, href: '/security' },
  { icon: "❓", label: "Ayuda y Soporte", badge: null, href: '/support' },
];

const LEVEL_GRADIENTS: Record<string, string> = {
  'Diamante': 'linear-gradient(135deg, #FFD700, #FFA500)',
  'Rubí': 'linear-gradient(135deg, #9C27B0, #E91E63)',
  'Oro': 'linear-gradient(135deg, #2196F3, #00BCD4)',
  'Plata': 'linear-gradient(135deg, #607D8B, #90A4AE)',
  'Bronce': 'linear-gradient(135deg, #795548, #A1887F)',
};
const DEFAULT_GRADIENT = '#E91E63';

export default function ProfilePage() {
  const { address } = useWallet();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isScrolled, setIsScrolled] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showBunzGuide, setShowBunzGuide] = useState(false);
  const [nextLevelHops, setNextLevelHops] = useState(500);
  const [levelGradient, setLevelGradient] = useState(DEFAULT_GRADIENT);
  const [levelName, setLevelName] = useState('1');
  const [hasBusiness, setHasBusiness] = useState(false);

  useEffect(() => {
    if (user?.telegramId) {
      fetch(`/api/business?telegramId=${user.telegramId}`)
        .then(r => r.json())
        .then(d => {
          if (d.success && d.business) {
            setHasBusiness(true);
          }
        })
        .catch(() => {});
    }
  }, [user]);

  const handleAvatarTap = async () => {
    if (!user?.telegramId) {
      showToast('Identidad NFT (Próximamente)', 'info');
      return;
    }
    const res = await fetch(`/api/auth/is-admin?telegramId=${user.telegramId}`);
    const { isAdmin } = await res.json();
    if (isAdmin) {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      if (newCount === 5) {
        setShowAdmin(true);
        setTapCount(0);
      }
    } else {
      showToast('Identidad NFT (Próximamente)', 'info');
    }
  };

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

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/gamification?userId=${user.id}`)
        .then(r => r.json())
        .then((data: any) => {
          if (data.level?.requiredHops) {
            setNextLevelHops(data.level.requiredHops);
          }
          const name = data.level?.name;
          if (name) {
            setLevelName(name);
            setLevelGradient(LEVEL_GRADIENTS[name] || DEFAULT_GRADIENT);
          }
        })
        .catch(() => {});
    }
  }, [user?.id]);

  const profileTitle = (
    <div className="flex items-center gap-3 relative w-full">
      <motion.div
        whileTap={{ scale: 0.9 }}
        onClick={handleAvatarTap}
        style={{ 
          background: levelGradient,
          boxShadow: (user as any)?.hops >= 500 ? '0 4px 16px rgba(0,0,0,0.1)' : 'none'
        }}
        className="w-[50px] h-[50px] rounded-[14px] p-0.5 flex items-center justify-center shrink-0 relative cursor-pointer"
      >
        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=ffffff`} alt={user?.firstName || 'User'} className="w-full h-full rounded-xl" />
        {(user as any)?.hops >= 2000 && (
          <div className="absolute -top-[6px] -right-[6px] text-base">👑</div>
        )}
      </motion.div>
      <div className="flex-1">
        <p className="text-lg font-extrabold text-[#111] mb-0 leading-[1.1]">{user?.firstName || 'Rabbiter'}</p>
        <p className="text-[13px] text-[#AAA] m-0">
          <span className="font-extrabold text-[#E91E63] mr-1.5">Lvl. {levelName}</span>
          @{user?.username || 'explorador'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <ProfileSubpageLayout title={profileTitle} showBack={false}>

        <div className="pb-4">
          {/* HOPS PROGRESS BAR */}
          <div className="mb-5 bg-[#FAFAFA] rounded-[14px] p-4 border border-[#F0F0F0]">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-[11px] font-extrabold text-[#AAA] uppercase tracking-[0.5px] m-0 mb-0.5">PROGRESO DE MADRIGUERA</p>
                <p className="text-[15px] font-extrabold text-[#111] m-0">{(user as any)?.hops || 0} <span className="text-[#E91E63]">Hops</span></p>
              </div>
              <p className="text-xs font-bold text-[#888] m-0">{(user as any)?.hops >= 5000 ? 'MAX' : `Siguiente: ${nextLevelHops} Hops`}</p>
            </div>
            <div className="h-2 bg-[#EAEAEA] rounded-[100px] overflow-hidden">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${Math.min((((user as any)?.hops || 0) / nextLevelHops) * 100, 100)}%` }} 
                transition={{ duration: 1, delay: 0.2 }}
                style={{ background: levelGradient }}
                className="h-full rounded-[100px]"
              />
            </div>
          </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex gap-3 mb-4"
        >
          <div className="flex-1 border border-[#F0F0F0] rounded-[14px] px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#E91E63" strokeWidth="1.5" /><path d="M5 8l2 2 4-4" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-[26px] font-extrabold text-[#111] tracking-[-0.5px]">{(user?.totalBunzEarned || 0).toLocaleString()}</p>
            <p className="text-xs text-[#AAA] mt-0.5">bunz ganados</p>
          </div>
          <div className="flex-1 border border-[#F0F0F0] rounded-[14px] px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3L10 10L12 6L14 13" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-[26px] font-extrabold text-[#111] tracking-[-0.5px]">{user?.visitedBusinesses ?? 0}</p>
            <p className="text-xs text-[#AAA] mt-0.5">Negocios visitados</p>
          </div>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {(user?.role === 'AFFILIATE' || hasBusiness) ? (
            <>
              <Link href="/business" className="flex items-center justify-between bg-[#111] rounded-[14px] p-4 mb-2.5 no-underline active:scale-[0.98] transition-transform shadow-lg">
                <div>
                  <p className="text-sm font-extrabold text-white mb-0.5">Portal de Negocio Afiliado</p>
                  <p className="text-[11px] text-[#888] m-0">Gestiona tu negocio y tasa de Bunz</p>
                </div>
                <div className="w-11 h-6 rounded-xl bg-[#E91E63] p-0.5 flex justify-end">
                  <div className="w-5 h-5 rounded-[10px] bg-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
                </div>
              </Link>

              <button
                onClick={async () => {
                  const mod = await import('@twa-dev/sdk');
                  const app = mod.default;
                  app.showScanQrPopup({ text: "Escanea el código QR de tu PC" }, (qrText: string) => {
                    (async () => {
                      // Extract token: https://t.me/Rabbittyme_bot/app?startapp=qrlogin_{TOKEN}
                      let qrToken = qrText;
                      if (qrText.includes('qrlogin_')) {
                        qrToken = qrText.split('qrlogin_')[1];
                      }

                      try {
                        const res = await fetch('/api/auth/qr/scan', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ qrToken, userId: user?.id })
                        });
                        const data = await res.json();
                        if (data.success) {
                          if (app.closeScanQrPopup) {
                            try { app.closeScanQrPopup(); } catch (e) { }
                          }
                          showToast("¡Inicio de sesión exitoso en la PC! 🪄", 'success');
                        } else {
                          showToast("Error: " + data.error, 'error');
                        }
                      } catch (e) {
                        showToast("Error de conexión", 'error');
                      }
                    })();
                    return true;
                  });
                }}
                className="block w-full text-left bg-[#111] rounded-[14px] px-4 py-3 mb-2.5 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <p className="text-[13px] font-extrabold text-white mb-0.5">📸 Escanear QR de PC (Login Mágico)</p>
                <p className="text-[11px] text-white/60 m-0">Inicia sesión en tu dashboard web</p>
              </button>
            </>
          ) : (
            <Link href="/business" className="block bg-[#111] rounded-[14px] px-4 py-3 mb-2.5 flex-col gap-0.5 no-underline active:scale-[0.98] transition-transform">
              <p className="text-[13px] font-bold text-white mb-0.5">¿Tienes un negocio?</p>
              <p className="text-[11px] text-[#888] m-0">Afíliate y otorga bunz</p>
            </Link>
          )}
          <button onClick={() => setShowBunzGuide(true)} className="w-full flex items-center gap-2 bg-[#111] rounded-[14px] px-4 py-3 mb-2.5 cursor-pointer active:scale-[0.98] transition-transform border-none text-left">
            <HelpCircle size={16} color="rgba(255,255,255,0.4)" />
            <div>
              <p className="text-[13px] font-bold text-white mb-0.5">¿Cómo funciona la economía Bunz?</p>
              <p className="text-[11px] text-[#888] m-0">Guía para negocios afiliados</p>
            </div>
          </button>

          {showBunzGuide && <BunzGuide onClose={() => setShowBunzGuide(false)} />}

          <div className="flex gap-2.5 w-full mb-2.5">
            <Link href="/profile/gamification" style={{ background: "linear-gradient(135deg, #2A2D34 0%, #111 100%)" }} className="flex-1 rounded-[14px] py-4 flex flex-col items-center cursor-pointer gap-0.5 no-underline shadow-[0_4px_12px_rgba(0,0,0,0.1)] active:scale-[0.98] transition-transform">
              <span className="text-lg mb-0.5">🏆</span>
              <span className="text-sm font-extrabold text-white">Logros</span>
              <span className="text-[11px] text-white/60">Insignias y Misiones</span>
            </Link>
            
            <Link href="/referral" style={{ background: "linear-gradient(135deg, #FF6B9E 0%, #E91E63 100%)" }} className="flex-1 rounded-[14px] py-4 flex flex-col items-center cursor-pointer gap-0.5 no-underline shadow-[0_4px_12px_rgba(233,30,99,0.2)] active:scale-[0.98] transition-transform">
              <span className="text-lg mb-0.5">🎁</span>
              <span className="text-sm font-extrabold text-white">Invitar amigos</span>
              <span className="text-[11px] text-white/80">Gana 50 bunz por ref</span>
            </Link>
          </div>
        </motion.div>
      </div>

      <div>
        <p className="text-[11px] font-bold text-[#AAA] tracking-[0.8px] mb-1 mt-1">CONFIGURACIÓN</p>
        {MENU_ITEMS.map((item, i) => (
          <Link
            href={item.href}
            key={item.label}
            style={{ borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid #F4F4F4" : "none" }}
            className="flex items-center gap-3.5 py-[15px] cursor-pointer no-underline active:opacity-60 transition-opacity"
          >
            <span className="text-xl w-6 text-center">{item.icon}</span>
            <span className="flex-1 text-[15px] text-[#111]">{item.label}</span>
            {item.badge && (
              <span className="bg-[#E91E63] text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{item.badge}</span>
            )}
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="#CCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        ))}
      </div>
    </ProfileSubpageLayout>
    {/* ADMIN PANEL OVERLAY */}
    {showAdmin && (
      <AdminPanel onClose={() => setShowAdmin(false)} />
    )}
    </>
  );
}
