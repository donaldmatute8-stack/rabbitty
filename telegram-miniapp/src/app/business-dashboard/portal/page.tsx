'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { LogOut, Users, Receipt, Store, TrendingUp, Sparkles, Compass, Headphones, Activity } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { MoodPulseWidget } from '@/components/mood/MoodPulseWidget';

interface BusinessInfo {
  id: string;
  name: string;
  status: string;
  [key: string]: unknown;
}

interface TransactionItem {
  id: string;
  userId: string;
  bunzMinted?: number;
  [key: string]: unknown;
}

export default function BusinessPortal() {
  const { user } = useAuth();
  const [businessState, setBusinessState] = useState<BusinessInfo | null>(null);
  const [stats, setStats] = useState({ clients: 0, tickets: 0, bunz: 0, visits: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const bizData = await fetch(`/api/business`, { headers }).then(r => r.json());
        if (bizData.success && bizData.business) {
          const biz = bizData.business as BusinessInfo;
          setBusinessState(biz);
          const txData = await fetch(`/api/business/transactions?businessId=${biz.id}`, { headers }).then(r => r.json());
          if (txData.success) {
            const txs = (txData.transactions || []) as TransactionItem[];
            const uniqueClients = new Set(txs.map((t) => t.userId));
            const totalBunz = txs.reduce((sum: number, t) => sum + (t.bunzMinted || 0), 0);
            setStats({
              clients: uniqueClients.size,
              tickets: txs.length,
              bunz: totalBunz,
              visits: txs.length,
            });
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

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
        {businessState && businessState.status !== 'APPROVED' && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-amber-800 font-bold flex items-center gap-2">
                ⏳ Negocio en Revisión
              </h3>
              <p className="text-amber-700 text-sm mt-1">
                Tu solicitud está siendo analizada por nuestro equipo. Mientras tanto, puedes configurar tus recompensas y fotos, pero tu perfil no será visible para los clientes.
              </p>
            </div>
          </div>
        )}
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

        {/* Rabbitty Mood Intelligence Widget */}
        <div className="mb-8">
          <MoodPulseWidget businessId={businessState?.id} />
        </div>

        {/* Rabbitty Ecosystem Innovation: Phygital Experience Pillars */}
        <div className="mt-8 bg-linear-to-b from-gray-900 to-black text-white p-6 rounded-3xl border border-white/10 shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400">
              <Sparkles size={16} />
            </span>
            <div>
              <h3 className="font-extrabold text-base text-white">Ecosistema Phygital Rabbitty</h3>
              <p className="text-xs text-white/50">Innovación en experiencia y hospitalidad para tu negocio</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <Activity size={15} />
                <span>Proof of Atmosphere (PoA)</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Mide de forma empírica y agregada cómo las recetas ambientales y acústicas se asocian a una mayor permanencia, ticket promedio y satisfacción de tus mesas.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400">
                <Compass size={15} />
                <span>Rabbitty Vibe Passport</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Rutas temáticas comunitarias en tu ciudad. Nuevos Rabbitters descubren tu local al completar pasaportes de bienestar (Café de mañana, Coworking, Restaurante).
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-violet-400">
                <Headphones size={15} />
                <span>The Collective Sonic Room</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Identidad sonora colectiva. Adapta sutilmente la ambientación de tu establecimiento sintonizando listas curadas según la energía predominante del salón.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                <Store size={15} />
                <span>Rabbitty Vibe Graph</span>
              </div>
              <p className="text-xs text-white/70 leading-relaxed">
                Inteligencia de red: descubre qué experiencias generan mayor recurrencia y activa campañas y colaboraciones estratégicas con otros comercios de tu zona.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
