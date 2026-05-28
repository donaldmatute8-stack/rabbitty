'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

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
      <div
        onClick={() => showToast('La edición de avatar estará disponible pronto 🐰', 'info')}
        style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#E91E63", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, position: 'relative', cursor: 'pointer' }}
      >
        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${user?.firstName || 'Rabbitty'}&backgroundColor=E91E63`} alt={user?.firstName || 'User'} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#fff', borderRadius: '50%', padding: 2 }}>
          <div style={{ background: '#111', borderRadius: '50%', padding: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 0, lineHeight: 1.1 }}>{user?.firstName || 'Rabbiter'}</p>
        <p style={{ fontSize: 13, color: "#AAA", margin: 0 }}>@{user?.username || 'explorador'}</p>
      </div>
    </div>
  );

  return (
    <ProfileSubpageLayout title={profileTitle} showBack={false}>

      <div style={{ paddingBottom: 16 }}>
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

          <Link href="/referral" style={{ display: 'flex', width: "100%", backgroundColor: "#FFE8F0", border: "1.5px solid #FFBCD4", borderRadius: 14, padding: "14px 0", flexDirection: "column", alignItems: "center", cursor: "pointer", gap: 2, textDecoration: 'none' }} className="active:scale-[0.98] transition-transform">
            <span style={{ fontSize: 14, fontWeight: 700, color: "#E91E63" }}>Invitar amigos</span>
            <span style={{ fontSize: 11, color: "#E91E63", opacity: 0.7 }}>Gana 50 bunz por ref</span>
          </Link>
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
  );
}
