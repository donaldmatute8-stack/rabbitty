'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { QrCode, Settings, PieChart, TrendingUp, Users, CreditCard } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

const ANALYTICS = [
  { label: 'Transacciones', value: '156', change: '+12%', icon: CreditCard },
  { label: 'Clientes', value: '89', change: '+5%', icon: Users },
  { label: 'Bunz dados', value: '2,340', change: '+8%', icon: TrendingUp },
];

export default function BusinessPanel() {
  const [businessData] = useState({
    name: 'Café Cultura',
    type: 'Restaurante',
    creditLimit: 100000,
    creditUsed: 25000,
    creditRemaining: 75000,
    rewardRate: 20,
    transactions: 156,
    customers: 89,
  });
  const [newRate, setNewRate] = useState(20);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  const creditPercent = Math.round((businessData.creditUsed / businessData.creditLimit) * 100);

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      <Header />

      <main className="flex-1 px-4 pt-2">
        {/* Business Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3">
            {businessData.name[0]}
          </div>
          <h1 className="text-2xl font-semibold text-[#111111]">{businessData.name}</h1>
          <p className="text-[#8A8A8A] text-sm">{businessData.type}</p>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {ANALYTICS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="bg-[#F5F5F5] rounded-xl p-3 text-center"
            >
              <stat.icon className="w-5 h-5 text-[#8A8A8A] mx-auto mb-2" />
              <p className="text-lg font-bold text-[#111111]">{stat.value}</p>
              <p className="text-[11px] text-green-600 font-medium">{stat.change}</p>
            </motion.div>
          ))}
        </div>

        {/* QR Generator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-[#111111] to-[#333333] rounded-2xl p-6 text-white mb-6"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <p className="font-semibold">Generar QR</p>
              <p className="text-sm text-white/70">Para clientes Rabbitty</p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 flex items-center justify-center mb-4">
            <div className="w-32 h-32 bg-[#F5F5F5] rounded-lg" />
          </div>

          <Button variant="primary" fullWidth className="bg-white text-[#111111] hover:bg-gray-100">
            Generar nuevo QR
          </Button>
        </motion.div>

        {/* Credit Line */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#F5F5F5] rounded-xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-[#111111]">Línea de crédito</p>
              <p className="text-sm text-[#8A8A8A]">${businessData.creditRemaining.toLocaleString()} disponible</p>
            </div>
            <span className="text-2xl font-bold text-[#111111]">${businessData.creditLimit.toLocaleString()}</span>
          </div>

          <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${creditPercent}%` }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="h-full bg-gradient-to-r from-[#E91E63] to-[#C2185B]"
            />
          </div>
          <p className="text-xs text-[#8A8A8A]">{ creditPercent }% usado</p>
        </motion.div>

        {/* Reward Rate */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#F5F5F5] rounded-xl p-6 mb-6"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-[#111111]">Tasa de recompensa</p>
              <p className="text-sm text-[#8A8A8A]">Otorga {newRate}% en bunz</p>
            </div>
            <span className="text-3xl font-bold text-[#E91E63]">{newRate}%</span>
          </div>

          <input
            type="range"
            min="10"
            max="100"
            value={newRate}
            onChange={e => setNewRate(Number(e.target.value))}
            className="w-full accent-[#E91E63]"
          />
          <div className="flex justify-between text-xs text-[#8A8A8A] mt-2">
            <span>10%</span>
            <span>100%</span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button className="flex flex-col items-center gap-2 p-4 bg-[#F5F5F5] rounded-xl active:scale-[0.98] transition-transform">
            <PieChart className="w-6 h-6 text-[#111111]" />
            <span className="text-sm font-medium text-[#111111]">Analytics</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-4 bg-[#F5F5F5] rounded-xl active:scale-[0.98] transition-transform">
            <Settings className="w-6 h-6 text-[#111111]" />
            <span className="text-sm font-medium text-[#111111]">Settings</span>
          </button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
