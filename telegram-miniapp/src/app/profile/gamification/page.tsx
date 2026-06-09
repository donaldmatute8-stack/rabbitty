'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useToast } from '@/contexts/ToastContext';

export default function GamificationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MISSIONS' | 'BADGES'>('MISSIONS');

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/gamification?userId=${user.id}`)
        .then(res => res.json())
        .then(d => {
          if (d.success) setData(d);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
          showToast('Error cargando progreso', 'error');
        });
    }
  }, [user]);

  return (
    <ProfileSubpageLayout title="Identidad y Logros" showBack={true}>
      {loading ? (
        <div className="text-center px-5 py-10 text-[#888]">Cargando madriguera...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          
          {/* Header Stats */}
          <div className="bg-[#111] rounded-2xl p-5 mb-5 relative overflow-hidden">
            <div className="absolute -top-5 -right-5 text-[100px] opacity-10">🐰</div>
            
            <p className="text-[#E91E63] font-black text-xs uppercase tracking-[1px] m-0 mb-1">Rango Actual</p>
            <h2 className="text-white text-[24px] font-black m-0 mb-4">{data?.level?.name || 'Rabbitter Novato'}</h2>
            
            <div className="flex gap-3">
              <div className="flex-1 bg-white/10 p-3 rounded-xl">
                <p className="text-white/60 text-[11px] m-0 mb-1">Saltos (Hops)</p>
                <p className="text-white text-lg font-extrabold m-0">{data?.hops || 0}</p>
              </div>
              <div className="flex-1 bg-white/10 p-3 rounded-xl">
                <p className="text-white/60 text-[11px] m-0 mb-1">Bonus de Bunz</p>
                <p className="text-[#E91E63] text-lg font-extrabold m-0">x{data?.level?.bunzMultiplier || '1.0'}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-[#F4F4F4] rounded-xl p-1 mb-5">
            <button 
              onClick={() => setActiveTab('MISSIONS')}
              className="flex-1 py-[10px] border-none rounded-[10px] text-[13px] font-extrabold cursor-pointer"
              style={{
                backgroundColor: activeTab === 'MISSIONS' ? '#fff' : 'transparent',
                color: activeTab === 'MISSIONS' ? '#111' : '#888',
                boxShadow: activeTab === 'MISSIONS' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Misiones
            </button>
            <button 
              onClick={() => setActiveTab('BADGES')}
              className="flex-1 py-[10px] border-none rounded-[10px] text-[13px] font-extrabold cursor-pointer"
              style={{
                backgroundColor: activeTab === 'BADGES' ? '#fff' : 'transparent',
                color: activeTab === 'BADGES' ? '#111' : '#888',
                boxShadow: activeTab === 'BADGES' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Insignias
            </button>
          </div>

          {/* MISSIONS TAB */}
          {activeTab === 'MISSIONS' && (
            <div className="flex flex-col gap-3 pb-5">
              {data?.missions?.map((m: any) => (
                <div key={m.id} className="bg-white border border-[#EAEAEA] rounded-[14px] p-4" style={{ opacity: m.isCompleted ? 0.6 : 1 }}>
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-[15px] font-extrabold text-[#111] m-0 mb-1">{m.title}</h3>
                      <p className="text-xs text-[#888] m-0 leading-[1.4]">{m.description}</p>
                    </div>
                    {m.isCompleted ? (
                      <div className="bg-[#4CAF50] text-white text-[10px] font-extrabold px-2 py-1 rounded-[6px]">COMPLETADA</div>
                    ) : (
                      <div className="bg-[#FFE8F0] text-[#E91E63] text-[10px] font-extrabold px-2 py-1 rounded-[6px]">+{m.rewardHops} HOPS</div>
                    )}
                  </div>
                  
                  {!m.isCompleted && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-bold text-[#AAA] mb-1">
                        <span>Progreso</span>
                        <span>{m.progressValue} / {m.conditionTarget}</span>
                      </div>
                      <div className="h-[6px] bg-[#F0F0F0] rounded-full overflow-hidden">
                        <div className="h-full bg-[#E91E63] rounded-full" style={{ width: `${Math.min((m.progressValue / m.conditionTarget) * 100, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* BADGES TAB */}
          {activeTab === 'BADGES' && (
            <div className="grid grid-cols-3 gap-3 pb-5">
              {data?.achievements?.map((ach: any) => (
                <div key={ach.id} className="bg-white border border-[#EAEAEA] rounded-[14px] px-2 py-4 flex flex-col items-center text-center" style={{ filter: ach.unlocked ? 'none' : 'grayscale(100%)', opacity: ach.unlocked ? 1 : 0.4 }}>
                  <div className="text-[32px] mb-2">{ach.iconUrl}</div>
                  <h4 className="text-[11px] font-extrabold text-[#111] m-0 mb-1 leading-[1.1]">{ach.name}</h4>
                </div>
              ))}
            </div>
          )}

        </motion.div>
      )}
    </ProfileSubpageLayout>
  );
}
