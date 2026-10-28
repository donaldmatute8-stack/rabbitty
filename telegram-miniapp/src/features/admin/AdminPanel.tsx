'use client';

/**
 * ── GOD CONTROL · Panel móvil del God Admin (rediseño premium) ──
 * Mobile-native: tabs segmentadas, solo operaciones ejecutables, identidad Rabbitty.
 * Contratos de API preservados 1:1 con el panel anterior.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/features/auth/AuthProvider';
import { useToast } from '@/contexts/ToastContext';
import { PlatformBridge } from '@/lib/platform';

let initDataPromise: Promise<string> | null = null;
function getInitData(): Promise<string> {
  if (!initDataPromise) {
    initDataPromise = (async () => {
      try {
        const mod = await import('@twa-dev/sdk');
        return mod.default?.initData || '';
      } catch {
        return '';
      }
    })();
  }
  return initDataPromise;
}

interface AdminUserLike {
  id?: string;
  role?: string | null;
  username?: string | null;
  email?: string | null;
  telegramId?: string | null;
  [key: string]: unknown;
}

async function adminHeaders(user: AdminUserLike | null, json = false): Promise<Record<string, string>> {
  const [initData, bridgeHeaders] = await Promise.all([
    getInitData(),
    PlatformBridge.getAuthHeaders(),
  ]);
  return {
    ...bridgeHeaders,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'X-Telegram-Id': user?.telegramId || '',
    'x-init-data': initData,
  };
}

// ── Tokens de diseño (obsidiana premium Rabbitty) ──
const T = {
  bg: '#08080D',
  card: '#12121B',
  cardHi: '#181824',
  border: 'rgba(255,255,255,0.07)',
  borderHi: 'rgba(255,255,255,0.13)',
  text: '#F5F5F7',
  sub: '#8E8EA0',
  faint: '#5A5A6E',
  pink: '#EC4899',
  purple: '#A855F7',
  amber: '#F59E0B',
  green: '#10B981',
  rose: '#F43F5E',
  cyan: '#38BDF8',
};

const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString('es-MX');
const fmtBunz = (n: number | undefined | null) => `${fmt(n)} Bunz`;

// ── Tipos (contratos existentes) ──
interface LevelItem { id: string; name: string; requiredHops: number; bunzMultiplier: number }
interface TrickItem { id: string; title: string; description: string; rewardHops: number | string; rewardBunz: number | string; conditionType?: string; conditionTarget?: number | string }
interface AdminBusinessItem {
  id: string; name: string; category: string; status: string;
  rewardPercentage?: number; bunzBalance?: number; package?: string | null;
  creditLimit?: number; creditUsed?: number; createdAt?: string | Date;
  owner?: { firstName?: string | null; username?: string | null; phoneNumber?: string | null } | null;
}
interface TreasurySummary {
  totalSplitDebtGenerated: number; totalSplitDebtSettled: number;
  netNegativeBalance: number; outstandingDebtAbs: number;
  totalFeeIncome: number; availableSurplusForSettlement: number;
  welcomeClaimsCount: number;
  capConfig?: { default: number; overrides: Record<string, number> };
  monthlyCapDefault?: number;
  perBusinessMonthlyUsage?: Array<{ businessId: string; businessName: string; used: number; cap: number }>;
}
interface Reconciliation {
  status: 'HEALTHY' | 'DEVIATION_DETECTED';
  totalUsersChecked: number; balancedUsers: number; discrepantUsers: number;
  totalCachedCirculation: number; totalLedgerCirculation: number; systemDifference: number;
  details: Array<{ userId: string; username: string; cachedBalance: number; ledgerNet: number; discrepancy: number; isBalanced: boolean }>;
}
interface ScalingMetric { key: string; label: string; icon: string; value: number; pct: number; max: number; unit?: string }
interface EcosystemData {
  businesses?: { total: number; active: number; pending: number; totalCreditLimit: number; totalCreditUsed: number };
  rabbitters?: { total: number; totalBunzEarned: number; totalBunzSpent: number; circulatingSupply: number };
  ledger?: { rewardsGiven: number; rewardsCount: number; redemptionsSpent: number; redemptionsCount: number; transfersP2P: number; transfersCount: number };
  recentLedger?: Array<{ id: string; payer: string; payee: string; amount: number; type: string; createdAt?: string | null }>;
}

type TabKey = 'resumen' | 'tenants' | 'tesoreria' | 'economia' | 'gamificacion';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'resumen', label: 'Resumen' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'tesoreria', label: 'Tesorería' },
  { key: 'economia', label: 'Economía' },
  { key: 'gamificacion', label: 'Juego' },
];

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<TabKey>('resumen');
  const [refreshKey, setRefreshKey] = useState(0);

  // Cross-tab state: pendientes por aprobar (para el resumen)
  const [pendingCount, setPendingCount] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: T.bg, display: 'flex', flexDirection: 'column' }}>
      {/* ── Header fijo ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px 12px',
        borderBottom: `1px solid ${T.border}`, background: `linear-gradient(180deg, ${T.card} 0%, ${T.bg} 100%)`,
        flexShrink: 0,
      }}>
        <button
          onClick={onClose}
          style={{ width: 34, height: 34, borderRadius: 12, border: `1px solid ${T.border}`, background: T.cardHi, color: T.text, fontSize: 15, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Cerrar"
        >✕</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 17, fontWeight: 900, color: T.text, margin: 0, letterSpacing: -0.3, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              God Control
            </span>
            <span style={{ width: 6, height: 6, borderRadius: 99, background: T.green, boxShadow: `0 0 8px ${T.green}`, flexShrink: 0 }} />
          </h2>
          <p style={{ fontSize: 10, color: T.faint, margin: '1px 0 0', fontWeight: 600 }}>
            {user?.username ? `@${user.username}` : 'Rabbitty Ecosystem'} · Operaciones en vivo
          </p>
        </div>
        <button
          onClick={refresh}
          style={{ width: 34, height: 34, borderRadius: 12, border: `1px solid ${T.border}`, background: T.cardHi, color: T.text, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          aria-label="Refrescar"
        >
          <span style={{ display: 'block', width: 13, height: 13, border: `2px solid ${T.sub}`, borderTopColor: 'transparent', borderRadius: 99 }} />
        </button>
      </div>

      {/* ── Tabs segmentadas ── */}
      <div style={{
        display: 'flex', gap: 6, padding: '10px 14px', overflowX: 'auto', flexShrink: 0,
        borderBottom: `1px solid ${T.border}`, background: T.bg, scrollbarWidth: 'none',
      }}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                flexShrink: 0, padding: '8px 16px', borderRadius: 999, border: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: 800, letterSpacing: 0.2,
                background: active ? `linear-gradient(135deg, ${T.pink} 0%, ${T.purple} 100%)` : T.cardHi,
                color: active ? '#fff' : T.sub,
                boxShadow: active ? `0 4px 18px rgba(236,72,153,0.35)` : 'none',
                transition: 'all .2s',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── Contenido ── */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 16px 40px' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={`${tab}-${refreshKey}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'resumen' && <ResumenTab showToast={showToast} user={user} onGoTab={setTab} pendingCount={pendingCount} setPendingCount={setPendingCount} />}
            {tab === 'tenants' && <TenantsTab showToast={showToast} user={user} setPendingCount={setPendingCount} />}
            {tab === 'tesoreria' && <TesoreriaTab showToast={showToast} user={user} />}
            {tab === 'economia' && <EconomiaTab showToast={showToast} user={user} />}
            {tab === 'gamificacion' && <GamificacionTab showToast={showToast} user={user} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── Primitivas de UI ──
function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: T.card, borderRadius: 18, border: `1px solid ${accent ?? T.border}`,
      padding: 16, marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title, right }: { icon: string; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <h3 style={{ fontSize: 13.5, fontWeight: 900, color: T.text, margin: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 14 }}>{icon}</span> {title}
      </h3>
      {right}
    </div>
  );
}

function Kpi({ label, value, color, sub, onClick }: { label: string; value: string; color: string; sub?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, padding: 14,
        cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: 2,
      }}
    >
      <span style={{ fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.6, color: T.faint }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 900, color, lineHeight: 1.15 }}>{value}</span>
      {sub && <span style={{ fontSize: 9.5, color: T.faint, fontWeight: 600 }}>{sub}</span>}
    </div>
  );
}

function Btn({ children, onClick, kind = 'ghost', disabled, full }: {
  children: React.ReactNode; onClick?: () => void; kind?: 'primary' | 'danger' | 'success' | 'ghost'; disabled?: boolean; full?: boolean;
}) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: `linear-gradient(135deg, ${T.pink} 0%, ${T.purple} 100%)`, color: '#fff', border: 'none' },
    danger: { background: `linear-gradient(135deg, ${T.rose} 0%, #E11D48 100%)`, color: '#fff', border: 'none' },
    success: { background: `linear-gradient(135deg, ${T.green} 0%, #059669 100%)`, color: '#fff', border: 'none' },
    ghost: { background: T.cardHi, color: T.text, border: `1px solid ${T.borderHi}` },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...styles[kind], padding: '11px 16px', borderRadius: 13, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 12, fontWeight: 900, letterSpacing: 0.2, width: full ? '100%' : undefined,
        opacity: disabled ? 0.45 : 1, transition: 'opacity .15s',
      }}
    >
      {children}
    </button>
  );
}

// ═══════════════════ TAB: RESUMEN ═══════════════════
function ResumenTab({ showToast, user, onGoTab, pendingCount, setPendingCount }: {
  showToast: (m: string, t?: 'success' | 'error') => void;
  user: AdminUserLike | null;
  onGoTab: (t: TabKey) => void;
  pendingCount: number;
  setPendingCount: (n: number) => void;
}) {
  const [eco, setEco] = useState<EcosystemData | null>(null);
  const [treasury, setTreasury] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [ecoRes, treRes] = await Promise.all([
        fetch('/api/admin/ecosystem-metrics', { headers: await adminHeaders(user), cache: 'no-store' }),
        fetch('/api/admin/treasury-debt', { headers: await adminHeaders(user), cache: 'no-store' }),
      ]);
      const ecoJson = await ecoRes.json();
      if (ecoJson.success && ecoJson.ecosystem) {
        setEco(ecoJson.ecosystem);
        setPendingCount(ecoJson.ecosystem.businesses?.pending ?? 0);
      }
      const treJson = await treRes.json();
      if (treJson.success && treJson.summary) setTreasury(treJson.summary);
    } catch (err) {
      console.error('[GodPanel] resumen:', err);
      showToast('Error cargando resumen', 'error');
    } finally {
      setLoading(false);
    }
  }, [user, showToast, setPendingCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const debt = treasury?.outstandingDebtAbs ?? 0;
  const circulating = eco?.rabbitters?.circulatingSupply ?? 0;

  return (
    <div>
      {/* KPIs principales */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        <Kpi
          label="Tesorería en Negativo" value={debt > 0 ? `-${fmt(debt)}` : '0 ✓'}
          color={debt > 0 ? T.rose : T.green} sub={debt > 0 ? 'toca para liquidar' : 'al corriente'}
          onClick={() => onGoTab('tesoreria')}
        />
        <Kpi label="Bunz en Circulación" value={fmt(circulating)} color={T.cyan} sub={`${fmt(eco?.rabbitters?.total)} Rabbitters`} />
        <Kpi
          label="Negocios Activos" value={`${eco?.businesses?.active ?? 0}/${eco?.businesses?.total ?? 0}`}
          color={T.green} sub={`crédito ${fmt(eco?.businesses?.totalCreditUsed)}/${fmt(eco?.businesses?.totalCreditLimit)}`}
        />
        <Kpi
          label="Pendientes Aprobación" value={String(pendingCount)}
          color={pendingCount > 0 ? T.amber : T.green} sub={pendingCount > 0 ? 'toca para revisar' : 'todo al día'}
          onClick={() => pendingCount > 0 && onGoTab('tenants')}
        />
      </div>

      {/* Acciones rápidas */}
      <Card>
        <SectionTitle icon="⚡" title="Acciones rápidas" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Btn kind={debt > 0 ? 'danger' : 'ghost'} full onClick={() => onGoTab('tesoreria')} disabled={debt <= 0}>
            {debt > 0 ? `⚡ Poner Tesorería al Corriente (${fmt(debt)} Bunz)` : '✅ Tesorería al corriente'}
          </Btn>
          <Btn kind="ghost" full onClick={() => onGoTab('tenants')}>
            🏪 Revisar Tenants {pendingCount > 0 ? `(${pendingCount} pendientes)` : ''}
          </Btn>
          <Btn kind="ghost" full onClick={() => onGoTab('economia')}>
            ⚖️ Salud del Ledger & Escalado
          </Btn>
        </div>
      </Card>

      {/* Feed económico en vivo */}
      <Card>
        <SectionTitle icon="📡" title="Movimientos recientes" />
        {loading && <p style={{ fontSize: 12, color: T.faint }}>Cargando…</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(eco?.recentLedger ?? []).slice(0, 6).map((l) => (
            <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
              <span style={{ fontSize: 10.5, color: T.sub, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '62%' }}>
                {l.type === 'EARN' ? '🎁' : l.type === 'SPEND' ? '🛒' : '🔄'} {String(l.payer).slice(0, 10)} → {String(l.payee).slice(0, 10)}
              </span>
              <span style={{ fontSize: 12, fontWeight: 900, color: l.type === 'EARN' ? T.green : l.type === 'SPEND' ? T.rose : T.cyan }}>
                {l.amount > 0 ? '+' : ''}{fmt(l.amount)}
              </span>
            </div>
          ))}
          {!loading && (eco?.recentLedger?.length ?? 0) === 0 && <p style={{ fontSize: 11, color: T.faint }}>Sin movimientos aún</p>}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════ TAB: TENANTS ═══════════════════
function TenantsTab({ showToast, setPendingCount }: {
  showToast: (m: string, t?: 'success' | 'error') => void;
  user: AdminUserLike | null;
  setPendingCount: (n: number) => void;
}) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<AdminBusinessItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [acting, setActing] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/business?t=${Date.now()}`, { headers: await adminHeaders(user), cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setBusinesses(data.businesses || []);
        setPendingCount((data.businesses || []).filter((b: AdminBusinessItem) => b.status === 'PENDING' || b.status === 'PENDING_VERIFICATION').length);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [user, setPendingCount]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleAction = async (businessId: string, status: string) => {
    setActing(businessId);
    try {
      const res = await fetch('/api/admin/business', {
        method: 'POST', headers: await adminHeaders(user, true),
        body: JSON.stringify({ businessId, status }),
      });
      const data = await res.json();
      if (data.success) {
        setBusinesses((prev) => prev.map((b) => (b.id === businessId ? { ...b, status } : b)));
        showToast(`Negocio ${status === 'APPROVED' ? 'aprobado ✓' : status === 'REJECTED' ? 'rechazado' : 'en revisión'}`, 'success');
      } else showToast('Error: ' + (data.error || 'desconocido'), 'error');
    } catch { showToast('Error de conexión', 'error'); } finally { setActing(null); }
  };

  const handleProvision = async (businessId: string, businessName: string, amount = 3500) => {
    setProvisioning(businessId);
    try {
      const res = await fetch('/api/admin/business', {
        method: 'POST', headers: await adminHeaders(user, true),
        body: JSON.stringify({ businessId, action: 'PROVISION_BUNZ', amount }),
      });
      const data = await res.json();
      if (data.success) {
        setBusinesses((prev) => prev.map((b) => (b.id === businessId ? { ...b, bunzBalance: data.bunzBalance } : b)));
        showToast(`🎉 +${fmt(amount)} Bunz → ${businessName}`, 'success');
      } else showToast('Error: ' + (data.error || 'No se pudo aprovisionar'), 'error');
    } catch { showToast('Error de conexión al aprovisionar', 'error'); } finally { setProvisioning(null); }
  };

  const filtered = businesses.filter((b) =>
    filter === 'ALL' || b.status === filter || (filter === 'PENDING' && b.status === 'PENDING_VERIFICATION')
  );

  const statusChip = (s: string) => {
    if (s === 'APPROVED' || s === 'ACTIVE') return { bg: 'rgba(16,185,129,0.14)', c: T.green, t: 'ACTIVO' };
    if (s === 'PENDING' || s === 'PENDING_VERIFICATION') return { bg: 'rgba(245,158,11,0.14)', c: T.amber, t: 'PENDIENTE' };
    if (s === 'REJECTED') return { bg: 'rgba(244,63,94,0.14)', c: T.rose, t: 'RECHAZADO' };
    return { bg: 'rgba(142,142,160,0.14)', c: T.sub, t: s.toUpperCase() };
  };

  return (
    <div>
      {/* Filtros */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flexShrink: 0, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 800,
              background: filter === f ? `linear-gradient(135deg, ${T.pink}, ${T.purple})` : T.cardHi,
              color: filter === f ? '#fff' : T.sub, border: 'none',
            }}
          >
            {f === 'ALL' ? 'Todos' : f === 'PENDING' ? 'Pendientes' : f === 'APPROVED' ? 'Activos' : 'Rechazados'}
          </button>
        ))}
      </div>

      {loading && <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', padding: 20 }}>Cargando tenants…</p>}

      {filtered.map((b) => {
        const chip = statusChip(b.status);
        const isPending = b.status === 'PENDING' || b.status === 'PENDING_VERIFICATION';
        return (
          <Card key={b.id}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 900, color: T.text }}>{b.name}</span>
                  <span style={{ fontSize: 8.5, fontWeight: 900, padding: '2px 8px', borderRadius: 99, background: chip.bg, color: chip.c, letterSpacing: 0.5 }}>{chip.t}</span>
                </div>
                <p style={{ fontSize: 10.5, color: T.faint, margin: '3px 0 0', fontWeight: 600 }}>
                  {b.category} · {b.owner?.username ? `@${b.owner.username}` : b.owner?.firstName || 'sin owner'}
                  {b.rewardPercentage ? ` · ${b.rewardPercentage}% Bunz` : ''}
                </p>
                <p style={{ fontSize: 10, color: T.faint, margin: '3px 0 0' }}>
                  Saldo: {fmtBunz(b.bunzBalance)} · Crédito {fmt(b.creditUsed)}/{fmt(b.creditLimit)}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              {isPending && (
                <>
                  <Btn kind="success" onClick={() => handleAction(b.id, 'APPROVED')} disabled={acting === b.id}>✓ Aprobar</Btn>
                  <Btn kind="danger" onClick={() => handleAction(b.id, 'REJECTED')} disabled={acting === b.id}>✕ Rechazar</Btn>
                </>
              )}
              {!isPending && (
                <Btn kind="primary" onClick={() => handleProvision(b.id, b.name)} disabled={provisioning === b.id}>
                  {provisioning === b.id ? 'Aprovisionando…' : '⚡ Aprovisionar +3,500 Bunz'}
                </Btn>
              )}
            </div>
          </Card>
        );
      })}

      {!loading && filtered.length === 0 && (
        <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', padding: 30 }}>Sin negocios en este filtro</p>
      )}
    </div>
  );
}

// ═══════════════════ TAB: TESORERÍA ═══════════════════
function TesoreriaTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void; user: AdminUserLike | null }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<TreasurySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [settleMode, setSettleMode] = useState<'from_treasury_fees' | 'direct_injection'>('from_treasury_fees');
  const [customAmount, setCustomAmount] = useState('');
  const [settling, setSettling] = useState(false);
  const [capDraft, setCapDraft] = useState<{ default: string; overrides: Record<string, string> }>({ default: '200', overrides: {} });
  const [savingCap, setSavingCap] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/treasury-debt', { headers: await adminHeaders(user), cache: 'no-store' });
      const data = await res.json();
      if (data.success && data.summary) {
        const s: TreasurySummary = data.summary;
        setSummary(s);
        setCustomAmount(String(s.outstandingDebtAbs || 0));
        setCapDraft({
          default: String(s.capConfig?.default ?? s.monthlyCapDefault ?? 200),
          overrides: Object.fromEntries((s.perBusinessMonthlyUsage || []).map((b) => [b.businessId, String(s.capConfig?.overrides?.[b.businessId] ?? '')])),
        });
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const handleSettle = async () => {
    if (!summary || summary.outstandingDebtAbs <= 0) return;
    setSettling(true);
    try {
      const res = await fetch('/api/admin/treasury-debt', {
        method: 'POST', headers: await adminHeaders(user, true),
        body: JSON.stringify({ amountToSettle: Number(customAmount) || summary.outstandingDebtAbs, mode: settleMode }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ Tesorería al corriente por ${fmt(data.settledAmount)} Bunz`, 'success');
        setSummary(data.summary);
        setShowConfirm(false);
      } else showToast(data.error || 'No se pudo liquidar', 'error');
    } catch { showToast('Error de red', 'error'); } finally { setSettling(false); }
  };

  const handleSaveCap = async () => {
    setSavingCap(true);
    try {
      const overrides: Record<string, number> = {};
      for (const [bizId, raw] of Object.entries(capDraft.overrides)) {
        const n = Math.round(Number(raw));
        if (raw !== '' && Number.isFinite(n) && n > 0) overrides[bizId] = n;
      }
      const res = await fetch('/api/admin/treasury-debt', {
        method: 'POST', headers: await adminHeaders(user, true),
        body: JSON.stringify({ action: 'update_cap_config', capConfig: { default: Math.round(Number(capDraft.default) || 0), overrides } }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`🎯 Tope mensual: ${fmt(data.capConfig?.default ?? 200)} Bunz/mes`, 'success');
        setSummary(data.summary);
      } else showToast(data.error || 'No se pudo guardar', 'error');
    } catch { showToast('Error de red', 'error'); } finally { setSavingCap(false); }
  };

  if (loading && !summary) return <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', padding: 20 }}>Cargando tesorería…</p>;
  if (!summary) return <p style={{ fontSize: 12, color: T.rose, textAlign: 'center', padding: 20 }}>No se pudo cargar el estado</p>;

  const hasDebt = summary.outstandingDebtAbs > 0;

  return (
    <div>
      {/* Saldos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
        <Kpi label="En Negativo (Split)" value={hasDebt ? `-${fmt(summary.netNegativeBalance)}` : '0 ✓'} color={hasDebt ? T.rose : T.green} sub={`${summary.welcomeClaimsCount} bonos co-financiados`} />
        <Kpi label="Disponible (Fees)" value={`+${fmt(summary.availableSurplusForSettlement)}`} color={T.cyan} sub={`recaudado ${fmt(summary.totalFeeIncome)}`} />
      </div>

      {/* Liquidación */}
      <Card accent={hasDebt ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.35)'}>
        <SectionTitle icon="🏦" title="Liquidar Deuda de Bienvenida" />
        {hasDebt ? (
          <>
            <Btn kind="danger" full onClick={() => { setCustomAmount(String(summary.outstandingDebtAbs)); setSettleMode(summary.availableSurplusForSettlement >= summary.outstandingDebtAbs ? 'from_treasury_fees' : 'direct_injection'); setShowConfirm(true); }}>
              ⚡ Poner al Corriente ({fmt(summary.outstandingDebtAbs)} Bunz)
            </Btn>
            <p style={{ fontSize: 9.5, color: T.faint, margin: '8px 0 0', fontWeight: 600 }}>
              Con comisiones acumuladas o respaldo directo de reserva. Queda en audit log.
            </p>
          </>
        ) : (
          <p style={{ fontSize: 12, color: T.green, fontWeight: 800 }}>✅ Tesorería 100% al corriente — sin deuda pendiente</p>
        )}
      </Card>

      {/* Tope mensual por afiliado */}
      <Card>
        <SectionTitle icon="🎯" title="Tope Mensual por Afiliado" />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
          <input
            type="number" min={0} value={capDraft.default}
            onChange={(e) => setCapDraft({ ...capDraft, default: e.target.value })}
            style={{ width: 92, padding: '9px 10px', borderRadius: 11, border: `1px solid ${T.borderHi}`, background: 'rgba(0,0,0,0.4)', color: T.text, fontSize: 14, fontWeight: 900, textAlign: 'center' }}
          />
          <span style={{ fontSize: 10, color: T.faint, fontWeight: 700, flex: 1 }}>Bunz/mes fondeados por cada local</span>
          <Btn onClick={handleSaveCap} disabled={savingCap}>{savingCap ? '…' : '💾'}</Btn>
        </div>
        {(summary.perBusinessMonthlyUsage || []).map((b) => {
          const exhausted = b.used >= b.cap;
          return (
            <div key={b.businessId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}`, marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 11, fontWeight: 900, color: T.text, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.businessName}</p>
                <p style={{ fontSize: 9.5, color: exhausted ? T.rose : T.faint, margin: '1px 0 0', fontWeight: 700 }}>
                  Mes: {b.used}/{b.cap}{exhausted ? ' · tope → Tesorería subsidia' : ''}
                </p>
              </div>
              <input
                type="number" placeholder={String(b.cap)}
                value={capDraft.overrides[b.businessId] ?? ''}
                onChange={(e) => setCapDraft({ ...capDraft, overrides: { ...capDraft.overrides, [b.businessId]: e.target.value } })}
                style={{ width: 66, padding: '6px 8px', borderRadius: 9, border: `1px solid ${T.borderHi}`, background: T.cardHi, color: T.text, fontSize: 12, fontWeight: 800, textAlign: 'center' }}
              />
            </div>
          );
        })}
      </Card>

      {/* Modal confirmación */}
      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
            onClick={() => setShowConfirm(false)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 8 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              style={{ background: T.card, borderRadius: 20, border: `1px solid ${T.borderHi}`, padding: 20, width: '100%', maxWidth: 360 }}
            >
              <h3 style={{ fontSize: 15, fontWeight: 900, color: T.text, margin: '0 0 10px' }}>🛡️ Confirmar Liquidación</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {[
                  { k: 'from_treasury_fees' as const, t: 'Con comisiones en Tesorería', ok: summary.availableSurplusForSettlement > 0 },
                  { k: 'direct_injection' as const, t: 'Respaldo directo de reserva', ok: true },
                ].map((opt) => (
                  <button
                    key={opt.k}
                    onClick={() => setSettleMode(opt.k)}
                    disabled={!opt.ok}
                    style={{
                      textAlign: 'left', padding: '11px 14px', borderRadius: 12, cursor: opt.ok ? 'pointer' : 'not-allowed',
                      border: settleMode === opt.k ? `2px solid ${T.pink}` : `1px solid ${T.borderHi}`,
                      background: settleMode === opt.k ? 'rgba(236,72,153,0.12)' : T.cardHi,
                      color: opt.ok ? T.text : T.faint, fontSize: 12, fontWeight: 800, opacity: opt.ok ? 1 : 0.55,
                    }}
                  >
                    {opt.t}{!opt.ok && ' (sin saldo)'}
                  </button>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: T.sub, fontWeight: 700 }}>Monto:</span>
                  <input
                    type="number" value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    style={{ flex: 1, padding: '9px 12px', borderRadius: 11, border: `1px solid ${T.borderHi}`, background: 'rgba(0,0,0,0.4)', color: T.text, fontSize: 14, fontWeight: 900 }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Btn kind="ghost" full onClick={() => setShowConfirm(false)}>Cancelar</Btn>
                <Btn kind="danger" full onClick={handleSettle} disabled={settling}>{settling ? 'Liquidando…' : '✓ Confirmar'}</Btn>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════ TAB: ECONOMÍA ═══════════════════
function EconomiaTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void; user: AdminUserLike | null }) {
  const { user } = useAuth();
  const [recon, setRecon] = useState<Reconciliation | null>(null);
  const [scaling, setScaling] = useState<ScalingMetric[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncingUser, setSyncingUser] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const [recRes, scaRes] = await Promise.all([
        fetch('/api/admin/reconcile', { headers: await adminHeaders(user), cache: 'no-store' }),
        fetch('/api/admin/scaling', { headers: await adminHeaders(user), cache: 'no-store' }),
      ]);
      const recJson = await recRes.json();
      if (recJson?.status) setRecon(recJson);
      const scaJson = await scaRes.json();
      if (scaJson?.metrics) setScaling(scaJson.metrics);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const selfHeal = async (userId: string) => {
    setSyncingUser(userId);
    try {
      const res = await fetch('/api/admin/reconcile', {
        method: 'POST', headers: await adminHeaders(user, true),
        body: JSON.stringify({ userId, syncDirection: 'LEDGER_TO_CACHE' }),
      });
      const json = await res.json();
      if (json.success) { showToast('Balance alineado con el Ledger ✓', 'success'); void load(); }
      else showToast(json.error || 'Error al reconciliar', 'error');
    } catch { showToast('Error de conexión', 'error'); } finally { setSyncingUser(null); }
  };

  const healthy = recon?.status === 'HEALTHY';
  const discrepant = (recon?.details ?? []).filter((d) => !d.isBalanced);

  return (
    <div>
      {/* Salud del Ledger */}
      <Card accent={healthy ? 'rgba(16,185,129,0.4)' : 'rgba(244,63,94,0.4)'}>
        <SectionTitle
          icon="⚖️" title="Salud del Ledger"
          right={<span style={{ fontSize: 10, fontWeight: 900, color: healthy ? T.green : T.rose, padding: '3px 10px', borderRadius: 99, background: healthy ? 'rgba(16,185,129,0.12)' : 'rgba(244,63,94,0.12)' }}>{healthy ? 'SANO' : 'DESVIACIÓN'}</span>}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Kpi label="Auditados" value={String(recon?.totalUsersChecked ?? '—')} color={T.text} />
          <Kpi label="Discrepantes" value={String(recon?.discrepantUsers ?? '—')} color={Number(recon?.discrepantUsers) > 0 ? T.rose : T.green} />
          <Kpi label="Circulante (cache)" value={fmt(recon?.totalCachedCirculation)} color={T.cyan} />
          <Kpi label="Circulante (ledger)" value={fmt(recon?.totalLedgerCirculation)} color={T.cyan} />
        </div>
      </Card>

      {/* Discrepancias con acción */}
      {discrepant.length > 0 && (
        <Card>
          <SectionTitle icon="🩹" title={`Corregir (${discrepancías(discrepant.length)})`} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(showAll ? discrepant : discrepant.slice(0, 5)).map((d) => (
              <div key={d.userId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', borderRadius: 11, background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.25)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, fontWeight: 900, color: T.text, margin: 0 }}>{d.username}</p>
                  <p style={{ fontSize: 9.5, color: T.faint, margin: 0 }}>cache {d.cachedBalance} vs ledger {d.ledgerNet}</p>
                </div>
                <Btn onClick={() => selfHeal(d.userId)} disabled={syncingUser === d.userId}>
                  {syncingUser === d.userId ? '…' : 'Alinear'}
                </Btn>
              </div>
            ))}
            {discrepant.length > 5 && (
              <button onClick={() => setShowAll(!showAll)} style={{ background: 'none', border: 'none', color: T.pink, fontSize: 11, fontWeight: 800, cursor: 'pointer', padding: 6 }}>
                {showAll ? 'Ver menos' : `Ver todas (${discrepant.length})`}
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Escalado */}
      <Card>
        <SectionTitle icon="🚀" title="Estado de Escalado" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(scaling ?? []).map((m) => (
            <div key={m.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: T.text }}>{m.icon} {m.label}</span>
                <span style={{ fontSize: 11, fontWeight: 900, color: m.pct >= 80 ? T.rose : m.pct >= 50 ? T.amber : T.green }}>
                  {fmt(m.value)}/{fmt(m.max)} ({m.pct.toFixed(0)}%)
                </span>
              </div>
              <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ height: '100%', borderRadius: 99, width: `${m.pct}%`, background: m.pct >= 80 ? T.rose : m.pct >= 50 ? T.amber : T.green, transition: 'width .3s' }} />
              </div>
            </div>
          ))}
          {scaling === null && !loading && <p style={{ fontSize: 11, color: T.faint }}>Sin datos de escalado</p>}
        </div>
      </Card>

      {loading && <p style={{ fontSize: 12, color: T.faint, textAlign: 'center', padding: 14 }}>Auditando economía…</p>}
    </div>
  );
}

function discrepancías(n: number) { return `${n} discrepancia${n === 1 ? '' : 's'}`; }

// ═══════════════════ TAB: GAMIFICACIÓN ═══════════════════
function GamificacionTab({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void; user: AdminUserLike | null }) {
  const { user } = useAuth();
  const [tricks, setTricks] = useState<TrickItem[]>([]);
  const [levels, setLevels] = useState<LevelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingLevel, setSavingLevel] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { mult: string; hops: string }>>({});
  const [form, setForm] = useState({ title: '', description: '', rewardHops: '100', rewardBunz: '50', conditionType: 'TOTAL_VISITS', conditionTarget: '1' });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/gamification', { headers: await adminHeaders(user), cache: 'no-store' });
      const data = await res.json();
      if (data?.levels && data?.tricks) {
        setLevels(data.levels);
        setTricks(data.tricks);
        setDrafts(Object.fromEntries((data.levels as LevelItem[]).map((l) => [l.id, { mult: String(l.bunzMultiplier ?? 1), hops: String(l.requiredHops ?? 0) }])));
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const createTrick = async () => {
    if (!form.title.trim()) { showToast('Título requerido', 'error'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/gamification', {
        method: 'POST', headers: await adminHeaders(user, true),
        body: JSON.stringify({ action: 'CREATE_TRICK', payload: form }),
      });
      const data = await res.json();
      if (data.success) {
        setTricks((prev) => [data.trick, ...prev]);
        setShowForm(false);
        setForm({ title: '', description: '', rewardHops: '100', rewardBunz: '50', conditionType: 'TOTAL_VISITS', conditionTarget: '1' });
        showToast('🪄 Misión creada', 'success');
      } else showToast('Error al crear misión', 'error');
    } catch { showToast('Error de conexión', 'error'); } finally { setSaving(false); }
  };

  const updateLevel = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setSavingLevel(id);
    try {
      const res = await fetch('/api/admin/gamification', {
        method: 'POST', headers: await adminHeaders(user, true),
        body: JSON.stringify({ action: 'UPDATE_LEVEL', payload: { id, bunzMultiplier: Number(d.mult), requiredHops: Number(d.hops) } }),
      });
      const data = await res.json();
      if (data.success) showToast('📈 Nivel actualizado', 'success');
      else showToast('Error al actualizar', 'error');
    } catch { showToast('Error de conexión', 'error'); } finally { setSavingLevel(null); }
  };

  return (
    <div>
      {/* Trucos */}
      <Card>
        <SectionTitle
          icon="🪄" title={`Trucos del Sombrero (${tricks.length})`}
          right={<Btn onClick={() => setShowForm(!showForm)}>{showForm ? '✕' : '+ Nuevo'}</Btn>}
        />
        {showForm && (
          <div style={{ background: T.cardHi, borderRadius: 13, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8, border: `1px solid ${T.borderHi}` }}>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título de la misión" style={inputStyle} />
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" style={inputStyle} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={form.rewardHops} onChange={(e) => setForm({ ...form, rewardHops: e.target.value.replace(/\D/g, '') })} placeholder="Hops" inputMode="numeric" style={{ ...inputStyle, flex: 1 }} />
              <input value={form.rewardBunz} onChange={(e) => setForm({ ...form, rewardBunz: e.target.value.replace(/\D/g, '') })} placeholder="Bunz" inputMode="numeric" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <Btn kind="primary" full onClick={createTrick} disabled={saving}>{saving ? 'Guardando…' : '🪄 Crear Misión'}</Btn>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tricks.slice(0, 8).map((t) => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 11px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: 11.5, fontWeight: 900, color: T.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</p>
                <p style={{ fontSize: 9.5, color: T.faint, margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>{t.description}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 900, color: T.amber, flexShrink: 0 }}>+{t.rewardBunz} Bunz</span>
            </div>
          ))}
          {!loading && tricks.length === 0 && <p style={{ fontSize: 11, color: T.faint }}>Sin misiones aún</p>}
        </div>
      </Card>

      {/* Niveles */}
      <Card>
        <SectionTitle icon="📈" title="Niveles & Multiplicadores" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {levels.map((l, i) => {
            const d = drafts[l.id] ?? { mult: String(l.bunzMultiplier ?? 1), hops: String(l.requiredHops ?? 0) };
            return (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 900, color: T.purple, width: 58, flexShrink: 0 }}>{l.name || `Nv ${i + 1}`}</span>
                <input
                  value={d.hops} inputMode="numeric"
                  onChange={(e) => setDrafts({ ...drafts, [l.id]: { ...d, hops: e.target.value.replace(/\D/g, '') } })}
                  style={{ ...inputStyle, width: 58, textAlign: 'center', padding: '6px 4px' }}
                />
                <span style={{ fontSize: 9, color: T.faint, fontWeight: 700 }}>hops ×</span>
                <input
                  value={d.mult}
                  onChange={(e) => setDrafts({ ...drafts, [l.id]: { ...d, mult: e.target.value } })}
                  style={{ ...inputStyle, width: 48, textAlign: 'center', padding: '6px 4px' }}
                />
                <Btn onClick={() => updateLevel(l.id)} disabled={savingLevel === l.id} kind="ghost">
                  {savingLevel === l.id ? '…' : '✓'}
                </Btn>
              </div>
            );
          })}
          {!loading && levels.length === 0 && <p style={{ fontSize: 11, color: T.faint }}>Sin niveles configurados</p>}
        </div>
        <p style={{ fontSize: 9, color: T.faint, margin: '8px 0 0', fontWeight: 600 }}>
          Aplica al instante para todos los Rabbitters
        </p>
      </Card>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 10,
  border: `1px solid ${T.borderHi}`, background: 'rgba(0,0,0,0.4)',
  color: T.text, fontSize: 12.5, fontWeight: 700, outline: 'none',
};
