'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

const MENU_ITEMS = [
  { icon: "💳", label: "Historial de transacciones", badge: null, href: '/history' },
  { icon: "👥", label: "Programa de referidos", badge: null, href: '/referral' },
  { icon: "🔔", label: "Notificaciones", badge: 3, href: '/notifications' },
  { icon: "🛡", label: "Seguridad y Privacidad", badge: null, href: '/security' },
  { icon: "❓", label: "Ayuda y Soporte", badge: null, href: '/privacy' },
  { icon: "🚀", label: "Ver Onboarding", badge: "Dev", href: '/onboarding' },
];

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      const tgUser = app.initDataUnsafe.user;
      if (tgUser) setUser(tgUser);
      else setUser({ first_name: 'Bruce', username: 'bruce_wayne' });
    });
  }, []);

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
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: "50%", backgroundColor: "#E91E63", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{user?.first_name?.[0] || 'B'}</span>
      </div>
      <div>
        <p style={{ fontSize: 18, fontWeight: 800, color: "#111", marginBottom: 0, lineHeight: 1.1 }}>{user?.first_name || 'Bruce'}</p>
        <p style={{ fontSize: 13, color: "#AAA", margin: 0 }}>@{user?.username || 'bruce_wayne'}</p>
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
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="#E91E63" strokeWidth="1.5"/><path d="M5 8l2 2 4-4" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>1,250</p>
            <p style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>Bunz ganados</p>
          </div>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 13L6 3L10 10L12 6L14 13" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>23</p>
            <p style={{ fontSize: 12, color: "#AAA", marginTop: 2 }}>Negocios visitados</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Link href="/business" style={{ display: 'block', backgroundColor: "#111", borderRadius: 14, padding: "12px 16px", marginBottom: 10, flexDirection: "column", gap: 2, textDecoration: 'none' }} className="active:scale-[0.98] transition-transform">
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>¿Tienes un negocio?</p>
            <p style={{ fontSize: 11, color: "#888", margin: 0 }}>Afíliate y otorga bunz</p>
          </Link>

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
            <svg width="7" height="12" viewBox="0 0 7 12" fill="none"><path d="M1 1l5 5-5 5" stroke="#CCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>
        ))}
      </div>
    </ProfileSubpageLayout>
  );
}
