'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { History as HistoryIcon } from 'lucide-react';
import { PremiumHero } from '@/components/premium/PremiumUI';
import AnimatedBunz from '@/components/ui/AnimatedBunz';

const FILTERS = ["Todos", "Ganado", "Gastado", "Pagos", "Comida", "Fitness", "Tecnología"];

interface TxHistory {
  id: string;
  name: string;
  category: string;
  amount: string;
  type: string;
  date: string;
  icon: string;
  currency?: 'BUNZ' | 'MXN';
  detail?: string | null;
}

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [transactions, setTransactions] = useState<TxHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    let active = true;
    if (!user?.id) return;

    // Asynchronously begin fetch and manage loading in microtask / promise resolution
    Promise.resolve().then(() => {
      if (active) setLoading(true);
      return PlatformBridge.getAuthHeaders();
    })
      .then((headers) => fetch('/api/history', { headers }))
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && Array.isArray(data.history)) {
          setTransactions(data.history);
        }
      })
      .catch((err) => {
        console.error('[History] fetch error:', err);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    }).catch(() => {});
  }, []);

  const bunzTx = transactions.filter(t => (t.currency ?? 'BUNZ') === 'BUNZ');
  const totalEarned = bunzTx.filter(t => t.type === 'earned').reduce((s, t) => s + parseInt(t.amount.replace('+', '') || '0', 10), 0);
  const totalSpent = bunzTx.filter(t => t.type === 'spent').reduce((s, t) => s + Math.abs(parseInt(t.amount.replace('-', '') || '0', 10)), 0);
  const totalPaidMxn = transactions
    .filter(t => t.currency === 'MXN')
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount.replace('-', '')) || 0), 0);

  const filteredTransactions = transactions.filter(tx => {
    if (activeFilter === 'Todos') return true;
    if (activeFilter === 'Ganado') return tx.type === 'earned' && (tx.currency ?? 'BUNZ') === 'BUNZ';
    if (activeFilter === 'Gastado') return tx.type === 'spent';
    if (activeFilter === 'Pagos') return tx.currency === 'MXN';
    return tx.category === activeFilter;
  });

  return (
    <ProfileSubpageLayout title="Historial">

        <PremiumHero
          icon={HistoryIcon}
          eyebrow="HISTORIAL"
          title="Tu actividad"
          subtitle="Cada movimiento de tu economía Rabbitty"
        >
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/10 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-emerald-300/70">Ganado</p>
              <AnimatedBunz value={totalEarned} className="text-[15px] font-black text-emerald-300" />
            </div>
            <div className="rounded-xl border border-rose-400/15 bg-rose-400/10 px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-rose-300/70">Gastado</p>
              <AnimatedBunz value={totalSpent} className="text-[15px] font-black text-rose-300" />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2">
              <p className="text-[9px] font-black uppercase tracking-wider text-white/45">Pagado</p>
              <p className="text-[15px] font-black text-white">${totalPaidMxn.toFixed(0)}</p>
            </div>
          </div>
        </PremiumHero>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
          {FILTERS.map((f) => (
            <button 
              key={f} 
              onClick={() => setActiveFilter(f)}
              className="shrink-0 px-3.5 py-1.75 rounded-[100px] border border-white/5 text-[13px] font-semibold cursor-pointer"
              style={{ 
                backgroundColor: activeFilter === f ? "var(--rabbitty-pink)" : "var(--bg-elevated)", 
                color: activeFilter === f ? "#fff" : "var(--text-muted)", 
                fontFamily: "var(--font-family-base)",
                transition: "all 0.2s"
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Feed List */}
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div></div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState icon={<div className="text-[32px]">🔍</div>} title="Sin actividad" description="No hay transacciones aún en esta categoría." />
          ) : (
            filteredTransactions.map((tx, i) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center justify-between bg-(--bg-elevated) p-4 rounded-2xl border border-(--border-subtle)"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[22px]"
                    style={{ backgroundColor: tx.type === 'earned' ? "rgba(76, 175, 80, 0.15)" : "rgba(233, 30, 99, 0.15)" }}
                  >
                    {tx.icon}
                  </div>
                  <div>
                    <h4 className="m-0 text-[16px] font-bold text-(--text-primary)">{tx.name}</h4>
                    <p className="m-0 text-[13px] text-(--text-muted) mt-0.5">
                      {tx.detail ? `${tx.detail} · ` : ''}{tx.category} — {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[16px] font-extrabold" style={{ color: tx.type === 'earned' ? "#4CAF50" : "var(--text-primary)" }}>
                    {tx.currency === 'MXN'
                      ? `-$${Math.abs(parseFloat(tx.amount.replace('-', '')) || 0).toFixed(2)}`
                      : tx.amount}
                  </span>
                  <span className="text-[11px] text-[#AAA] font-semibold">
                    {tx.currency === 'MXN' ? 'MXN' : 'bunz'}
                  </span>
                </div>
              </motion.div>
            ))
          )}
        </div>
    </ProfileSubpageLayout>
  );
}
