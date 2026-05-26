'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ChevronRight, Settings, Bell, Shield, CreditCard, Award, TrendingUp, HelpCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';

const STATS = [
  { label: 'Bunz ganados', value: '1,250', icon: Award, color: 'text-[#E91E63] bg-[#E91E63]/5 border-[#E91E63]/10' },
  { label: 'Negocios visitados', value: '23', icon: TrendingUp, color: 'text-blue-600 bg-blue-50/50 border-blue-100' },
];

const MENU_ITEMS = [
  { label: 'Historial de transacciones', href: '/history', icon: CreditCard },
  { label: 'Programa de referidos', href: '/referral', icon: Award },
  { label: 'Notificaciones', href: '#', icon: Bell, badge: '3' },
  { label: 'Seguridad y Privacidad', href: '#', icon: Shield },
  { label: 'Ayuda y Soporte', href: '#', icon: HelpCircle },
];

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      const tgUser = app.initDataUnsafe.user;
      if (tgUser) setUser(tgUser);
      else setUser({ first_name: 'Bruce', username: 'bruce_wayne' });
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

  return (
    <div className="page-wrap pb-28 bg-white">
      <div className={`sticky top-0 z-[60] bg-white transition-shadow duration-300 ${isScrolled ? 'shadow-[0_2px_8px_rgba(0,0,0,0.04)]' : ''}`}>
        <div style={{ height: 'var(--safe-top)' }} />
        <Header showBack={true} isScrolled={isScrolled} />
      </div>

      <main className="flex-1 w-full max-w-[600px] mx-auto px-4" style={{ backgroundColor: '#FFFFFF' }}>
        {/* Profile Hero */}
        <div className="pt-4 pb-6">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-5 px-1"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-[#E91E63] to-[#C2185B] rounded-full blur-[4px] opacity-20" />
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-2xl font-semibold border-2 border-white relative z-10 shadow-[0_4px_16px_rgba(233,30,99,0.15)]">
                {user?.first_name?.[0] || 'B'}
              </div>
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-normal text-[#111111] mb-0.5">{user?.first_name || 'Bruce'}</h1>
              <p className="text-[#8A8A8A] text-[14px] font-light">@{user?.username || 'bruce_wayne'}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-[#E91E63]/10 text-[#E91E63] text-xs font-semibold px-3 py-1 rounded-full">
                  Member
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="pb-6">
          <div className="grid grid-cols-2 gap-4">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.08, duration: 0.3 }}
                className="bg-white border border-[#F0F0F0] rounded-2xl p-5 hover:shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all"
              >
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${stat.color}`}>
                  <stat.icon className="w-5 h-5" strokeWidth={1.5} />
                </div>
                <p className="text-2xl font-semibold text-[#111111] mb-0.5">{stat.value}</p>
                <p className="text-[13px] text-[#8A8A8A] font-light">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="pb-6">
          <div className="flex gap-4">
            <Link href="/business" className="flex-1">
              <motion.div 
                whileTap={{ scale: 0.98 }}
                className="bg-[#111111] text-white rounded-2xl p-5 text-center shadow-[0_4px_16px_rgba(0,0,0,0.08)] border border-neutral-900 cursor-pointer h-full flex flex-col justify-center"
              >
                <p className="text-[15px] font-normal mb-1">¿Tienes un negocio?</p>
                <p className="text-[12px] text-white/60 font-light">Afíliate y otorga bunz</p>
              </motion.div>
            </Link>
            <Link href="/referral" className="flex-1">
              <motion.div 
                whileTap={{ scale: 0.98 }}
                className="bg-[#E91E63]/5 border border-[#E91E63]/10 text-[#E91E63] rounded-2xl p-5 text-center cursor-pointer h-full flex flex-col justify-center"
              >
                <p className="text-[15px] font-semibold mb-1">Invitar amigos</p>
                <p className="text-[12px] text-[#E91E63]/70 font-light">Gana 50 bunz por ref</p>
              </motion.div>
            </Link>
          </div>
        </div>

        {/* Menu Items */}
        <div className="pb-8">
          <h2 className="text-[12px] font-semibold text-[#8A8A8A] uppercase tracking-wider mb-3 px-1">Configuración</h2>
          
          <div className="bg-white border border-[#F0F0F0] rounded-2xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.02)]">
            {MENU_ITEMS.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
              >
                <Link href={item.href} className="flex items-center gap-4 p-4 hover:bg-[#FAFAFA] active:bg-[#F5F5F5] transition-colors duration-200">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-5 h-5 text-[#111111]" strokeWidth={1.5} />
                  </div>
                  <span className="flex-1 text-[15px] font-normal text-[#111111]">{item.label}</span>
                  {item.badge && (
                    <span className="bg-[#E91E63] text-white text-[11px] font-semibold w-5 h-5 rounded-full flex items-center justify-center mr-1">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-[#8A8A8A]" strokeWidth={1.5} />
                </Link>
                {i < MENU_ITEMS.length - 1 && (
                  <div className="h-[1px] bg-[#F0F0F0] ml-16" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
