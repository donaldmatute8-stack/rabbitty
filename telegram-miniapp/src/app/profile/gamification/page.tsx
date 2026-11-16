'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useAuth } from '@/features/auth/AuthProvider';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';
import { Trophy } from 'lucide-react';
import { PremiumHero } from '@/components/premium/PremiumUI';

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

interface MembershipMissionItem {
  id: string;
  title: string;
  hint: string;
  progress: number;
  target: number;
  done: boolean;
  badge: { id: string; label: string; color: string };
  reward?: { label: string; description: string | null } | null;
}

interface MembershipMissionsBlock {
  subscriptionId: string;
  businessName: string;
  planName: string;
  tier: 'BRONZE' | 'SILVER' | 'GOLD';
  missions: MembershipMissionItem[];
  badgesEarned: Array<{ id: string; label: string; color: string }>;
}

interface GamificationData {
  hops: number;
  level?: LevelInfo;
  missions?: MissionItem[];
  achievements?: AchievementItem[];
  membershipMissions?: MembershipMissionsBlock[];
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
          
          <PremiumHero
            icon={Trophy}
            eyebrow="IDENTIDAD Y LOGROS"
            title={data?.level?.name || 'Rabbitter Novato'}
            subtitle={`Nivel ${data?.level?.level || 1} · ${data?.hops || 0} Hops`}
          >
            <div>
              <div className="flex justify-between text-[11px] font-semibold text-white/45 mb-1.5">
                <span>Progreso a siguiente rango</span>
                <span className="font-mono text-white/70">{data?.hops || 0} / {data?.level?.nextLevelHops || 100} HOPS</span>
              </div>
              <div className="h-2 rounded-full bg-white/10 p-0.5">
                <div
                  className="h-full rounded-full bg-linear-to-r from-[#E91E63] to-[#FF4081] shadow-[0_0_10px_#E91E63] transition-all duration-500"
                  style={{ width: `${Math.min(((data?.hops || 0) / (data?.level?.nextLevelHops || 100)) * 100, 100)}%` }}
                />
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-white/45">Saltos (Hops)</p>
                <p className="text-lg font-black text-white">{data?.hops || 0}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2">
                <p className="text-[9px] font-black uppercase tracking-wider text-white/45">Multiplicador Bunz</p>
                <p className="text-lg font-black text-[#FF5FA8]">x{data?.level?.bunzMultiplier || '1.0'}</p>
              </div>
            </div>
          </PremiumHero>

          {/* Tabs */}
          <div className="mt-4 flex bg-(--bg-subtle) border border-(--border-subtle) rounded-xl p-1 mb-5">
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
              {(data?.membershipMissions?.length ?? 0) > 0 && (
                <div className="rounded-3xl border border-(--border-subtle) bg-(--bg-elevated) p-4">
                  <div className="mb-3">
                    <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em] text-[#E91E63]">Lealtad en tus membresías</p>
                    <p className="m-0 mt-0.5 text-[11px] text-(--text-muted)">Insignias de reconocimiento · no dan Bunz</p>
                  </div>

                  {(data?.membershipMissions ?? []).map((block) => {
                    const tierLabel = block.tier === 'GOLD' ? 'Oro' : block.tier === 'SILVER' ? 'Plata' : 'Bronce';
                    const tierColor = block.tier === 'GOLD' ? '#FFD166' : block.tier === 'SILVER' ? '#A8B3C1' : '#C97B4A';
                    return (
                      <div key={block.subscriptionId} className="mb-3 last:mb-0">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="truncate text-[12.5px] font-black text-(--text-primary)">{block.businessName}</span>
                          <span
                            className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                            style={{ color: tierColor, background: `${tierColor}1f`, border: `1px solid ${tierColor}44` }}
                          >
                            {tierLabel}
                          </span>
                          {block.badgesEarned.length > 0 && (
                            <span className="ml-auto text-[10px] font-bold text-(--text-muted)">
                              {block.badgesEarned.length} insignia{block.badgesEarned.length === 1 ? '' : 's'}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-col gap-2">
                          {block.missions.map((mission) => {
                            const pct = Math.min(100, Math.round((mission.progress / mission.target) * 100));
                            return (
                              <div key={mission.id} className="rounded-2xl border border-(--border-subtle) bg-(--bg-primary) p-2.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-[11.5px] font-bold text-(--text-primary)">{mission.title}</span>
                                  <span className="shrink-0 text-[10.5px] font-black tabular-nums text-(--text-muted)">
                                    {mission.progress}/{mission.target}
                                  </span>
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-(--bg-elevated)">
                                  <div
                                    className="h-full rounded-full"
                                    style={{
                                      width: `${pct}%`,
                                      background: mission.done
                                        ? `linear-gradient(90deg, ${mission.badge.color} 0%, ${mission.badge.color}aa 100%)`
                                        : 'linear-gradient(90deg, #A855F7 0%, #E91E63 100%)',
                                    }}
                                  />
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                  {mission.done && (
                                    <span
                                      className="rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider"
                                      style={{ color: mission.badge.color, background: `${mission.badge.color}1f`, border: `1px solid ${mission.badge.color}44` }}
                                    >
                                      {mission.badge.label}
                                    </span>
                                  )}
                                  {mission.reward && (
                                    <span
                                      className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-black text-amber-300"
                                      title={mission.reward.description ?? undefined}
                                    >
                                      🎁 {mission.reward.label}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

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
