'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';

const TRANSACTIONS = [
  { id: '1', type: 'earned', amount: 50, business: 'Café Cultura', date: 'Hoy, 10:30 AM', description: 'Desayuno', category: 'Comida' },
  { id: '2', type: 'spent', amount: 100, business: 'Pizza Napoli', date: 'Ayer, 7:00 PM', description: 'Cena', category: 'Comida' },
  { id: '3', type: 'earned', amount: 30, business: 'Gimnasio Power', date: 'Ayer, 9:00 AM', description: 'Membresía', category: 'Fitness' },
  { id: '4', type: 'earned', amount: 75, business: 'TechZone', date: '22 Ene, 3:45 PM', description: 'Audífonos', category: 'Tecnología' },
  { id: '5', type: 'spent', amount: 200, business: 'Spa Relax', date: '20 Ene, 2:00 PM', description: 'Masaje', category: 'Belleza' },
];

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio'];

export default function HistoryPage() {
  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  const totalEarned = TRANSACTIONS.filter(t => t.type === 'earned').reduce((s, t) => s + t.amount, 0);
  const totalSpent = TRANSACTIONS.filter(t => t.type === 'spent').reduce((s, t) => s + t.amount, 0);

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      <Header />

      <main className="flex-1 px-4 pt-2">
        <h1 className="text-2xl font-semibold text-[#111111] mb-6 px-2">Historial</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6 px-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-xs text-green-600 font-medium">Ganado</span>
            </div>
            <p className="text-2xl font-bold text-[#111111]">{totalEarned}</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-50 rounded-xl p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4 text-[#111111]" />
              </div>
              <span className="text-xs text-[#8A8A8A] font-medium">Gastado</span>
            </div>
            <p className="text-2xl font-bold text-[#111111]">{totalSpent}</p>
          </motion.div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 mb-4 px-2 overflow-x-auto">
          <button className="flex items-center gap-1 px-3 py-1.5 bg-[#111111] text-white rounded-full text-sm font-medium">
            <Filter className="w-3.5 h-3.5" />
            Todos
          </button>
          <button className="px-3 py-1.5 bg-[#F5F5F5] text-[#8A8A8A] rounded-full text-sm">
            Ganado
          </button>
          <button className="px-3 py-1.5 bg-[#F5F5F5] text-[#8A8A8A] rounded-full text-sm">
            Gastado
          </button>
          {MONTHS.slice(-3).map(month => (
            <button key={month} className="px-3 py-1.5 bg-[#F5F5F5] text-[#8A8A8A] rounded-full text-sm whitespace-nowrap">
              {month}
            </button>
          ))}
        </div>

        {/* Transaction List */}
        <div className="space-y-2">
          <p className="px-2 text-[13px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-2">
            Enero 2026
          </p>

          {TRANSACTIONS.map((tx, i) => (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                tx.type === 'earned' ? 'bg-green-50' : 'bg-gray-50'
              }`}>
                {tx.type === 'earned' ? (
                  <ArrowDownRight className="w-5 h-5 text-green-600" />
                ) : (
                  <ArrowUpRight className="w-5 h-5 text-[#111111]" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <p className="font-medium text-[#111111] text-[15px] truncate">{tx.business}</p>
                  <span className={`font-semibold text-[15px] ${tx.type === 'earned' ? 'text-green-600' : 'text-[#111111]'}`}>
                    {tx.type === 'earned' ? '+' : '-'}{tx.amount}
                  </span>
                </div>
                <p className="text-[13px] text-[#8A8A8A]">{tx.description} • {tx.date}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
