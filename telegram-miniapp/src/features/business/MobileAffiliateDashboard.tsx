import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { QrCode, Inbox, Check, X, ArrowLeft } from 'lucide-react';
import RabbittyCode from '@/components/ui/RabbittyCode';
import { PlatformBridge } from '@/lib/platform';

interface BusinessProfile {
  id?: string;
  name?: string;
  category?: string;
  ownerId?: string;
  status?: string;
  rewardPercentage?: number;
  creditLimit?: number;
  creditUsed?: number;
  package?: string;
  startTime?: string;
  endTime?: string;
  address?: string;
}

interface ReservationItem {
  id: string;
  title?: string;
  status: string;
  bunzCost?: number;
  user?: {
    firstName?: string;
  };
}

interface TransactionItem {
  userId?: string;
  bunzMinted?: number;
}

interface MobileAffiliateDashboardProps {
  business: BusinessProfile;
  telegramId?: string;
}

export default function MobileAffiliateDashboard({ business }: MobileAffiliateDashboardProps) {
  const router = useRouter();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'clients' | 'settings' | null>(null);
  const [rewardRate, setRewardRate] = useState(business?.rewardPercentage || 21);
  const [savingRate, setSavingRate] = useState(false);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loadingRes, setLoadingRes] = useState(true);
  const [txCount, setTxCount] = useState(0);
  const [totalBunz, setTotalBunz] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [clientList] = useState<Array<{ user?: { firstName?: string; username?: string }; txs?: number; bunz?: number }>>([]);

  const saveRewardRate = async () => {
    setSavingRate(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      await fetch('/api/business', {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rewardPercentage: rewardRate }),
      });
      PlatformBridge.hapticFeedback('success');
    } catch {}
    setSavingRate(false);
  };

  useEffect(() => {
    if (business?.ownerId) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/reservations`, { headers }))
        .then(res => res.json())
        .then(data => {
          if (data.success) setReservations((data.reservations as ReservationItem[]) || []);
        })
        .finally(() => setLoadingRes(false));
    }
  }, [business?.ownerId]);

  useEffect(() => {
    if (business?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/business/transactions?businessId=${business.id}`, { headers }))
        .then(r => r.json())
        .then((data: { success?: boolean; transactions?: TransactionItem[] }) => {
          if (data.success && data.transactions) {
            setTxCount(data.transactions.length);
            const uniqueClients = new Set(data.transactions.map((t) => t.userId));
            setClientCount(uniqueClients.size);
            const total = data.transactions.reduce((sum: number, t) => sum + (t.bunzMinted || 0), 0);
            setTotalBunz(total);
          }
        })
        .catch(() => {});
    }
  }, [business?.id]);

  const handleReservationStatus = async (id: string, status: string) => {
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/reservations/${id}`, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        setReservations(prev => prev.map(r => r.id === id ? { ...r, status } : r));
        PlatformBridge.hapticFeedback('light');
      } else {
        alert(data.error || 'Error al actualizar reserva');
      }
    } catch {
      alert('Error de conexión');
    }
  };

  if (business?.status === 'PENDING_VERIFICATION' || business?.status === 'PENDING') {
    return (
      <div 
        className="min-h-screen flex flex-col items-center justify-center p-8 text-center"
        style={{ 
          background: 'var(--bg-primary)', 
          color: 'var(--text-primary)',
          paddingTop: 'calc(max(var(--safe-top, 0px), 64px) + 32px)' 
        }}
      >
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            router.back();
          }}
          aria-label="Volver"
          className="absolute top-4 left-4 w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
        >
          <ArrowLeft size={18} />
        </button>

        <div className="w-20 h-20 bg-amber-500/15 text-amber-500 rounded-full flex items-center justify-center mb-6 border border-amber-500/30">
          <span className="text-3xl">⏱️</span>
        </div>
        <h2 className="text-2xl font-black mb-3">Negocio en Revisión</h2>
        <p className="text-sm text-(--text-secondary) leading-relaxed max-w-sm mb-8">
          Estamos verificando la información de <strong>{business.name}</strong> para proteger la red. Este proceso toma entre 2 y 24 horas.
        </p>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: 'var(--bg-primary)', 
        color: 'var(--text-primary)',
        paddingBottom: 120 
      }}
    >
      {/* Top Header estilo burbuja con Volver y Pill central */}
      <div 
        className="sticky top-0 z-40 flex items-center justify-between px-4"
        style={{
          height: 'calc(56px + var(--safe-top, 0px))',
          paddingTop: 'var(--safe-top, 0px)',
          background: 'color-mix(in srgb, var(--bg-primary) 85%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {/* Back Button */}
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            router.back();
          }}
          aria-label="Volver"
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-none shrink-0"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <svg width="10" height="18" viewBox="0 0 10 18" fill="none">
            <path d="M9 1L1 9L9 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Central Pill with Business Name and Category */}
        <div 
          className="flex items-center gap-2 px-3 py-1.5 rounded-full max-w-55"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span className="text-xs">🏪</span>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] font-black leading-tight truncate text-(--text-primary)">
              {business?.name || 'Comercio Afiliado'}
            </span>
            <span className="text-[9px] font-semibold text-(--text-muted) truncate">
              {business?.category || 'Afiliado'}
            </span>
          </div>
        </div>

        {/* Right QR trigger */}
        <button
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            setShowCodeModal(true);
          }}
          aria-label="Código QR"
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-90 transition-transform cursor-pointer border-none shrink-0"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: '#E91E63',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <QrCode size={18} />
        </button>
      </div>

      <div className="px-4 pt-4 max-w-xl mx-auto">
        {/* Metric Cards */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-3 gap-2 mb-4"
        >
          <div 
            className="rounded-2xl p-3 text-center transition-all"
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p className="text-xl font-black text-(--text-primary) tracking-tight m-0">{txCount}</p>
            <p className="text-[9px] font-black text-(--text-muted) tracking-wider uppercase mt-1 mb-0">Transacciones</p>
          </div>
          <div 
            className="rounded-2xl p-3 text-center transition-all"
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p className="text-xl font-black text-(--text-primary) tracking-tight m-0">{clientCount}</p>
            <p className="text-[9px] font-black text-(--text-muted) tracking-wider uppercase mt-1 mb-0">Clientes</p>
          </div>
          <div 
            className="rounded-2xl p-3 text-center transition-all"
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p className="text-xl font-black text-[#E91E63] tracking-tight m-0">{totalBunz.toLocaleString()}</p>
            <p className="text-[9px] font-black text-(--text-muted) tracking-wider uppercase mt-1 mb-0">Bunz Dados</p>
          </div>
        </motion.div>

        {/* QR Code Quick Action Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="rounded-2xl p-4 mb-4 flex items-center justify-between"
          style={{ 
            background: 'linear-gradient(135deg, #1A0D26 0%, #0D0D1A 100%)',
            border: '1px solid rgba(233, 30, 99, 0.25)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/20 border border-pink-500/30 flex items-center justify-center shrink-0">
              <QrCode size={20} className="text-[#E91E63]" />
            </div>
            <div>
              <p className="text-sm font-bold text-white m-0 leading-snug">Generar código QR</p>
              <p className="text-xs text-white/60 m-0">Para registrar consumos en caja</p>
            </div>
          </div>
          <div 
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setShowCodeModal(true);
            }}
            className="rounded-xl p-1.5 flex items-center justify-center cursor-pointer active:scale-95 transition-transform"
            style={{ backgroundColor: '#180B28', border: '1px solid rgba(233,30,99,0.3)' }}
          >
            <RabbittyCode data={`business_${business?.id}`} size={38} showCardFrame={false} />
          </div>
        </motion.div>

        {/* Minting Credit Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl p-4 mb-4"
          style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-[14px] font-bold text-(--text-primary) m-0 mb-0.5">
                {business?.package ? `${business.package}` : 'Crédito de Minting'}
              </p>
              <p className="text-[12px] text-(--text-muted) m-0">
                {(business?.creditLimit || 0) > 0 
                  ? `${(((business?.creditLimit || 0) - (business?.creditUsed || 0)) || 0).toLocaleString()} Bunz disponibles`
                  : 'Sin límite configurado'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-[#E91E63] m-0">
                {(business?.creditLimit || 0) > 0 
                  ? `${(((business?.creditLimit || 0) - (business?.creditUsed || 0)) || 0).toLocaleString()} B`
                  : '∞'}
              </p>
              {(business?.creditLimit || 0) > 0 && (
                <p className="text-[10px] text-(--text-muted) m-0">de {business?.creditLimit?.toLocaleString()} B</p>
              )}
            </div>
          </div>
          {(business?.creditLimit || 0) > 0 && (
            <>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
                <motion.div 
                  initial={{ width: 0 }} 
                  animate={{ width: `${Math.min(100, (((business.creditUsed || 0)) / (business.creditLimit || 1)) * 100)}%` }} 
                  transition={{ duration: 1, delay: 0.3 }}
                  className="h-full rounded-full bg-[#E91E63]"
                />
              </div>
              <p className="text-[11px] text-(--text-muted) mt-1.5 mb-0">
                {Math.round(((business.creditUsed || 0) / (business.creditLimit || 1)) * 100)}% usado
              </p>
            </>
          )}
        </motion.div>

        {/* Reward Rate Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl p-4 mb-4"
          style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div className="flex justify-between items-center mb-2">
            <div>
              <p className="text-[14px] font-bold text-(--text-primary) m-0 mb-0.5">Tasa de recompensa</p>
              <p className="text-[12px] text-(--text-muted) m-0">Otorga {rewardRate}% en bunz por consumo</p>
            </div>
            <p className="text-2xl font-black text-[#E91E63] m-0">{rewardRate}%</p>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-subtle)' }}>
            <motion.div 
              initial={{ width: 0 }} 
              animate={{ width: `${rewardRate}%` }} 
              transition={{ duration: 1, delay: 0.4 }}
              className="h-full rounded-full bg-[#E91E63]"
            />
          </div>
          
          <input
            type="range" 
            min="2" 
            max="50" 
            value={rewardRate} 
            onChange={(e) => setRewardRate(Number(e.target.value))}
            className="w-full mt-4 cursor-pointer accent-[#E91E63]"
          />
          <div className="flex justify-between mt-1 text-[11px] text-(--text-muted)">
            <span>2% Mínimo</span>
            <span>50% Máximo</span>
          </div>
          <button
            onClick={saveRewardRate}
            disabled={savingRate}
            className="mt-3 w-full py-2.5 rounded-xl bg-[#E91E63] text-white font-bold text-xs border-none cursor-pointer active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {savingRate ? 'Guardando...' : 'Guardar tasa'}
          </button>
        </motion.div>

        {/* Stock Reservations */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
          className="rounded-2xl p-4 mb-4"
          style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)'
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Inbox size={18} className="text-[#E91E63]" />
            <h3 className="text-sm font-black m-0 text-(--text-primary)">Reservaciones Stock</h3>
            {reservations.filter(r => r.status === 'PENDING').length > 0 && (
              <span className="bg-[#E91E63] text-white text-[10px] font-black px-2 py-0.5 rounded-full">
                {reservations.filter(r => r.status === 'PENDING').length}
              </span>
            )}
          </div>

          {loadingRes ? (
            <p className="text-xs text-(--text-muted)">Cargando...</p>
          ) : reservations.length === 0 ? (
            <p className="text-xs text-(--text-muted) m-0">No tienes reservaciones pendientes.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {reservations.map(res => (
                <div 
                  key={res.id} 
                  className="rounded-xl p-3"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="text-[13px] font-bold text-(--text-primary) m-0 mb-0.5">{res.title}</p>
                      <p className="text-[11px] text-(--text-muted) m-0">👤 Cliente: {res.user?.firstName || 'Usuario'}</p>
                    </div>
                    <span className="text-sm font-black text-[#E91E63]">{res.bunzCost} B</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      res.status === 'PENDING' ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' :
                      res.status === 'CONFIRMED' ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30' :
                      'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                    }`}>
                      {res.status}
                    </span>
                    
                    {res.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleReservationStatus(res.id, 'REJECTED')} 
                          aria-label="Rechazar"
                          className="w-8 h-8 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/30 flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                        >
                          <X size={15} />
                        </button>
                        <button 
                          onClick={() => handleReservationStatus(res.id, 'CONFIRMED')} 
                          aria-label="Confirmar"
                          className="w-8 h-8 rounded-full bg-emerald-500 text-white border-none flex items-center justify-center cursor-pointer active:scale-90 transition-transform"
                        >
                          <Check size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Tab Selection */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="grid grid-cols-3 gap-2 mb-4"
        >
          <button 
            onClick={() => setActiveSubTab(activeSubTab === 'analytics' ? null : 'analytics')}
            className="rounded-2xl p-3 flex flex-col items-center gap-1 cursor-pointer transition-all border-none"
            style={{ 
              background: activeSubTab === 'analytics' ? 'rgba(233,30,99,0.15)' : 'var(--bg-elevated)', 
              border: activeSubTab === 'analytics' ? '1px solid #E91E63' : '1px solid var(--border-subtle)',
              color: activeSubTab === 'analytics' ? '#E91E63' : 'var(--text-secondary)'
            }}
          >
            <span className="text-xl">📊</span>
            <span className="text-[12px] font-bold">Analíticas</span>
          </button>

          <button 
            onClick={() => setActiveSubTab(activeSubTab === 'clients' ? null : 'clients')}
            className="rounded-2xl p-3 flex flex-col items-center gap-1 cursor-pointer transition-all border-none"
            style={{ 
              background: activeSubTab === 'clients' ? 'rgba(233,30,99,0.15)' : 'var(--bg-elevated)', 
              border: activeSubTab === 'clients' ? '1px solid #E91E63' : '1px solid var(--border-subtle)',
              color: activeSubTab === 'clients' ? '#E91E63' : 'var(--text-secondary)'
            }}
          >
            <span className="text-xl">👥</span>
            <span className="text-[12px] font-bold">Clientes</span>
          </button>

          <button 
            onClick={() => setActiveSubTab(activeSubTab === 'settings' ? null : 'settings')}
            className="rounded-2xl p-3 flex flex-col items-center gap-1 cursor-pointer transition-all border-none"
            style={{ 
              background: activeSubTab === 'settings' ? 'rgba(233,30,99,0.15)' : 'var(--bg-elevated)', 
              border: activeSubTab === 'settings' ? '1px solid #E91E63' : '1px solid var(--border-subtle)',
              color: activeSubTab === 'settings' ? '#E91E63' : 'var(--text-secondary)'
            }}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-[12px] font-bold">Ajustes</span>
          </button>
        </motion.div>

        {/* SUBTAB: ANALYTICS */}
        {activeSubTab === 'analytics' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <h4 className="text-sm font-extrabold text-(--text-primary) mb-3 m-0">📊 Analíticas del Negocio</h4>
            <div className="flex flex-col gap-2 text-xs text-(--text-secondary)">
              <div className="flex justify-between p-2.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
                <span>Promedio por consumo:</span>
                <span className="font-bold text-(--text-primary)">${txCount > 0 ? (totalBunz / txCount * 10).toFixed(0) : 0} MXN</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
                <span>Tasa de retorno de clientes:</span>
                <span className="font-bold text-(--text-primary)">{clientCount > 0 ? (txCount / clientCount).toFixed(1) : 0}x visitas/cliente</span>
              </div>
            </div>
          </motion.div>
        )}

        {/* SUBTAB: CLIENTS */}
        {activeSubTab === 'clients' && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <h4 className="text-sm font-extrabold text-(--text-primary) mb-3 m-0">👥 Clientes Frecuentes ({clientCount})</h4>
            {clientList.length === 0 ? (
              <p className="text-xs text-(--text-muted) m-0">Aún no hay registros de clientes.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {clientList.map((c, i) => (
                  <div key={i} className="flex justify-between items-center p-2.5 rounded-xl text-xs" style={{ background: 'var(--bg-subtle)' }}>
                    <div>
                      <p className="font-bold text-(--text-primary) m-0">{c.user?.firstName || 'Rabbitter'} (@{c.user?.username || 'user'})</p>
                      <p className="text-[10px] text-(--text-muted) m-0">{c.txs} visita(s)</p>
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
          <motion.div 
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} 
            className="rounded-2xl p-4 mb-4"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <h4 className="text-sm font-extrabold text-(--text-primary) mb-3 m-0">⚙️ Ajustes del Comercio</h4>
            <div className="flex flex-col gap-2 text-xs">
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
                <p className="font-bold text-(--text-primary) m-0 mb-1">Horario Happy Hour</p>
                <p className="text-(--text-muted) m-0">{business?.startTime || '00:00'} - {business?.endTime || '23:59'}</p>
              </div>
              <div className="p-3 rounded-xl" style={{ background: 'var(--bg-subtle)' }}>
                <p className="font-bold text-(--text-primary) m-0 mb-1">Dirección Registrada</p>
                <p className="text-(--text-muted) m-0">{business?.address || 'Sin dirección registrada'}</p>
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
