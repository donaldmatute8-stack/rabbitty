'use client';

import { useMemo } from 'react';
import qrcode from 'qrcode-generator';

/**
 * Rabbitty Code "Simple" — QR estándar con identidad (estilo Telegram):
 * tarjeta blanca, módulos redondeados con gradiente, logo al centro y handle.
 *
 * Es un QR real (cualquier cámara lo lee). El RabbittyCode neón queda como
 * respaldo detrás de `RABBITTY_CODE_STYLE = 'neon'`.
 */

export type RabbittyCodeTheme = 'violet' | 'pink' | 'ocean';

const THEMES: Record<RabbittyCodeTheme, { from: string; to: string; handle: string }> = {
  violet: { from: '#7C3AED', to: '#4C1D95', handle: '#4C1D95' },
  pink: { from: '#FF2E93', to: '#8B5CF6', handle: '#9D174D' },
  ocean: { from: '#0EA5E9', to: '#4338CA', handle: '#0C4A6E' },
};

interface Props {
  /** Payload a codificar (p. ej. `rabbitty://pay?to=@handle`). */
  value: string;
  handle?: string | null;
  name?: string | null;
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
  size = 236,
  theme = 'violet',
  logoSrc = '/bunzy-avatar.png',
  onShare,
  onScan,
}: Props) {
  const colors = THEMES[theme];

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

  const isFinder = (x: number, y: number) =>
    (x <= 6 && y <= 6) ||
    (x >= count - 7 && y <= 6) ||
    (x <= 6 && y >= count - 7);

  const modules: React.ReactNode[] = [];
  for (let y = 0; y < count; y += 1) {
    for (let x = 0; x < count; x += 1) {
      if (!qr.isDark(y, x)) continue;
      if (isFinder(x, y)) continue;
      modules.push(
        <rect
          key={`${x}-${y}`}
          x={x + pad}
          y={y + pad}
          width={1}
          height={1}
          rx={0.34}
          fill={`url(#${gradientId})`}
        />,
      );
    }
  }

  const finder = (fx: number, fy: number, key: string) => (
    <g key={key}>
      <rect
        x={fx + pad + 0.5}
        y={fy + pad + 0.5}
        width={6}
        height={6}
        rx={1.7}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={1}
      />
      <rect
        x={fx + pad + 2}
        y={fy + pad + 2}
        width={3}
        height={3}
        rx={0.9}
        fill={`url(#${gradientId})`}
      />
    </g>
  );

  const logoRadius = 3.1;
  const center = total / 2;

  return (
    <div className="flex w-full flex-col items-center">
      {/* Avatar que corta el borde superior de la tarjeta */}
      <div className="relative z-10 -mb-9 flex h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/Rabbitty_vector.png" alt="" className="h-full w-full object-cover" />
      </div>

      <div
        className="w-full rounded-[28px] bg-white px-5 pb-5 pt-11 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.55)]"
        style={{ maxWidth: 320 }}
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
            {modules}
            {/* Hueco blanco para el logo central (error correction H) */}
            <circle cx={center} cy={center} r={logoRadius + 0.45} fill="#ffffff" />
          </svg>

          {/* Logo central */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center overflow-hidden rounded-full"
            style={{
              width: `${(logoRadius * 2 * size) / total}px`,
              height: `${(logoRadius * 2 * size) / total}px`,
              background: '#fff',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoSrc} alt="" className="h-full w-full object-cover" />
          </div>
        </div>

        <p
          className="m-0 mt-4 truncate text-center text-[19px] font-black tracking-tight"
          style={{ color: colors.handle }}
        >
          {handle ? `@${handle.replace(/^@/, '')}` : name || 'Rabbitty'}
        </p>
        {name && handle ? (
          <p className="m-0 mt-0.5 truncate text-center text-[11px] font-semibold text-neutral-500">{name}</p>
        ) : null}
      </div>

      {(onShare || onScan) && (
        <div className="mt-4 flex w-full max-w-[320px] flex-col gap-2">
          {onShare && (
            <button
              type="button"
              onClick={onShare}
              className="w-full rounded-2xl px-4 py-3 text-[14px] font-black text-white active:scale-[0.99] transition-transform"
              style={{ background: 'linear-gradient(135deg, #FF2E93, #8B5CF6)' }}
            >
              Compartir mi código
            </button>
          )}
          {onScan && (
            <button
              type="button"
              onClick={onScan}
              className="w-full rounded-2xl border border-white/12 bg-white/[0.06] px-4 py-3 text-[14px] font-black text-(--text-primary) active:scale-[0.99] transition-transform"
            >
              Escanear un código
            </button>
          )}
        </div>
      )}
    </div>
  );
}
