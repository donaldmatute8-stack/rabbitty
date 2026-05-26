'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Filter, Coffee, Dumbbell, Sparkles, Laptop, UtensilsCrossed } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

const TRANSACTIONS = [
  { id: '1', type: 'earned', amount: 50, business: 'Café Cultura', date: 'Hoy, 10:30 AM', description: 'Desayuno', category: 'Comida', icon: <Coffee className="w-5 h-5 text-green-600" /> },
  { id: '2', type: 'spent', amount: 100, business: 'Pizza Napoli', date: 'Ayer, 7:00 PM', description: 'Cena', category: 'Comida', icon: <UtensilsCrossed className="w-5 h-5 text-[#111111]" /> },
  { id: '3', type: 'earned', amount: 30, business: 'Gimnasio Power', date: 'Ayer, 9:00 AM', description: 'Membresía', category: 'Fitness', icon: <Dumbbell className="w-5 h-5 text-green-600" /> },
  { id: '4', type: 'earned', amount: 75, business: 'TechZone', date: '22 Ene, 3:45 PM', description: 'Audífonos', category: 'Tecnología', icon: <Laptop className="w-5 h-5 text-green-600" /> },
  { id: '5', type: 'spent', amount: 200, business: 'Spa Relax', date: '20 Ene, 2:00 PM', description: 'Masaje', category: 'Belleza', icon: <Sparkles className="w-5 h-5 text-[#111111]" /> },
];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];
const FILTERS = ['Todos', 'Ganado', 'Gastado', 'Comida', 'Fitness', 'Tecnología'];

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

  // Detectar scroll para comprimir header
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

  const totalEarned = TRANSACTIONS.filter(t => t.type === 'earned').reduce((s, t) => s + t.amount, 0);
  const totalSpent = TRANSACTIONS.filter(t => t.type === 'spent').reduce((s, t) => s + t.amount, 0);

  const filteredTransactions = TRANSACTIONS.filter(tx => {
    if (activeFilter === 'Todos') return true;
    if (activeFilter === 'Ganado') return tx.type === 'earned';
    if (activeFilter === 'Gastado') return tx.type === 'spent';
    return tx.category === activeFilter;
  });

  return (
    <div className="page-wrap pb-28 bg-white">
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 pt-2" style={{ backgroundColor: '#FFFFFF' }}>
        <h1 className="text-2xl font-normal text-[#111111] mb-6 px-1">Historial</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white border border-[#F0F0F0] rounded-2xl p-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs text-[#8A8A8A] font-normal">Ganado</span>
            </div>
            <p className="text-2xl font-semibold text-[#111111]">{totalEarned} <span className="text-[14px] font-normal text-[#8A8A8A]">bunz</span></p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            className="bg-white border border-[#F0F0F0] rounded-2xl p-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all"
          >
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-[#111111]" />
              </div>
              <span className="text-xs text-[#8A8A8A] font-normal">Gastado</span>
            </div>
            <p className="text-2xl font-semibold text-[#111111]">{totalSpent} <span className="text-[14px] font-normal text-[#8A8A8A]">bunz</span></p>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex-shrink-0 pl-1">
            <Filter className="w-4 h-4 text-[#8A8A8A]" strokeWidth={1.5} />
          </div>
          {FILTERS.map((filter, idx) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-xl text-sm transition-all duration-300 ${
                activeFilter === filter
                  ? 'bg-[#111111] text-white font-medium shadow-sm'
                  : 'bg-[#FAFAFA] border border-[#F0F0F0] text-[#8A8A8A] hover:bg-gray-50 active:scale-95'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="space-y-4">
          <p className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-2 px-1">
            Enero 2026
          </p>

          {filteredTransactions.length > 0 ? (
            filteredTransactions.map((tx, i) => (
              <motion.div
                key={tx.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className="bg-white border border-[#F0F0F0] rounded-2xl p-4 flex items-center gap-4 active:scale-[0.99] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  tx.type === 'earned' ? 'bg-green-50/50 border border-green-100/50' : 'bg-gray-50 border border-gray-100'
                }`}>
                  {tx.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-normal text-[#111111] text-[16px] truncate">{tx.business}</p>
                    <span className={`font-semibold text-[16px] ${tx.type === 'earned' ? 'text-green-600' : 'text-[#111111]'}`}>
                      {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#8A8A8A] font-light">{tx.description} — {tx.date}</p>
                </div>
              </motion.div>
            ))
          ) : (
            <EmptyState
              icon={<Filter className="w-8 h-8 text-[#8A8A8A]" />}
              title="Sin transacciones"
              description={`No se encontraron transacciones en la categoría "${activeFilter}".`}
            />
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
