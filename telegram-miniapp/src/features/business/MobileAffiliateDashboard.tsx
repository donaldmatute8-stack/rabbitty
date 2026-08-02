import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Inbox, Check, X } from 'lucide-react';
import RabbittyCode from '@/components/ui/RabbittyCode';

interface MobileAffiliateDashboardProps {
  business: any;
  telegramId?: string;
}

export default function MobileAffiliateDashboard({ business, telegramId }: MobileAffiliateDashboardProps) {
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'clients' | 'settings' | null>(null);
  const [rewardRate, setRewardRate] = useState(business?.rewardPercentage || 21);
  const [savingRate, setSavingRate] = useState(false);
  const [reservations, setReservations] = useState<any[]>([]);
  const [loadingRes, setLoadingRes] = useState(true);
  const [txCount, setTxCount] = useState(0);
  const [totalBunz, setTotalBunz] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [clientList, setClientList] = useState<any[]>([]);

  const saveRewardRate = async () => {
    if (!telegramId) return;
    setSavingRate(true);
    try {
      await fetch('/api/business', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, rewardPercentage: rewardRate }),
      });
    } catch {}
    setSavingRate(false);
  };

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

  if (business?.status === 'PENDING_VERIFICATION' || business?.status === 'PENDING') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 32px', paddingTop: 'calc(max(env(safe-area-inset-top), 64px) + 32px)', textAlign: 'center' }}>
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
    <div style={{ paddingBottom: 120, paddingTop: 'calc(max(env(safe-area-inset-top), 84px) + 12px)' }}>
      <div style={{ padding: '8px 20px 16px' }}>
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
          <div 
            onClick={() => setShowCodeModal(true)}
            style={{ backgroundColor: "#180B28", border: '1px solid rgba(233,30,99,0.3)', borderRadius: 12, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <RabbittyCode data={`business_${business?.id}`} size={38} showCardFrame={false} />
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          style={{ border: "1px solid #F0F0F0", borderRadius: 18, padding: "16px 20px", marginBottom: 16, background: '#fff' }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2, marginTop: 0 }}>
                {business?.package ? `${business.package}` : 'Crédito de Minting'}
              </p>
              <p style={{ fontSize: 13, color: "#AAA", margin: 0 }}>
                {(business?.creditLimit || 0) > 0 
                  ? `${((business.creditLimit - business.creditUsed) || 0).toLocaleString()} Bunz disponibles`
                  : 'Sin límite configurado'}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#E91E63", margin: 0 }}>
                {(business?.creditLimit || 0) > 0 
                  ? `${((business.creditLimit - business.creditUsed) || 0).toLocaleString()} B`
                  : '∞'}
              </p>
              {(business?.creditLimit || 0) > 0 && (
                <p style={{ fontSize: 10, color: "#AAA", margin: 0 }}>de {business.creditLimit.toLocaleString()} B</p>
              )}
            </div>
          </div>
          {(business?.creditLimit || 0) > 0 && (
            <>
              <div style={{ height: 6, backgroundColor: "#F0F0F0", borderRadius: 100, overflow: "hidden" }}>
                <motion.div 
                  initial={{ width: 0 }} animate={{ width: `${Math.min(100, ((business.creditUsed || 0) / business.creditLimit) * 100)}%` }} transition={{ duration: 1, delay: 0.3 }}
                  style={{ height: "100%", backgroundColor: "#E91E63", borderRadius: 100 }} 
                />
              </div>
              <p style={{ fontSize: 11, color: "#AAA", marginTop: 6, marginBottom: 0 }}>
                {Math.round((business.creditUsed / business.creditLimit) * 100)}% usado
              </p>
            </>
          )}
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
            type="range" min="2" max="50" value={rewardRate} onChange={(e) => setRewardRate(Number(e.target.value))}
            style={{
              width: '100%', marginTop: 16, appearance: 'none', background: '#F0F0F0', height: 2, borderRadius: 1, outline: 'none'
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#CCC" }}>2% Mínimo</span>
            <span style={{ fontSize: 11, color: "#CCC" }}>50% Máximo</span>
          </div>
          <button
            onClick={saveRewardRate}
            disabled={savingRate}
            style={{
              marginTop: 12, width: '100%', padding: '10px', borderRadius: 10,
              backgroundColor: savingRate ? '#CCC' : '#E91E63', color: '#fff',
              border: 'none', fontWeight: 700, cursor: savingRate ? 'default' : 'pointer', fontSize: 13
            }}
          >
            {savingRate ? 'Guardando...' : 'Guardar tasa'}
          </button>
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
          <button 
            onClick={() => setActiveSubTab(activeSubTab === 'analytics' ? null : 'analytics')}
            style={{ 
              flex: 1, border: activeSubTab === 'analytics' ? '1px solid #E91E63' : "1px solid #F0F0F0", borderRadius: 14, padding: "14px 8px", 
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, 
              background: activeSubTab === 'analytics' ? '#FFF5F8' : "#fff", cursor: "pointer", outline: 'none'
            }}
          >
            <span style={{ fontSize: 22 }}>📊</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: activeSubTab === 'analytics' ? '#E91E63' : "#666" }}>Analíticas</span>
          </button>

          <button 
            onClick={() => setActiveSubTab(activeSubTab === 'clients' ? null : 'clients')}
            style={{ 
              flex: 1, border: activeSubTab === 'clients' ? '1px solid #E91E63' : "1px solid #F0F0F0", borderRadius: 14, padding: "14px 8px", 
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, 
              background: activeSubTab === 'clients' ? '#FFF5F8' : "#fff", cursor: "pointer", outline: 'none'
            }}
          >
            <span style={{ fontSize: 22 }}>👥</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: activeSubTab === 'clients' ? '#E91E63' : "#666" }}>Clientes</span>
          </button>

          <button 
            onClick={() => setActiveSubTab(activeSubTab === 'settings' ? null : 'settings')}
            style={{ 
              flex: 1, border: activeSubTab === 'settings' ? '1px solid #E91E63' : "1px solid #F0F0F0", borderRadius: 14, padding: "14px 8px", 
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6, 
              background: activeSubTab === 'settings' ? '#FFF5F8' : "#fff", cursor: "pointer", outline: 'none'
            }}
          >
            <span style={{ fontSize: 22 }}>⚙️</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: activeSubTab === 'settings' ? '#E91E63' : "#666" }}>Ajustes</span>
          </button>
        </motion.div>

        {/* SUBTAB: ANALYTICS */}
        {activeSubTab === 'analytics' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-[#FAFAFA] border border-[#EAEAEA] rounded-2xl p-4 mb-4">
            <h4 className="text-sm font-extrabold text-[#111] mb-2 m-0">📊 Analíticas del Negocio</h4>
            <div className="flex flex-col gap-2 text-xs text-[#555]">
              <div className="flex justify-between bg-white p-2.5 rounded-xl border border-[#F0F0F0]">
                <span>Promedio por consumo:</span>
                <span className="font-bold text-[#111]">${txCount > 0 ? (totalBunz / txCount * 10).toFixed(0) : 0} MXN</span>
              </div>
              <div className="flex justify-between bg-white p-2.5 rounded-xl border border-[#F0F0F0]">
                <span>Tasa de retorno de clientes:</span>
                <span className="font-bold text-[#111]">{clientCount > 0 ? (txCount / clientCount).toFixed(1) : 0}x visitas/cliente</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* SUBTAB: CLIENTS */}
        {activeSubTab === 'clients' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-[#FAFAFA] border border-[#EAEAEA] rounded-2xl p-4 mb-4">
            <h4 className="text-sm font-extrabold text-[#111] mb-2 m-0">👥 Clientes Frecuentes ({clientCount})</h4>
            {clientList.length === 0 ? (
              <p className="text-xs text-[#888] m-0">Aún no hay registros de clientes.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {clientList.map((c, i) => (
                  <div key={i} className="flex justify-between items-center bg-white p-2.5 rounded-xl border border-[#F0F0F0] text-xs">
                    <div>
                      <p className="font-bold text-[#111] m-0">{c.user?.firstName || 'Rabbitter'} (@{c.user?.username || 'user'})</p>
                      <p className="text-[10px] text-[#AAA] m-0">{c.txs} visita(s)</p>
                    </div>
                    <span className="font-extrabold text-[#E91E63]">{c.bunz} Bunz</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* SUBTAB: SETTINGS */}
        {activeSubTab === 'settings' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-[#FAFAFA] border border-[#EAEAEA] rounded-2xl p-4 mb-4">
            <h4 className="text-sm font-extrabold text-[#111] mb-2 m-0">⚙️ Ajustes del Comercio</h4>
            <div className="flex flex-col gap-2 text-xs">
              <div className="bg-white p-3 rounded-xl border border-[#F0F0F0]">
                <p className="font-bold text-[#111] m-0 mb-1">Horario Happy Hour</p>
                <p className="text-[#666] m-0">{business?.startTime || '00:00'} - {business?.endTime || '23:59'}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-[#F0F0F0]">
                <p className="font-bold text-[#111] m-0 mb-1">Dirección Registrada</p>
                <p className="text-[#666] m-0">{business?.address}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal Rabbitty Code Ampliado para Escaneo */}
      {showCodeModal && (
        <div 
          onClick={() => setShowCodeModal(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <RabbittyCode data={`business_${business?.id}`} size={240} showCardFrame={true} />
            <p className="text-white/80 font-bold text-sm mt-6 bg-white/10 backdrop-blur-md px-6 py-2 rounded-full border border-white/10">
              Escanea para registrar consumo
            </p>
            <p className="text-white/40 text-xs mt-2">Toca en cualquier lugar para cerrar</p>
          </div>
        </div>
      )}
    </div>
  );
}
