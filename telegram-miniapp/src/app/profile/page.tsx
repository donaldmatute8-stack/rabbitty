'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { HelpCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import AdminPanel from '@/features/admin/AdminPanel';
import BunzGuide from '@/features/business/BunzGuide';

interface UserProfile {
  id?: string;
  firstName?: string;
  username?: string;
  hops?: number;
  role?: string;
  totalBunzEarned?: number;
  visitedBusinesses?: number;
}

interface GamificationLevelResponse {
  level?: {
    requiredHops?: number;
    name?: string;
  };
}

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
  const { user: rawUser, logout } = useAuth();
  const user = rawUser as UserProfile | null;
  const { showToast } = useToast();
  const [tapCount, setTapCount] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showBunzGuide, setShowBunzGuide] = useState(false);
  const [nextLevelHops, setNextLevelHops] = useState(500);
  const [levelGradient, setLevelGradient] = useState(DEFAULT_GRADIENT);
  const [levelName, setLevelName] = useState('1');
  const [hasBusiness, setHasBusiness] = useState(false);

  useEffect(() => {
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/business`, { headers }))
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
    if (!user?.id) {
      showToast('Identidad NFT (Próximamente)', 'info');
      return;
    }
    const headers = await PlatformBridge.getAuthHeaders();
    const res = await fetch(`/api/auth/is-admin`, { headers });
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
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/gamification`, { headers }))
        .then(r => r.json())
        .then((data: GamificationLevelResponse) => {
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
          boxShadow: (user?.hops ?? 0) >= 500 ? '0 4px 16px rgba(0,0,0,0.1)' : 'none'
        }}
        className="w-12.5 h-12.5 rounded-[14px] p-0.5 flex items-center justify-center shrink-0 relative cursor-pointer"
      >
        <Image 
          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=ffffff`} 
          alt={user?.firstName || 'User'} 
          width={46}
          height={46}
          unoptimized
          className="w-full h-full rounded-xl" 
        />
        {(user?.hops ?? 0) >= 2000 && (
          <div className="absolute -top-1.5 -right-1.5 text-base">👑</div>
        )}
      </motion.div>
      <div className="flex-1">
        <p className="text-lg font-extrabold text-(--text-primary) mb-0 leading-[1.1]">{user?.firstName || 'Rabbiter'}</p>
        <p className="text-[13px] text-(--text-muted) m-0">
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
          <div className="mb-5 bg-(--bg-elevated) rounded-[14px] p-4 border border-(--border-subtle)">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-[11px] font-extrabold text-(--text-muted) uppercase tracking-[0.5px] m-0 mb-0.5">PROGRESO DE MADRIGUERA</p>
                <p className="text-[15px] font-extrabold text-(--text-primary) m-0">{user?.hops || 0} <span className="text-[#E91E63]">Hops</span></p>
              </div>
              <p className="text-xs font-bold text-(--text-muted) m-0">{(user?.hops ?? 0) >= 5000 ? 'MAX' : `Siguiente: ${nextLevelHops} Hops`}</p>
            </div>
            <div className="h-2 bg-(--bg-pressed) rounded-[100px] overflow-hidden">
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${Math.min(((user?.hops || 0) / nextLevelHops) * 100, 100)}%` }} 
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
          <div className="flex-1 bg-(--bg-elevated) border border-(--border-subtle) rounded-[14px] px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#E91E63" strokeWidth="1.5" /><path d="M5 8l2 2 4-4" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-[26px] font-extrabold text-(--text-primary) tracking-[-0.5px]">{(user?.totalBunzEarned || 0).toLocaleString()}</p>
            <p className="text-xs text-(--text-muted) mt-0.5">bunz ganados</p>
          </div>
          <div className="flex-1 bg-(--bg-elevated) border border-(--border-subtle) rounded-[14px] px-4 py-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3L10 10L12 6L14 13" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p className="text-[26px] font-extrabold text-(--text-primary) tracking-[-0.5px]">{user?.visitedBusinesses ?? 0}</p>
            <p className="text-xs text-(--text-muted) mt-0.5">Negocios visitados</p>
          </div>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {(user?.role === 'AFFILIATE' || hasBusiness) ? (
            <>
              <Link href="/business" className="flex items-center justify-between bg-(--bg-elevated) border border-(--border-subtle) rounded-[14px] p-4 mb-2.5 no-underline active:scale-[0.98] transition-transform shadow-lg">
                <div>
                  <p className="text-sm font-extrabold text-(--text-primary) mb-0.5">Portal de Negocio Afiliado</p>
                  <p className="text-[11px] text-(--text-muted) m-0">Gestiona tu negocio y tasa de Bunz</p>
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
                      let qrToken = qrText;
                      if (qrText.includes('qrlogin_')) {
                        qrToken = qrText.split('qrlogin_')[1].split('&')[0].split('?')[0];
                      } else if (qrText.startsWith('{')) {
                        try {
                          const parsed = JSON.parse(qrText);
                          if (parsed.token) qrToken = parsed.token;
                        } catch { /* ignore parse error */ }
                      }

                      try {
                        const headers = await PlatformBridge.getAuthHeaders();
                        const res = await fetch('/api/auth/qr/scan', {
                          method: 'POST',
                          headers: { ...headers, 'Content-Type': 'application/json' },
                          body: JSON.stringify({ qrToken })
                        });
                        const data = await res.json();
                        if (data.success) {
                          if (app.closeScanQrPopup) {
                            try { app.closeScanQrPopup(); } catch { /* ignore popup close error */ }
                          }
                          showToast("¡Inicio de sesión exitoso en la PC! 🪄", 'success');
                        } else {
                          showToast("Error: " + data.error, 'error');
                        }
                      } catch {
                        showToast("Error de conexión", 'error');
                      }
                    })();
                    return true;
                  });
                }}
                className="block w-full text-left bg-(--bg-elevated) border border-(--border-subtle) rounded-[14px] px-4 py-3 mb-2.5 cursor-pointer active:scale-[0.98] transition-transform"
              >
                <p className="text-[13px] font-extrabold text-(--text-primary) mb-0.5">📸 Escanear QR de PC (Login Mágico)</p>
                <p className="text-[11px] text-(--text-muted) m-0">Inicia sesión en tu dashboard web</p>
              </button>
            </>
          ) : (
            <Link href="/business" className="block bg-(--bg-elevated) border border-(--border-subtle) rounded-[14px] px-4 py-3 mb-2.5 flex-col gap-0.5 no-underline active:scale-[0.98] transition-transform">
              <p className="text-[13px] font-bold text-(--text-primary) mb-0.5">¿Tienes un negocio?</p>
              <p className="text-[11px] text-(--text-muted) m-0">Afíliate y otorga bunz</p>
            </Link>
          )}
          <button onClick={() => setShowBunzGuide(true)} className="w-full flex items-center gap-2 bg-(--bg-elevated) border border-(--border-subtle) rounded-[14px] px-4 py-3 mb-2.5 cursor-pointer active:scale-[0.98] transition-transform text-left">
            <HelpCircle size={16} className="text-(--text-muted)" />
            <div>
              <p className="text-[13px] font-bold text-(--text-primary) mb-0.5">¿Cómo funciona la economía Bunz?</p>
              <p className="text-[11px] text-(--text-muted) m-0">Guía para negocios afiliados</p>
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
        <p className="text-[11px] font-bold text-(--text-muted) tracking-[0.8px] mb-1 mt-1">CONFIGURACIÓN</p>
        {MENU_ITEMS.map((item, i) => (
          <Link
            href={item.href}
            key={item.label}
            style={{ borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid var(--border-subtle)" : "none" }}
            className="flex items-center gap-3.5 py-3.75 cursor-pointer no-underline active:opacity-60 transition-opacity"
          >
            <span className="text-xl w-6 text-center">{item.icon}</span>
            <span className="flex-1 text-[15px] text-(--text-primary)">{item.label}</span>
            {item.badge && (
              <span className="bg-[#E91E63] text-white text-[11px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{item.badge}</span>
            )}
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="currentColor" className="text-(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
        ))}

        <button
          onClick={logout}
          className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 rounded-[14px] bg-rose-500/10 text-rose-500 border border-rose-500/20 font-bold text-sm cursor-pointer active:scale-[0.98] transition-transform"
        >
          <span>🚪</span>
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </ProfileSubpageLayout>
    {/* ADMIN PANEL OVERLAY */}
    {showAdmin && (
      <AdminPanel onClose={() => setShowAdmin(false)} />
    )}
    </>
  );
}
