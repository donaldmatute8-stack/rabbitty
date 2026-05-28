import { useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface MobileAffiliateDashboardProps {
  business: any;
}

const STATS = [
  { value: "156", label: "TRANSACCIONES", delta: "↑ +12%", color: "#E91E63" },
  { value: "89", label: "CLIENTES", delta: "↑ +5%", color: "#E91E63" },
  { value: "2,340", label: "BUNZ DADOS", delta: "↑ +8%", color: "#E91E63" },
];

export default function MobileAffiliateDashboard({ business }: MobileAffiliateDashboardProps) {
  const [rewardRate, setRewardRate] = useState(business?.rewardPercentage || 21);

  if (business?.status === 'PENDING_VERIFICATION') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', textAlign: 'center' }}>
        <div style={{ width: 80, height: 80, background: '#FFF5F0', color: '#F97316', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <span style={{ fontSize: 32 }}>⏱️</span>
        </div>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: '#111', marginBottom: 12 }}>Negocio en Revisión</h2>
        <p style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 32 }}>
          Estamos verificando la información de <strong>{business.name}</strong> para proteger la red. Este proceso toma entre 2 y 24 horas.
        </p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Dynamic Header */}
      <div style={{ padding: '24px 20px 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', margin: '0 0 4px 0', letterSpacing: '-1px' }}>{business?.name || 'Café Cultura'}</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#888', fontWeight: 600 }}>{business?.category || 'Restaurante y Café'}</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        {/* STATS */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          {STATS.map((s, i) => (
            <motion.div 
              key={s.label} 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
              style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 8px", textAlign: "center", background: '#fff' }}
            >
              <p style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0 }}>{s.value}</p>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#AAA", letterSpacing: "0.5px", margin: "4px 0" }}>{s.label}</p>
              <p style={{ fontSize: 11, color: s.color, fontWeight: 600, margin: 0 }}>{s.delta}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* QR CODE GENERATOR */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ backgroundColor: "#111", borderRadius: 18, padding: "16px 20px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <QrCode size={16} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>Generar código QR</p>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", margin: 0 }}>Para registrar consumos</p>
              </div>
            </div>
          </div>
          <div style={{ backgroundColor: "#fff", borderRadius: 12, padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <QRCodeSVG value={`business_${business?.id}`} size={40} level="L" />
          </div>
        </motion.div>

        {/* LINEA DE CREDITO */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16, background: '#fff' }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2, marginTop: 0 }}>Línea de crédito</p>
              <p style={{ fontSize: 13, color: "#AAA", margin: 0 }}>$75,000 disponible</p>
            </div>
            <p style={{ fontSize: 18, fontWeight: 800, color: "#111", margin: 0 }}>$100,000</p>
          </div>
          <div style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 100, overflow: "hidden" }}>
            <motion.div 
              initial={{ width: 0 }} animate={{ width: "25%" }} transition={{ duration: 1, delay: 0.3 }}
              style={{ height: "100%", backgroundColor: "#E91E63", borderRadius: 100 }} 
            />
          </div>
          <p style={{ fontSize: 11, color: "#AAA", marginTop: 6, marginBottom: 0 }}>25% usado</p>
        </motion.div>

        {/* TASA DE RECOMPENSA */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16, background: '#fff' }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2, marginTop: 0 }}>Tasa de recompensa</p>
              <p style={{ fontSize: 12, color: "#AAA", margin: 0 }}>Otorga {rewardRate}% en bunz por consumo</p>
            </div>
            <p style={{ fontSize: 24, fontWeight: 900, color: "#E91E63", margin: 0 }}>{rewardRate}%</p>
          </div>
          <div style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 100, overflow: "hidden" }}>
            <motion.div 
              initial={{ width: 0 }} animate={{ width: `${rewardRate}%` }} transition={{ duration: 1, delay: 0.4 }}
              style={{ height: "100%", backgroundColor: "#E91E63", borderRadius: 100 }} 
            />
          </div>
          
          <input
            type="range" min="10" max="100" value={rewardRate} onChange={(e) => setRewardRate(Number(e.target.value))}
            style={{
              width: '100%', marginTop: 16, appearance: 'none', background: '#F0F0F0', height: 2, borderRadius: 1, outline: 'none'
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#CCC" }}>10% Mínimo</span>
            <span style={{ fontSize: 11, color: "#CCC" }}>100% Máximo</span>
          </div>
        </motion.div>

        {/* QUICK ACTION BUTTONS */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ display: "flex", gap: 10, marginBottom: 16 }}
        >
          {[
            { icon: "📊", label: "Analíticas" },
            { icon: "👥", label: "Clientes" },
            { icon: "⚙️", label: "Ajustes" },
          ].map((item) => (
            <button key={item.label} style={{ 
              flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "14px 8px", 
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, 
              background: "#fff", cursor: "pointer", outline: 'none'
            }}>
              <span style={{ fontSize: 22 }}>{item.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{item.label}</span>
            </button>
          ))}
        </motion.div>

      </div>
    </div>
  );
}
