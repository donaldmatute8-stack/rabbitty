'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import BottomNav from '@/components/BottomNav';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';

const FILTERS = ["Todos", "Ganado", "Gastado", "Comida", "Fitness", "Tecnología"];

const TRANSACTIONS = [
  { id: '1', icon: "☕", color: "#FFF0F0", name: "Café Cultura", sub: "Desayuno — Hoy, 10:30 AM", amount: "+50", positive: true, category: 'Comida', type: 'earned' },
  { id: '2', icon: "🍕", color: "#FFF4E0", name: "Pizza Napoli", sub: "Cena — Ayer, 7:00 PM", amount: "-100", positive: false, category: 'Comida', type: 'spent' },
  { id: '3', icon: "💪", color: "#E8FFE8", name: "Gimnasio Power", sub: "Membresía — Ayer, 9:00 AM", amount: "+30", positive: true, category: 'Fitness', type: 'earned' },
  { id: '4', icon: "💻", color: "#E8F0FF", name: "TechZone", sub: "Audífonos — 22 Ene, 3:45 PM", amount: "+75", positive: true, category: 'Tecnología', type: 'earned' },
  { id: '5', icon: "✨", color: "#F5E8FF", name: "Spa Relax", sub: "Masaje — 20 Ene, 2:00 PM", amount: "-200", positive: false, category: 'Belleza', type: 'spent' },
];

export default function HistoryPage() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isScrolled, setIsScrolled] = useState(false);

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

  const totalEarned = TRANSACTIONS.filter(t => t.type === 'earned').reduce((s, t) => s + parseInt(t.amount.replace('+', '')), 0);
  const totalSpent = TRANSACTIONS.filter(t => t.type === 'spent').reduce((s, t) => s + parseInt(t.amount.replace('-', '')), 0);

  const filteredTransactions = TRANSACTIONS.filter(tx => {
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

        {/* List */}
        <div style={{ paddingTop: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: "#AAA", letterSpacing: "0.8px", marginBottom: 4 }}>ENERO 2026</p>

          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx, i) => (
              <motion.div 
                key={tx.id} 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 14, paddingBottom: 14, borderBottom: i < filteredTransactions.length - 1 ? "1px solid #F4F4F4" : "none" }}
              >
                <div style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tx.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  {tx.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "#111", marginBottom: 2 }}>{tx.name}</p>
                  <p style={{ fontSize: 12, color: "#AAA" }}>{tx.sub}</p>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, color: tx.positive ? "#4CAF50" : "#E91E63", flexShrink: 0 }}>
                  {tx.amount}
                </span>
              </motion.div>
            ))
          ) : (
            <div style={{ padding: "40px 0" }}>
              <EmptyState
                icon={<div style={{ fontSize: 32 }}>🔍</div>}
                title="Sin transacciones"
                description={`No se encontraron transacciones en "${activeFilter}".`}
              />
            </div>
          )}
        </div>
    </ProfileSubpageLayout>
  );
}
