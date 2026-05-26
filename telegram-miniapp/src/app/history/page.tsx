'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';
import { useWallet } from '@/contexts/WalletContext';

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

  useEffect(() => {
    if (address) {
      fetchHistory();
    }
  }, [address]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`/api/history?wallet=${address}`);
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
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v6m0 0l-3-3m3 3l3-3" stroke="#4CAF50" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 12, color: "#4CAF50", fontWeight: 600 }}>Ganado</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>{totalEarned}</span>
            <span style={{ fontSize: 13, color: "#AAA", marginLeft: 4 }}>bunz</span>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ flex: 1, border: "1px solid #F0F0F0", borderRadius: 14, padding: "12px 14px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 13V7m0 0l-3 3m3-3l3 3" stroke="#E91E63" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <span style={{ fontSize: 12, color: "#E91E63", fontWeight: 600 }}>Gastado</span>
            </div>
            <span style={{ fontSize: 24, fontWeight: 800, color: "#111" }}>{totalSpent}</span>
            <span style={{ fontSize: 13, color: "#AAA", marginLeft: 4 }}>bunz</span>
          </motion.div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12 }} className="scrollbar-hide">
          {FILTERS.map((f, i) => (
            <button 
              key={f} 
              onClick={() => setActiveFilter(f)}
              style={{ 
                flexShrink: 0, 
                padding: "7px 14px", 
                borderRadius: 100, 
                border: "none", 
                fontSize: 13, 
                fontWeight: 600, 
                cursor: "pointer", 
                backgroundColor: activeFilter === f ? "#111" : "#F0F0F0", 
                color: activeFilter === f ? "#fff" : "#666", 
                fontFamily: "var(--font-family-base)",
                transition: "all 0.2s"
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Feed List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div></div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState icon={<div style={{ fontSize: 32 }}>🔍</div>} title="Sin actividad" description="No hay transacciones aún en esta categoría." />
          ) : (
            filteredTransactions.map((tx, i) => (
              <motion.div 
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "space-between", 
                  backgroundColor: "#FFF", 
                  padding: "16px", 
                  borderRadius: 16,
                  border: "1px solid #F0F0F0"
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: tx.type === 'earned' ? "#E8FFE8" : "#FFF0F0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {tx.icon}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111" }}>{tx.name}</h4>
                    <p style={{ margin: 0, fontSize: 13, color: "#8A8A8A", marginTop: 2 }}>
                      {tx.category} — {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: tx.type === 'earned' ? "#4CAF50" : "#111" }}>
                    {tx.amount}
                  </span>
                  <span style={{ fontSize: 11, color: "#AAA", fontWeight: 600 }}>bunz</span>
                </div>
              </motion.div>
            ))
          )}
        </div>
    </ProfileSubpageLayout>
  );
}
