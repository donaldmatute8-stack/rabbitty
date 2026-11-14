'use client';

/**
 * ── Rabbitty Pass ───────────────────────────────────────────────────────────
 *
 * Tarjeta principal del inicio. Tres cosas viven aquí:
 *
 * 1. El pase: saldo, nivel, nombre y el botón “Ver QR”.
 * 2. El código: por defecto el **QR estándar** (BrandQR, cualquier cámara lo
 *    lee); el Rabbitty Code neón queda como secundario, a un toque.
 * 3. Las caras del pase: se desliza a la izquierda/derecha para pasar del Pass
 *    a las membresías del usuario (swipe se puede apagar en Opciones).
 *
 * El engranaje (esquina superior derecha, solo con el pase extendido) abre
 * “Opciones del Pass”: qué código abrir, qué membresía abre el acceso directo,
 * si el swipe está activo y si el saldo se ve en la tarjeta comprimida.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, ChevronRight, X, ShieldCheck, Settings2, Ticket, Check, ArrowRight, Sparkles } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';
import RabbittyCode from '@/components/ui/RabbittyCode';
import BrandQR from '@/components/ui/BrandQR';
import { useTheme } from '@/contexts/ThemeContext';
import AnimatedBunz from '@/components/ui/AnimatedBunz';

import Image from 'next/image';

interface MembershipCardProps {
  user: {
    id?: string;
    telegramId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
    totalBunzEarned?: number;
    totalBunzSpent?: number;
  } | null;
  levelName?: string;
  isDark?: boolean;
}

/** Membresía del usuario (subconjunto de /api/memberships). */
interface PassMembership {
  id: string;
  planName: string | null;
  businessName: string | null;
  businessLogoUrl: string | null;
  status: string;
  currentPeriodEnd: string | null;
  noExpiration: boolean;
  badgeColor: string | null;
}

interface PassSettings {
  /** Código que se abre con “Ver QR”. */
  code: 'standard' | 'neon';
  swipe: boolean;
  /** Muestra el botón de acceso directo a membresías. */
  showDirect: boolean;
  /** 'memberships' = hub; o el id de una membresía concreta. */
  defaultTarget: string;
  /** Saldo visible con la tarjeta comprimida. */
  collapsedBalance: boolean;
}

const SETTINGS_KEY = 'rabbitty_pass_settings';
const COLLAPSED_KEY = 'rabbitty_pass_collapsed';

const DEFAULT_SETTINGS: PassSettings = {
  code: 'standard',
  swipe: true,
  showDirect: true,
  defaultTarget: 'memberships',
  collapsedBalance: true,
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Activa',
  GRACE_PERIOD: 'En gracia',
  PAST_DUE: 'Vencida',
  CANCELED: 'Cancelada',
  REVOKED: 'Revocada',
  EXPIRED: 'Expirada',
};

function readSettings(): PassSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PassSettings>;
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const emptySubscribe = () => () => {};

export default function MembershipCard({ user, levelName = '1', isDark: isDarkProp }: MembershipCardProps) {
  const { isDark: themeIsDark } = useTheme();
  const isDark = isDarkProp ?? themeIsDark;
  const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
  const router = useRouter();

  const [showQrModal, setShowQrModal] = useState(false);
  const [codeMode, setCodeMode] = useState<'standard' | 'neon'>('standard');
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<PassSettings>(DEFAULT_SETTINGS);
  const [memberships, setMemberships] = useState<PassMembership[]>([]);
  const [slide, setSlide] = useState(0);
  const draggedRef = useRef(false);

  const bunzBalance = (user?.totalBunzEarned || 0) - (user?.totalBunzSpent || 0);
  const qrIdentifier = user?.id || user?.telegramId || 'rabbitty_guest';
  const qrValue = `https://app.rabbitty.me/u/${encodeURIComponent(user?.username || String(qrIdentifier))}`;

  const memberName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Explorador Rabbitty';
  const username = user?.username ? `@${user.username}` : '@miembro';

  // ── Preferencias (localStorage) ──
  useEffect(() => {
    const saved = readSettings();
    setSettings(saved);
    setCodeMode(saved.code);
  }, []);

  const updateSettings = (patch: Partial<PassSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (patch.code) setCodeMode(patch.code);
  };

  // ── Membresías para las caras del pase ──
  useEffect(() => {
    let alive = true;
    void PlatformBridge.getAuthHeaders()
      .then((headers) => fetch('/api/memberships', { headers: headers as Record<string, string> }))
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.success || !Array.isArray(d.memberships)) return;
        setMemberships(
          (d.memberships as PassMembership[]).filter((m) => m.status !== 'REVOKED' && m.status !== 'EXPIRED'),
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    try {
      setIsCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');
    } catch {}
  }, []);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    PlatformBridge.hapticFeedback('light');
    setIsCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
      return next;
    });
  };

  // ── Caras del pase: 0 = Pass, 1..n = membresías ──
  const slides = useMemo(
    () => [{ kind: 'pass' as const }, ...memberships.map((m) => ({ kind: 'membership' as const, m }))],
    [memberships],
  );
  const current = slides[Math.min(slide, slides.length - 1)];

  const goto = (dir: 1 | -1) => {
    setSlide((prev) => {
      const next = Math.min(Math.max(prev + dir, 0), slides.length - 1);
      if (next !== prev) PlatformBridge.hapticFeedback('light');
      return next;
    });
  };

  const onDragEnd = (_e: unknown, info: { offset: { x: number } }) => {
    if (Math.abs(info.offset.x) < 55) return;
    draggedRef.current = true;
    setTimeout(() => { draggedRef.current = false; }, 220);
    goto(info.offset.x < 0 ? 1 : -1);
  };

  const openQr = () => {
    if (draggedRef.current) return;
    PlatformBridge.hapticFeedback('medium');
    setCodeMode(settings.code);
    setShowQrModal(true);
  };

  const openMemberships = (target: string) => {
    PlatformBridge.hapticFeedback('medium');
    router.push(target === 'memberships' ? '/memberships' : `/memberships?focus=${encodeURIComponent(target)}`);
  };

  const defaultMembership = memberships.find((m) => m.id === settings.defaultTarget);
  const directLabel = defaultMembership?.planName || defaultMembership?.businessName || 'Mi membresía';

  const cardShell = (
    <div className="flex items-center justify-between w-full relative z-10">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[10px] font-black uppercase tracking-[1.5px] text-[#E91E63]">
          {current.kind === 'pass' ? 'RABBITTY PASS' : 'MEMBRESÍA'}
        </span>
        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-slate-900/5 text-slate-800 border border-slate-900/10'}`}>
          {current.kind === 'pass' ? `Lvl. ${levelName}` : STATUS_LABEL[current.m.status] || current.m.status}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {slides.length > 1 && (
          <span className="flex items-center gap-1 mr-1" aria-hidden>
            {slides.map((_, i) => (
              <span
                key={i}
                className="rounded-full transition-all"
                style={{
                  width: i === slide ? 12 : 4,
                  height: 4,
                  background: i === slide ? '#E91E63' : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,10,20,0.18)',
                }}
              />
            ))}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            PlatformBridge.hapticFeedback('light');
            setShowSettings(true);
          }}
          aria-label="Opciones del Rabbitty Pass"
          className={`flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform border ${isDark ? 'border-white/10 text-white/60 bg-white/5' : 'border-slate-900/10 text-slate-500 bg-slate-900/[0.03]'}`}
        >
          <Settings2 size={13} />
        </button>
      </div>
    </div>
  );

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        drag={settings.swipe && slides.length > 1 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragDirectionLock
        onDragEnd={onDragEnd}
        className="w-full relative overflow-hidden rounded-3xl mb-5 cursor-pointer select-none"
        style={{
          transition: 'padding 0.3s ease',
          padding: isCollapsed && current.kind === 'pass' ? '12px 16px 18px' : '20px 20px 26px',
          background: isDark
            ? 'linear-gradient(135deg, #18181B 0%, #111113 45%, #240C1A 100%)'
            : 'linear-gradient(135deg, #FFFFFF 0%, #FFF5F8 50%, #FFE4EE 100%)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid rgba(233, 30, 99, 0.15)',
          boxShadow: isDark
            ? '0 12px 36px -10px rgba(0, 0, 0, 0.7), 0 0 24px -6px rgba(233, 30, 99, 0.15)'
            : '0 12px 30px -10px rgba(233, 30, 99, 0.15), 0 4px 12px rgba(0, 0, 0, 0.04)',
        }}
        onClick={() => { if (!draggedRef.current && current.kind === 'pass') openQr(); }}
      >
        {/* Halo de marca */}
        <div
          className="absolute -right-8 -top-8 w-44 h-44 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ background: 'radial-gradient(circle, #E91E63 0%, transparent 70%)' }}
        />

        <Image
          src="/rabbit_pass_watermark.png"
          alt=""
          width={210}
          height={244}
          aria-hidden
          className="pointer-events-none select-none absolute bottom-0 right-4 sm:right-8 opacity-[0.11] object-contain object-bottom"
        />

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.kind === 'pass' ? 'pass' : current.m.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="relative z-10"
          >
            {current.kind === 'pass' ? (
              isCollapsed ? (
                <div className="flex items-center justify-between">
                  <div className="min-w-0 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#E91E63]">RABBITTY PASS</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-slate-900/5 text-slate-800 border border-slate-900/10'}`}>
                        Lvl. {levelName}
                      </span>
                    </div>
                    {settings.collapsedBalance ? (
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white/45' : 'text-slate-500'}`}>Saldo:</span>
                        <AnimatedBunz
                          value={bunzBalance}
                          className={`text-sm font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
                        />
                        <span className="text-[10px] font-black text-[#E91E63]">BUNZ</span>
                      </div>
                    ) : (
                      <p className={`text-[11px] font-bold m-0 mt-0.5 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>{username}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openQr(); }}
                    className="flex items-center gap-1.5 bg-[#E91E63] hover:bg-[#D81B60] active:scale-95 text-white text-[11px] font-black px-3 py-1.5 rounded-full shadow-[0_4px_12px_rgba(233,30,99,0.35)] cursor-pointer border-none shrink-0"
                  >
                    <QrCode size={13} />
                    <span>Ver QR</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4">{cardShell}</div>

                  <div className="my-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block mb-0.5 ${isDark ? 'text-white/45' : 'text-slate-500'}`}>Saldo acumulado</span>
                    <div className="flex items-baseline gap-2">
                      <AnimatedBunz
                        value={bunzBalance}
                        className={`text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
                      />
                      <span className="text-lg font-black text-[#E91E63] tracking-wide">BUNZ</span>
                    </div>
                  </div>

                  {/* Miembro + Ver QR */}
                  <div className={`flex items-center justify-between pt-3 border-t mt-3 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <div className="truncate max-w-50">
                      <p className={`text-[13px] font-extrabold truncate m-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>{memberName}</p>
                      <p className={`text-[11px] m-0 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{username}</p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openQr(); }}
                      className="flex items-center gap-1.5 bg-[#E91E63] hover:bg-[#D81B60] active:scale-95 text-white text-xs font-black px-3.5 py-2 rounded-full shadow-[0_4px_14px_rgba(233,30,99,0.35)] transition-all cursor-pointer border-none"
                    >
                      <QrCode size={14} />
                      <span>Ver QR</span>
                      <ChevronRight size={12} />
                    </button>
                  </div>

                  {/* Accesos: hub de membresías y, si hay, la predeterminada */}
                  <div
                    className={`mt-3 grid gap-2 ${memberships.length > 0 && settings.showDirect ? 'grid-cols-2' : 'grid-cols-1'}`}
                  >
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openMemberships('memberships'); }}
                      className={`flex items-center justify-between gap-1.5 rounded-2xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-900/10 bg-white/70'}`}
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        <Ticket size={13} className="text-[#E91E63] shrink-0" />
                        <span className={`text-[11.5px] font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>
                          Membresías
                        </span>
                      </span>
                      <ArrowRight size={12} className={isDark ? 'text-white/35' : 'text-slate-400'} />
                    </button>

                    {memberships.length > 0 && settings.showDirect && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openMemberships(settings.defaultTarget); }}
                        className={`flex items-center justify-between gap-1.5 rounded-2xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform border ${isDark ? 'border-white/10 bg-white/5' : 'border-slate-900/10 bg-white/70'}`}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          {defaultMembership?.businessLogoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={defaultMembership.businessLogoUrl} alt="" className="h-4 w-4 rounded object-cover shrink-0" />
                          ) : (
                            <Sparkles size={13} className="text-[#E91E63] shrink-0" />
                          )}
                          <span className={`text-[11.5px] font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{directLabel}</span>
                        </span>
                        <ArrowRight size={12} className={isDark ? 'text-white/35' : 'text-slate-400'} />
                      </button>
                    )}
                  </div>
                </>
              )
            ) : (
              <>
                <div className="mb-4">{cardShell}</div>

                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border ${isDark ? 'border-white/12 bg-white/5' : 'border-slate-900/10 bg-white'}`}
                    style={current.m.badgeColor ? { borderColor: `${current.m.badgeColor}66` } : undefined}
                  >
                    {current.m.businessLogoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={current.m.businessLogoUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl">🏪</span>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`m-0 truncate text-[15px] font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                      {current.m.planName || 'Membresía'}
                    </p>
                    <p className={`m-0 mt-0.5 truncate text-[11.5px] font-semibold ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                      {current.m.businessName || 'Comercio afiliado'}
                    </p>
                    <p className={`m-0 mt-1 text-[10.5px] ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                      {current.m.noExpiration
                        ? 'Vigencia indefinida'
                        : current.m.currentPeriodEnd
                          ? `Vigente hasta ${new Date(current.m.currentPeriodEnd).toLocaleDateString('es-MX')}`
                          : 'Sin fecha de corte'}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openMemberships(current.m.id); }}
                    className="rounded-2xl py-2.5 text-[11.5px] font-black text-white active:scale-[0.98] transition-transform"
                    style={{ background: 'linear-gradient(135deg, #E91E63 0%, #8B5CF6 100%)' }}
                  >
                    Abrir membresía
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSettings({ defaultTarget: current.m.id, showDirect: true });
                      PlatformBridge.hapticFeedback('success');
                    }}
                    className={`rounded-2xl py-2.5 text-[11.5px] font-black active:scale-[0.98] transition-transform border ${isDark ? 'border-white/12 bg-white/5 text-white' : 'border-slate-900/10 bg-white/70 text-slate-900'}`}
                  >
                    {settings.defaultTarget === current.m.id ? 'Predeterminada ✓' : 'Usar por defecto'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Pill triangular para comprimir/expandir (solo en el pase) */}
        {current.kind === 'pass' && (
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? 'Expandir tarjeta Rabbitty Pass' : 'Comprimir tarjeta Rabbitty Pass'}
            title={isCollapsed ? 'Expandir tarjeta' : 'Comprimir tarjeta'}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center cursor-pointer border-none"
            style={{ background: 'transparent', padding: 0, outline: 'none' }}
          >
            <div
              className="flex items-center justify-center px-3.5 py-0.5 rounded-t-lg transition-transform active:scale-90"
              style={{
                background: isDark ? 'rgba(36, 36, 44, 0.95)' : 'rgba(255, 235, 242, 0.95)',
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(233, 30, 99, 0.25)',
                borderBottom: 'none',
                boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.15)',
              }}
            >
              <svg
                width="10"
                height="6"
                viewBox="0 0 10 6"
                fill="none"
                style={{ transform: isCollapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
              >
                <path d="M1 1L5 5L9 1" stroke="#E91E63" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </button>
        )}
      </motion.div>

      {/* ── Modal del código (QR estándar por defecto; neón a un toque) ── */}
      {isClient && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showQrModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10000 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-5 select-none"
              onClick={() => { setShowQrModal(false); PlatformBridge.hapticFeedback('light'); }}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                transition={{ type: 'spring', damping: 25, stiffness: 260 }}
                className="w-full max-w-85 bg-[#121214] border border-white/15 rounded-4xl p-6 flex flex-col items-center shadow-[0_20px_50px_rgba(0,0,0,0.9)] relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => { setShowQrModal(false); PlatformBridge.hapticFeedback('light'); }}
                  aria-label="Cerrar"
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-transform cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="text-center mb-3">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E91E63]/15 text-[#E91E63] text-[10px] font-black uppercase tracking-[1.5px] border border-[#E91E63]/30 mb-2">
                    <ShieldCheck size={12} /> Membresía Oficial
                  </div>
                  <h3 className="text-xl font-black text-white m-0">
                    {codeMode === 'standard' ? 'Escanea en Caja' : 'Rabbitty Code'}
                  </h3>
                  <p className="text-xs text-white/50 mt-1 mb-0 leading-relaxed">
                    {codeMode === 'standard'
                      ? 'Presenta tu código en el terminal del negocio para sumar Bunz en tu consumo.'
                      : 'Código neón propietario: solo nuestros lectores lo interpretan.'}
                  </p>
                </div>

                <div className="py-2 flex items-center justify-center w-full">
                  {codeMode === 'standard' ? (
                    <div
                      className="w-full max-w-[248px] rounded-[26px] p-3"
                      style={{
                        background: 'linear-gradient(160deg, #FFFFFF 0%, #FFFFFF 55%, #FFE6F0 100%)',
                        border: '1px solid rgba(233,30,99,0.30)',
                        boxShadow: '0 18px 40px -22px rgba(233,30,99,0.9)',
                      }}
                    >
                      <BrandQR value={qrValue} size={224} />
                    </div>
                  ) : (
                    <RabbittyCode
                      data={String(qrIdentifier)}
                      size={190}
                      showCardFrame={false}
                    />
                  )}
                </div>

                <div className="w-full bg-white/5 rounded-2xl p-3 border border-white/10 text-center mt-3">
                  <p className="text-xs font-black text-white uppercase tracking-wider m-0">{memberName}</p>
                  <p className="text-[11px] text-gray-400 font-mono tracking-widest mt-0.5 m-0">
                    {username} • {bunzBalance.toLocaleString()} BUNZ
                  </p>
                </div>

                <button
                    type="button"
                    onClick={() => {
                      PlatformBridge.hapticFeedback('light');
                      setCodeMode(codeMode === 'standard' ? 'neon' : 'standard');
                    }}
                    className="mt-3 text-[11px] font-black text-[#E91E63] underline-offset-4 hover:underline"
                  >
                    {codeMode === 'standard' ? 'Ver mi Rabbitty Code (neón)' : 'Volver al QR estándar'}
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* ── Opciones del Pass ── */}
      {isClient && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-10000 bg-black/70 backdrop-blur-md flex items-end justify-center"
              onClick={() => setShowSettings(false)}
            >
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="w-full max-w-lg max-h-[88dvh] overflow-y-auto rounded-t-[28px] px-5 pb-[max(env(safe-area-inset-bottom),28px)] pt-4"
                style={{
                  background: isDark ? '#141016' : '#FFFFFF',
                  borderTop: isDark ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(15,10,20,0.08)',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,10,20,0.14)' }} />

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="m-0 text-[15px] font-black" style={{ color: 'var(--text-primary)' }}>Opciones del Pass</p>
                    <p className="m-0 mt-0.5 text-[11px]" style={{ color: 'var(--text-muted)' }}>Se guarda en este dispositivo</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSettings(false)}
                    aria-label="Cerrar"
                    className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
                    style={{ background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,10,20,0.05)', color: 'var(--text-primary)' }}
                  >
                    <X size={17} />
                  </button>
                </div>

                {/* Código al abrir */}
                <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Código al abrir</p>
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {([
                    { id: 'standard' as const, label: 'QR estándar', hint: 'Cualquier cámara' },
                    { id: 'neon' as const, label: 'Rabbitty Code', hint: 'Neón, propietario' },
                  ]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { PlatformBridge.hapticFeedback('light'); updateSettings({ code: opt.id }); }}
                      className="rounded-2xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
                      style={{
                        background: settings.code === opt.id ? 'rgba(233,30,99,0.14)' : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,10,20,0.04)',
                        border: `1px solid ${settings.code === opt.id ? 'rgba(233,30,99,0.45)' : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,10,20,0.08)'}`,
                      }}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-[12px] font-black" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                        {settings.code === opt.id && <Check size={14} className="text-[#E91E63]" />}
                      </span>
                      <span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.hint}</span>
                    </button>
                  ))}
                </div>

                {/* Acceso directo */}
                <div className="mb-2 flex items-center justify-between">
                  <p className="m-0 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Acceso directo</p>
                  <button
                    type="button"
                    onClick={() => { PlatformBridge.hapticFeedback('light'); updateSettings({ showDirect: !settings.showDirect }); }}
                    role="switch"
                    aria-checked={settings.showDirect}
                    className="relative h-6 w-11 rounded-full transition-colors"
                    style={{ background: settings.showDirect ? '#E91E63' : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,10,20,0.12)' }}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                      style={{ left: 2, transform: settings.showDirect ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
                <p className="m-0 mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Qué abre el botón de membresía en el pase.
                </p>
                <div className="mb-4 flex flex-col gap-1.5">
                  {[{ id: 'memberships', label: 'Rabbitty Memberships (hub)' },
                    ...memberships.map((m) => ({ id: m.id, label: m.planName || m.businessName || 'Membresía' }))].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { PlatformBridge.hapticFeedback('light'); updateSettings({ defaultTarget: opt.id, showDirect: true }); }}
                      className="flex items-center justify-between rounded-xl px-3 py-2 active:scale-[0.99] transition-transform"
                      style={{
                        background: settings.defaultTarget === opt.id ? 'rgba(233,30,99,0.12)' : 'transparent',
                        border: `1px solid ${settings.defaultTarget === opt.id ? 'rgba(233,30,99,0.35)' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,10,20,0.06)'}`,
                      }}
                    >
                      <span className="truncate text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                      {settings.defaultTarget === opt.id && <Check size={14} className="text-[#E91E63] shrink-0" />}
                    </button>
                  ))}
                </div>

                {/* Swipe */}
                <SettingRow
                  isDark={isDark}
                  title="Deslizar entre tarjetas"
                  hint="Pass ↔ membresías"
                  value={settings.swipe}
                  onChange={(v) => updateSettings({ swipe: v })}
                />

                {/* Saldo comprimido */}
                <SettingRow
                  isDark={isDark}
                  title="Saldo con la tarjeta comprimida"
                  hint="Si se apaga, muestra tu usuario"
                  value={settings.collapsedBalance}
                  onChange={(v) => updateSettings({ collapsedBalance: v })}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

function SettingRow({
  isDark,
  title,
  hint,
  value,
  onChange,
}: {
  isDark: boolean;
  title: string;
  hint: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="m-0 text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
        <p className="m-0 mt-0.5 text-[10.5px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      </div>
      <button
        type="button"
        onClick={() => { PlatformBridge.hapticFeedback('light'); onChange(!value); }}
        role="switch"
        aria-checked={value}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: value ? '#E91E63' : isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,10,20,0.12)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
          style={{ left: 2, transform: value ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  );
}
