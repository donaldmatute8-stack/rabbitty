'use client';

import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { X, Sun, QrCode, Sparkles, Flame, Leaf, Zap, ArrowLeft } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Rabbitty Code Simple — Réplica del diseño del Código QR de Telegram.
 *
 * FIX v2:
 * 1. Fondo programático (SVG doodles + gradiente CSS) por tema — sin screenshot artifacts.
 * 2. QR con algoritmo de esquinas por vecinos (neighbor-aware) → aspecto fluido como Telegram.
 * 3. Selector de temas con mini-preview generado en código (no cortes de screenshot).
 * 4. Centro del QR usa app_icon_only.png con gradiente idéntico al tema.
 */

export type RabbittyCodeTheme = 'theme1' | 'theme2' | 'theme3' | 'theme4';

interface ThemeConfig {
  id: RabbittyCodeTheme;
  title: string;
  /** Gradiente del QR (from → to) */
  from: string;
  to: string;
  /** Color de fondo del wallpaper */
  bgDark: string;
  bgAccent: string;
  /** Color del handle @username */
  handleColor: string;
  /** Color doodle en el mini-preview */
  doodleColor: string;
  /** Color del botón Share */
  shareBtnFrom?: string;
  shareBtnTo?: string;
}

const TG_THEMES: Record<RabbittyCodeTheme, ThemeConfig> = {
  theme1: {
    id: 'theme1',
    title: 'Clásico',
    from: '#1E6ED4',
    to: '#7C22C8',
    bgDark: '#06060E',
    bgAccent: '#0D1A33',
    handleColor: '#1a1a1a',
    doodleColor: 'rgba(90,140,220,0.22)',
  },
  theme2: {
    id: 'theme2',
    title: 'Fuego',
    // Rojo vivo: el degradado va de rojo intenso a rojo profundo
    // (antes arrancaba en naranja y el QR se leía anaranjado).
    from: '#FF2A2A',
    to: '#A50E0E',
    bgDark: '#120405',
    bgAccent: '#2A0708',
    handleColor: '#1a1a1a',
    doodleColor: 'rgba(220,50,50,0.22)',
  },
  theme3: {
    id: 'theme3',
    title: 'Menta',
    from: '#00B09B',
    to: '#1565C0',
    bgDark: '#010E0D',
    bgAccent: '#001A18',
    handleColor: '#1a1a1a',
    doodleColor: 'rgba(40,170,160,0.22)',
  },
  theme4: {
    id: 'theme4',
    title: 'Neón',
    from: '#8E24AA',
    to: '#3949AB',
    bgDark: '#080510',
    bgAccent: '#11093A',
    handleColor: '#1a1a1a',
    doodleColor: 'rgba(140,60,200,0.22)',
  },
};

const THEME_LIST: RabbittyCodeTheme[] = ['theme1', 'theme2', 'theme3', 'theme4'];

/** Doodles SVG mínimos inline para el fondo — distintos en cada tema */
const DOODLE_PATHS: Record<RabbittyCodeTheme, string> = {
  theme1: `
    <circle cx="12%" cy="8%" r="22" fill="none" stroke-width="2.5" stroke="rgba(80,130,230,0.4)"/>
    <path d="M80%,5% Q83%,2% 86%,5% T92%,5%" fill="none" stroke="rgba(80,130,230,0.35)" stroke-width="2"/>
    <circle cx="92%" cy="18%" r="8" fill="none" stroke="rgba(80,130,230,0.3)" stroke-width="2"/>
    <path d="M4%,55% l10,0 m-5,-5 l0,10" fill="none" stroke="rgba(80,130,230,0.35)" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M88%,65% Q91%,60% 94%,65% Q97%,60% 100%,65%" fill="none" stroke="rgba(80,130,230,0.3)" stroke-width="2.2"/>
    <circle cx="6%" cy="82%" r="14" fill="none" stroke="rgba(80,130,230,0.25)" stroke-width="2"/>
    <path d="M85%,80% l6,0 m-3,-3 l0,6" fill="none" stroke="rgba(80,130,230,0.4)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="50%" cy="3%" r="6" fill="none" stroke="rgba(80,130,230,0.3)" stroke-width="2"/>
  `,
  theme2: `
    <path d="M10%,10% l5,-8 l5,8 l-10,0" fill="none" stroke="rgba(200,150,30,0.4)" stroke-width="2.5"/>
    <circle cx="88%" cy="12%" r="16" fill="none" stroke="rgba(200,150,30,0.35)" stroke-width="2.2"/>
    <path d="M3%,45% Q6%,40% 9%,45% Q12%,40% 15%,45%" fill="none" stroke="rgba(200,150,30,0.3)" stroke-width="2"/>
    <path d="M85%,50% l8,-6 l2,10 l-10,-4" fill="none" stroke="rgba(200,150,30,0.35)" stroke-width="2"/>
    <circle cx="8%" cy="78%" r="10" fill="none" stroke="rgba(200,150,30,0.3)" stroke-width="2"/>
    <path d="M86%,78% l6,0 m-3,-3 l0,6" fill="none" stroke="rgba(200,150,30,0.4)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="45%" cy="5%" r="8" fill="none" stroke="rgba(200,150,30,0.3)" stroke-width="2"/>
  `,
  theme3: `
    <circle cx="10%" cy="10%" r="18" fill="none" stroke="rgba(30,170,160,0.4)" stroke-width="2.5"/>
    <path d="M85%,8% Q88%,4% 91%,8% T97%,8%" fill="none" stroke="rgba(30,170,160,0.35)" stroke-width="2"/>
    <path d="M2%,50% l10,0 m-5,-5 l0,10" fill="none" stroke="rgba(30,170,160,0.4)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="90%" cy="55%" r="12" fill="none" stroke="rgba(30,170,160,0.3)" stroke-width="2"/>
    <path d="M5%,80% Q8%,75% 11%,80% Q14%,75% 17%,80%" fill="none" stroke="rgba(30,170,160,0.3)" stroke-width="2"/>
    <path d="M86%,82% l6,-5 l1,8 l-7,-3" fill="none" stroke="rgba(30,170,160,0.35)" stroke-width="2"/>
    <circle cx="50%" cy="4%" r="7" fill="none" stroke="rgba(30,170,160,0.3)" stroke-width="2"/>
  `,
  theme4: `
    <path d="M8%,8% Q12%,2% 16%,8%" fill="none" stroke="rgba(150,60,210,0.45)" stroke-width="2.5"/>
    <circle cx="88%" cy="10%" r="20" fill="none" stroke="rgba(150,60,210,0.35)" stroke-width="2.2"/>
    <path d="M4%,48% l5,-7 l5,7 l-10,0" fill="none" stroke="rgba(150,60,210,0.4)" stroke-width="2"/>
    <path d="M86%,52% Q89%,46% 92%,52% Q95%,46% 98%,52%" fill="none" stroke="rgba(150,60,210,0.35)" stroke-width="2"/>
    <circle cx="6%" cy="80%" r="12" fill="none" stroke="rgba(150,60,210,0.3)" stroke-width="2"/>
    <path d="M85%,80% l6,0 m-3,-3 l0,6" fill="none" stroke="rgba(150,60,210,0.4)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="50%" cy="4%" r="9" fill="none" stroke="rgba(150,60,210,0.3)" stroke-width="2"/>
  `,
};

interface Props {
  value: string;
  handle?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  size?: number;
  theme?: RabbittyCodeTheme;
  logoSrc?: string;
  onShare?: () => void;
  onScan?: () => void;
  onClose?: () => void;
  /**
   * Fondo temático propio (degradado radial + doodles).
   * En /scan lo apagamos para dejar ver la imagen de fondo de la página.
   */
  showBackdrop?: boolean;
}

/** Genera el path SVG de un módulo QR estilo Telegram con esquinas redondeadas adaptadas a vecinos. */
function buildModulePath(
  isDark: (row: number, col: number) => boolean,
  count: number,
  pad: number,
  r: number, // radio de esquina como fracción del módulo (0..0.5)
): string {
  let d = '';

  for (let row = 0; row < count; row++) {
    for (let col = 0; col < count; col++) {
      if (!isDark(row, col)) continue;

      // Vecinos: top, right, bottom, left
      const top    = row > 0            && isDark(row - 1, col);
      const bot    = row < count - 1    && isDark(row + 1, col);
      const left   = col > 0            && isDark(row, col - 1);
      const right  = col < count - 1    && isDark(row, col + 1);

      const x = col + pad;
      const y = row + pad;
      const size = 1; // módulo = 1 unidad en viewBox

      // Radio de esquina: 0 si esa esquina está "unida" a un vecino
      const tl = !top && !left    ? r : 0;
      const tr = !top && !right   ? r : 0;
      const br = !bot && !right   ? r : 0;
      const bl = !bot && !left    ? r : 0;

      // Dibujamos un rectángulo con esquinas individuales redondeadas
      // M (x + tl, y) → tl curve → right → tr curve → bottom → br curve → left → bl curve → close
      d += `M${x + tl},${y} `;
      d += `H${x + size - tr} `;
      if (tr > 0) d += `Q${x + size},${y} ${x + size},${y + tr} `;
      d += `V${y + size - br} `;
      if (br > 0) d += `Q${x + size},${y + size} ${x + size - br},${y + size} `;
      d += `H${x + bl} `;
      if (bl > 0) d += `Q${x},${y + size} ${x},${y + size - bl} `;
      d += `V${y + tl} `;
      if (tl > 0) d += `Q${x},${y} ${x + tl},${y} `;
      d += 'Z ';
    }
  }
  return d;
}

/** Finder pattern grande con esquinas muy redondeadas (igual a Telegram). */
function buildFinderPath(fx: number, fy: number, pad: number): string {
  const x = fx + pad;
  const y = fy + pad;
  const r = 1.5; // radio outer
  const ri = 0.9; // radio inner dot

  // Outer ring (7x7 con apertura interna de 5x5)
  // → outer square rounded - inner square rounded
  const outer = `M${x + r},${y} H${x + 7 - r} Q${x + 7},${y} ${x + 7},${y + r} V${y + 7 - r} Q${x + 7},${y + 7} ${x + 7 - r},${y + 7} H${x + r} Q${x},${y + 7} ${x},${y + 7 - r} V${y + r} Q${x},${y} ${x + r},${y} Z `;
  // Hole (5x5 centered at +1,+1)
  const hx = x + 1, hy = y + 1;
  const rh = 0.8;
  const hole = `M${hx + rh},${hy} H${hx + 5 - rh} Q${hx + 5},${hy} ${hx + 5},${hy + rh} V${hy + 5 - rh} Q${hx + 5},${hy + 5} ${hx + 5 - rh},${hy + 5} H${hx + rh} Q${hx},${hy + 5} ${hx},${hy + 5 - rh} V${hy + rh} Q${hx},${hy} ${hx + rh},${hy} Z `;
  // Inner dot (3x3 centered at +2,+2)
  const dx = x + 2, dy = y + 2;
  const dot = `M${dx + ri},${dy} H${dx + 3 - ri} Q${dx + 3},${dy} ${dx + 3},${dy + ri} V${dy + 3 - ri} Q${dx + 3},${dy + 3} ${dx + 3 - ri},${dy + 3} H${dx + ri} Q${dx},${dy + 3} ${dx},${dy + 3 - ri} V${dy + ri} Q${dx},${dy} ${dx + ri},${dy} Z `;

  return outer + hole + dot;
}

/** Glifo vectorial que identifica cada identidad — sin fondos ni screenshots. */
const THEME_GLYPHS: Record<RabbittyCodeTheme, { icon: LucideIcon; label: string }> = {
  theme1: { icon: Sparkles, label: 'Clásico' },
  theme2: { icon: Flame, label: 'Fuego' },
  theme3: { icon: Leaf, label: 'Menta' },
  theme4: { icon: Zap, label: 'Neón' },
};

function ThemeGlyph({ id, isSelected }: { id: RabbittyCodeTheme; isSelected: boolean }) {
  const theme = TG_THEMES[id];
  const { icon: Icon, label } = THEME_GLYPHS[id];

  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-[14px] border transition-all duration-200"
      style={{
        background: 'transparent',
        borderColor: isSelected ? theme.from : 'rgba(255,255,255,0.10)',
        boxShadow: isSelected ? `0 0 0 2px ${theme.from}59, 0 0 18px ${theme.to}40` : 'none',
        opacity: isSelected ? 1 : 0.6,
      }}
    >
      <Icon
        size={24}
        strokeWidth={2.1}
        style={{ color: theme.from, filter: `drop-shadow(0 0 7px ${theme.to}66)` }}
      />
      <span
        className="text-[9px] font-extrabold uppercase tracking-[0.12em]"
        style={{ color: isSelected ? '#ffffff' : 'rgba(255,255,255,0.65)' }}
      >
        {label}
      </span>
    </div>
  );
}

export default function RabbittyCodeSimple({
  value,
  handle,
  name,
  avatarUrl,
  size = 220,
  theme = 'theme1',
  logoSrc = '/app_icon_only.png',
  onShare,
  onScan,
  onClose,
  showBackdrop = false,
}: Props) {
  const [activeTheme, setActiveTheme] = useState<RabbittyCodeTheme>(theme);
  const currentTheme = TG_THEMES[activeTheme];

  const qr = useMemo(() => {
    const code = qrcode(0, 'H');
    code.addData(value || 'rabbitty');
    code.make();
    return code;
  }, [value]);

  const count = qr.getModuleCount();
  const pad = 1.5;
  const total = count + pad * 2;

  const gradientId = useMemo(
    () => `rc-g-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );
  const maskId = useMemo(
    () => `rc-m-${Math.random().toString(36).slice(2, 8)}`,
    [],
  );

  // Función isDark que respeta finder patterns (no los pintamos en modulePath)
  const inFinder = (col: number, row: number) =>
    (col <= 6 && row <= 6) ||
    (col >= count - 7 && row <= 6) ||
    (col <= 6 && row >= count - 7);

  const isDark = (row: number, col: number) => {
    if (col < 0 || row < 0 || col >= count || row >= count) return false;
    if (inFinder(col, row)) return false;
    return qr.isDark(row, col);
  };

  const modulePath = useMemo(
    () => buildModulePath(isDark, count, pad, 0.42),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, pad, activeTheme],
  );

  const finderPath = useMemo(() => {
    return (
      buildFinderPath(0, 0, pad) +
      buildFinderPath(count - 7, 0, pad) +
      buildFinderPath(0, count - 7, pad)
    );
  }, [count, pad]);

  const center = total / 2;
  const holeR = 3.4; // radio del corte central

  const displayHandle = useMemo(() => {
    if (handle) return `@${handle.replace(/^@/, '').toUpperCase()}`;
    if (name) return name;
    return '@RABBITTER';
  }, [handle, name]);

  return (
    <div
      className="qr-screen relative flex w-full flex-1 flex-col items-center justify-between overflow-hidden min-h-[calc(100dvh-var(--safe-top,0px)-8px)]"
      style={{
        background: showBackdrop
          ? `radial-gradient(ellipse at 50% 0%, ${currentTheme.bgAccent} 0%, ${currentTheme.bgDark} 70%)`
          : 'transparent',
      }}
    >
      {/* ── Fondo doodle SVG programático (solo con backdrop temático) ── */}
      {showBackdrop && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
          dangerouslySetInnerHTML={{ __html: DOODLE_PATHS[activeTheme] }}
        />
      )}

      {/* Volver: visible también en Mi QR */}
      <button
        type="button"
        onClick={onClose ?? onScan}
        className="absolute left-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/35 text-white backdrop-blur-md active:scale-95"
        style={{ top: '10px' }}
        aria-label="Volver"
        title="Volver"
      >
        <ArrowLeft size={20} />
      </button>

      {/* ── ÁREA SUPERIOR: Avatar + Tarjeta Blanca ── */}
      <div className="relative z-10 flex w-full flex-col items-center pb-2" style={{ paddingTop: 'var(--qr-top-pad, 24px)' }}>
        {/* Avatar sobresaliente */}
        <div className="relative z-20 -mb-9 h-[70px] w-[70px] overflow-hidden rounded-full border-[3px] border-white bg-neutral-900 shadow-[0_10px_26px_rgba(0,0,0,0.5)]">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="h-full w-full object-cover"/>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/Rabbitty_vector.png" alt="" className="h-full w-full object-cover"/>
          )}
        </div>

        {/* Tarjeta Blanca */}
        <div
          className="flex w-[88%] max-w-[310px] flex-col items-center rounded-[30px] bg-white px-5 shadow-[0_20px_48px_rgba(0,0,0,0.6)]"
          style={{ paddingTop: 'var(--qr-card-pt, 48px)', paddingBottom: 'var(--qr-card-pb, 20px)' }}
        >
          {/* QR Container */}
          <div className="relative mx-auto" style={{ width: size, height: size }}>
            <svg
              viewBox={`0 0 ${total} ${total}`}
              width={size}
              height={size}
              role="img"
              aria-label="Rabbitty Code"
              shapeRendering="geometricPrecision"
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={currentTheme.from}/>
                  <stop offset="100%" stopColor={currentTheme.to}/>
                </linearGradient>
                <mask id={maskId}>
                  {/* Todo blanco → se ve, luego el círculo del centro en negro → queda hueco */}
                  <rect width={total} height={total} fill="white"/>
                  <circle cx={center} cy={center} r={holeR} fill="black"/>
                </mask>
              </defs>

              {/* Fondo blanco */}
              <rect width={total} height={total} fill="#ffffff"/>

              {/* Módulos QR (excluyendo finders) con máscara de hueco central */}
              <path
                d={modulePath}
                fill={`url(#${gradientId})`}
                mask={`url(#${maskId})`}
              />

              {/* Finder patterns */}
              <path
                d={finderPath}
                fill={`url(#${gradientId})`}
                fillRule="evenodd"
                mask={`url(#${maskId})`}
              />

              {/* Círculo central relleno con gradiente del QR (integrado visualmente) */}
              <circle cx={center} cy={center} r={holeR + 0.5} fill="white"/>
              <circle cx={center} cy={center} r={holeR} fill={`url(#${gradientId})`}/>
            </svg>

            {/* Logo Rabbitty (app_icon_only.png) sobre el círculo */}
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden"
              style={{
                width: `${(holeR * 1.6 * size) / total}px`,
                height: `${(holeR * 1.6 * size) / total}px`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc}
                alt=""
                className="h-full w-full object-contain"
                style={{ filter: 'brightness(0) invert(1) drop-shadow(0 0 2px rgba(0,0,0,0.3))' }}
              />
            </div>
          </div>

          {/* Handle */}
          <p className="m-0 text-center text-[15px] font-black tracking-tight text-black" style={{ marginTop: 'var(--qr-handle-mt, 16px)' }}>
            {displayHandle}
          </p>
        </div>
      </div>

      {/* ── ÁREA INFERIOR: Bottom Sheet ── */}
      <div className="relative z-20 mt-auto flex w-full flex-col rounded-t-[30px] border-t border-white/10 bg-[#1c1c1e]/85 px-4 pt-3 shadow-[0_-10px_36px_rgba(0,0,0,0.65)] backdrop-blur-xl"
        style={{ paddingBottom: 'calc(18px + max(env(safe-area-inset-bottom, 0px), 12px))' }}
      >
        {/* Header del sheet */}
        <div className="flex w-full items-center justify-between px-1 py-2">
          <button
            type="button"
            onClick={onClose ?? onScan}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 active:scale-95"
            aria-label="Cerrar"
          >
            <X size={20} strokeWidth={2.5}/>
          </button>
          <span className="text-[16px] font-semibold text-white">Código QR</span>
          <button
            type="button"
            aria-label="Cambiar tema"
            onClick={() => {
              const idx = THEME_LIST.indexOf(activeTheme);
              setActiveTheme(THEME_LIST[(idx + 1) % THEME_LIST.length]);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 active:scale-95"
          >
            <Sun size={20} strokeWidth={2.5}/>
          </button>
        </div>

        {/* Selector de temas */}
        <div className="my-3 grid grid-cols-4 gap-2.5 w-full max-w-[380px] mx-auto" style={{ height: 'var(--qr-grid-h, 92px)' }}>
          {THEME_LIST.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTheme(id)}
              className="relative overflow-hidden rounded-[14px] transition-all duration-200 active:scale-95 hover:opacity-90"
              aria-pressed={activeTheme === id}
              aria-label={`Identidad ${THEME_GLYPHS[id].label}`}
            >
              <ThemeGlyph id={id} isSelected={activeTheme === id}/>
            </button>
          ))}
        </div>

        {/* Botones */}
        <div className="mt-1.5 flex w-full max-w-[380px] mx-auto flex-col gap-2.5">
          <button
            type="button"
            onClick={onShare}
            className="flex w-full items-center justify-center rounded-[18px] bg-[#3390EC] text-[16px] font-bold text-white active:scale-[0.98] hover:bg-[#2b82d9] transition-all"
            style={{ height: 'var(--qr-btn-h, 52px)' }}
          >
            Compartir mi código
          </button>
          <button
            type="button"
            onClick={onScan}
            className="flex w-full items-center justify-center gap-2 rounded-[18px] bg-white/[0.07] text-[15px] font-semibold text-[#3390EC] hover:bg-white/[0.12] active:scale-[0.98] transition-all"
            style={{ height: 'var(--qr-btn2-h, 46px)' }}
          >
            <QrCode size={18} strokeWidth={2.2}/>
            <span>Escanear un código</span>
          </button>
        </div>
      </div>
    </div>
  );
}
