'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

function QRCode() {
  const cells: boolean[][] = [];
  const seed = [1,0,1,1,0,1,0,1, 0,1,0,0,1,0,1,0, 1,1,1,0,1,1,0,1, 0,0,1,1,0,0,1,1, 1,0,0,1,1,0,1,0, 0,1,1,0,0,1,0,1, 1,0,1,0,1,1,1,0, 0,1,0,1,0,0,1,1];
  for (let i = 0; i < 8; i++) {
    cells.push(seed.map(v => !!v));
  }
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(8, 10px)", gap: 2 }}>
      {cells.flat().map((on, i) => (
        <div key={i} style={{ width: 10, height: 10, backgroundColor: on ? "#111" : "transparent", borderRadius: 1 }} />
      ))}
    </div>
  );
}

const STATS = [
  { value: "156", label: "TRANSACCIONES", delta: "↑ +12%", color: "#E91E63" },
  { value: "89", label: "CLIENTES", delta: "↑ +5%", color: "#E91E63" },
  { value: "2,340", label: "BUNZ DADOS", delta: "↑ +8%", color: "#E91E63" },
];

export default function BusinessPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [rewardRate, setRewardRate] = useState(21);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
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

  const businessTitle = (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0, lineHeight: 1.1 }}>Café Cultura</h1>
      <p style={{ fontSize: 13, color: "#AAA", marginTop: 2, marginBottom: 0 }}>Restaurante y Café</p>
    </div>
  );

  return (
    <ProfileSubpageLayout title={businessTitle}>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          {STATS.map((s, i) => (
            <motion.div 
              key={s.label} 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 8px", textAlign: "center" }}
            >
              <p style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.5px" }}>{s.value}</p>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#AAA", letterSpacing: "0.5px", margin: "4px 0" }}>{s.label}</p>
              <p style={{ fontSize: 11, color: s.color, fontWeight: 600 }}>{s.delta}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          style={{ backgroundColor: "#111", borderRadius: 18, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.3"/>
                  <rect x="9" y="1" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.3"/>
                  <rect x="1" y="9" width="6" height="6" rx="1" stroke="#fff" strokeWidth="1.3"/>
                  <rect x="11" y="11" width="4" height="4" fill="#fff" rx="0.5"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Generar código QR</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>Para registrar consumos</p>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCode />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>Línea de crédito</p>
              <p style={{ fontSize: 13, color: "#AAA" }}>$75,000 disponible</p>
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#111" }}>$100,000</p>
          </div>
          <div style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 100, overflow: "hidden" }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "25%" }}
              transition={{ duration: 1, delay: 0.3 }}
              style={{ height: "100%", backgroundColor: "#E91E63", borderRadius: 100 }} 
            />
          </div>
          <p style={{ fontSize: 11, color: "#AAA", marginTop: 6 }}>25% usado</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>Tasa de recompensa</p>
              <p style={{ fontSize: 12, color: "#AAA" }}>Otorga {rewardRate}% en bunz por consumo</p>
            </div>
            <p style={{ fontSize: 24, fontWeight: 900, color: "#E91E63" }}>{rewardRate}%</p>
          </div>
          <div style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 100, overflow: "hidden" }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${rewardRate}%` }}
              transition={{ duration: 1, delay: 0.4 }}
              style={{ height: "100%", backgroundColor: "#E91E63", borderRadius: 100 }} 
            />
          </div>
          
          <input
            type="range"
            min="10"
            max="100"
            value={rewardRate}
            onChange={(e) => setRewardRate(Number(e.target.value))}
            className="w-full mt-4 appearance-none bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#111] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-runnable-track]:h-[2px] [&::-webkit-slider-runnable-track]:bg-[#F0F0F0]"
          />
          
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#CCC" }}>10% Mínimo</span>
            <span style={{ fontSize: 11, color: "#CCC" }}>100% Máximo</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ display: "flex", gap: 10, marginBottom: 16 }}
        >
          {[
            { icon: "📊", label: "Analíticas" },
            { icon: "👥", label: "Clientes" },
            { icon: "⚙️", label: "Ajustes" },
          ].map((item) => (
            <button key={item.label} className="active:scale-[0.96] transition-transform" style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, background: "none", cursor: "pointer", fontFamily: "var(--font-family-base)" }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{item.label}</span>
            </button>
          ))}
        </motion.div>

    </ProfileSubpageLayout>
  );
}
