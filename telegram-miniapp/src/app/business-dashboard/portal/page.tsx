'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogOut,
  Users,
  Receipt,
  Store,
  TrendingUp,
  Sparkles,
  Compass,
  Headphones,
  Activity,
  Coins,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Volume2,
  Sun,
  Flame,
  Coffee,
  Music,
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { MoodPulseWidget } from '@/components/mood/MoodPulseWidget';
import { MoodCampaignsManager } from '@/components/mood/MoodCampaignsManager';

interface BusinessInfo {
  id: string;
  name: string;
  status: string;
  rewardPercentage?: number;
  creditLimit?: number;
  creditUsed?: number;
  [key: string]: unknown;
}

interface TransactionItem {
  id: string;
  userId: string;
  bunzMinted?: number;
  fiatAmount?: number;
  createdAt?: string;
  userFirstName?: string | null;
  userTelegramId?: string | null;
  [key: string]: unknown;
}

interface LedgerAuditData {
  business: {
    id: string;
    name: string;
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
  statement: Array<{
    id: string;
    direction: 'OUTFLOW' | 'INFLOW';
    type: string;
    amount: number;
    counterparty: string;
    createdAt: string;
  }>;
}

interface AtmosphereIntervention {
  id: string;
  recipeType: string;
  soundtrackApplied?: string | null;
  lightingApplied?: string | null;
  executedAt: string;
  notes?: string | null;
}

export default function BusinessPortal() {
  const { user } = useAuth();
  const [businessState, setBusinessState] = useState<BusinessInfo | null>(null);
  const [stats, setStats] = useState({ clients: 0, tickets: 0, bunz: 0, visits: 0 });
  const [recentTxs, setRecentTxs] = useState<TransactionItem[]>([]);
  const [ledgerData, setLedgerData] = useState<LedgerAuditData | null>(null);
  const [interventions, setInterventions] = useState<AtmosphereIntervention[]>([]);
  const [loading, setLoading] = useState(true);

  // Cashier Modals
  const [activeModal, setActiveModal] = useState<'MINT' | 'REDEEM' | 'ATMOSPHERE' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Mint Form State
  const [mintCustomerId, setMintCustomerId] = useState('');
  const [mintFiatAmount, setMintFiatAmount] = useState('');

  // Atmosphere Form State
  const [selectedRecipe, setSelectedRecipe] = useState<'CALMA' | 'FOCUS' | 'ENERGIA' | 'FIESTA'>('CALMA');
  const [atmosphereSoundtrack, setAtmosphereSoundtrack] = useState('');
  const [atmosphereLighting, setAtmosphereLighting] = useState('');
  const [atmosphereNotes, setAtmosphereNotes] = useState('');

  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    let isMounted = true;
    if (!user?.id) return;
    
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const bizData = await fetch(`/api/business`, { headers }).then(r => r.json());
        if (!isMounted) return;
        if (bizData.success && bizData.business) {
          const biz = bizData.business as BusinessInfo;
          setBusinessState(biz);

          const txData = await fetch(`/api/business/transactions?businessId=${biz.id}`, { headers }).then(r => r.json());
          if (txData.success && isMounted) {
            const txs = (txData.transactions || []) as TransactionItem[];
            setRecentTxs(txs.slice(0, 8));
            const uniqueClients = new Set(txs.map((t) => t.userId));
            const totalBunz = txs.reduce((sum: number, t) => sum + (t.bunzMinted || 0), 0);
            setStats({
              clients: uniqueClients.size,
              tickets: txs.length,
              bunz: totalBunz,
              visits: txs.length,
            });
          }

          const ledgerRes = await fetch(`/api/business/ledger?businessId=${biz.id}`, { headers }).then(r => r.json());
          if (ledgerRes.success && isMounted) {
            setLedgerData(ledgerRes);
          }

          const poaRes = await fetch(`/api/mood/intervention?businessId=${biz.id}`).then(r => r.json());
          if (poaRes.success && poaRes.interventions && isMounted) {
            setInterventions(poaRes.interventions);
          }
        }
      } catch {
        // ignore
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [user?.id, reloadTrigger]);

  // Handle Mint Bunz (Cashier Award)
  const handleMintBunz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessState?.id || !mintCustomerId.trim() || !mintFiatAmount) return;
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/business/scan/mint', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          telegramId: mintCustomerId.trim(),
          businessId: businessState.id,
          fiatAmount: parseFloat(mintFiatAmount),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al emitir recompensa de Bunz');
      }

      setActionSuccess(`¡Recompensa de ${data.bunzAwarded?.toLocaleString() || 'Bunz'} otorgada con éxito a ${data.customerName || 'cliente'}!`);
      setMintCustomerId('');
      setMintFiatAmount('');
      setTimeout(() => {
        setActiveModal(null);
        setActionSuccess(null);
        setReloadTrigger((n) => n + 1);
      }, 1800);
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || 'Error al conectar con la caja de recompensas');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Log Proof of Atmosphere
  const handleLogAtmosphere = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessState?.id) return;
    setIsSubmitting(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch('/api/mood/intervention', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: businessState.id,
          recipeType: selectedRecipe,
          soundtrackApplied: atmosphereSoundtrack.trim() || undefined,
          lightingApplied: atmosphereLighting.trim() || undefined,
          notes: atmosphereNotes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al registrar atmósfera');
      }

      setActionSuccess('¡Receta de atmósfera registrada en Proof of Atmosphere (PoA)!');
      setAtmosphereSoundtrack('');
      setAtmosphereLighting('');
      setAtmosphereNotes('');
      setTimeout(() => {
        setActiveModal(null);
        setActionSuccess(null);
        setReloadTrigger((n) => n + 1);
      }, 1600);
    } catch (err: unknown) {
      const error = err as Error;
      setActionError(error.message || 'Error al registrar la atmósfera');
    } finally {
      setIsSubmitting(false);
    }
  };

  const calculatedBunzReward = (() => {
    const fiat = parseFloat(mintFiatAmount);
    if (isNaN(fiat) || fiat <= 0) return 0;
    const pct = businessState?.rewardPercentage || 10;
    return Math.floor(fiat * (pct / 100));
  })();

  return (
    <div className="min-h-screen bg-(--background) text-(--foreground) font-sans pb-24">
      {/* Top Header */}
      <div className="bg-(--card) border-b border-(--border-subtle) px-5 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-xl shadow-xs">
            🐰
          </div>
          <div>
            <h1 className="font-black text-base tracking-tight leading-tight">
              {businessState?.name || 'Panel de Afiliado'}
            </h1>
            <p className="text-[11px] text-(--foreground-muted) flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Terminal Operativa & Caja
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            if (typeof window !== 'undefined') window.location.href = '/profile';
          }}
          className="w-9 h-9 rounded-full bg-(--secondary) text-(--foreground-muted) hover:text-(--foreground) flex items-center justify-center border border-(--border-subtle) active:scale-95 transition-all"
        >
          <LogOut size={16} />
        </button>
      </div>

      <div className="p-4 max-w-4xl mx-auto space-y-6">
        {/* Status Alert if in Review */}
        {businessState && businessState.status !== 'APPROVED' && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-amber-500 font-bold text-sm flex items-center gap-2">
                ⏳ Negocio en Proceso de Activación
              </h3>
              <p className="text-xs text-(--foreground-muted) mt-1">
                Tu solicitud está siendo validada. Puedes simular operaciones de caja y configurar atmósferas mientras activamos tu terminal.
              </p>
            </div>
          </div>
        )}

        {/* Operational Cashier Action Buttons */}
        <div className="bg-(--card) rounded-2xl p-4 border border-(--border-subtle) shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Acciones Rápidas de Operación</h2>
              <p className="text-[11px] text-(--foreground-muted)">Caja, fidelización y orquestación del salón</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-pink-500 bg-pink-500/10 px-2.5 py-1 rounded-full border border-pink-500/20">
              <Coins size={12} />
              <span>{businessState?.rewardPercentage || 10}% Cashback</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <button
              onClick={() => setActiveModal('MINT')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-xs shadow-sm active:scale-98 transition-all"
            >
              <ArrowUpRight size={16} />
              <span>Premiar Bunz (Caja)</span>
            </button>

            <button
              onClick={() => setActiveModal('ATMOSPHERE')}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-(--secondary) hover:bg-(--secondary)/80 text-(--foreground) border border-(--border-subtle) font-bold text-xs active:scale-98 transition-all"
            >
              <Music size={16} className="text-violet-400" />
              <span>Registrar PoA</span>
            </button>

            <button
              onClick={() => {
                const el = document.getElementById('ledger-audit-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-(--secondary) hover:bg-(--secondary)/80 text-(--foreground) border border-(--border-subtle) font-bold text-xs active:scale-98 transition-all"
            >
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Auditoría Ledger</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-(--card) p-4 rounded-2xl border border-(--border-subtle)">
            <div className="flex items-center gap-1.5 mb-1.5 text-(--foreground-muted) text-xs font-semibold">
              <Users size={14} /> Clientes Únicos
            </div>
            <p className="text-2xl font-black">{loading ? '...' : stats.clients}</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-(--card) p-4 rounded-2xl border border-(--border-subtle)">
            <div className="flex items-center gap-1.5 mb-1.5 text-(--foreground-muted) text-xs font-semibold">
              <Receipt size={14} /> Tickets Emitidos
            </div>
            <p className="text-2xl font-black">{loading ? '...' : stats.tickets}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-(--card) p-4 rounded-2xl border border-(--border-subtle)">
            <div className="flex items-center gap-1.5 mb-1.5 text-pink-500 text-xs font-semibold">
              <TrendingUp size={14} /> Bunz Entregados
            </div>
            <p className="text-2xl font-black text-pink-500">{loading ? '...' : stats.bunz.toLocaleString()}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-(--card) p-4 rounded-2xl border border-(--border-subtle)">
            <div className="flex items-center gap-1.5 mb-1.5 text-(--foreground-muted) text-xs font-semibold">
              <Store size={14} /> Visitas al Perfil
            </div>
            <p className="text-2xl font-black">{loading ? '...' : stats.visits}</p>
          </motion.div>
        </div>

        {/* Ledger Balance & Minting Capacity */}
        <div id="ledger-audit-section" className="bg-(--card) rounded-2xl p-4 border border-(--border-subtle)">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Capacidad de Tesorería & Ledger</h2>
              <p className="text-[11px] text-(--foreground-muted)">Control de liquidez de Bunz e inventario autorizado</p>
            </div>
            {ledgerData?.business?.isLowInventory && (
              <span className="text-[11px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Inventario Bajo (&lt;15%)
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-(--foreground-muted)">Crédito de Minting Usado</span>
                <span className="font-bold">
                  {(ledgerData?.business?.creditUsed || 0).toLocaleString()} / {(ledgerData?.business?.creditLimit || 0).toLocaleString()} Bunz
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-(--secondary) overflow-hidden">
                <div
                  className="h-full bg-pink-500 transition-all duration-500 rounded-full"
                  style={{
                    width: `${Math.min(100, Math.round(((ledgerData?.business?.creditUsed || 0) / Math.max(1, ledgerData?.business?.creditLimit || 1)) * 100))}%`
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-(--border-subtle)">
              <div className="p-2.5 rounded-xl bg-(--secondary)/40 border border-(--border-subtle)">
                <p className="text-[10px] text-(--foreground-muted) font-semibold">Total Recompensado</p>
                <p className="text-sm font-extrabold text-pink-500 mt-0.5">
                  {(ledgerData?.audit?.totalRewarded || 0).toLocaleString()} <span className="text-[10px] text-(--foreground-muted)">Bunz</span>
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-(--secondary)/40 border border-(--border-subtle)">
                <p className="text-[10px] text-(--foreground-muted) font-semibold">Total Canjeado</p>
                <p className="text-sm font-extrabold text-emerald-400 mt-0.5">
                  {(ledgerData?.audit?.totalRedeemed || 0).toLocaleString()} <span className="text-[10px] text-(--foreground-muted)">Bunz</span>
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-(--secondary)/40 border border-(--border-subtle)">
                <p className="text-[10px] text-(--foreground-muted) font-semibold">Flujo Neto</p>
                <p className="text-sm font-extrabold text-(--foreground) mt-0.5">
                  {(ledgerData?.audit?.netFlow || 0).toLocaleString()} <span className="text-[10px] text-(--foreground-muted)">Bunz</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Rabbitty Mood Intelligence Widget */}
        <MoodPulseWidget businessId={businessState?.id} />

        {/* Mood Campaigns Manager */}
        <MoodCampaignsManager businessId={businessState?.id} />

        {/* Recent PoA Interventions History */}
        {interventions.length > 0 && (
          <div className="bg-(--card) rounded-2xl p-4 border border-(--border-subtle)">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold tracking-tight">Historial de Recetas de Atmósfera (PoA)</h2>
                <p className="text-[11px] text-(--foreground-muted)">Últimas intervenciones acústicas y lumínicas en salón</p>
              </div>
              <span className="text-xs font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full border border-violet-500/20">
                {interventions.length} Registros
              </span>
            </div>

            <div className="divide-y divide-(--border-subtle)">
              {interventions.slice(0, 4).map((item) => (
                <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-400 flex items-center justify-center font-bold">
                      {item.recipeType === 'CALMA' && <Coffee size={14} />}
                      {item.recipeType === 'FOCUS' && <Sun size={14} />}
                      {item.recipeType === 'ENERGIA' && <Flame size={14} />}
                      {item.recipeType === 'FIESTA' && <Music size={14} />}
                    </span>
                    <div>
                      <p className="font-bold">Receta {item.recipeType}</p>
                      <p className="text-[11px] text-(--foreground-muted)">
                        {item.soundtrackApplied || 'Soundtrack estándar'} {item.lightingApplied ? `• Luz: ${item.lightingApplied}` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-(--foreground-muted)">
                    {new Date(item.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Cashier Transactions */}
        <div className="bg-(--card) rounded-2xl p-4 border border-(--border-subtle)">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-bold tracking-tight">Últimas Operaciones de Caja</h2>
              <p className="text-[11px] text-(--foreground-muted)">Mints y recompensas otorgadas a clientes</p>
            </div>
          </div>

          {recentTxs.length === 0 ? (
            <div className="text-center py-6 text-xs text-(--foreground-muted)">
              Aún no hay transacciones registradas hoy.
            </div>
          ) : (
            <div className="divide-y divide-(--border-subtle)">
              {recentTxs.map((tx) => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-pink-500/10 text-pink-500 flex items-center justify-center">
                      <ArrowUpRight size={14} />
                    </div>
                    <div>
                      <p className="font-bold">
                        {tx.userFirstName || (tx.userTelegramId ? `@${tx.userTelegramId}` : 'Cliente')}
                      </p>
                      <p className="text-[11px] text-(--foreground-muted)">
                        Consumo: ${tx.fiatAmount?.toLocaleString() || 0} MXN
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-extrabold text-pink-500">+{tx.bunzMinted?.toLocaleString() || 0} Bunz</p>
                    <p className="text-[10px] text-(--foreground-muted)">
                      {tx.createdAt ? new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rabbitty Ecosystem Innovation: Phygital Experience Pillars */}
        <div className="bg-linear-to-b from-gray-900 to-black text-white p-5 rounded-2xl border border-white/10 shadow-lg space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles size={16} />
            </span>
            <div>
              <h3 className="font-extrabold text-sm text-white">Ecosistema Phygital Rabbitty</h3>
              <p className="text-[11px] text-white/50">Innovación en experiencia y hospitalidad para tu negocio</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 pt-1">
            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Activity size={14} />
                <span>Proof of Atmosphere (PoA)</span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Mide de forma empírica cómo las recetas ambientales y acústicas se asocian a una mayor permanencia, ticket promedio y satisfacción.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <Compass size={14} />
                <span>Rabbitty Vibe Passport</span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Rutas temáticas comunitarias en tu ciudad. Nuevos Rabbitters descubren tu local al completar pasaportes de bienestar.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-400">
                <Headphones size={14} />
                <span>The Collective Sonic Room</span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Identidad sonora colectiva. Adapta sutilmente la ambientación sintonizando listas curadas según la energía predominante.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                <Store size={14} />
                <span>Rabbitty Vibe Graph</span>
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">
                Inteligencia de red: descubre qué experiencias generan mayor recurrencia y activa campañas estratégicas en tu zona.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Mint Bunz (Cashier Award) */}
      <AnimatePresence>
        {activeModal === 'MINT' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-(--card) rounded-2xl border border-(--border-subtle) p-5 shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setActiveModal(null);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-(--secondary) flex items-center justify-center text-(--foreground-muted) hover:text-(--foreground)"
              >
                <X size={15} />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-pink-500/10 text-pink-500 flex items-center justify-center">
                  <Coins size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">Premiar Bunz en Caja</h3>
                  <p className="text-[11px] text-(--foreground-muted)">Emisión de recompensas por consumo</p>
                </div>
              </div>

              {actionSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 mb-3">
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              <form onSubmit={handleMintBunz} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-(--foreground-muted) mb-1">
                    Identificador del Cliente
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="@username, Telegram ID o Wallet TON"
                    value={mintCustomerId}
                    onChange={(e) => setMintCustomerId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-(--secondary) border border-(--border-subtle) text-xs focus:outline-hidden focus:border-pink-500"
                  />
                  <p className="text-[10px] text-(--foreground-muted) mt-1">
                    Ingresa el Telegram ID del cliente o su dirección de Wallet registrada.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-(--foreground-muted) mb-1">
                    Monto de Consumo ($ MXN)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="Ej. 250.00"
                    value={mintFiatAmount}
                    onChange={(e) => setMintFiatAmount(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-(--secondary) border border-(--border-subtle) text-xs font-semibold focus:outline-hidden focus:border-pink-500"
                  />
                </div>

                {calculatedBunzReward > 0 && (
                  <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-between text-xs">
                    <span className="text-(--foreground-muted)">Recompensa estimada:</span>
                    <span className="font-extrabold text-pink-500 text-sm">+{calculatedBunzReward.toLocaleString()} Bunz</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !mintCustomerId.trim() || !mintFiatAmount}
                  className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white font-bold text-xs shadow-md active:scale-98 transition-all"
                >
                  {isSubmitting ? 'Procesando en Caja...' : 'Confirmar Recompensa'}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Modal: Proof of Atmosphere Intervention */}
        {activeModal === 'ATMOSPHERE' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-(--card) rounded-2xl border border-(--border-subtle) p-5 shadow-2xl relative"
            >
              <button
                onClick={() => {
                  setActiveModal(null);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                className="absolute top-4 right-4 w-7 h-7 rounded-full bg-(--secondary) flex items-center justify-center text-(--foreground-muted) hover:text-(--foreground)"
              >
                <X size={15} />
              </button>

              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                  <Volume2 size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">Registrar Receta PoA</h3>
                  <p className="text-[11px] text-(--foreground-muted)">Proof of Atmosphere: intervención en el salón</p>
                </div>
              </div>

              {actionSuccess && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 mb-3">
                  <CheckCircle2 size={16} />
                  <span>{actionSuccess}</span>
                </div>
              )}

              {actionError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 mb-3">
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              <form onSubmit={handleLogAtmosphere} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold text-(--foreground-muted) mb-1.5">
                    Tipo de Receta Ambiental
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['CALMA', 'FOCUS', 'ENERGIA', 'FIESTA'] as const).map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setSelectedRecipe(r)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                          selectedRecipe === r
                            ? 'bg-violet-600 text-white border-violet-500 shadow-xs'
                            : 'bg-(--secondary) text-(--foreground-muted) border-(--border-subtle)'
                        }`}
                      >
                        {r === 'CALMA' && '☕ Calma & Relajación'}
                        {r === 'FOCUS' && '💡 Focus & Trabajo'}
                        {r === 'ENERGIA' && '⚡ Energía & Social'}
                        {r === 'FIESTA' && '🎉 Fiesta & Noche'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-(--foreground-muted) mb-1">
                    Soundtrack / Playlist Sintonizada
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Rabbitty Lo-Fi Chill Vol. 2"
                    value={atmosphereSoundtrack}
                    onChange={(e) => setAtmosphereSoundtrack(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-(--secondary) border border-(--border-subtle) text-xs focus:outline-hidden focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-(--foreground-muted) mb-1">
                    Iluminación / Escena
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Atenuada 40%, cálida ámbar"
                    value={atmosphereLighting}
                    onChange={(e) => setAtmosphereLighting(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-(--secondary) border border-(--border-subtle) text-xs focus:outline-hidden focus:border-violet-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-(--foreground-muted) mb-1">
                    Notas operativas (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Ocupación al 85%, cambio de música solicitado por clientes"
                    value={atmosphereNotes}
                    onChange={(e) => setAtmosphereNotes(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-(--secondary) border border-(--border-subtle) text-xs focus:outline-hidden focus:border-violet-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-xs shadow-md active:scale-98 transition-all"
                >
                  {isSubmitting ? 'Registrando en PoA...' : 'Guardar Intervención PoA'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
