'use client';

/**
 * ── Rabbitty Pass ───────────────────────────────────────────────────────────
 *
 * 1. El pase: saldo, nivel, nombre y dos acciones en línea — “Mi Membresía” y
 *    “Ver QR”. Una sola puerta a membresías: la que esté marcada por defecto
 *    (si no hay ninguna configurada, abre el hub).
 * 2. El código: por defecto el **QR estándar** (BrandQR, cualquier cámara lo
 *    lee); el Rabbitty Code neón queda como secundario, a un toque.
 * 3. Las caras del pase: deslizar izquierda/derecha pasa del Pass a las
 *    membresías. Al arrastrar aparecen flechas con el nombre de la cara; la
 *    primera vez se insinúa con un “Desliza”.
 *
 * El engranaje (arriba a la derecha, solo con el pase extendido) abre
 * “Opciones del Pass”.
 */

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode, ChevronRight, ChevronLeft, X, ShieldCheck, Settings2, Ticket,
  Check, ArrowRight, Sparkles, SlidersHorizontal,
} from 'lucide-react';
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

type PassThemeId = 'classic' | 'fire' | 'mint' | 'neon';
type CollapsedView = 'balance' | 'level' | 'name';

interface PassSettings {
  /** Código que se abre con “Ver QR”. */
  code: 'standard' | 'neon';
  swipe: boolean;
  /** 'memberships' = hub; o el id de una membresía concreta. */
  defaultTarget: string;
  /** Qué muestra la tarjeta comprimida. */
  collapsedView: CollapsedView;
  /** Tema visual del pase (mismos 4 del código). */
  theme: PassThemeId;
  /** Ocultar membresías que no estén activas. */
  activeOnly: boolean;
  /** Mantener la pantalla encendida mientras se muestra el código. */
  wakeLock: boolean;
  /** Aviso de vencimiento en el pase (si hay fechas). */
  expiryNotice: boolean;
  /** Vibración del pase. */
  haptics: boolean;
}

const SETTINGS_KEY = 'rabbitty_pass_settings';
const COLLAPSED_KEY = 'rabbitty_pass_collapsed';

const DEFAULT_SETTINGS: PassSettings = {
  code: 'standard',
  swipe: true,
  defaultTarget: 'memberships',
  collapsedView: 'balance',
  theme: 'classic',
  activeOnly: false,
  wakeLock: true,
  expiryNotice: true,
  haptics: true,
};

/** Paleta del pase: cambia tarjeta, botones, puntos y finders del código. */
const PASS_THEMES: Record<PassThemeId, {
  label: string;
  from: string;
  to: string;
  accent: string;
  bgDark: string;
  bgLight: string;
}> = {
  classic: {
    label: 'Clásico',
    from: '#E91E63', to: '#8B5CF6', accent: '#E91E63',
    bgDark: 'linear-gradient(135deg, #18181B 0%, #111113 45%, #240C1A 100%)',
    bgLight: 'linear-gradient(135deg, #FFFFFF 0%, #FFF5F8 50%, #FFE4EE 100%)',
  },
  fire: {
    label: 'Fuego',
    from: '#F97316', to: '#EF4444', accent: '#F97316',
    bgDark: 'linear-gradient(135deg, #1B1310 0%, #120C0A 45%, #2A1108 100%)',
    bgLight: 'linear-gradient(135deg, #FFFFFF 0%, #FFF7F2 50%, #FFE8DA 100%)',
  },
  mint: {
    label: 'Menta',
    from: '#10B981', to: '#22D3EE', accent: '#10B981',
    bgDark: 'linear-gradient(135deg, #0F1A17 0%, #0B1210 45%, #07301F 100%)',
    bgLight: 'linear-gradient(135deg, #FFFFFF 0%, #F2FBF7 50%, #DFF6EC 100%)',
  },
  neon: {
    label: 'Neón',
    from: '#A855F7', to: '#EC4899', accent: '#A855F7',
    bgDark: 'linear-gradient(135deg, #191024 0%, #0F0A18 45%, #2A0B33 100%)',
    bgLight: 'linear-gradient(135deg, #FFFFFF 0%, #FAF3FF 50%, #F3E4FF 100%)',
  },
};

const THEME_IDS = Object.keys(PASS_THEMES) as PassThemeId[];

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
    const parsed = JSON.parse(raw) as Partial<PassSettings> & { collapsedBalance?: boolean };
    // Migración: la versión anterior guardaba un booleano.
    const collapsedView =
      parsed.collapsedView ?? (parsed.collapsedBalance === false ? 'name' : 'balance');
    return { ...DEFAULT_SETTINGS, ...parsed, collapsedView };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

const daysUntil = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return Math.ceil((ms - Date.now()) / 86_400_000);
};

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
  const [allMemberships, setAllMemberships] = useState<PassMembership[]>([]);
  const [slide, setSlide] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [teachSwipe, setTeachSwipe] = useState(false);
  const dragDistanceRef = useRef(0);
  const taughtRef = useRef(false);

  const bunzBalance = (user?.totalBunzEarned || 0) - (user?.totalBunzSpent || 0);
  const qrIdentifier = user?.id || user?.telegramId || 'rabbitty_guest';
  const qrValue = `https://app.rabbitty.me/u/${encodeURIComponent(user?.username || String(qrIdentifier))}`;

  const memberName = user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : 'Explorador Rabbitty';
  const username = user?.username ? `@${user.username}` : '@miembro';

  const palette = PASS_THEMES[settings.theme] ?? PASS_THEMES.classic;

  /** Vibración del pase (respeta la preferencia). */
  const haptic = (style: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') => {
    if (settings.haptics) PlatformBridge.hapticFeedback(style);
  };

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

  // ── Membresías (se guardan todas; la vista filtra) ──
  useEffect(() => {
    let alive = true;
    void PlatformBridge.getAuthHeaders()
      .then((headers) => fetch('/api/memberships', { headers: headers as Record<string, string> }))
      .then((r) => r.json())
      .then((d) => {
        if (!alive || !d?.success || !Array.isArray(d.memberships)) return;
        setAllMemberships(
          (d.memberships as PassMembership[]).filter((m) => m.status !== 'REVOKED' && m.status !== 'EXPIRED'),
        );
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const memberships = useMemo(
    () => (settings.activeOnly ? allMemberships.filter((m) => m.status === 'ACTIVE') : allMemberships),
    [allMemberships, settings.activeOnly],
  );

  // ── Vencimiento próximo (solo si el usuario lo pide y hay fechas) ──
  const expiring = useMemo(() => {
    const list = allMemberships
      .filter((m) => !m.noExpiration && m.currentPeriodEnd)
      .map((m) => ({ m, days: daysUntil(m.currentPeriodEnd) }))
      .filter((x): x is { m: PassMembership; days: number } => x.days !== null && x.days >= 0 && x.days <= 30)
      .sort((a, b) => a.days - b.days);
    return list[0] ?? null;
  }, [allMemberships]);

  const [isCollapsed, setIsCollapsed] = useState(false);
  useEffect(() => {
    try {
      setIsCollapsed(localStorage.getItem(COLLAPSED_KEY) === 'true');
    } catch {}
  }, []);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic('light');
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
  const canSwipe = settings.swipe && slides.length > 1;

  // Insinuación de swipe: una sola vez por sesión.
  useEffect(() => {
    if (!canSwipe || isCollapsed || taughtRef.current) return;
    const t = window.setTimeout(() => {
      setTeachSwipe(true);
      taughtRef.current = true;
      window.setTimeout(() => setTeachSwipe(false), 2600);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [canSwipe, isCollapsed]);

  const goto = (dir: 1 | -1) => {
    setSlide((prev) => {
      const next = Math.min(Math.max(prev + dir, 0), slides.length - 1);
      if (next !== prev) haptic('light');
      return next;
    });
    setDragX(0);
  };

  const onDragEnd = (_e: unknown, info: { offset: { x: number } }) => {
    setDragX(0);
    if (Math.abs(info.offset.x) < 55) return;
    goto(info.offset.x < 0 ? 1 : -1);
  };

  // ── Pantalla encendida mientras se muestra el código ──
  useEffect(() => {
    if (!showQrModal || !settings.wakeLock) return;
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
    let sentinel: { release: () => Promise<void> } | null = null;
    let cancelled = false;

    const request = async () => {
      try {
        const wakeLock = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<{ release: () => Promise<void> }> } }).wakeLock;
        if (!wakeLock) return;
        sentinel = await wakeLock.request('screen');
      } catch { /* el dispositivo lo niega (batería baja) */ }
    };
    void request();

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sentinel) void request();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      if (!cancelled) return;
      void sentinel?.release().catch(() => {});
    };
  }, [showQrModal, settings.wakeLock]);

  const openQr = () => {
    // Si el gesto fue un arrastre, no abrimos el código.
    if (dragDistanceRef.current > 8) return;
    haptic('medium');
    setCodeMode(settings.code);
    setShowQrModal(true);
  };

  const openMemberships = (target: string) => {
    haptic('medium');
    router.push(target === 'memberships' ? '/memberships' : `/memberships?focus=${encodeURIComponent(target)}`);
  };

  /** A dónde va “Mi Membresía”: la predeterminada o el hub. */
  const membershipTarget = useMemo(() => {
    if (settings.defaultTarget === 'memberships') return 'memberships';
    return memberships.some((m) => m.id === settings.defaultTarget) ? settings.defaultTarget : 'memberships';
  }, [settings.defaultTarget, memberships]);

  const nextSlide = slides[Math.min(slide + 1, slides.length - 1)];
  const prevSlide = slides[Math.max(slide - 1, 0)];
  const labelOf = (s: { kind: 'pass' } | { kind: 'membership'; m: PassMembership }) =>
    s.kind === 'pass' ? 'Rabbitty Pass' : s.m.planName || s.m.businessName || 'Membresía';

  const collapsedValue =
    settings.collapsedView === 'balance' ? (
      <span className="flex items-baseline gap-1">
        <AnimatedBunz
          value={bunzBalance}
          className={`text-sm font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
        />
        <span className="text-[10px] font-black" style={{ color: palette.accent }}>BUNZ</span>
      </span>
    ) : settings.collapsedView === 'level' ? (
      <span className={`text-sm font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>Nivel {levelName}</span>
    ) : (
      <span className={`text-sm font-black truncate ${isDark ? 'text-white' : 'text-slate-900'}`}>{memberName}</span>
    );

  const smallBtn = (extra = '') =>
    `flex items-center gap-1 rounded-full font-black active:scale-95 transition-transform shrink-0 text-[10.5px] px-2.5 py-1.5 border-none ${extra}`;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        drag={canSwipe ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.16}
        dragDirectionLock
        onPointerDown={() => { dragDistanceRef.current = 0; }}
        onDrag={(_e, info) => { dragDistanceRef.current = Math.abs(info.offset.x); setDragX(info.offset.x); }}
        onDragEnd={onDragEnd}
        className="w-full relative overflow-hidden rounded-3xl mb-5 cursor-pointer select-none"
        style={{
          transition: 'padding 0.3s ease',
          padding: isCollapsed && current.kind === 'pass' ? '12px 16px 18px' : '18px 18px 24px',
          background: isDark ? palette.bgDark : palette.bgLight,
          border: `1px solid ${isDark ? 'rgba(255,255,255,0.10)' : `${palette.accent}26`}`,
          boxShadow: isDark
            ? `0 12px 36px -10px rgba(0, 0, 0, 0.7), 0 0 24px -6px ${palette.accent}26`
            : `0 12px 30px -10px ${palette.accent}26, 0 4px 12px rgba(0, 0, 0, 0.04)`,
        }}
        onClick={() => { if (dragDistanceRef.current <= 8 && current.kind === 'pass') openQr(); }}
      >
        {/* Halo del tema */}
        <div
          className="absolute -right-8 -top-8 w-44 h-44 rounded-full pointer-events-none blur-3xl opacity-30"
          style={{ background: `radial-gradient(circle, ${palette.accent} 0%, transparent 70%)` }}
        />

        <Image
          src="/rabbit_pass_watermark.png"
          alt=""
          width={210}
          height={244}
          aria-hidden
          className="pointer-events-none select-none absolute bottom-0 right-4 sm:right-8 opacity-[0.11] object-contain object-bottom"
        />

        {/* Flechas de swipe: aparecen mientras arrastras */}
        {canSwipe && (
          <>
            <AnimatePresence>
              {dragX < -12 && slide < slides.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-black uppercase tracking-wide backdrop-blur-md"
                  style={{ background: isDark ? 'rgba(12,8,18,0.82)' : 'rgba(255,255,255,0.92)', color: palette.accent, border: `1px solid ${palette.accent}66` }}
                >
                  {labelOf(nextSlide)}
                  <ChevronRight size={12} />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {dragX > 12 && slide > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 z-30 flex items-center gap-1 rounded-full px-2 py-1 text-[9.5px] font-black uppercase tracking-wide backdrop-blur-md"
                  style={{ background: isDark ? 'rgba(12,8,18,0.82)' : 'rgba(255,255,255,0.92)', color: palette.accent, border: `1px solid ${palette.accent}66` }}
                >
                  <ChevronLeft size={12} />
                  {labelOf(prevSlide)}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Insinuación inicial: el contenido se corre solo una vez */}
            <AnimatePresence>
              {teachSwipe && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="pointer-events-none absolute inset-y-0 right-0 z-20 w-7"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${palette.accent}22 100%)`,
                    borderRight: `1px solid ${palette.accent}44`,
                  }}
                />
              )}
            </AnimatePresence>
          </>
        )}

        <motion.div animate={teachSwipe ? { x: [0, -14, 0] } : { x: 0 }} transition={{ duration: 0.85, repeat: 1, ease: 'easeInOut' }}>
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
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 truncate">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: palette.accent }}>RABBITTY PASS</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-slate-900/5 text-slate-800 border border-slate-900/10'}`}>
                        Lvl. {levelName}
                      </span>
                    </div>
                    <div className="mt-0.5 min-w-0">{collapsedValue}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); openQr(); }}
                    className={smallBtn('text-white shadow-[0_4px_12px_rgba(0,0,0,0.18)]')}
                    style={{ background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)` }}
                  >
                    <QrCode size={12} />
                    <span>Ver QR</span>
                  </button>
                </div>
              ) : (
                <>
                  {/* Cabecera: marca + nivel + puntos + engranaje */}
                  <div className="mb-3 flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: palette.accent }}>
                        RABBITTY PASS
                      </span>
                      <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-slate-900/5 text-slate-800 border border-slate-900/10'}`}>
                        Lvl. {levelName}
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
                                background: i === slide ? palette.accent : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,10,20,0.18)',
                              }}
                            />
                          ))}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          haptic('light');
                          setShowSettings(true);
                        }}
                        aria-label="Opciones del Rabbitty Pass"
                        className={`flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform border ${isDark ? 'border-white/10 text-white/60 bg-white/5' : 'border-slate-900/10 text-slate-500 bg-slate-900/[0.03]'}`}
                      >
                        <Settings2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div className="my-2">
                    <span className={`text-[11px] font-bold uppercase tracking-wider block mb-0.5 ${isDark ? 'text-white/45' : 'text-slate-500'}`}>Saldo acumulado</span>
                    <div className="flex items-baseline gap-2">
                      <AnimatedBunz
                        value={bunzBalance}
                        className={`text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
                      />
                      <span className="text-lg font-black tracking-wide" style={{ color: palette.accent }}>BUNZ</span>
                    </div>
                  </div>

                  {/* Aviso de vencimiento (si hay fecha y está activado) */}
                  {settings.expiryNotice && expiring && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); openMemberships(expiring.m.id); }}
                      className="mb-2 flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left active:scale-[0.99] transition-transform"
                      style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}
                    >
                      <span className="text-[11px]">⏳</span>
                      <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold text-amber-500">
                        {expiring.m.planName || expiring.m.businessName}: {expiring.days === 0 ? 'vence hoy' : `vence en ${expiring.days} día${expiring.days === 1 ? '' : 's'}`}
                      </span>
                      <ArrowRight size={11} className="text-amber-500 shrink-0" />
                    </button>
                  )}

                  {/* Miembro + acciones en línea */}
                  <div className={`flex items-center justify-between gap-2 pt-3 border-t mt-2 ${isDark ? 'border-white/10' : 'border-slate-200'}`}>
                    <div className="truncate min-w-0">
                      <p className={`text-[13px] font-extrabold truncate m-0 ${isDark ? 'text-white' : 'text-slate-900'}`}>{memberName}</p>
                      <p className={`text-[10.5px] m-0 ${isDark ? 'text-white/40' : 'text-slate-500'}`}>{username}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openMemberships(membershipTarget); }}
                        className={smallBtn(isDark ? 'text-white bg-white/8 border border-white/12' : 'text-slate-900 bg-white/80 border border-slate-900/10')}
                      >
                        <Ticket size={12} style={{ color: palette.accent }} />
                        <span>Mi Membresía</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); openQr(); }}
                        className={smallBtn('text-white')}
                        style={{ background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)`, boxShadow: `0 4px 12px ${palette.accent}40` }}
                      >
                        <QrCode size={12} />
                        <span>Ver QR</span>
                      </button>
                    </div>
                  </div>
                </>
              )
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-[1.5px]" style={{ color: palette.accent }}>MEMBRESÍA</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${isDark ? 'bg-white/10 text-white/80 border border-white/10' : 'bg-slate-900/5 text-slate-800 border border-slate-900/10'}`}>
                      {STATUS_LABEL[current.m.status] || current.m.status}
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
                              background: i === slide ? palette.accent : isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,10,20,0.18)',
                            }}
                          />
                        ))}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); haptic('light'); setShowSettings(true); }}
                      aria-label="Opciones del Rabbitty Pass"
                      className={`flex h-7 w-7 items-center justify-center rounded-full active:scale-90 transition-transform border ${isDark ? 'border-white/10 text-white/60 bg-white/5' : 'border-slate-900/10 text-slate-500 bg-slate-900/[0.03]'}`}
                    >
                      <Settings2 size={13} />
                    </button>
                  </div>
                </div>

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
                    style={{ background: `linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%)` }}
                  >
                    Abrir membresía
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateSettings({ defaultTarget: current.m.id });
                      haptic('success');
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
        </motion.div>

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
                border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : `1px solid ${palette.accent}40`,
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
                <path
                  d="M1 1L5 5L9 1"
                  stroke={palette.accent}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
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
              onClick={() => { setShowQrModal(false); haptic('light'); }}
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
                  onClick={() => { setShowQrModal(false); haptic('light'); }}
                  aria-label="Cerrar"
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 border border-white/10 flex items-center justify-center text-white/70 active:scale-90 transition-transform cursor-pointer"
                >
                  <X size={18} />
                </button>

                <div className="text-center mb-3">
                  <div
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[1.5px] border mb-2"
                    style={{ color: palette.accent, borderColor: `${palette.accent}4d`, background: `${palette.accent}26` }}
                  >
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
                        background: 'linear-gradient(160deg, #FFFFFF 0%, #FFFFFF 55%, #FFF0F6 100%)',
                        border: `1px solid ${palette.accent}4d`,
                        boxShadow: `0 18px 40px -22px ${palette.accent}`,
                      }}
                    >
                      <BrandQR value={qrValue} size={224} from={palette.from} to={palette.to} />
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
                    haptic('light');
                    setCodeMode(codeMode === 'standard' ? 'neon' : 'standard');
                  }}
                  className="mt-3 text-[11px] font-black underline-offset-4 hover:underline"
                  style={{ color: palette.accent }}
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
                      onClick={() => { haptic('light'); updateSettings({ code: opt.id }); }}
                      className="rounded-2xl px-3 py-2.5 text-left active:scale-[0.98] transition-transform"
                      style={{
                        background: settings.code === opt.id ? `${palette.accent}24` : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,10,20,0.04)',
                        border: `1px solid ${settings.code === opt.id ? `${palette.accent}73` : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,10,20,0.08)'}`,
                      }}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-[12px] font-black" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                        {settings.code === opt.id && <Check size={14} style={{ color: palette.accent }} />}
                      </span>
                      <span className="mt-0.5 block text-[10px]" style={{ color: 'var(--text-muted)' }}>{opt.hint}</span>
                    </button>
                  ))}
                </div>

                {/* Tema del pass */}
                <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Tema del Pass</p>
                <div className="mb-4 flex items-center gap-2">
                  {THEME_IDS.map((id) => {
                    const t = PASS_THEMES[id];
                    const active = settings.theme === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => { haptic('light'); updateSettings({ theme: id }); }}
                        aria-label={`Tema ${t.label}`}
                        className="flex h-9 w-9 items-center justify-center rounded-full active:scale-90 transition-transform"
                        style={{
                          background: `linear-gradient(135deg, ${t.from} 0%, ${t.to} 100%)`,
                          border: active ? `2px solid ${isDark ? '#fff' : '#0f0a14'}` : '2px solid transparent',
                          boxShadow: active ? `0 0 0 2px ${t.accent}55` : 'none',
                        }}
                      >
                        {active && <Check size={14} className="text-white" />}
                      </button>
                    );
                  })}
                  <span className="ml-1 text-[11px] font-bold" style={{ color: 'var(--text-muted)' }}>{PASS_THEMES[settings.theme].label}</span>
                </div>

                {/* Membresía predeterminada */}
                <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Membresía predeterminada</p>
                <p className="m-0 mb-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  Es la que abre “Mi Membresía” en el pase.
                </p>
                <div className="mb-4 flex flex-col gap-1.5">
                  {[{ id: 'memberships', label: 'Rabbitty Memberships (todas)' },
                    ...memberships.map((m) => ({ id: m.id, label: m.planName || m.businessName || 'Membresía' }))].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { haptic('light'); updateSettings({ defaultTarget: opt.id }); }}
                      className="flex items-center justify-between rounded-xl px-3 py-2 active:scale-[0.99] transition-transform"
                      style={{
                        background: settings.defaultTarget === opt.id ? `${palette.accent}1f` : 'transparent',
                        border: `1px solid ${settings.defaultTarget === opt.id ? `${palette.accent}59` : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,10,20,0.06)'}`,
                      }}
                    >
                      <span className="truncate text-[12px] font-bold" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                      {settings.defaultTarget === opt.id && <Check size={14} style={{ color: palette.accent }} className="shrink-0" />}
                    </button>
                  ))}
                </div>

                {/* Tarjeta comprimida */}
                <p className="m-0 mb-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: 'var(--text-muted)' }}>Tarjeta comprimida</p>
                <div className="mb-4 grid grid-cols-3 gap-1.5">
                  {([
                    { id: 'balance' as const, label: 'Saldo' },
                    { id: 'level' as const, label: 'Nivel' },
                    { id: 'name' as const, label: 'Nombre' },
                  ]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => { haptic('light'); updateSettings({ collapsedView: opt.id }); }}
                      className="rounded-xl py-2 text-[11.5px] font-black active:scale-[0.98] transition-transform"
                      style={{
                        background: settings.collapsedView === opt.id ? `${palette.accent}24` : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,10,20,0.04)',
                        border: `1px solid ${settings.collapsedView === opt.id ? `${palette.accent}73` : isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,10,20,0.08)'}`,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Interruptores */}
                <SettingRow
                  isDark={isDark}
                  title="Deslizar entre tarjetas"
                  hint="Pass ↔ membresías"
                  value={settings.swipe}
                  onChange={(v) => updateSettings({ swipe: v })}
                />
                <SettingRow
                  isDark={isDark}
                  title="Solo membresías activas"
                  hint="Oculta vencidas y en gracia"
                  value={settings.activeOnly}
                  onChange={(v) => updateSettings({ activeOnly: v })}
                />
                <SettingRow
                  isDark={isDark}
                  title="Pantalla encendida"
                  hint="Mientras se muestra el código"
                  value={settings.wakeLock}
                  onChange={(v) => updateSettings({ wakeLock: v })}
                />
                {expiring && (
                  <SettingRow
                    isDark={isDark}
                    title="Aviso de vencimiento"
                    hint={`${expiring.m.planName || 'Membresía'} vence en ${expiring.days} día${expiring.days === 1 ? '' : 's'}`}
                    value={settings.expiryNotice}
                    onChange={(v) => updateSettings({ expiryNotice: v })}
                  />
                )}
                <SettingRow
                  isDark={isDark}
                  title="Hápticos del pase"
                  hint="Vibración al deslizar y abrir"
                  value={settings.haptics}
                  onChange={(v) => updateSettings({ haptics: v })}
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
        onClick={() => onChange(!value)}
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
