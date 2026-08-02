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
    fetch('/api/admin/business', {
      headers: { 'X-Telegram-Id': user?.telegramId || '' }
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
        showToast(`Negocio ${status === 'APPROVED' ? 'aprobado' : 'rechazado'}`, 'success');
      } else {
        showToast('Error: ' + (data.error || 'desconocido'), 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    }
  };

  const filtered = businesses.filter(b => filter === 'ALL' || b.status === filter);

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['PENDING', 'APPROVED', 'REJECTED', 'ALL'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '4px 12px', borderRadius: 999, border: 'none', fontSize: 11, fontWeight: 800, cursor: 'pointer',
              backgroundColor: filter === f ? '#111' : '#E0E0E0', color: filter === f ? '#fff' : '#666'
            }}
          >
            {f === 'ALL' ? 'Todos' : f}
          </button>
        ))}
      </div>

      {loading && <p style={{ fontSize: 13, color: '#888' }}>Cargando...</p>}

      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: 13, color: '#888' }}>No hay negocios {filter !== 'ALL' ? filter.toLowerCase() : ''}.</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
        {filtered.slice(0, 20).map((b: any) => (
          <div key={b.id} style={{ backgroundColor: '#fff', borderRadius: 10, padding: 12, border: '1px solid #EEE' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{b.name}</p>
                <p style={{ margin: '2px 0', fontSize: 11, color: '#888' }}>{b.category} · {b.address?.slice(0, 40)}</p>
                {b.owner && (
                  <p style={{ margin: '2px 0', fontSize: 11, color: '#555' }}>
                    👤 {b.owner.firstName || ''} {b.owner.lastName || ''}
                    {b.owner.phoneNumber ? ` · 📞 ${b.owner.phoneNumber}` : ''}
                    {b.owner.telegramId ? ` · 📱 @${b.owner.username || b.owner.telegramId?.slice(0, 8)}` : ''}
                  </p>
                )}
              </div>
              <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 6, backgroundColor: b.status === 'PENDING' ? '#FFF3E0' : b.status === 'APPROVED' ? '#E8F5E9' : '#FFEBEE', color: b.status === 'PENDING' ? '#F57C00' : b.status === 'APPROVED' ? '#4CAF50' : '#F44336' }}>
                {b.status}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              {b.status !== 'REJECTED' && (
                <button onClick={() => handleAction(b.id, 'REJECTED')} style={{ flex: 1, backgroundColor: '#FFEBEE', color: '#F44336', border: 'none', padding: '6px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Rechazar
                </button>
              )}
              {b.status !== 'APPROVED' && (
                <button onClick={() => handleAction(b.id, 'APPROVED')} style={{ flex: 1, backgroundColor: '#E8F5E9', color: '#4CAF50', border: 'none', padding: '6px', borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Aprobar
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {businesses.length > 20 && (
        <p style={{ fontSize: 11, textAlign: 'center', color: '#AAA', marginTop: 8 }}>Mostrando 20 de {businesses.length}</p>
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
