'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import AdminPanel from '@/features/admin/AdminPanel';

const MENU_ITEMS = [
  { icon: "💳", label: "Mi Billetera", badge: null, href: '/profile/wallet' },
  { icon: "📜", label: "Historial de transacciones", badge: null, href: '/history' },
  { icon: "👥", label: "Programa de referidos", badge: null, href: '/referral' },
  { icon: "🔔", label: "Notificaciones", badge: null, href: '/notifications' },
  { icon: "🛡", label: "Seguridad y Privacidad", badge: null, href: '/security' },
  { icon: "❓", label: "Ayuda y Soporte", badge: null, href: '/profile/support' },
];

export default function ProfilePage() {
  const { address } = useWallet();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [isScrolled, setIsScrolled] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [showAdmin, setShowAdmin] = useState(false);

  // Dynamic NFT Level Colors
  const getLevelColor = (levelId?: string | null) => {
    // We can map levelId to colors. For now, fallback logic based on hops
    const hops = (user as any)?.hops || 0;
    if (hops >= 5000) return 'linear-gradient(135deg, #FFD700, #FFA500)'; // Legendary
    if (hops >= 2000) return 'linear-gradient(135deg, #9C27B0, #E91E63)'; // Epic
    if (hops >= 500) return 'linear-gradient(135deg, #2196F3, #00BCD4)'; // Rare
    return '#E91E63'; // Common
  };

  const handleAvatarTap = () => {
    // Only allow admin ID 798431743
    if (user?.telegramId === "798431743") {
      const newCount = tapCount + 1;
      setTapCount(newCount);
      if (newCount === 5) {
        setShowAdmin(true);
        setTapCount(0);
      }
    } else {
      // Just a normal tap for non-admins
      if (tapCount > 5) {
        // block or ignore
      }
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

  const profileTitle = (
    <div style={{ display: "flex", alignItems: "center", gap: 12, position: 'relative', width: '100%' }}>
      <motion.div
        whileTap={{ scale: 0.9 }}
        onClick={handleAvatarTap}
        style={{ 
          width: 50, height: 50, borderRadius: "14px", 
          background: getLevelColor((user as any)?.levelId), 
          padding: 2, display: "flex", alignItems: "center", justifyContent: "center", 
          flexShrink: 0, position: 'relative', cursor: 'pointer',
          boxShadow: (user as any)?.hops >= 500 ? '0 4px 16px rgba(0,0,0,0.1)' : 'none'
        }}
      >
        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=ffffff`} alt={user?.firstName || 'User'} style={{ width: '100%', height: '100%', borderRadius: '12px' }} />
        {(user as any)?.hops >= 2000 && (
          <div style={{ position: 'absolute', top: -6, right: -6, fontSize: 16 }}>👑</div>
        )}
      </motion.div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 0, lineHeight: 1.1 }}>{user?.firstName || 'Rabbiter'}</p>
        <p style={{ fontSize: 13, color: "#AAA", margin: 0 }}>
          <span style={{ fontWeight: 800, color: '#E91E63', marginRight: 6 }}>Lvl. {(user as any)?.levelId || 1}</span>
          @{user?.username || 'explorador'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <ProfileSubpageLayout title={profileTitle} showBack={false}>

        <div style={{ paddingBottom: 16 }}>
          {/* HOPS PROGRESS BAR */}
          <div style={{ marginBottom: 20, background: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #F0F0F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 900, color: '#AAA', textTransform: 'uppercase', letterSpacing: 0.5, margin: '0 0 2px' }}>PROGRESO DE MADRIGUERA</p>
                <p style={{ fontSize: 15, fontWeight: 900, color: '#111', margin: 0 }}>{(user as any)?.hops || 0} <span style={{ color: '#E91E63' }}>Hops</span></p>
              </div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#888', margin: 0 }}>{(user as any)?.hops >= 5000 ? 'MAX' : 'Siguiente: 500 Hops'}</p>
            </div>
            <div style={{ height: 8, background: '#EAEAEA', borderRadius: 100, overflow: 'hidden' }}>
              <motion.div 
                initial={{ width: 0 }} 
                animate={{ width: `${Math.min((((user as any)?.hops || 0) / 500) * 100, 100)}%` }} 
                transition={{ duration: 1, delay: 0.2 }}
                style={{ height: '100%', background: getLevelColor((user as any)?.levelId), borderRadius: 100 }}
              />
            </div>
          </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          style={{ display: "flex", gap: 12, marginBottom: 16 }}
        >
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#E91E63" strokeWidth="1.5" /><path d="M5 8l2 2 4-4" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>{(user?.totalBunzEarned || 0).toLocaleString()}</p>
            <p style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>bunz ganados</p>
          </div>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3L10 10L12 6L14 13" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>{user?.visitedBusinesses ?? 0}</p>
            <p style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>Negocios visitados</p>
          </div>
        </motion.div>


        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {user?.role === 'AFFILIATE' ? (
            <>
              <Link href="/business" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: "#111", borderRadius: 14, padding: "16px", marginBottom: 10, textDecoration: 'none' }} className="active:scale-[0.98] transition-transform shadow-lg">
                <div>
                  <p style={{ fontSize: 14, fontWeight: 900, color: "#fff", marginBottom: 2 }}>Cambiar a Modo Afiliado</p>
                  <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Gestiona tu negocio activo</p>
                </div>
                <div style={{ width: 44, height: 24, borderRadius: 12, backgroundColor: '#E91E63', padding: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <div style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                </div>
              </Link>

              <button
                onClick={async () => {
                  const mod = await import('@twa-dev/sdk');
                  const app = mod.default;
                  app.showScanQrPopup({ text: "Escanea el código QR de tu PC" }, (qrText: string) => {
                    (async () => {
                      // Extract token: https://t.me/RabbittyBot/app?startapp=qrlogin_{TOKEN}
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
                style={{ display: 'block', width: '100%', textAlign: 'left', backgroundColor: "#111", border: "none", borderRadius: 14, padding: "12px 16px", marginBottom: 10, cursor: "pointer" }}
                className="active:scale-[0.98] transition-transform"
              >
                <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 2 }}>📸 Escanear QR de PC (Login Mágico)</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: 0 }}>Inicia sesión en tu dashboard web</p>
              </button>
            </>
          ) : (
            <Link href="/business" style={{ display: 'block', backgroundColor: "#111", borderRadius: 14, padding: "12px 16px", marginBottom: 10, flexDirection: "column", gap: 2, textDecoration: 'none' }} className="active:scale-[0.98] transition-transform">
              <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>¿Tienes un negocio?</p>
              <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Afíliate y otorga bunz</p>
            </Link>
          )}

          <div style={{ display: 'flex', gap: 10, width: '100%', marginBottom: 10 }}>
            <Link href="/profile/gamification" style={{ flex: 1, background: "linear-gradient(135deg, #2A2D34 0%, #111 100%)", borderRadius: 14, padding: "16px 0", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", gap: 2, textDecoration: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} className="active:scale-[0.98] transition-transform">
              <span style={{ fontSize: 18, marginBottom: 2 }}>🏆</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Logros</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>Insignias y Misiones</span>
            </Link>
            
            <Link href="/referral" style={{ flex: 1, background: "linear-gradient(135deg, #FF6B9E 0%, #E91E63 100%)", borderRadius: 14, padding: "16px 0", display: "flex", flexDirection: "column", alignItems: "center", cursor: "pointer", gap: 2, textDecoration: 'none', boxShadow: '0 4px 12px rgba(233,30,99,0.2)' }} className="active:scale-[0.98] transition-transform">
              <span style={{ fontSize: 18, marginBottom: 2 }}>🎁</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Invitar amigos</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}>Gana 50 bunz por ref</span>
            </Link>
          </div>
        </motion.div>
      </div>

      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 4, marginTop: 4 }}>CONFIGURACIÓN</p>
        {MENU_ITEMS.map((item, i) => (
          <Link
            href={item.href}
            key={item.label}
            style={{ display: "flex", alignItems: "center", gap: 14, paddingTop: 15, paddingBottom: 15, borderBottom: i < MENU_ITEMS.length - 1 ? "1px solid #F4F4F4" : "none", cursor: "pointer", textDecoration: 'none' }}
            className="active:opacity-60 transition-opacity"
          >
            <span style={{ fontSize: 20, width: 24, textAlign: "center" }}>{item.icon}</span>
            <span style={{ flex: 1, fontSize: 15, color: "#111" }}>{item.label}</span>
            {item.badge && (
              <span style={{ backgroundColor: "#E91E63", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>{item.badge}</span>
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
