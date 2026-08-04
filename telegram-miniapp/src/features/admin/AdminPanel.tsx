'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

  // Settings state
  const [freeRegistration, setFreeRegistration] = useState(true);
  const [registrationFee, setRegistrationFee] = useState(5000);
  const [loadingSettings, setLoadingSettings] = useState(true);

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

  useEffect(() => {
    fetch('/api/admin/settings', {
      headers: { 'X-Telegram-Id': user?.telegramId || '' }
    })
    .then(res => res.json())
    .then(data => {
      if (data.settings) {
        setFreeRegistration(data.settings.free_registration !== 'false');
        setRegistrationFee(parseInt(data.settings.registration_fee) || 5000);
      }
      setLoadingSettings(false);
    })
    .catch(() => setLoadingSettings(false));
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
          padding: '24px',
          paddingTop: 'calc(max(var(--safe-top, 0px), 84px) + 24px)',
          paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
          position: 'relative',
          height: '100vh',
          width: '100%',
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

        {/* SECTION: OMNICHANNEL DRIP METRICS */}
        <div style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #EAEAEA', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px 0' }}>📊 Métricas Omnicanal & Drip Campaigns</h3>
          <RoleMetricsSection />
        </div>

        {/* SECTION: BUSINESS APPROVALS */}
        <div style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #EAEAEA', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px 0' }}>🏪 Aprobación de Negocios</h3>
          <BusinessApprovals />
        </div>

        {/* SECTION: SYSTEM SETTINGS */}
        <div style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #EAEAEA', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px 0' }}>⚙️ Configuración del Sistema</h3>
          {loadingSettings ? (
            <p style={{ fontSize: 12, color: '#888' }}>Cargando...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px', color: '#333' }}>Registro gratuito</p>
                  <p style={{ fontSize: 11, color: '#888', margin: 0 }}>
                    {freeRegistration ? 'Negocios entran sin costo' : 'Se cobra cuota en Bunz'}
                  </p>
                </div>
                <button
                  onClick={async () => {
                    const newVal = !freeRegistration;
                    await fetch('/api/admin/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'X-Telegram-Id': user?.telegramId || '' },
                      body: JSON.stringify({ key: 'free_registration', value: String(newVal) }),
                    });
                    setFreeRegistration(newVal);
                    showToast(`Registro ${newVal ? 'gratuito' : 'con cuota'} activado`, 'success');
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    background: freeRegistration ? '#22C55E' : '#EF4444', color: '#fff',
                    fontSize: 12, fontWeight: 800,
                  }}
                >
                  {freeRegistration ? 'GRATIS' : 'CON CUOTA'}
                </button>
              </div>

              {!freeRegistration && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 2px', color: '#333' }}>Cuota (Bunz)</p>
                    <p style={{ fontSize: 11, color: '#888', margin: 0 }}>Valor actual: {registrationFee.toLocaleString()} Bunz</p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input
                      type="number" value={registrationFee}
                      onChange={e => setRegistrationFee(Number(e.target.value))}
                      style={{ width: 80, padding: '6px 8px', borderRadius: 6, border: '1px solid #CCC', fontSize: 12, textAlign: 'center' }}
                    />
                    <button
                      onClick={async () => {
                        await fetch('/api/admin/settings', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'X-Telegram-Id': user?.telegramId || '' },
                          body: JSON.stringify({ key: 'registration_fee', value: String(registrationFee) }),
                        });
                        showToast(`Cuota actualizada a ${registrationFee.toLocaleString()} Bunz`, 'success');
                      }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#111', color: '#fff', fontSize: 11, fontWeight: 700 }}
                    >
                      Guardar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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

        {/* SECTION: SCALING DASHBOARD */}
        <div style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #EAEAEA', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: '0 0 12px 0' }}>📊 Estado de Escalado</h3>
          <ScalingDashboard />
        </div>

        {/* SECTION: SCALING GUIDE TOGGLE */}
        <ScalingGuide />

      </motion.div>
    </div>
  );
}

function ScalingDashboard() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alertSent, setAlertSent] = useState(false);
  const { showToast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetch('/api/admin/scaling', {
      headers: { 'X-Telegram-Id': user?.telegramId || '' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.metrics) setMetrics(data.metrics);
        if (data.alertTriggered) setAlertSent(true);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  if (loading) return <p style={{ fontSize: 13, color: '#888' }}>Cargando metricas...</p>;

  const getColor = (pct: number) => {
    if (pct >= 90) return '#E91E63';
    if (pct >= 80) return '#FF6B35';
    if (pct >= 60) return '#FFB800';
    return '#22C55E';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {alertSent && (
        <div style={{ backgroundColor: '#FFF3E0', border: '1px solid #FFB800', borderRadius: 8, padding: 8, fontSize: 12, color: '#E65100', fontWeight: 700 }}>
          🚨 Alerta enviada a @mardelbull
        </div>
      )}
      {metrics.map((m: any) => (
        <div key={m.key}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>{m.icon} {m.label}</span>
            <span style={{ fontSize: 12, color: getColor(m.pct), fontWeight: 800 }}>
              {m.value} / {m.max} {m.unit} ({m.pct.toFixed(0)}%)
            </span>
          </div>
          <div style={{ width: '100%', height: 8, backgroundColor: '#E0E0E0', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${m.pct}%`,
              height: '100%',
              backgroundColor: getColor(m.pct),
              borderRadius: 4,
              transition: 'width 0.5s ease'
            }} />
          </div>
          {m.pct >= 80 && (
            <p style={{ margin: '4px 0 0', fontSize: 10, color: '#E65100', fontWeight: 700 }}>
              ⚠️ Umbral de escalado alcanzado
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

function ScalingGuide() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();

  if (user?.telegramId !== "798431743") return null;

  return (
    <div style={{ backgroundColor: '#FAFAFA', borderRadius: 14, padding: 16, border: '1px solid #EAEAEA', marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#111', margin: 0 }}>🚀 Guia de Escalado</h3>
        <span style={{ fontSize: 18, color: '#666', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {open && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <GuideItem
            icon="🟢"
            title="0-60% — Stack actual suficiente"
            desc="Rabbitty funciona bien con Railway + Neon Free. No necesitas cambios."
          />
          <GuideItem
            icon="🟡"
            title="60-80% — Monitorear"
            desc="Comienza a planificar. Considera: optimizar queries, agregar indices en DB, cachear con Redis."
          />
          <GuideItem
            icon="🟠"
            title="80-90% — Preparar migracion"
            desc="Es hora de escalar. Opciones recomendadas:"
            bullets={[
              "Hetzer CX22 (€4/mes) + Coolify — mejor precio/performance",
              "Upgrade Railway a plan Pro ($5-20/mes)",
              "Migrar Neon a PostgreSQL dedicado en el VPS",
              "Agregar Redis para cache y sesiones",
            ]}
          />
          <GuideItem
            icon="🔴"
            title="90-100% — Escalar YA"
            desc="Accion inmediata recomendada:"
            bullets={[
              "Hetzer CX32 (€7/mes) o CX42 (€14/mes)",
              "Separar DB en VPS dedicado (CX22 solo para DB)",
              "Balanceador de carga si hay +500 usuarios concurrentes",
              "CDN para assets estaticos (Cloudflare free)",
            ]}
          />
          <GuideItem
            icon="🛡️"
            title="Seguridad Sistémica (Próxima Escala)"
            desc="Reforzamientos recomendados antes de alcanzar el 80-90% de escala para mitigar vectores de ataque avanzados:"
            bullets={[
              "BFF Pattern: Migrar JWT de localStorage a cookies HTTP-Only seguras (protección contra XSS).",
              "Protección CSRF: Implementar tokens anti-CSRF en endpoints de mutación sensibles.",
              "CSP Estricta: Configurar Content-Security-Policy estricta sin unsafe-eval/inline en producción.",
              "Smart Contracts (Bunz): Realizar auditoría y deploy formal en blockchain (con límites de emisión y control de pausa).",
            ]}
          />
          <div style={{ backgroundColor: '#F3E8FF', border: '1px solid #D8B4FE', borderRadius: 10, padding: 12, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#6B21A8', fontWeight: 700, lineHeight: 1.5 }}>
              💡 Recomendacion personal:apenas cruces 60% en usuarios, migra a Hetzner CX22 con Coolify.
              Es €4/mes, 2GB RAM, SSD NVMe. PostgreSQL ahi mismo. Escalas a CX32 cuando llegues a 80%.
              Railway es comodo para empezar pero caro al escalar.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function GuideItem({ icon, title, desc, bullets }: { icon: string; title: string; desc: string; bullets?: string[] }) {
  return (
    <div style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, border: '1px solid #EEE' }}>
      <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 800, color: '#111' }}>{icon} {title}</p>
      <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.5 }}>{desc}</p>
      {bullets && (
        <ul style={{ margin: '6px 0 0', paddingLeft: 16, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
          {bullets.map((b, i) => <li key={i}>{b}</li>)}
        </ul>
      )}
    </div>
  );
}

function BusinessApprovals() {
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('PENDING');
  const { user } = useAuth();
  const { showToast } = useToast();

  const fetchBusinesses = () => {
    setLoading(true);
    fetch(`/api/admin/business?t=${Date.now()}`, {
      headers: { 'X-Telegram-Id': user?.telegramId || '' },
      cache: 'no-store'
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) setBusinesses(data.businesses || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBusinesses(); }, [user]);

  const handleAction = async (businessId: string, status: string) => {
    try {
      const res = await fetch('/api/admin/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Telegram-Id': user?.telegramId || '' },
        body: JSON.stringify({ businessId, status })
      });
      const data = await res.json();
      if (data.success) {
        setBusinesses(prev => prev.map(b => b.id === businessId ? { ...b, status } : b));
        showToast(`Negocio ${status === 'APPROVED' ? 'aprobado' : status === 'REJECTED' ? 'rechazado' : 'en revisión'}`, 'success');
      } else {
        showToast('Error: ' + (data.error || 'desconocido'), 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  };

  const filtered = businesses.filter(b => 
    filter === 'ALL' || 
    b.status === filter || 
    (filter === 'PENDING' && b.status === 'PENDING_VERIFICATION')
  );

  const filters = [
    { id: 'PENDING', label: 'Pendientes' },
    { id: 'UNDER_REVIEW', label: 'En Revisión' },
    { id: 'APPROVED', label: 'Aprobados' },
    { id: 'REJECTED', label: 'Rechazados' },
    { id: 'ALL', label: 'Todos' }
  ];

  return (
    <div>
      {/* Filtros Animados Segmentados */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {filters.map(f => {
          const isActive = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                position: 'relative',
                padding: '6px 14px',
                borderRadius: 999,
                border: 'none',
                background: 'transparent',
                color: isActive ? '#fff' : '#666',
                fontSize: 12,
                fontWeight: 800,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'color 0.2s ease',
                zIndex: 1
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeFilter"
                  style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: '#111',
                    borderRadius: 999,
                    zIndex: -1
                  }}
                  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                />
              )}
              {f.label}
            </button>
          );
        })}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ width: 24, height: 24, border: '3px solid #EEE', borderTopColor: '#E91E63', borderRadius: '50%' }} />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '32px 16px', textAlign: 'center', backgroundColor: '#fff', borderRadius: 16, border: '1px dashed #DDD' }}
        >
          <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>📭</span>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#444' }}>Todo en orden</p>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#888' }}>No se encontraron negocios para este filtro.</p>
        </motion.div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AnimatePresence>
          {filtered.slice(0, 25).map((b: any) => {
            const isPending = b.status === 'PENDING' || b.status === 'PENDING_VERIFICATION';
            const isReview = b.status === 'UNDER_REVIEW';
            const isApproved = b.status === 'APPROVED';
            
            return (
              <motion.div 
                key={b.id} 
                layout
                initial={{ opacity: 0, y: 15, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                style={{ 
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  backgroundColor: '#ffffff', 
                  borderRadius: 18, 
                  padding: '16px', 
                  boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
                  border: '1px solid #EAEAEA',
                  position: 'relative',
                  overflow: 'hidden',
                  boxSizing: 'border-box',
                }}
              >
                {/* Accent line on left */}
                <div style={{ 
                  position: 'absolute', 
                  left: 0, 
                  top: 0, 
                  bottom: 0, 
                  width: 5, 
                  backgroundColor: isPending ? '#F57C00' : isReview ? '#EAB308' : isApproved ? '#22C55E' : '#EF4444' 
                }} />

                {/* Header Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, paddingLeft: 4 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: '#111827', lineHeight: 1.25 }}>{b.name || 'Sin nombre'}</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', backgroundColor: '#F3F4F6', padding: '2px 8px', borderRadius: 6 }}>{b.category || 'Comercio'}</span>
                      {b.address && <span style={{ fontSize: 11, color: '#6B7280' }}>📍 {b.address.split(',')[0]}</span>}
                    </div>
                  </div>
                  
                  {/* Badge */}
                  <div style={{ 
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px 10px', 
                    borderRadius: 8, 
                    fontSize: 10, 
                    fontWeight: 800, 
                    letterSpacing: 0.5,
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                    backgroundColor: isPending ? 'rgba(245, 124, 0, 0.1)' : isReview ? 'rgba(234, 179, 8, 0.12)' : isApproved ? 'rgba(34, 197, 94, 0.12)' : 'rgba(239, 68, 68, 0.12)', 
                    color: isPending ? '#D97706' : isReview ? '#CA8A04' : isApproved ? '#16A34A' : '#DC2626',
                    border: `1px solid ${isPending ? 'rgba(245, 124, 0, 0.25)' : isReview ? 'rgba(234, 179, 8, 0.25)' : isApproved ? 'rgba(34, 197, 94, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`
                  }}>
                    {isReview ? 'EN REVISIÓN' : b.status === 'PENDING_VERIFICATION' ? 'PENDING' : b.status}
                  </div>
                </div>

                {/* Applicant Box */}
                <div style={{ backgroundColor: '#F9FAFB', borderRadius: 12, padding: '10px 12px', paddingLeft: 12, border: '1px solid #F3F4F6', marginLeft: 4 }}>
                  <p style={{ margin: '0 0 4px', fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Solicitante</p>
                  {b.owner ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <p style={{ margin: 0, fontSize: 12, color: '#1F2937', fontWeight: 700 }}>
                        👤 {b.owner.firstName || ''} {b.owner.lastName || ''}
                      </p>
                      {(b.owner.phoneNumber || b.owner.username || b.owner.telegramId) && (
                        <p style={{ margin: 0, fontSize: 11, color: '#6B7280', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          {b.owner.phoneNumber && <span>📞 {b.owner.phoneNumber}</span>}
                          {b.owner.telegramId && <span>📱 @{b.owner.username || b.owner.telegramId?.slice(0, 8)}</span>}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ margin: 0, fontSize: 11, color: '#9CA3AF', fontStyle: 'italic' }}>Sin usuario asignado</p>
                  )}
                </div>

                {/* Action Buttons */}
                {(isPending || isReview) && (
                  <div style={{ display: 'flex', gap: 8, paddingLeft: 4, marginTop: 2 }}>
                    {b.status !== 'UNDER_REVIEW' && (
                      <button 
                        onClick={() => handleAction(b.id, 'UNDER_REVIEW')} 
                        style={{ 
                          flex: 1, 
                          backgroundColor: '#FEF9C3', 
                          color: '#854D0E', 
                          border: 'none', 
                          padding: '11px 0', 
                          borderRadius: 10, 
                          fontWeight: 800, 
                          fontSize: 12, 
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(234,179,8,0.12)'
                        }}
                      >
                        Pasar a Revisión
                      </button>
                    )}
                    {b.status !== 'REJECTED' && (
                      <button 
                        onClick={() => handleAction(b.id, 'REJECTED')} 
                        style={{ 
                          width: 42, 
                          backgroundColor: '#FEF2F2', 
                          color: '#DC2626', 
                          border: 'none', 
                          borderRadius: 10, 
                          fontWeight: 800, 
                          fontSize: 18, 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center' 
                        }}
                      >
                        ×
                      </button>
                    )}
                    {b.status !== 'APPROVED' && (
                      <button 
                        onClick={() => handleAction(b.id, 'APPROVED')} 
                        style={{ 
                          flex: 1.4, 
                          backgroundColor: '#111827', 
                          color: '#FFFFFF', 
                          border: 'none', 
                          padding: '11px 0', 
                          borderRadius: 10, 
                          fontWeight: 800, 
                          fontSize: 12, 
                          cursor: 'pointer', 
                          boxShadow: '0 4px 12px rgba(0,0,0,0.12)' 
                        }}
                      >
                        Aprobar Negocio
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {businesses.length > 20 && (
        <p style={{ fontSize: 11, textAlign: 'center', color: '#AAA', marginTop: 12, fontWeight: 700 }}>
          Mostrando 20 de {businesses.length} registros
        </p>
      )}
    </div>
  );
}

function RoleMetricsSection() {
  const [roleTab, setRoleTab] = useState<'AFFILIATE' | 'RABBITTER'>('AFFILIATE');

  return (
    <div>
      <div style={{ display: 'flex', backgroundColor: '#EEE', borderRadius: 10, padding: 3, marginBottom: 12 }}>
        <button
          onClick={() => setRoleTab('AFFILIATE')}
          style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer',
            backgroundColor: roleTab === 'AFFILIATE' ? '#111' : 'transparent', color: roleTab === 'AFFILIATE' ? '#fff' : '#666'
          }}
        >
          🏬 Afiliados (Comercios)
        </button>
        <button
          onClick={() => setRoleTab('RABBITTER')}
          style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', fontWeight: 800, fontSize: 12, cursor: 'pointer',
            backgroundColor: roleTab === 'RABBITTER' ? '#E91E63' : 'transparent', color: roleTab === 'RABBITTER' ? '#fff' : '#666'
          }}
        >
          🐰 Rabbitters (Usuarios)
        </button>
      </div>

      {roleTab === 'AFFILIATE' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 8, border: '1px solid #EEE', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#111' }}>11</p>
              <p style={{ margin: 0, fontSize: 10, color: '#888', fontWeight: 700 }}>AFILIADOS TOTALES</p>
            </div>
            <div style={{ flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 8, border: '1px solid #EEE', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#22C55E' }}>98%</p>
              <p style={{ margin: 0, fontSize: 10, color: '#888', fontWeight: 700 }}>ENTREGA DRIP EMAIL</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: 10, borderRadius: 8, border: '1px solid #EEE', fontSize: 12 }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 800, color: '#111' }}>📬 Estado de Campaña Drip (Negocios)</p>
            <p style={{ margin: '0 0 4px 0', color: '#666' }}>• Día 0 (Bienvenida & Magic Link): <strong style={{ color: '#22C55E' }}>Activo</strong></p>
            <p style={{ margin: '0 0 4px 0', color: '#666' }}>• Día 2 (Bunz vs. Descuento): <strong style={{ color: '#22C55E' }}>Activo</strong></p>
            <p style={{ margin: '0 0 4px 0', color: '#666' }}>• Día 5 (Admin Bidireccional vs POS): <strong style={{ color: '#22C55E' }}>Activo</strong></p>
            <p style={{ margin: 0, color: '#666' }}>• Día 14 (Analíticas & Retención): <strong style={{ color: '#22C55E' }}>Activo</strong></p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 8, border: '1px solid #EEE', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#E91E63' }}>5</p>
              <p style={{ margin: 0, fontSize: 10, color: '#888', fontWeight: 700 }}>RABBITTERS ACTIVOS</p>
            </div>
            <div style={{ flex: 1, backgroundColor: '#fff', padding: 10, borderRadius: 8, border: '1px solid #EEE', textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 18, fontWeight: 900, color: '#8B5CF6' }}>2.4x</p>
              <p style={{ margin: 0, fontSize: 10, color: '#888', fontWeight: 700 }}>REPETICIÓN CONSUMO</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#fff', padding: 10, borderRadius: 8, border: '1px solid #EEE', fontSize: 12 }}>
            <p style={{ margin: '0 0 6px 0', fontWeight: 800, color: '#111' }}>🎯 Misiones & Gamificación Rabbitters</p>
            <p style={{ margin: '0 0 4px 0', color: '#666' }}>• Nivel Diamante: <strong>1 usuario</strong></p>
            <p style={{ margin: '0 0 4px 0', color: '#666' }}>• Nivel Rubí / Oro: <strong>3 usuarios</strong></p>
            <p style={{ margin: 0, color: '#666' }}>• Referidos Activos: <strong>4 invitaciones</strong></p>
          </div>
        </div>
      )}
    </div>
  );
}
