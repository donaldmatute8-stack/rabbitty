'use client';

import { useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';

/**
 * Rabbitty Code "Simple" — QR estándar con identidad (estilo Telegram):
 * módulos en líneas redondeadas, tarjeta blanca, avatar del perfil arriba,
 * logo de la app en un corte central limpio y selector de 4 estilos.
 *
 * Es un QR real: cualquier cámara lo lee. El RabbittyCode neón sigue existiendo
 * como respaldo (RABBITTY_CODE_STYLE = 'neon').
 */

export type RabbittyCodeTheme = 'violet' | 'pink' | 'ocean' | 'emerald';

const THEMES: Record<
  RabbittyCodeTheme,
  { label: string; emoji: string; from: string; to: string; handle: string }
> = {
  violet: { label: 'Violeta', emoji: '💎', from: '#7C3AED', to: '#4C1D95', handle: '#4C1D95' },
  pink: { label: 'Rosa', emoji: '🏠', from: '#FF2E93', to: '#8B5CF6', handle: '#9D174D' },
  ocean: { label: 'Océano', emoji: '🐤', from: '#0EA5E9', to: '#4338CA', handle: '#0C4A6E' },
  emerald: { label: 'Esmeralda', emoji: '⛄', from: '#10B981', to: '#065F46', handle: '#065F46' },
};

const THEME_ORDER: RabbittyCodeTheme[] = ['violet', 'pink', 'ocean', 'emerald'];

interface Props {
  /** Payload a codificar (URL pública del perfil). */
  value: string;
  handle?: string | null;
  name?: string | null;
  /** Avatar del perfil del usuario. */
  avatarUrl?: string | null;
  size?: number;
  theme?: RabbittyCodeTheme;
  logoSrc?: string;
  onShare?: () => void;
  onScan?: () => void;
}

export default function RabbittyCodeSimple({
  value,
  handle,
  name,
  avatarUrl,
  size = 204,
  theme = 'violet',
  logoSrc = '/app_icon.png',
  onShare,
  onScan,
}: Props) {
  const [activeTheme, setActiveTheme] = useState<RabbittyCodeTheme>(theme);
  const colors = THEMES[activeTheme];

  const qr = useMemo(() => {
    const code = qrcode(0, 'H');
    code.addData(value || 'rabbitty');
    code.make();
    return code;
  }, [value]);

  const count = qr.getModuleCount();
  const pad = 2;
  const total = count + pad * 2;
  const gradientId = useMemo(() => `rc-grad-${Math.random().toString(36).slice(2, 9)}`, []);

  const inFinder = (x: number, y: number) =>
    (x <= 6 && y <= 6) ||
    (x >= count - 7 && y <= 6) ||
    (x <= 6 && y >= count - 7);

  // Módulos en LÍNEAS redondeadas (estilo Telegram): se agrupan runs horizontales.
  const shapes: React.ReactNode[] = [];
  for (let y = 0; y < count; y += 1) {
    let x = 0;
    while (x < count) {
      if (!qr.isDark(y, x) || inFinder(x, y)) {
        x += 1;
        continue;
      }
      let end = x;
      while (end + 1 < count && qr.isDark(y, end + 1) && !inFinder(end + 1, y)) {
        end += 1;
      }
      const runLength = end - x + 1;
      shapes.push(
        <rect
          key={`${x}-${y}`}
          x={x + pad}
          y={y + pad}
          width={runLength}
          height={1}
          rx={0.5}
          fill={`url(#${gradientId})`}
        />,
      );
      x = end + 1;
    }
  }

  const finder = (fx: number, fy: number, key: string) => (
    <g key={key}>
      <rect
        x={fx + pad + 0.5}
        y={fy + pad + 0.5}
        width={6}
        height={6}
        rx={1.8}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={1}
      />
      <rect
        x={fx + pad + 2}
        y={fy + pad + 2}
        width={3}
        height={3}
        rx={0.95}
        fill={`url(#${gradientId})`}
      />
    </g>
  );

  const center = total / 2;
  const holeRadius = 3.55;

  return (
    <div className="flex w-full flex-col items-center">
      {/* Avatar del perfil (corta el borde superior) */}
      <div className="relative z-10 -mb-8 flex h-[64px] w-[64px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-[0_8px_22px_rgba(0,0,0,0.4)]">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/Rabbitty_vector.png" alt="" className="h-full w-full object-cover" />
        )}
      </div>

      <div
        className="w-full rounded-[26px] bg-white px-4 pb-4 pt-10 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]"
        style={{ maxWidth: 300 }}
      >
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
                <stop offset="0%" stopColor={colors.from} />
                <stop offset="100%" stopColor={colors.to} />
              </linearGradient>
            </defs>
            <rect width={total} height={total} fill="#ffffff" />
            {finder(0, 0, 'tl')}
            {finder(count - 7, 0, 'tr')}
            {finder(0, count - 7, 'bl')}
            {shapes}
            {/* Corte central limpio (mask circular) */}
            <circle cx={center} cy={center} r={holeRadius} fill="#ffffff" />
          </svg>

          {/* Logo de la app dentro del corte */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full border border-black/5 bg-white"
            style={{
              width: `${(holeRadius * 1.55 * size) / total}px`,
              height: `${(holeRadius * 1.55 * size) / total}px`,
              boxShadow: '0 0 0 2px #fff',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" className="h-full w-full object-cover" />
          </div>
        </div>

        <p
          className="m-0 mt-3 truncate text-center text-[17px] font-black tracking-tight"
          style={{ color: colors.handle }}
        >
          {handle ? `@${handle.replace(/^@/, '')}` : name || 'Rabbitty'}
        </p>
      </div>

      {/* Selector de estilos (4) */}
      <div className="mt-3 flex w-full max-w-[300px] items-center justify-between gap-2">
        {THEME_ORDER.map((id) => {
          const t = THEMES[id];
          const selected = id === activeTheme;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTheme(id)}
              aria-label={t.label}
              className={`flex h-11 flex-1 items-center justify-center rounded-xl border transition-all active:scale-95 ${
                selected ? 'border-2 border-white/80' : 'border border-white/10'
              }`}
              style={{
                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                opacity: selected ? 1 : 0.7,
              }}
            >
              <span style={{ fontSize: 16 }}>{t.emoji}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex w-full max-w-[300px] flex-col gap-2">
        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="w-full rounded-xl px-4 py-2.5 text-[13.5px] font-black text-white active:scale-[0.99] transition-transform"
            style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
          >
            Compartir mi código
          </button>
        )}
        {onScan && (
          <button
            type="button"
            onClick={onScan}
            className="w-full rounded-xl border border-white/12 bg-white/[0.06] px-4 py-2.5 text-[13.5px] font-black text-(--text-primary) active:scale-[0.99] transition-transform"
          >
            Escanear un código
          </button>
        )}
      </div>
    </div>
  );
}
