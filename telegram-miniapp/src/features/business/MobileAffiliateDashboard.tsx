import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Inbox, Check, X, ArrowLeft, BookOpen, AlertTriangle, BarChart3, Users, Settings2, Zap } from 'lucide-react';
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
  logoUrl?: string | null;
  hops?: number;
  savedCount?: number;
  sharedCount?: number;
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

interface LedgerStatementRow {
  id: string;
  direction: 'INFLOW' | 'OUTFLOW';
  type: string;
  amount: number;
  counterparty: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

interface LedgerAuditData {
  business: {
    id: string;
    name: string;
    package: string | null;
    creditLimit: number;
    creditUsed: number;
    remainingInventory: number | null;
    isLowInventory: boolean;
  };
  audit: {
    totalRewarded: number;
    countRewarded: number;
    totalRedeemed: number;
    countRedeemed: number;
    netFlow: number;
  };
  statement: LedgerStatementRow[];
}

interface MobileAffiliateDashboardProps {
  business: BusinessProfile;
  telegramId?: string;
}

export default function MobileAffiliateDashboard({ business }: MobileAffiliateDashboardProps) {
  const router = useRouter();
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'analytics' | 'clients' | 'settings' | 'ledger' | 'campaigns' | null>(null);
  const [rewardRate, setRewardRate] = useState(business?.rewardPercentage || 21);
  const [savingRate, setSavingRate] = useState(false);
  const [reservations, setReservations] = useState<ReservationItem[]>([]);
  const [loadingRes, setLoadingRes] = useState(true);
  const [txCount, setTxCount] = useState(0);
  const [totalBunz, setTotalBunz] = useState(0);
  const [clientCount, setClientCount] = useState(0);
  const [clientList] = useState<Array<{ user?: { firstName?: string; username?: string }; txs?: number; bunz?: number }>>([]);
  const [growthSignals, setGrowthSignals] = useState<Array<{ id: string; type: string; headline: string; explanation: string; targetCount: number; suggestedAction: { rewardPercentage: number; maxBudgetBunz: number; validityHours: number } }>>([]);
  const [affiliateCampaigns, setAffiliateCampaigns] = useState<Array<{ id: string; title: string; status: string; budgetSpent: number; budgetBunz: number; redemptionCount: number; message: string }>>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  
  // Paso C: Ledger audit state
  const [ledgerData, setLedgerData] = useState<LedgerAuditData | null>(null);
  const [loadingLedger, setLoadingLedger] = useState(false);

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

      // Fetch Growth Signals & Campaigns
      PlatformBridge.getAuthHeaders().then(headers => {
        setLoadingCampaigns(true);
        Promise.all([
          fetch(`/api/business/growth-signals?businessId=${business.id}`, { headers }).then(r => r.json()),
          fetch(`/api/business/campaigns?businessId=${business.id}`, { headers }).then(r => r.json()),
        ]).then(([signalsData, campaignsData]) => {
          if (signalsData?.success && signalsData.opportunities) {
            setGrowthSignals(signalsData.opportunities);
          }
          if (campaignsData?.success && campaignsData.campaigns) {
            setAffiliateCampaigns(campaignsData.campaigns);
          }
        }).catch(() => {}).finally(() => setLoadingCampaigns(false));
      });
    }
  }, [business?.id]);

  useEffect(() => {
    let active = true;
    if (!business?.id) return;

    Promise.resolve().then(() => {
      if (active) setLoadingLedger(true);
      return PlatformBridge.getAuthHeaders();
    })
      .then((headers) => fetch(`/api/business/ledger?businessId=${business.id}`, { headers }))
      .then((r) => r.json())
      .then((data) => {
        if (!active) return;
        if (data.success) {
          setLedgerData(data as LedgerAuditData);
        }
      })
      .catch((err) => {
        console.error('[Affiliate Ledger] Fetch error:', err);
      })
      .finally(() => {
        if (active) setLoadingLedger(false);
      });

    return () => {
      active = false;
    };
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
          className="grid grid-cols-4 gap-2 mb-4"
        >
          <div 
            className="rounded-2xl p-2.5 text-center transition-all"
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p className="text-lg font-black text-(--text-primary) tracking-tight m-0">{txCount}</p>
            <p className="text-[8px] font-black text-(--text-muted) tracking-wider uppercase mt-1 mb-0">Tickets</p>
          </div>
          <div 
            className="rounded-2xl p-2.5 text-center transition-all"
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p className="text-lg font-black text-(--text-primary) tracking-tight m-0">{clientCount}</p>
            <p className="text-[8px] font-black text-(--text-muted) tracking-wider uppercase mt-1 mb-0">Clientes</p>
          </div>
          <div 
            className="rounded-2xl p-2.5 text-center transition-all"
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p className="text-lg font-black text-amber-400 tracking-tight m-0">{business?.hops || 0}</p>
            <p className="text-[8px] font-black text-(--text-muted) tracking-wider uppercase mt-1 mb-0">Hops 🐾</p>
          </div>
          <div 
            className="rounded-2xl p-2.5 text-center transition-all"
            style={{ 
              background: 'var(--bg-elevated)', 
              border: '1px solid var(--border-subtle)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <p className="text-lg font-black text-[#E91E63] tracking-tight m-0">{totalBunz.toLocaleString()}</p>
            <p className="text-[8px] font-black text-(--text-muted) tracking-wider uppercase mt-1 mb-0">Bunz Dados</p>
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

        {/* Action: Growth Engine & Campañas Flash */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}
          className="rounded-2xl p-4 mb-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          style={{
            background: 'linear-gradient(135deg, rgba(233,30,99,0.12) 0%, rgba(255,138,0,0.12) 100%)',
            border: '1.5px solid rgba(233,30,99,0.3)',
            boxShadow: 'var(--shadow-sm)',
          }}
          onClick={() => {
            PlatformBridge.hapticFeedback('medium');
            setActiveSubTab('campaigns');
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-[#E91E63] to-[#FF8A00] text-white flex items-center justify-center shrink-0 text-lg shadow-sm">
              ⚡
            </div>
            <div>
              <p className="text-sm font-extrabold text-(--text-primary) m-0 leading-snug">Motor de Crecimiento & Campañas</p>
              <p className="text-xs text-(--text-muted) m-0">
                {growthSignals.length > 0 ? `${growthSignals.length} oportunidades detectadas por Bunzy` : 'Campañas flash y recuperación de clientes'}
              </p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-[#E91E63] text-white text-xs font-bold shrink-0 shadow-sm">
            Ver
          </div>
        </motion.div>

        {/* Action: Kit de Impresión Físico Dinámico */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
          className="rounded-2xl p-4 mb-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-sm)',
          }}
          onClick={() => {
            PlatformBridge.hapticFeedback('medium');
            const encodedName = encodeURIComponent(business.name || 'Mi Negocio');
            const encodedRef = encodeURIComponent(business.id?.replace(/-/g, '').slice(0, 8) || 'afiliado');
            const encodedLogo = encodeURIComponent(business.logoUrl || '');
            const encodedNiche = encodeURIComponent(business.category || '');
            const bunzValue = encodeURIComponent(String(business.rewardPercentage || 25));
            const printKitUrl = `https://rabbitty.me/impresos?name=${encodedName}&ref=${encodedRef}&bunz=${bunzValue}&logo=${encodedLogo}&niche=${encodedNiche}`;
            window.open(printKitUrl, '_blank');
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center shrink-0 text-lg">
              🖨️
            </div>
            <div>
              <p className="text-sm font-extrabold text-(--text-primary) m-0 leading-snug">Kit de Impresos del Local</p>
              <p className="text-xs text-(--text-muted) m-0">Cartel A3, habladores de mesa y caja listos en PDF</p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-pink-500/15 border border-pink-500/30 text-[#E91E63] text-xs font-bold shrink-0">
            Exportar
          </div>
        </motion.div>

        {/* Action: Reporte Oficial de Cuadre de Caja & PDF */}
        <motion.div
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}
          className="rounded-2xl p-4 mb-4 flex items-center justify-between cursor-pointer active:scale-[0.99] transition-transform"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(59, 130, 246, 0.12) 100%)',
            border: '1.5px solid rgba(16, 185, 129, 0.3)',
            boxShadow: 'var(--shadow-sm)',
          }}
          onClick={() => {
            PlatformBridge.hapticFeedback('medium');
            router.push(`/business/reports${business?.id ? `?businessId=${business.id}` : ''}`);
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-linear-to-br from-emerald-500 to-cyan-500 text-white flex items-center justify-center shrink-0 text-lg shadow-sm">
              📊
            </div>
            <div>
              <p className="text-sm font-extrabold text-(--text-primary) m-0 leading-snug">Cuadre de Caja & Auditoría</p>
              <p className="text-xs text-(--text-muted) m-0">Reporte oficial con desglose de ventas, IVA y PDF</p>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-bold shrink-0">
            Ver PDF
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

        {/* Low Inventory Alert Banner */}
        {ledgerData?.business?.isLowInventory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-3.5 mb-4 flex items-center gap-3 border border-amber-500/30 bg-amber-500/10 text-amber-200"
          >
            <AlertTriangle className="text-amber-400 shrink-0" size={22} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-amber-300 m-0 leading-tight">Inventario de Bunz Bajo</p>
              <p className="text-[11px] text-amber-200/80 m-0 mt-0.5">
                Te quedan {ledgerData.business.remainingInventory?.toLocaleString()} Bunz. Recarga tu paquete para seguir otorgando recompensas.
              </p>
            </div>
            <button
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveSubTab('ledger');
              }}
              className="px-2.5 py-1 rounded-lg bg-amber-400 text-black text-[11px] font-black border-none cursor-pointer active:scale-95 transition-transform shrink-0"
            >
              Auditar
            </button>
          </motion.div>
        )}

        {/* Tab Selection con Iconos Personalizados Rabbitty */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="grid grid-cols-4 gap-1.5 mb-4"
        >
          <button 
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setActiveSubTab(activeSubTab === 'analytics' ? null : 'analytics');
            }}
            className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all border-none"
            style={{ 
              background: activeSubTab === 'analytics' ? 'rgba(233,30,99,0.18)' : 'var(--bg-elevated)', 
              border: activeSubTab === 'analytics' ? '1.5px solid #E91E63' : '1px solid var(--border-subtle)',
              color: activeSubTab === 'analytics' ? '#E91E63' : 'var(--text-secondary)'
            }}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeSubTab === 'analytics' ? 'bg-[#E91E63]/20 text-[#E91E63]' : 'bg-white/5 text-(--text-muted)'}`}>
              <BarChart3 size={18} strokeWidth={2.4} />
            </div>
            <span className="text-[11px] font-extrabold tracking-tight">Analíticas</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setActiveSubTab(activeSubTab === 'ledger' ? null : 'ledger');
            }}
            className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all border-none"
            style={{ 
              background: activeSubTab === 'ledger' ? 'rgba(233,30,99,0.18)' : 'var(--bg-elevated)', 
              border: activeSubTab === 'ledger' ? '1.5px solid #E91E63' : '1px solid var(--border-subtle)',
              color: activeSubTab === 'ledger' ? '#E91E63' : 'var(--text-secondary)'
            }}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeSubTab === 'ledger' ? 'bg-[#E91E63]/20 text-[#E91E63]' : 'bg-white/5 text-(--text-muted)'}`}>
              <BookOpen size={18} strokeWidth={2.4} />
            </div>
            <span className="text-[11px] font-extrabold tracking-tight">Libro</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setActiveSubTab(activeSubTab === 'clients' ? null : 'clients');
            }}
            className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all border-none"
            style={{ 
              background: activeSubTab === 'clients' ? 'rgba(233,30,99,0.18)' : 'var(--bg-elevated)', 
              border: activeSubTab === 'clients' ? '1.5px solid #E91E63' : '1px solid var(--border-subtle)',
              color: activeSubTab === 'clients' ? '#E91E63' : 'var(--text-secondary)'
            }}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeSubTab === 'clients' ? 'bg-[#E91E63]/20 text-[#E91E63]' : 'bg-white/5 text-(--text-muted)'}`}>
              <Users size={18} strokeWidth={2.4} />
            </div>
            <span className="text-[11px] font-extrabold tracking-tight">Clientes</span>
          </button>

          <button 
            type="button"
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setActiveSubTab(activeSubTab === 'settings' ? null : 'settings');
            }}
            className="rounded-2xl p-2.5 flex flex-col items-center gap-1.5 cursor-pointer transition-all border-none"
            style={{ 
              background: activeSubTab === 'settings' ? 'rgba(233,30,99,0.18)' : 'var(--bg-elevated)', 
              border: activeSubTab === 'settings' ? '1.5px solid #E91E63' : '1px solid var(--border-subtle)',
              color: activeSubTab === 'settings' ? '#E91E63' : 'var(--text-secondary)'
            }}
          >
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${activeSubTab === 'settings' ? 'bg-[#E91E63]/20 text-[#E91E63]' : 'bg-white/5 text-(--text-muted)'}`}>
              <Settings2 size={18} strokeWidth={2.4} />
            </div>
            <span className="text-[11px] font-extrabold tracking-tight">Ajustes</span>
          </button>
        </motion.div>
      </div>

      {/* FULL SCREEN SLIDE-UP MODAL PARA SUBTABS (Analíticas, Libro, Clientes, Ajustes) */}
      <AnimatePresence>
        {activeSubTab && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/75 backdrop-blur-md"
            onClick={() => setActiveSubTab(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-[92vh] max-h-[92vh] rounded-t-3xl flex flex-col overflow-hidden"
              style={{
                background: 'var(--bg-primary)',
                borderTop: '1px solid var(--border-subtle)',
                boxShadow: '0 -10px 40px rgba(0,0,0,0.5)',
              }}
            >
              {/* Grab handle indicator */}
              <div className="w-full flex items-center justify-center pt-3 pb-1 shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-white/20" />
              </div>

              {/* Modal Top Header */}
              <div 
                className="flex items-center justify-between px-5 py-3 shrink-0"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#E91E63]/15 text-[#E91E63] flex items-center justify-center">
                    {activeSubTab === 'campaigns' && <Zap size={18} strokeWidth={2.4} />}
                    {activeSubTab === 'analytics' && <BarChart3 size={18} strokeWidth={2.4} />}
                    {activeSubTab === 'ledger' && <BookOpen size={18} strokeWidth={2.4} />}
                    {activeSubTab === 'clients' && <Users size={18} strokeWidth={2.4} />}
                    {activeSubTab === 'settings' && <Settings2 size={18} strokeWidth={2.4} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-(--text-primary) m-0 leading-tight">
                      {activeSubTab === 'campaigns' && 'Motor Comercial y Campañas'}
                      {activeSubTab === 'analytics' && 'Métricas y Analíticas'}
                      {activeSubTab === 'ledger' && 'Libro Mayor Inmutable'}
                      {activeSubTab === 'clients' && `Clientes Frecuentes (${clientCount})`}
                      {activeSubTab === 'settings' && 'Ajustes del Comercio'}
                    </h3>
                    <p className="text-[11px] text-(--text-muted) m-0">
                      {activeSubTab === 'campaigns' && 'Growth Signals, Bunzy Co-Pilot y ROI'}
                      {activeSubTab === 'analytics' && 'Rendimiento y retorno de clientes'}
                      {activeSubTab === 'ledger' && 'Auditoría criptográfica y transacciones'}
                      {activeSubTab === 'clients' && 'Usuarios más recurrentes y puntos acumulados'}
                      {activeSubTab === 'settings' && 'Horarios y configuración de sucursal'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    PlatformBridge.hapticFeedback('light');
                    setActiveSubTab(null);
                  }}
                  aria-label="Cerrar modal"
                  className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer border-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Modal Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 pb-20">
                {/* SUBTAB: CAMPAIGNS & GROWTH SIGNALS */}
                {activeSubTab === 'campaigns' && (
                  <div className="space-y-4">
                    {/* Header Banner */}
                    <div className="p-4 rounded-2xl bg-linear-to-br from-pink-500/15 via-purple-500/10 to-amber-500/10 border border-pink-500/30">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap size={18} className="text-[#E91E63]" />
                        <h4 className="text-sm font-black text-(--text-primary) m-0">Oportunidades de Retorno & Copiloto</h4>
                      </div>
                      <p className="text-xs text-(--text-secondary) m-0 leading-relaxed">
                        Detectamos patrones de consumo y horas valle para reactivar clientes con incentivos garantizados contra consumo real.
                      </p>
                    </div>

                    {/* Opportunities Section */}
                    <div className="space-y-3">
                      <h5 className="text-[11px] font-black uppercase tracking-wider text-(--text-muted) m-0">
                        Señales Detectadas en Tu Negocio
                      </h5>
                      {loadingCampaigns ? (
                        <div className="p-6 text-center text-xs text-(--text-muted)">Analizando señales de consumo...</div>
                      ) : growthSignals.length === 0 ? (
                        <div className="p-4 rounded-2xl text-center text-xs text-(--text-muted)" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                          No hay señales críticas hoy. ¡Tus clientes están acudiendo con normalidad!
                        </div>
                      ) : (
                        growthSignals.map((sig) => (
                          <div 
                            key={sig.id}
                            className="p-4 rounded-2xl space-y-3"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-500 mb-1">
                                  {sig.type === 'OFF_PEAK_HAPPY_HOUR' ? 'Hora Valle' : 'Reactivación'}
                                </span>
                                <h4 className="text-sm font-black text-(--text-primary) m-0">{sig.headline}</h4>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="text-xs font-black text-[#E91E63]">{sig.targetCount} clientes</span>
                                <p className="text-[10px] text-(--text-muted) m-0">Audiencia k-anon</p>
                              </div>
                            </div>

                            <p className="text-xs text-(--text-secondary) m-0 leading-relaxed">
                              {sig.explanation}
                            </p>

                            <div className="p-3 rounded-xl flex items-center justify-between text-xs" style={{ background: 'var(--bg-subtle)' }}>
                              <div>
                                <p className="text-[10px] uppercase text-(--text-muted) font-bold m-0">Incentivo Sugerido</p>
                                <p className="text-xs font-black text-[#E91E63] m-0">+{sig.suggestedAction.rewardPercentage}% Cashback en Bunz</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] uppercase text-(--text-muted) font-bold m-0">Tope de Presupuesto</p>
                                <p className="text-xs font-black text-(--text-primary) m-0">{sig.suggestedAction.maxBudgetBunz} Bunz</p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                PlatformBridge.hapticFeedback('medium');
                                router.push(`/chat/bunzy?ref=opportunity_${sig.id}`);
                              }}
                              className="w-full py-2.5 rounded-xl bg-linear-to-r from-[#E91E63] to-pink-600 text-white font-black text-xs border-none cursor-pointer flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm"
                            >
                              <span>🤖</span>
                              <span>Activar con Bunzy Co-Pilot</span>
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Active Affiliate Campaigns Section */}
                    <div className="space-y-3 pt-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-[11px] font-black uppercase tracking-wider text-(--text-muted) m-0">
                          Campañas Registradas ({affiliateCampaigns.length})
                        </h5>
                      </div>

                      {affiliateCampaigns.length === 0 ? (
                        <div className="p-4 rounded-2xl text-center text-xs text-(--text-muted)" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                          Aún no has creado campañas comerciales. Pídele a Bunzy en el chat: &ldquo;Quiero crear una campaña de reactivación&rdquo;.
                        </div>
                      ) : (
                        affiliateCampaigns.map((camp) => (
                          <div 
                            key={camp.id}
                            className="p-4 rounded-2xl space-y-2.5"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                          >
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-black text-(--text-primary) m-0 truncate pr-2">{camp.title}</h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                camp.status === 'ACTIVE' 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                                  : camp.status === 'PAUSED'
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  : 'bg-white/10 text-(--text-muted)'
                              }`}>
                                {camp.status === 'ACTIVE' ? 'Activa' : camp.status === 'PAUSED' ? 'Pausada' : camp.status}
                              </span>
                            </div>

                            <p className="text-xs text-(--text-secondary) m-0 line-clamp-2">
                              {camp.message}
                            </p>

                            <div className="flex items-center justify-between text-xs pt-1 border-t border-(--border-subtle)">
                              <span className="text-(--text-muted)">
                                Consumido: <strong className="text-(--text-primary)">{camp.budgetSpent}</strong> / {camp.budgetBunz} B
                              </span>
                              <span className="text-(--text-muted)">
                                Canjes: <strong className="text-emerald-400">{camp.redemptionCount}</strong>
                              </span>
                            </div>

                            {/* Control button: Pause / Resume */}
                            {(camp.status === 'ACTIVE' || camp.status === 'PAUSED') && (
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    PlatformBridge.hapticFeedback('light');
                                    const nextAction = camp.status === 'ACTIVE' ? 'PAUSE' : 'RESUME';
                                    const headers = await PlatformBridge.getAuthHeaders();
                                    const res = await fetch('/api/business/campaigns/manage', {
                                      method: 'POST',
                                      headers: { ...headers, 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ campaignId: camp.id, action: nextAction }),
                                    });
                                    const d = await res.json();
                                    if (d.success) {
                                      setAffiliateCampaigns(prev => prev.map(c => c.id === camp.id ? { ...c, status: d.campaign.status } : c));
                                    }
                                  } catch (err) {
                                    console.error('Error toggling campaign:', err);
                                  }
                                }}
                                className="w-full mt-1 py-2 rounded-xl text-xs font-bold border border-(--border-subtle) cursor-pointer transition-colors"
                                style={{ background: 'var(--bg-subtle)', color: 'var(--text-secondary)' }}
                              >
                                {camp.status === 'ACTIVE' ? 'Pausar Campaña' : 'Reanudar Campaña'}
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* SUBTAB: ANALYTICS */}
                {activeSubTab === 'analytics' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <p className="text-[11px] font-bold text-(--text-muted) uppercase m-0">Ticket Promedio</p>
                        <p className="text-2xl font-black text-[#E91E63] m-0 mt-1">
                          ${txCount > 0 ? (totalBunz / txCount * 10).toFixed(0) : 0} <span className="text-xs font-bold text-(--text-muted)">MXN</span>
                        </p>
                        <p className="text-[10px] text-(--text-muted) m-0 mt-1">Por visita registrada</p>
                      </div>

                      <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <p className="text-[11px] font-bold text-(--text-muted) uppercase m-0">Retorno de Visita</p>
                        <p className="text-2xl font-black text-emerald-400 m-0 mt-1">
                          {clientCount > 0 ? (txCount / clientCount).toFixed(1) : 0}x
                        </p>
                        <p className="text-[10px] text-(--text-muted) m-0 mt-1">Visitas por cliente único</p>
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <h4 className="text-xs font-black uppercase text-(--text-muted) m-0 tracking-wider">Desglose de Operaciones</h4>
                      <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="text-xs text-(--text-secondary)">Total Bunz Distribuidos</span>
                        <span className="text-sm font-black text-(--text-primary)">{totalBunz.toLocaleString()} B</span>
                      </div>
                      <div className="flex justify-between items-center py-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <span className="text-xs text-(--text-secondary)">Total Escaneos y Consumos</span>
                        <span className="text-sm font-black text-(--text-primary)">{txCount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs text-(--text-secondary)">Clientes Registrados</span>
                        <span className="text-sm font-black text-(--text-primary)">{clientCount.toLocaleString()}</span>
                      </div>
                    </div>

                    {/* Telemetría y Métricas Sociales del Comercio (Hops, Madriguera, Shares) */}
                    <div className="p-4 rounded-2xl space-y-3" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase text-pink-400 m-0 tracking-wider">Descubrimiento & Tracción Social</h4>
                        <span className="text-[10px] font-mono text-zinc-400">En vivo</span>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2 pt-1">
                        <div className="p-3 rounded-xl flex flex-col items-center justify-center text-center bg-pink-500/10 border border-pink-500/20">
                          <span className="text-base mb-1">🐾</span>
                          <span className="text-lg font-black text-(--text-primary)">
                            {(business?.hops || 0).toLocaleString()}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-pink-400 mt-0.5">Hops Dados</span>
                        </div>

                        <div className="p-3 rounded-xl flex flex-col items-center justify-center text-center bg-amber-500/10 border border-amber-500/20">
                          <span className="text-base mb-1">🔖</span>
                          <span className="text-lg font-black text-(--text-primary)">
                            {(business?.savedCount || 0).toLocaleString()}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-amber-400 mt-0.5">Madrigueras</span>
                        </div>

                        <div className="p-3 rounded-xl flex flex-col items-center justify-center text-center bg-cyan-500/10 border border-cyan-500/20">
                          <span className="text-base mb-1">↗️</span>
                          <span className="text-lg font-black text-(--text-primary)">
                            {(business?.sharedCount || 0).toLocaleString()}
                          </span>
                          <span className="text-[9px] uppercase font-bold text-cyan-400 mt-0.5">Compartidos</span>
                        </div>
                      </div>
                      <p className="text-[10px] text-(--text-muted) m-0 pt-1">
                        Métricas de engagement orgánico generadas desde el feed social Rabbitty y redes de mensajería (Telegram y WhatsApp).
                      </p>
                    </div>
                  </div>
                )}

                {/* SUBTAB: LEDGER (LIBRO CONTABLE) */}
                {activeSubTab === 'ledger' && (
                  <div className="space-y-4">
                    {loadingLedger ? (
                      <p className="text-xs text-(--text-muted) m-0 py-6 text-center">Consultando libro contable inmutable...</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-3.5 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-[10px] uppercase font-bold text-(--text-muted) m-0">Bunz Otorgados</p>
                            <p className="text-lg font-black text-rose-400 m-0 mt-0.5">
                              -{ledgerData?.audit.totalRewarded.toLocaleString() || 0} B
                            </p>
                            <p className="text-[10px] text-(--text-muted) m-0 mt-0.5">{ledgerData?.audit.countRewarded || 0} emisiones</p>
                          </div>
                          <div className="p-3.5 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                            <p className="text-[10px] uppercase font-bold text-(--text-muted) m-0">Bunz Canjeados</p>
                            <p className="text-lg font-black text-emerald-400 m-0 mt-0.5">
                              +{ledgerData?.audit.totalRedeemed.toLocaleString() || 0} B
                            </p>
                            <p className="text-[10px] text-(--text-muted) m-0 mt-0.5">{ledgerData?.audit.countRedeemed || 0} canjes</p>
                          </div>
                        </div>

                        <div className="p-4 rounded-2xl space-y-2" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-(--text-secondary)">Balance Inventario:</span>
                            <span className="text-xs font-black text-(--text-primary)">
                              {ledgerData?.business.remainingInventory !== null && ledgerData?.business.remainingInventory !== undefined
                                ? `${ledgerData.business.remainingInventory.toLocaleString()} Bunz`
                                : 'Ilimitado'}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs text-(--text-muted)">
                            <span>Flujo neto del comercio:</span>
                            <span className={`font-black ${((ledgerData?.audit.netFlow || 0) >= 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {((ledgerData?.audit.netFlow || 0) >= 0 ? '+' : '')}{ledgerData?.audit.netFlow.toLocaleString()} B
                            </span>
                          </div>
                        </div>

                        <div>
                          <h5 className="text-[11px] font-black uppercase text-(--text-muted) mb-2 m-0 tracking-wider">
                            Últimos Movimientos del Ledger
                          </h5>
                          {!ledgerData?.statement || ledgerData.statement.length === 0 ? (
                            <p className="text-xs text-(--text-muted) m-0 py-4 text-center">Sin movimientos contables registrados.</p>
                          ) : (
                            <div className="flex flex-col gap-2">
                              {ledgerData.statement.map((row) => (
                                <div
                                  key={row.id}
                                  className="flex items-center justify-between p-3 rounded-xl text-xs"
                                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                                >
                                  <div className="min-w-0 pr-2">
                                    <p className="font-bold text-(--text-primary) m-0 truncate">
                                      {row.direction === 'OUTFLOW' ? 'Recompensa a' : 'Canje de'} {row.counterparty}
                                    </p>
                                    <p className="text-[10px] text-(--text-muted) m-0 mt-0.5">
                                      {new Date(row.createdAt).toLocaleDateString('es-MX', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}
                                    </p>
                                  </div>
                                  <span
                                    className={`font-black text-xs shrink-0 ${
                                      row.direction === 'OUTFLOW' ? 'text-rose-400' : 'text-emerald-400'
                                    }`}
                                  >
                                    {row.direction === 'OUTFLOW' ? '-' : '+'}{row.amount.toLocaleString()} B
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* SUBTAB: CLIENTS */}
                {activeSubTab === 'clients' && (
                  <div className="space-y-3">
                    {clientList.length === 0 ? (
                      <p className="text-xs text-(--text-muted) m-0 py-8 text-center">Aún no hay registros de clientes en esta sucursal.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {clientList.map((c, i) => (
                          <div 
                            key={i} 
                            className="flex justify-between items-center p-3.5 rounded-2xl text-xs" 
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                          >
                            <div>
                              <p className="font-bold text-(--text-primary) m-0 text-sm">
                                {c.user?.firstName || 'Rabbitter'} (@{c.user?.username || 'user'})
                              </p>
                              <p className="text-[11px] text-(--text-muted) m-0 mt-0.5">{c.txs} visita(s) acumuladas</p>
                            </div>
                            <span className="font-black text-sm text-[#E91E63]">{c.bunz} Bunz</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB: SETTINGS */}
                {activeSubTab === 'settings' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p className="font-bold text-xs uppercase text-(--text-muted) m-0 mb-1">Horario de Operación / Happy Hour</p>
                      <p className="text-sm font-black text-(--text-primary) m-0">
                        {business?.startTime || '00:00'} - {business?.endTime || '23:59'}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p className="font-bold text-xs uppercase text-(--text-muted) m-0 mb-1">Dirección de la Sucursal</p>
                      <p className="text-sm font-semibold text-(--text-primary) m-0">
                        {business?.address || 'Sin dirección registrada'}
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <p className="font-bold text-xs uppercase text-(--text-muted) m-0 mb-1">Estado de Afiliación</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                        <p className="text-xs font-bold text-emerald-400 m-0">Negocio Verificado en Red Rabbitty</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
