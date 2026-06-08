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
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>Cargando madriguera...</div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          
          {/* Header Stats */}
          <div style={{ backgroundColor: '#111', borderRadius: 16, padding: 20, marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -20, right: -20, fontSize: 100, opacity: 0.1 }}>🐰</div>
            
            <p style={{ color: '#E91E63', fontWeight: 900, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' }}>Rango Actual</p>
            <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 900, margin: '0 0 16px' }}>{data?.level?.name || 'Rabbitter Novato'}</h2>
            
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12 }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '0 0 4px' }}>Saltos (Hops)</p>
                <p style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>{data?.hops || 0}</p>
              </div>
              <div style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', padding: 12, borderRadius: 12 }}>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: '0 0 4px' }}>Bonus de Bunz</p>
                <p style={{ color: '#E91E63', fontSize: 18, fontWeight: 800, margin: 0 }}>x{data?.level?.bunzMultiplier || '1.0'}</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', backgroundColor: '#F4F4F4', borderRadius: 12, padding: 4, marginBottom: 20 }}>
            <button 
              onClick={() => setActiveTab('MISSIONS')}
              style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, backgroundColor: activeTab === 'MISSIONS' ? '#fff' : 'transparent', color: activeTab === 'MISSIONS' ? '#111' : '#888', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: activeTab === 'MISSIONS' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}
            >
              Misiones
            </button>
            <button 
              onClick={() => setActiveTab('BADGES')}
              style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 10, backgroundColor: activeTab === 'BADGES' ? '#fff' : 'transparent', color: activeTab === 'BADGES' ? '#111' : '#888', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: activeTab === 'BADGES' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}
            >
              Insignias
            </button>
          </div>

          {/* MISSIONS TAB */}
          {activeTab === 'MISSIONS' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
              {data?.missions?.map((m: any) => (
                <div key={m.id} style={{ backgroundColor: '#fff', border: '1px solid #EAEAEA', borderRadius: 14, padding: 16, opacity: m.isCompleted ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 4px' }}>{m.title}</h3>
                      <p style={{ fontSize: 12, color: '#888', margin: 0, lineHeight: 1.4 }}>{m.description}</p>
                    </div>
                    {m.isCompleted ? (
                      <div style={{ backgroundColor: '#4CAF50', color: '#fff', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6 }}>COMPLETADA</div>
                    ) : (
                      <div style={{ backgroundColor: '#FFE8F0', color: '#E91E63', fontSize: 10, fontWeight: 800, padding: '4px 8px', borderRadius: 6 }}>+{m.rewardHops} HOPS</div>
                    )}
                  </div>
                  
                  {!m.isCompleted && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 700, color: '#AAA', marginBottom: 4 }}>
                        <span>Progreso</span>
                        <span>{m.progressValue} / {m.conditionTarget}</span>
                      </div>
                      <div style={{ height: 6, backgroundColor: '#F0F0F0', borderRadius: 100, overflow: 'hidden' }}>
                        <div style={{ height: '100%', backgroundColor: '#E91E63', borderRadius: 100, width: `${Math.min((m.progressValue / m.conditionTarget) * 100, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* BADGES TAB */}
          {activeTab === 'BADGES' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, paddingBottom: 20 }}>
              {data?.achievements?.map((ach: any) => (
                <div key={ach.id} style={{ backgroundColor: '#fff', border: '1px solid #EAEAEA', borderRadius: 14, padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', filter: ach.unlocked ? 'none' : 'grayscale(100%)', opacity: ach.unlocked ? 1 : 0.4 }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>{ach.iconUrl}</div>
                  <h4 style={{ fontSize: 11, fontWeight: 800, color: '#111', margin: '0 0 4px', lineHeight: 1.1 }}>{ach.name}</h4>
                </div>
              ))}
            </div>
          )}

        </motion.div>
      )}
    </ProfileSubpageLayout>
  );
}
