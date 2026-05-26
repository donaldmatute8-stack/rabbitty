'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

const LEVELS = [
  { name: "Bronce", refs: 0, bunz: "+50 bunz", color: "#CD7F32", active: true },
  { name: "Plata", refs: 5, bunz: "+75 bunz", color: "#999", active: false },
  { name: "Oro", refs: 15, bunz: "+100 bunz", color: "#DAA520", active: false },
  { name: "Platino", refs: 50, bunz: "+200 bunz", color: "#4FC3F7", active: false },
];

const REFERIDOS = [
  { initial: "M", name: "María G.", time: "Hace 2 días", color: "#E91E63" },
  { initial: "C", name: "Carlos R.", time: "Hace 5 días", color: "#2196F3" },
  { initial: "A", name: "Ana L.", time: "Hace 1 semana", color: "#4CAF50" },
];

export default function ReferralPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [copied, setCopied] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [utils, setUtils] = useState<any>(null);

  const referralCode = `RABBIT${user?.id?.toString().slice(0, 4) || '2026'}`;
  const botLink = `https://t.me/rabbitty_bot?start=${referralCode}`;

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      if (app.initDataUnsafe?.user) setUser(app.initDataUnsafe.user);
      if ((app as any).Utils) setUtils((app as any).Utils);
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

  const handleCopy = () => {
    navigator.clipboard.writeText(botLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    if (utils) {
      utils.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent('¡Únete a Rabbitty y gana bunz conmigo!')}`);
    } else {
      handleCopy();
    }
  };

  const referralTitle = (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0, lineHeight: 1.1 }}>Referidos</h1>
      <p style={{ fontSize: 13, color: "#AAA", marginTop: 2, marginBottom: 0 }}>Gana 50 bunz por amigo</p>
    </div>
  );

  return (
    <ProfileSubpageLayout title={referralTitle}>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: "linear-gradient(135deg, #E91E63 0%, #C2185B 100%)", borderRadius: 18, padding: "20px 20px 16px", marginBottom: 16 }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.8px", marginBottom: 8, textAlign: 'center' }}>TU CÓDIGO DE REFERIDO</p>
          <p style={{ fontSize: 28, fontWeight: 900, color: "#fff", letterSpacing: "4px", textAlign: "center", marginBottom: 16 }}>{referralCode}</p>
          <div style={{ display: "flex", gap: 10 }}>
            <button 
              onClick={handleCopy}
              className="active:scale-[0.98] transition-transform"
              style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 100, padding: "10px 0", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "var(--font-family-base)" }}
            >
              {copied ? (
                <span className="text-white">¡Copiado!</span>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1" y="3" width="9" height="10" rx="2" stroke="#fff" strokeWidth="1.4"/><path d="M4 3V2a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-1" stroke="#fff" strokeWidth="1.4"/></svg>
                  Copiar
                </>
              )}
            </button>
            <button 
              onClick={handleShare}
              className="active:scale-[0.98] transition-transform"
              style={{ flex: 1, backgroundColor: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 100, padding: "10px 0", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "var(--font-family-base)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="11" cy="3" r="2" stroke="#fff" strokeWidth="1.4"/><circle cx="3" cy="7" r="2" stroke="#fff" strokeWidth="1.4"/><circle cx="11" cy="11" r="2" stroke="#fff" strokeWidth="1.4"/><path d="M5 6L9 4M5 8L9 10" stroke="#fff" strokeWidth="1.4"/></svg>
              Compartir
            </button>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ display: "flex", gap: 10, marginBottom: 24 }}
        >
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1c1.5 0 2.5 1 2.5 2.5S8.5 6 7 6 4.5 5 4.5 3.5 5.5 1 7 1zM1 13c0-3 2.7-5 6-5s6 2 6 5" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round"/></svg>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>{REFERIDOS.length}</p>
            <p style={{ fontSize: 12, color: "#AAA" }}>amigos Referidos</p>
          </div>
          <div style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 10L5 3L8 8L10 5L12 10" stroke="#E91E63" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <p style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>150</p>
            <p style={{ fontSize: 12, color: "#AAA" }}>bunz Ganado</p>
          </div>
        </motion.div>

        <div style={{ paddingBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 10 }}>NIVELES DE RECOMPENSA</p>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 16 }} className="scrollbar-hide">
            {LEVELS.map((level) => (
              <div key={level.name} style={{ flexShrink: 0, width: 110, border: level.active ? `2px solid ${level.color}` : "1px solid #F0F0F0", borderRadius: 14, padding: "12px 10px", backgroundColor: level.active ? "#FFFBF8" : "#FAFAFA" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", backgroundColor: level.color, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 12 }}>⭐</span>
                </div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#111", marginBottom: 2 }}>{level.name}</p>
                <p style={{ fontSize: 11, color: "#AAA", marginBottom: 4 }}>{level.refs} refs necesarios</p>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#E91E63" }}>{level.bunz}</p>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 10, marginTop: 16 }}>TUS REFERIDOS</p>
          {REFERIDOS.map((r, i) => (
            <motion.div 
              key={r.name} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 12, borderBottom: i < REFERIDOS.length - 1 ? "1px solid #F4F4F4" : "none" }}
            >
              <div style={{ width: 40, height: 40, borderRadius: "50%", backgroundColor: r.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{r.initial}</span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>{r.name}</p>
                <p style={{ fontSize: 12, color: "#AAA" }}>{r.time}</p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#E91E63" }}>+50 bunz</span>
            </motion.div>
          ))}
        </div>
    </ProfileSubpageLayout>
  );
}
