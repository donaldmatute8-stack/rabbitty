'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';

interface LevelInfo {
  level: number;
  name: string;
  nextLevelHops: number;
  bunzMultiplier: number | string;
}

interface MissionItem {
  id: string;
  title: string;
  description: string;
  isCompleted: boolean;
  rewardHops: number;
  progressValue: number;
  conditionTarget: number;
}

interface AchievementItem {
  id: string;
  name: string;
  iconUrl?: string;
  unlocked: boolean;
}

interface GamificationData {
  hops: number;
  level?: LevelInfo;
  missions?: MissionItem[];
  achievements?: AchievementItem[];
}

const ACHIEVEMENT_EMOJI: Record<string, string> = {
  '/icons/first-visit.png': '🐰',
  '/icons/collector.png': '🏅',
  '/icons/bunz-master.png': '👑',
};

function AchievementIcon({ iconUrl, name }: { iconUrl?: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const isPath = !!iconUrl && (iconUrl.startsWith('/') || iconUrl.startsWith('http'));

  if (isPath && !failed) {
    return (
      <Image
        src={iconUrl}
        alt={name}
        width={40}
        height={40}
        unoptimized
        onError={() => setFailed(true)}
        className="w-10 h-10 object-contain"
      />
    );
  }

  const emoji = !isPath && iconUrl ? iconUrl : (ACHIEVEMENT_EMOJI[iconUrl ?? ''] ?? '🏆');
  return <span className="text-[32px]">{emoji}</span>;
}

export default function GamificationPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [data, setData] = useState<GamificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'MISSIONS' | 'BADGES'>('MISSIONS');

  const loadGamification = useCallback(() => {
    if (!user?.id) return;
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
  }, [user?.id, showToast]);

  useEffect(() => {
    loadGamification();
  }, [loadGamification]);

  return (
    <ProfileSubpageLayout title="Identidad y Logros" showBack={true}>
      {loading ? (
        <div className="text-center px-5 py-10 text-[#888]">Cargando madriguera...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          
          {/* Header Stats */}
          <div className="bg-(--bg-elevated) border border-(--border-subtle) rounded-2xl p-5 mb-5 relative overflow-hidden shadow-sm">
            <div className="absolute -top-5 -right-5 text-[100px] opacity-10 select-none text-(--text-primary)">🐰</div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#E91E63] font-black text-xs uppercase tracking-[1.5px]">Rango de Explorador</span>
              <span className="bg-[#E91E63]/15 border border-[#E91E63]/30 text-[#E91E63] text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                Nivel {data?.level?.level || 1}
              </span>
            </div>
            
            <h2 className="text-(--text-primary) text-[26px] font-black m-0 mb-4 tracking-tight">{data?.level?.name || 'Rabbitter Novato'}</h2>
            
            {/* XP progress bar toward next rank */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-(--text-muted) font-semibold mb-1.5">
                <span>Progreso a siguiente rango</span>
                <span className="text-(--text-primary) font-mono">{data?.hops || 0} / {data?.level?.nextLevelHops || 100} HOPS</span>
              </div>
              <div className="h-2 bg-(--bg-subtle) rounded-full overflow-hidden p-0.5 border border-(--border-subtle)">
                <div 
                  className="h-full bg-linear-to-r from-[#E91E63] to-[#FF4081] rounded-full transition-all duration-500 shadow-[0_0_10px_#E91E63]" 
                  style={{ width: `${Math.min(((data?.hops || 0) / (data?.level?.nextLevelHops || 100)) * 100, 100)}%` }} 
                />
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1 bg-(--bg-subtle) border border-(--border-subtle) p-3 rounded-xl">
                <p className="text-(--text-muted) text-[11px] font-semibold m-0 mb-1">Saltos (Hops)</p>
                <p className="text-(--text-primary) text-xl font-extrabold m-0 tracking-tight">{data?.hops || 0}</p>
              </div>
              <div className="flex-1 bg-(--bg-subtle) border border-(--border-subtle) p-3 rounded-xl">
                <p className="text-(--text-muted) text-[11px] font-semibold m-0 mb-1">Multiplicador Bunz</p>
                <p className="text-[#E91E63] text-xl font-extrabold m-0 tracking-tight">x{data?.level?.bunzMultiplier || '1.0'}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex bg-(--bg-subtle) border border-(--border-subtle) rounded-xl p-1 mb-5">
            <button 
              onClick={() => {
                PlatformBridge.hapticFeedback('light');
                setActiveTab('MISSIONS');
              }}
              className="flex-1 py-2.5 border-none rounded-[10px] text-[13px] font-extrabold cursor-pointer transition-all"
              style={{
                backgroundColor: activeTab === 'MISSIONS' ? '#E91E63' : 'transparent',
                color: activeTab === 'MISSIONS' ? '#fff' : 'var(--text-muted)',
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
              className="flex-1 py-2.5 border-none rounded-[10px] text-[13px] font-extrabold cursor-pointer transition-all"
              style={{
                backgroundColor: activeTab === 'BADGES' ? '#E91E63' : 'transparent',
                color: activeTab === 'BADGES' ? '#fff' : 'var(--text-muted)',
                boxShadow: activeTab === 'BADGES' ? '0 2px 10px rgba(233,30,99,0.3)' : 'none',
              }}
            >
              Insignias
            </button>
          </div>

          {/* MISSIONS TAB */}
          {activeTab === 'MISSIONS' && (
            <div className="flex flex-col gap-3 pb-5">
              {data?.missions?.map((m) => (
                <div key={m.id} className="bg-(--bg-elevated) border border-(--border-subtle) rounded-2xl p-4 shadow-sm transition-all" style={{ opacity: m.isCompleted ? 0.6 : 1 }}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="pr-2">
                      <h3 className="text-[15px] font-extrabold text-(--text-primary) m-0 mb-1">{m.title}</h3>
                      <p className="text-xs text-(--text-muted) m-0 leading-[1.4]">{m.description}</p>
                    </div>
                    {m.isCompleted ? (
                      <div className="bg-[#10B981]/20 border border-[#10B981]/40 text-[#10B981] text-[10px] font-extrabold px-2 py-1 rounded-md shrink-0">
                        COMPLETADA ✓
                      </div>
                    ) : (
                      <div className="bg-[#E91E63]/15 border border-[#E91E63]/30 text-[#E91E63] text-[10px] font-extrabold px-2 py-1 rounded-md shrink-0">
                        +{m.rewardHops} HOPS
                      </div>
                    )}
                  </div>
                  
                  {!m.isCompleted && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[11px] font-bold text-(--text-muted) mb-1">
                        <span>Progreso de objetivo</span>
                        <span className="font-mono text-(--text-primary)">{m.progressValue} / {m.conditionTarget}</span>
                      </div>
                      <div className="h-1.5 bg-(--bg-subtle) rounded-full overflow-hidden border border-(--border-subtle)">
                        <div className="h-full bg-linear-to-r from-[#E91E63] to-[#FF4081] rounded-full" style={{ width: `${Math.min((m.progressValue / m.conditionTarget) * 100, 100)}%` }} />
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
              {data?.achievements?.map((ach) => (
                <div 
                  key={ach.id} 
                  className="bg-(--bg-elevated) border rounded-2xl px-2 py-4 flex flex-col items-center text-center shadow-sm"
                  style={{ 
                    filter: ach.unlocked ? 'none' : 'grayscale(100%)', 
                    opacity: ach.unlocked ? 1 : 0.45,
                    borderColor: ach.unlocked ? 'rgba(233,30,99,0.35)' : 'var(--border-subtle)' 
                  }}
                >
                  <div className="relative w-12 h-12 flex items-center justify-center mb-2 drop-shadow-sm">
                    <AchievementIcon iconUrl={ach.iconUrl} name={ach.name} />
                  </div>
                  <h4 className="text-[12px] font-extrabold text-(--text-primary) m-0 mb-1 leading-[1.2]">{ach.name}</h4>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-(--text-muted)">
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
