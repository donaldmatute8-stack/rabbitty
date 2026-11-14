'use client';

/**
 * ── BrandQR · código QR estándar con identidad Rabbitty ─────────────────────
 *
 * Es un QR normal (nivel M, cualquier cámara lo lee) pero dibujado a mano:
 * módulos redondeados y los tres patrones de posición con el degradado de la
 * marca. Lo usan el Rabbitty Pass y el código de “Mi código”, así hay una sola
 * fuente de verdad para el dibujo.
 *
 * Si algún día hace falta el QR más “duro” para lectores antiguos, `plain`
 * pinta módulos cuadrados y finders sólidos con el mismo panel.
 */

import { useId, useMemo } from 'react';
import qrcode from 'qrcode-generator';

/** Matriz del QR (sin quiet zone; se agrega al dibujar). */
export function buildQrMatrix(value: string): { count: number; dark: (r: number, c: number) => boolean } {
  const qr = qrcode(0, 'M');
  qr.addData(value);
  qr.make();
  const count = qr.getModuleCount();
  return { count, dark: (r, c) => qr.isDark(r, c) };
}

/** ¿La celda cae dentro de un patrón de posición (7x7 en las esquinas)? */
export function inFinder(r: number, c: number, count: number): boolean {
  const top = r < 7;
  const bottom = r >= count - 7;
  const left = c < 7;
  const right = c >= count - 7;
  return (top || bottom) && (left || right);
}

interface Props {
  value: string;
  /** Lado del QR en px. Si se omite, ocupa el 100% del contenedor. */
  size?: number;
  from?: string;
  to?: string;
  ink?: string;
  /** Módulos cuadrados y finders sólidos (máxima compatibilidad). */
  plain?: boolean;
  className?: string;
}

export default function BrandQR({
  value,
  size,
  from = '#E91E63',
  to = '#8B5CF6',
  ink = '#140d1c',
  plain = false,
  className,
}: Props) {
  const rawId = useId();
  const gradientId = `rbqr-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const matrix = useMemo(() => buildQrMatrix(value), [value]);
  const cells = useMemo(() => {
    const list: { r: number; c: number }[] = [];
    for (let r = 0; r < matrix.count; r += 1) {
      for (let c = 0; c < matrix.count; c += 1) {
        if (matrix.dark(r, c) && !inFinder(r, c, matrix.count)) list.push({ r, c });
      }
    }
    return list;
  }, [matrix]);

  const finders: [number, number][] = [
    [0, 0],
    [0, matrix.count - 7],
    [matrix.count - 7, 0],
  ];

  return (
    <svg
      viewBox={`0 0 ${matrix.count + 4} ${matrix.count + 4}`}
      width={size ?? '100%'}
      height={size ?? '100%'}
      role="img"
      aria-label="Código QR de Rabbitty"
      className={className}
      style={{ display: 'block', maxWidth: '100%' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={from} />
          <stop offset="100%" stopColor={to} />
        </linearGradient>
      </defs>
      <g transform="translate(2,2)">
        {cells.map(({ r, c }) => (
          <rect
            key={`${r}-${c}`}
            x={c}
            y={r}
            width={1}
            height={1}
            rx={plain ? 0 : 0.3}
            fill={ink}
          />
        ))}
        {finders.map(([fr, fc]) => (
          <g key={`f-${fr}-${fc}`}>
            <rect
              x={fc}
              y={fr}
              width={7}
              height={7}
              rx={plain ? 0.6 : 2}
              fill={`url(#${gradientId})`}
            />
            <rect x={fc + 1} y={fr + 1} width={5} height={5} rx={plain ? 0 : 1.5} fill="#fbfafc" />
            <rect
              x={fc + 2}
              y={fr + 2}
              width={3}
              height={3}
              rx={plain ? 0 : 1}
              fill={`url(#${gradientId})`}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
