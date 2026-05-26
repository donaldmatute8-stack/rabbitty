'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { QrCode, Settings, PieChart, TrendingUp, Users, CreditCard, ArrowUpRight, BarChart3 } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Button from '@/components/ui/Button';

const ANALYTICS = [
  { label: 'Transacciones', value: '156', change: '+12%', icon: CreditCard, color: 'text-blue-600 bg-blue-50/50 border-blue-100/50' },
  { label: 'Clientes', value: '89', change: '+5%', icon: Users, color: 'text-[#E91E63] bg-[#E91E63]/5 border-[#E91E63]/10' },
  { label: 'Bunz dados', value: '2,340', change: '+8%', icon: TrendingUp, color: 'text-green-600 bg-green-50/50 border-green-100/50' },
];

export default function BusinessPanel() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [businessData] = useState({
    name: 'Café Cultura',
    type: 'Restaurante y Café',
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

  const creditPercent = Math.round((businessData.creditUsed / businessData.creditLimit) * 100);

  return (
    <div className="page-wrap pb-28 bg-white">
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4 pt-2" style={{ backgroundColor: '#FFFFFF' }}>
        {/* Business Info */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className="relative inline-block mb-3">
            <div className="absolute inset-0 bg-gradient-to-br from-[#E91E63] to-[#C2185B] rounded-full blur-[4px] opacity-20" />
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-3xl font-semibold border-2 border-white relative z-10 shadow-[0_4px_16px_rgba(233,30,99,0.15)]">
              {businessData.name[0]}
            </div>
          </div>
          <h1 className="text-xl font-normal text-[#111111] mb-0.5">{businessData.name}</h1>
          <p className="text-[#8A8A8A] text-[14px] font-light">{businessData.type}</p>
        </motion.div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {ANALYTICS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.08, duration: 0.3 }}
              className="bg-white border border-[#F0F0F0] rounded-2xl p-4 text-center hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all flex flex-col justify-between"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2 border ${stat.color}`}>
                <stat.icon className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <p className="text-[17px] font-semibold text-[#111111] mb-0.5">{stat.value}</p>
              <p className="text-[10px] text-[#8A8A8A] font-light uppercase tracking-wider mb-1">{stat.label}</p>
              <span className="text-[11px] text-green-600 font-semibold flex items-center justify-center gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                {stat.change}
              </span>
            </motion.div>
          ))}
        </div>

        {/* QR Generator */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="bg-gradient-to-br from-[#111111] to-[#2A2A2A] rounded-3xl p-6 text-white mb-6 relative overflow-hidden shadow-[0_12px_24px_rgba(0,0,0,0.08)]"
        >
          <div className="absolute top-[-50%] right-[-30%] w-72 h-72 rounded-full bg-white/5 blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-4.5 mb-6 relative z-10">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <p className="font-medium text-[16px] text-white">Generar código QR</p>
              <p className="text-[13px] text-white/60 font-light">Para registrar consumos de clientes</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 flex items-center justify-center mb-6 relative z-10 shadow-inner">
            {/* Visual simulation of QR with scan target effect */}
            <div className="w-36 h-36 border border-neutral-100 rounded-xl p-3 flex flex-col justify-between items-center bg-gray-50/50">
              <div className="w-full flex justify-between">
                <div className="w-7 h-7 border-[3px] border-[#111111] rounded-[4px]" />
                <div className="w-7 h-7 border-[3px] border-[#111111] rounded-[4px]" />
              </div>
              <div className="flex flex-col gap-1 w-20 items-center">
                <div className="h-[2px] bg-[#111111] w-full" />
                <div className="h-[2px] bg-[#111111] w-[60%]" />
                <div className="h-[2px] bg-[#111111] w-[80%]" />
              </div>
              <div className="w-full flex justify-between items-end">
                <div className="w-7 h-7 border-[3px] border-[#111111] rounded-[4px]" />
                <div className="w-4 h-4 bg-[#111111] rounded-[2px]" />
              </div>
            </div>
          </div>

          <Button variant="primary" fullWidth className="bg-white text-[#111111] hover:bg-gray-50 active:scale-[0.98] py-4 rounded-xl shadow-md font-medium text-sm transition-all relative z-10">
            Generar nuevo QR
          </Button>
        </motion.div>

        {/* Credit Line */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="bg-white border border-[#F0F0F0] rounded-2xl p-5 mb-6 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-normal text-[#111111] text-[15px] mb-0.5">Línea de crédito</p>
              <p className="text-[13px] text-[#8A8A8A] font-light">${businessData.creditRemaining.toLocaleString()} disponible</p>
            </div>
            <span className="text-xl font-semibold text-[#111111]">${businessData.creditLimit.toLocaleString()}</span>
          </div>

          <div className="h-2 bg-[#F5F5F5] rounded-full overflow-hidden mb-2 border border-[#FAFAFA]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${creditPercent}%` }}
              transition={{ delay: 0.4, duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-[#E91E63] to-[#C2185B]"
            />
          </div>
          <p className="text-[11px] text-[#8A8A8A] font-light">{ creditPercent }% usado</p>
        </motion.div>

        {/* Reward Rate */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="bg-white border border-[#F0F0F0] rounded-2xl p-5 mb-6 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-normal text-[#111111] text-[15px] mb-0.5">Tasa de recompensa</p>
              <p className="text-[13px] text-[#8A8A8A] font-light">Otorga {newRate}% en bunz por consumo</p>
            </div>
            <span className="text-2xl font-bold text-[#E91E63]">{newRate}%</span>
          </div>

          <input
            type="range"
            min="10"
            max="100"
            value={newRate}
            onChange={e => setNewRate(Number(e.target.value))}
            className="w-full accent-[#E91E63] cursor-pointer h-2 bg-[#F5F5F5] rounded-lg appearance-none"
          />
          <div className="flex justify-between text-[11px] text-[#8A8A8A] font-light mt-3">
            <span>10% Mínimo</span>
            <span>100% Máximo</span>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4 pb-4">
          <motion.button 
            whileTap={{ scale: 0.98 }}
            className="flex flex-col items-center gap-2.5 p-5 bg-white border border-[#F0F0F0] rounded-2xl active:scale-[0.98] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
              <BarChart3 className="w-5 h-5 text-[#111111]" strokeWidth={1.5} />
            </div>
            <span className="text-[13px] font-normal text-[#111111]">Ver Estadísticas</span>
          </motion.button>
          <motion.button 
            whileTap={{ scale: 0.98 }}
            className="flex flex-col items-center gap-2.5 p-5 bg-white border border-[#F0F0F0] rounded-2xl active:scale-[0.98] transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)]"
          >
            <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
              <Settings className="w-5 h-5 text-[#111111]" strokeWidth={1.5} />
            </div>
            <span className="text-[13px] font-normal text-[#111111]">Configuración</span>
          </motion.button>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
