'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  
  const [levels, setLevels] = useState<any[]>([]);
  const [tricks, setTricks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewTrickForm, setShowNewTrickForm] = useState(false);
  const [newTrick, setNewTrick] = useState({ title: '', description: '', rewardHops: '100', rewardBunz: '50', conditionType: 'TOTAL_VISITS', conditionTarget: '1' });

  useEffect(() => {
    fetch('/api/admin/gamification', {
      headers: { 'X-Telegram-Id': user?.telegramId || '' }
    })
    .then(res => res.json())
    .then(data => {
      if (data.levels) setLevels(data.levels);
      if (data.tricks) setTricks(data.tricks);
      setLoading(false);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [user]);

  const handleCreateTrick = async () => {
    try {
      const res = await fetch('/api/admin/gamification', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Telegram-Id': user?.telegramId || ''
        },
        body: JSON.stringify({ action: 'CREATE_TRICK', payload: newTrick })
      });
      const data = await res.json();
      if (data.success) {
        setTricks([data.trick, ...tricks]);
        setShowNewTrickForm(false);
        showToast('Misión creada exitosamente', 'success');
        setNewTrick({ title: '', description: '', rewardHops: '100', rewardBunz: '50', conditionType: 'TOTAL_VISITS', conditionTarget: '1' });
      } else {
        showToast('Error al crear misión', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  };

  // Double check security
  if (user?.telegramId !== "798431743") {
    return null;
  }

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      {/* Click outside to close */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} onClick={onClose} />
      
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        style={{
          backgroundColor: '#fff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          padding: '24px',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
          position: 'relative',
          maxHeight: '90vh',
          overflowY: 'auto'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 900, color: '#111', margin: 0 }}>Panel de Control <span style={{ color: '#E91E63' }}>God Mode</span></h2>
          <button 
            onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F0F0', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round"><path d="M1 1l12 12M1 13L13 1" /></svg>
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
            Bienvenido. Desde aquí puedes modificar la economía de Hops, Bunz y crear nuevos "Trucos del Sombrero" (Misiones) en tiempo real.
          </p>
        </div>

        {/* SECTION: GAMIFICATION */}
        <div style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #EAEAEA', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px 0' }}>🪄 Trucos del Sombrero ({tricks.length})</h3>
          
          {showNewTrickForm ? (
            <div style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, border: '1px solid #EEE', marginBottom: 16 }}>
              <input value={newTrick.title} onChange={e => setNewTrick({...newTrick, title: e.target.value})} placeholder="Título" style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: '1px solid #CCC' }} />
              <input value={newTrick.description} onChange={e => setNewTrick({...newTrick, description: e.target.value})} placeholder="Descripción" style={{ width: '100%', marginBottom: 8, padding: 8, borderRadius: 6, border: '1px solid #CCC' }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input value={newTrick.rewardHops} onChange={e => setNewTrick({...newTrick, rewardHops: e.target.value})} placeholder="Recompensa Hops" type="number" style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #CCC' }} />
                <input value={newTrick.rewardBunz} onChange={e => setNewTrick({...newTrick, rewardBunz: e.target.value})} placeholder="Recompensa Bunz" type="number" style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #CCC' }} />
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={newTrick.conditionType} onChange={e => setNewTrick({...newTrick, conditionType: e.target.value})} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #CCC', backgroundColor: '#fff' }}>
                  <option value="TOTAL_VISITS">Total Consumos</option>
                  <option value="CATEGORY_VISITS">Consumos Categoria</option>
                  <option value="REFERRALS_COUNT">Referidos</option>
                  <option value="RESERVATIONS">Reservas Stock</option>
                </select>
                <input value={newTrick.conditionTarget} onChange={e => setNewTrick({...newTrick, conditionTarget: e.target.value})} placeholder="Meta (ej: 5)" type="number" style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #CCC' }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={handleCreateTrick} style={{ flex: 1, backgroundColor: '#E91E63', color: '#fff', padding: 8, borderRadius: 6, border: 'none', fontWeight: 700 }}>Guardar</button>
                <button onClick={() => setShowNewTrickForm(false)} style={{ flex: 1, backgroundColor: '#EEE', color: '#111', padding: 8, borderRadius: 6, border: 'none', fontWeight: 700 }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowNewTrickForm(true)} style={{ width: '100%', backgroundColor: '#111', color: '#fff', padding: '12px', borderRadius: 10, border: 'none', fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
              + Nueva Misión (Truco)
            </button>
          )}

          <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tricks.slice(0, 5).map((t: any) => (
              <div key={t.id} style={{ backgroundColor: '#fff', padding: 10, borderRadius: 8, border: '1px solid #EEE' }}>
                <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800 }}>{t.title}</p>
                <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Recompensa: {t.rewardHops} Hops | {t.rewardBunz} Bunz</p>
              </div>
            ))}
            {tricks.length > 5 && <p style={{ fontSize: 11, textAlign: 'center', color: '#AAA' }}>Y {tricks.length - 5} más...</p>}
          </div>
        </div>

        {/* SECTION: LEVELS */}
        <div style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #EAEAEA', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px 0' }}>📈 Niveles y Multiplicadores</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {loading ? <p>Cargando...</p> : levels.map((l: any) => (
              <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', border: '1px solid #EEE', borderRadius: 8, padding: 10 }}>
                <div>
                  <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 800 }}>{l.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#888' }}>Hops req: {l.requiredHops}</p>
                </div>
                <div style={{ backgroundColor: '#E91E63', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 800 }}>
                  x{l.bunzMultiplier}
                </div>
              </div>
            ))}
          </div>
        </div>

      </motion.div>
    </div>
  );
}
