'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronRight, Settings, Bell, Shield, CreditCard, Award, TrendingUp } from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import Header from '@/components/ui/Header';
import Button from '@/components/ui/Button';

const STATS = [
  { label: 'Bunz ganados', value: '1,250', icon: Award, color: 'bg-[#E91E63]/10 text-[#E91E63]' },
  { label: 'Negocios visitados', value: '23', icon: TrendingUp, color: 'bg-blue-50 text-blue-600' },
];

const MENU_ITEMS = [
  { label: 'Historial', href: '/history', icon: CreditCard },
  { label: 'Referidos', href: '/referral', icon: Award },
  { label: 'Notificaciones', href: '#', icon: Bell, badge: '3' },
  { label: 'Seguridad', href: '#', icon: Shield },
  { label: 'Configuración', href: '#', icon: Settings },
];

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);

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

  return (
    <div className="page-wrap pb-28 bg-white">
      <div style={{ height: 'var(--safe-top)' }} />

      <Header />

      <main className="flex-1">
        {/* Profile Hero */}
        <div className="px-6 pt-4 pb-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center text-white text-2xl font-bold">
              {user?.first_name?.[0] || 'B'}
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold text-[#111111]">{user?.first_name || 'Bruce'}</h1>
              <p className="text-[#8A8A8A] text-sm">@{user?.username || 'bruce_wayne'}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="bg-[#E91E63]/10 text-[#E91E63] text-xs font-medium px-2.5 py-1 rounded-full">
                  Member
                </span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Stats Grid */}
        <div className="px-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            {STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#F5F5F5] rounded-xl p-4"
              >
                <div className={`w-10 h-10 rounded-full ${stat.color} flex items-center justify-center mb-3`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-[#111111]">{stat.value}</p>
                <p className="text-[13px] text-[#8A8A8A]">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            <Link href="/business" className="flex-1">
              <div className="bg-[#111111] text-white rounded-xl p-4 text-center active:scale-[0.98] transition-transform">
                <p className="text-sm font-medium">Tienes un negocio?</p>
                <p className="text-xs text-white/70 mt-1">Afíliate ahora</p>
              </div>
            </Link>
            <Link href="/referral" className="flex-1">
              <div className="bg-[#E91E63]/10 text-[#E91E63] rounded-xl p-4 text-center active:scale-[0.98] transition-transform">
                <p className="text-sm font-medium">Invitar amigos</p>
                <p className="text-xs text-[#E91E63]/70 mt-1">Gana 50 bunz</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Menu Items */}
        <div className="px-6">
          <h2 className="text-sm font-semibold text-[#8A8A8A] uppercase tracking-wider mb-4">Configuración</h2>
          <div className="space-y-1">
            {MENU_ITEMS.map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={item.href} className="flex items-center gap-4 p-4 bg-[#F5F5F5] rounded-xl active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                    <item.icon className="w-5 h-5 text-[#111111]" />
                  </div>
                  <span className="flex-1 text-[15px] text-[#111111]">{item.label}</span>
                  {item.badge && (
                    <span className="bg-[#E91E63] text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-5 h-5 text-[#8A8A8A]" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
