'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';

export default function GamificationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MISSIONS' | 'BADGES'>('MISSIONS');

  useEffect(() => {
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/gamification`, { headers }))
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
          <div className="bg-gradient-to-br from-[#1A1028] via-[#120D1A] to-[#0A0710] border border-white/10 rounded-2xl p-5 mb-5 relative overflow-hidden shadow-xl">
            <div className="absolute -top-5 -right-5 text-[100px] opacity-10 select-none">🐰</div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#E91E63] font-black text-xs uppercase tracking-[1.5px]">Rango de Explorador</span>
              <span className="bg-[#E91E63]/20 border border-[#E91E63]/40 text-[#F48FB1] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Nivel {data?.level?.level || 1}
              </span>
            </div>
            
            <h2 className="text-white text-[26px] font-black m-0 mb-4 tracking-tight">{data?.level?.name || 'Rabbitter Novato'}</h2>
            
            {/* XP progress bar toward next rank */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-white/60 font-semibold mb-1.5">
                <span>Progreso a siguiente rango</span>
                <span className="text-white font-mono">{data?.hops || 0} / {data?.level?.nextLevelHops || 100} HOPS</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-[#E91E63] to-[#FF4081] rounded-full transition-all duration-500 shadow-[0_0_10px_#E91E63]" 
                  style={{ width: `${Math.min(((data?.hops || 0) / (data?.level?.nextLevelHops || 100)) * 100, 100)}%` }} 
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl">
                <p className="text-white/50 text-[11px] font-semibold m-0 mb-1">Saltos (Hops)</p>
                <p className="text-white text-xl font-extrabold m-0 tracking-tight">{data?.hops || 0}</p>
              </div>
              <div className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl">
                <p className="text-white/50 text-[11px] font-semibold m-0 mb-1">Multiplicador Bunz</p>
                <p className="text-[#E91E63] text-xl font-extrabold m-0 tracking-tight">x{data?.level?.bunzMultiplier || '1.0'}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-[#161622] border border-white/10 rounded-xl p-1 mb-5">
            <button 
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveTab('MISSIONS');
              }}
              className="flex-1 py-[10px] border-none rounded-[10px] text-[13px] font-extrabold cursor-pointer transition-all"
              style={{
                backgroundColor: activeTab === 'MISSIONS' ? '#E91E63' : 'transparent',
                color: activeTab === 'MISSIONS' ? '#fff' : 'rgba(255,255,255,0.6)',
                boxShadow: activeTab === 'MISSIONS' ? '0 2px 10px rgba(233,30,99,0.3)' : 'none',
              }}
            >
              Misiones
            </button>
            <button 
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveTab('BADGES');
              }}
              className="flex-1 py-[10px] border-none rounded-[10px] text-[13px] font-extrabold cursor-pointer transition-all"
              style={{
                backgroundColor: activeTab === 'BADGES' ? '#E91E63' : 'transparent',
                color: activeTab === 'BADGES' ? '#fff' : 'rgba(255,255,255,0.6)',
                boxShadow: activeTab === 'BADGES' ? '0 2px 10px rgba(233,30,99,0.3)' : 'none',
              }}
            >
              Insignias
            </button>
          </div>

          {/* MISSIONS TAB */}
          {activeTab === 'MISSIONS' && (
            <div className="flex flex-col gap-3 pb-5">
              {data?.missions?.map((m: any) => (
                <div key={m.id} className="bg-[#161622] border border-white/10 rounded-[16px] p-4 shadow-md transition-all" style={{ opacity: m.isCompleted ? 0.6 : 1 }}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="pr-2">
                      <h3 className="text-[15px] font-extrabold text-white m-0 mb-1">{m.title}</h3>
                      <p className="text-xs text-white/60 m-0 leading-[1.4]">{m.description}</p>
                    </div>
                    {m.isCompleted ? (
                      <div className="bg-[#10B981]/20 border border-[#10B981]/40 text-[#34D399] text-[10px] font-extrabold px-2 py-1 rounded-[6px] shrink-0">
                        COMPLETADA ✓
                      </div>
                    ) : (
                      <div className="bg-[#E91E63]/15 border border-[#E91E63]/30 text-[#F472B6] text-[10px] font-extrabold px-2 py-1 rounded-[6px] shrink-0">
                        +{m.rewardHops} HOPS
                      </div>
                    )}
                  </div>
                  
                  {!m.isCompleted && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-bold text-white/50 mb-1">
                        <span>Progreso de objetivo</span>
                        <span className="font-mono text-white/70">{m.progressValue} / {m.conditionTarget}</span>
                      </div>
                      <div className="h-[6px] bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#E91E63] to-[#FF4081] rounded-full" style={{ width: `${Math.min((m.progressValue / m.conditionTarget) * 100, 100)}%` }} />
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
                <div 
                  key={ach.id} 
                  className="bg-[#161622] border border-white/10 rounded-[16px] px-2 py-4 flex flex-col items-center text-center shadow-md"
                  style={{ 
                    filter: ach.unlocked ? 'none' : 'grayscale(100%)', 
                    opacity: ach.unlocked ? 1 : 0.35,
                    borderColor: ach.unlocked ? 'rgba(233,30,99,0.3)' : 'rgba(255,255,255,0.08)' 
                  }}
                >
                  <div className="text-[36px] mb-2 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">{ach.iconUrl}</div>
                  <h4 className="text-[12px] font-extrabold text-white m-0 mb-1 leading-[1.2]">{ach.name}</h4>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                    {ach.unlocked ? 'Desbloqueado' : 'Bloqueado'}
                  </span>
                </div>
              ))}
            </div>
          )}

        </motion.div>
      )}
    </ProfileSubpageLayout>
  );
}
