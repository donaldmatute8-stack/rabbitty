'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';

const FILTERS = ["Todos", "Ganado", "Gastado", "Comida", "Fitness", "Tecnología"];

interface TxHistory {
  id: string;
  name: string;
  category: string;
  amount: string;
  type: string;
  date: string;
  icon: string;
}

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isScrolled, setIsScrolled] = useState(false);
  const [transactions, setTransactions] = useState<TxHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const { address } = useWallet();
  const { user } = useAuth();

  useEffect(() => {
    if (user?.id) {
      fetchHistory();
    } else {
      setLoading(false);
    }
  }, [user]);

  const fetchHistory = async () => {
    if (!user?.id) return;
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/history`, { headers });
      const data = await res.json();
      if (data.success) {
        setTransactions(data.history);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

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

  const totalEarned = transactions.filter(t => t.type === 'earned').reduce((s, t) => s + parseInt(t.amount.replace('+', '')), 0);
  const totalSpent = transactions.filter(t => t.type === 'spent').reduce((s, t) => s + parseInt(t.amount.replace('-', '')), 0);

  const filteredTransactions = transactions.filter(tx => {
    if (activeFilter === 'Todos') return true;
    if (activeFilter === 'Ganado') return tx.type === 'earned';
    if (activeFilter === 'Gastado') return tx.type === 'spent';
    return tx.category === activeFilter;
  });

  return (
    <ProfileSubpageLayout title="Historial">

        {/* Stats Blocks */}
        <div className="flex gap-[10px] mb-[16px]">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[14px] px-[14px] py-[12px]"
          >
            <div className="flex items-center gap-[6px] mb-[4px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v6m0 0l-3-3m3 3l3-3" stroke="#4CAF50" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[12px] text-[#4CAF50] font-semibold">Ganado</span>
            </div>
            <span className="text-[24px] font-extrabold text-[var(--text-primary)]">{totalEarned}</span>
            <span className="text-[13px] text-[var(--text-muted)] ml-[4px]">bunz</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-[14px] px-[14px] py-[12px]"
          >
            <div className="flex items-center gap-[6px] mb-[4px]">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 13V7m0 0l-3 3m3-3l3 3" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span className="text-[12px] text-[#E91E63] font-semibold">Gastado</span>
            </div>
            <span className="text-[24px] font-extrabold text-[var(--text-primary)]">{totalSpent}</span>
            <span className="text-[13px] text-[var(--text-muted)] ml-[4px]">bunz</span>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex gap-[8px] overflow-x-auto pb-[12px] scrollbar-hide">
          {FILTERS.map((f, i) => (
            <button 
              key={f} 
              onClick={() => setActiveFilter(f)}
              className="shrink-0 px-[14px] py-[7px] rounded-[100px] border border-white/5 text-[13px] font-semibold cursor-pointer"
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
        <div className="flex flex-col gap-[12px]">
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
                className="flex items-center justify-between bg-[var(--bg-elevated)] p-[16px] rounded-[16px] border border-[var(--border-subtle)]"
              >
                <div className="flex items-center gap-[14px]">
                  <div className="w-[44px] h-[44px] rounded-[12px] flex items-center justify-center text-[22px]"
                    style={{ backgroundColor: tx.type === 'earned' ? "rgba(76, 175, 80, 0.15)" : "rgba(233, 30, 99, 0.15)" }}
                  >
                    {tx.icon}
                  </div>
                  <div>
                    <h4 className="m-0 text-[16px] font-bold text-[var(--text-primary)]">{tx.name}</h4>
                    <p className="m-0 text-[13px] text-[var(--text-muted)] mt-[2px]">
                      {tx.category} — {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[16px] font-extrabold" style={{ color: tx.type === 'earned' ? "#4CAF50" : "var(--text-primary)" }}>
                    {tx.amount}
                  </span>
                  <span className="text-[11px] text-[#AAA] font-semibold">bunz</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
    </ProfileSubpageLayout>
  );
}
