'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Users, Receipt, Store, Settings, TrendingUp } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';

export default function BusinessPortal() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ clients: 0, tickets: 0, bunz: 0, visits: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.telegramId) return;
    Promise.all([
      fetch(`/api/business?telegramId=${user.telegramId}`).then(r => r.json()),
    ])
    .then(([bizData]) => {
      if (bizData.success && bizData.business) {
        const biz = bizData.business;
        fetch(`/api/business/transactions?businessId=${biz.id}`)
          .then(r => r.json())
          .then((txData: any) => {
            if (txData.success) {
              const txs = txData.transactions || [];
              const uniqueClients = new Set(txs.map((t: any) => t.userId));
              const totalBunz = txs.reduce((sum: number, t: any) => sum + (t.bunzMinted || 0), 0);
              setStats({
                clients: uniqueClients.size,
                tickets: txs.length,
                bunz: totalBunz,
                visits: txs.length,
              });
            }
          })
          .catch(() => {});
      }
    })
    .finally(() => setLoading(false));
  }, [user?.telegramId]);

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      <div className="bg-white border-b border-gray-100 p-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-pink-100 text-pink-600 rounded-xl flex items-center justify-center text-xl">
            🐰
          </div>
          <div>
            <h1 className="font-black text-gray-900 leading-tight">Panel de Afiliado</h1>
            <p className="text-xs text-gray-500 font-medium">Conectado y listo</p>
          </div>
        </div>
        <button className="w-10 h-10 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center border border-gray-100 active:scale-95 transition-transform">
          <LogOut size={18} />
        </button>
      </div>

      <div className="p-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-semibold">
              <Users size={16} /> Clientes Nuevos
            </div>
            <p className="text-3xl font-black text-gray-900">{loading ? '...' : stats.clients}</p>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-semibold">
              <Receipt size={16} /> Tickets Escaneados
            </div>
            <p className="text-3xl font-black text-gray-900">{loading ? '...' : stats.tickets}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2 text-pink-500 text-sm font-semibold">
              <TrendingUp size={16} /> Bunz Repartidos
            </div>
            <p className="text-3xl font-black text-pink-600">{loading ? '...' : stats.bunz.toLocaleString()}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-2 text-gray-500 text-sm font-semibold">
              <Store size={16} /> Visitas al Perfil
            </div>
            <p className="text-3xl font-black text-gray-900">{loading ? '...' : stats.visits}</p>
          </motion.div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button className="flex-1 p-4 font-bold text-pink-600 border-b-2 border-pink-600 bg-pink-50/30">
              Historial de Tráfico
            </button>
            <button className="flex-1 p-4 font-semibold text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2">
              <Settings size={18} /> Configurar Recompensas
            </button>
          </div>
          
          <div className="p-8 text-center text-gray-500 font-medium">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
              <Receipt size={24} />
            </div>
            <h3 className="text-gray-900 font-bold mb-1">Aún no hay actividad reciente</h3>
            <p className="text-sm">Cuando los clientes escaneen tickets, aparecerán aquí.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
