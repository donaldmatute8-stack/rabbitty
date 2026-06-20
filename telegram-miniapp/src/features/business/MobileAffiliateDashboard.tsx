import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Inbox, Check, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface MobileAffiliateDashboardProps {
  business: any;
}

export default function MobileAffiliateDashboard({ business }: MobileAffiliateDashboardProps) {
  const [rewardRate, setRewardRate] = useState(business?.rewardPercentage || 21);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingRes, setLoadingRes] = useState(true);
  const [txCount, setTxCount] = useState(0);
  const [totalBunz, setTotalBunz] = useState(0);
  const [clientCount, setClientCount] = useState(0);

  useEffect(() => {
    if (business?.ownerId) {
      fetch(`/api/reservations?ownerId=${business.ownerId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) setReservations(data.reservations || []);
        })
        .finally(() => setLoadingRes(false));
    }
  }, [business?.ownerId]);

  useEffect(() => {
    if (business?.id) {
      fetch(`/api/business/transactions?businessId=${business.id}`)
        .then(r => r.json())
        .then((data: any) => {
          if (data.success) {
            setTxCount(data.transactions?.length || 0);
            const uniqueClients = new Set(data.transactions?.map((t: any) => t.userId));
            setClientCount(uniqueClients.size);
            const total = data.transactions?.reduce((sum: number, t: any) => sum + (t.bunzMinted || 0), 0) || 0;
            setTotalBunz(total);
          }
        })
        .catch(() => {});
    }
  }, [business?.id]);

  const handleReservationStatus = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      } else {
        alert(data.error || 'Error al actualizar reserva');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

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
      <div style={{ padding: '24px 20px 16px' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', margin: '0 0 4px 0', letterSpacing: '-1px' }}>{business?.name || 'Café Cultura'}</h1>
        <p style={{ margin: 0, fontSize: 14, color: '#888', fontWeight: 600 }}>{business?.category || 'Restaurante y Café'}</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: "flex", gap: 8, marginBottom: 16 }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0 }}
            style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 8px", textAlign: "center", background: '#fff' }}
          >
            <p style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0 }}>{txCount}</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#AAA", letterSpacing: "0.5px", margin: "4px 0" }}>TRANSACCIONES</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
            style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 8px", textAlign: "center", background: '#fff' }}
          >
            <p style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0 }}>{clientCount}</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#AAA", letterSpacing: "0.5px", margin: "4px 0" }}>CLIENTES</p>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
            style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 8px", textAlign: "center", background: '#fff' }}
          >
            <p style={{ fontSize: 20, fontWeight: 800, color: "#111", letterSpacing: "-0.5px", margin: 0 }}>{totalBunz.toLocaleString()}</p>
            <p style={{ fontSize: 9, fontWeight: 700, color: "#AAA", letterSpacing: "0.5px", margin: "4px 0" }}>BUNZ DADOS</p>
          </motion.div>
        </motion.div>

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
            <span style={{ fontSize: 11, color: "#CCC" }}>2% Mínimo</span>
            <span style={{ fontSize: 11, color: "#CCC" }}>50% Máximo</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16, background: '#fff' }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <Inbox size={20} color="#E91E63" />
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#111' }}>Reservaciones Stock</h3>
            {reservations.filter(r => r.status === 'PENDING').length > 0 && (
              <span style={{ background: '#E91E63', color: '#fff', fontSize: 10, fontWeight: 900, padding: '2px 6px', borderRadius: 10 }}>
                {reservations.filter(r => r.status === 'PENDING').length}
              </span>
            )}
          </div>

          {loadingRes ? (
            <p style={{ fontSize: 13, color: '#888' }}>Cargando...</p>
          ) : reservations.length === 0 ? (
            <p style={{ fontSize: 13, color: '#888', margin: 0 }}>No tienes reservaciones pendientes.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reservations.map(res => (
                <div key={res.id} style={{ border: '1px solid #F0F0F0', borderRadius: 12, padding: 12, background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 800, color: '#111', margin: '0 0 4px 0' }}>{res.title}</p>
                      <p style={{ fontSize: 12, color: '#666', margin: 0 }}>👤 Cliente: {res.user?.firstName || 'Usuario'}</p>
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 900, color: '#E91E63' }}>{res.bunzCost} B</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ 
                      fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6,
                      background: res.status === 'PENDING' ? '#FFF3E0' : res.status === 'CONFIRMED' ? '#E8F5E9' : '#FFEBEE',
                      color: res.status === 'PENDING' ? '#F57C00' : res.status === 'CONFIRMED' ? '#4CAF50' : '#F44336'
                    }}>
                      {res.status}
                    </span>
                    
                    {res.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleReservationStatus(res.id, 'REJECTED')} style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', border: '1px solid #F0F0F0', color: '#F44336', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <X size={16} />
                        </button>
                        <button onClick={() => handleReservationStatus(res.id, 'CONFIRMED')} style={{ width: 32, height: 32, borderRadius: '50%', background: '#4CAF50', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                          <Check size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

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
