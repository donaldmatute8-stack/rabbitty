'use client';

/**
 * Icono propio de Escáner (Rabbitty).
 *
 * Simula un QR con cuatro cuadrantes iguales:
 *  · Arriba-izquierda, arriba-derecha y abajo-izquierda → cubos con esquinas redondeadas.
 *  · Abajo-derecha → 5 puntos cuadrados con esquinas redondeadas (patrón tipo quincunx).
 *
 * Usa `currentColor`, así hereda el color del menú (activo/inactivo).
 */
export default function RabbittyScanIcon({
  size = 25,
  className,
  strokeWidth: _strokeWidth,
  style,
}: {
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {/* Cubos (3 cuadrantes) */}
      <rect x="2.5" y="2.5" width="7.5" height="7.5" rx="2.4" />
      <rect x="14" y="2.5" width="7.5" height="7.5" rx="2.4" />
      <rect x="2.5" y="14" width="7.5" height="7.5" rx="2.4" />

      {/* Cuadrante de 5 puntos */}
      <rect x="14.3" y="14.3" width="1.9" height="1.9" rx="0.7" />
      <rect x="20" y="14.3" width="1.9" height="1.9" rx="0.7" />
      <rect x="14.3" y="20" width="1.9" height="1.9" rx="0.7" />
      <rect x="20" y="20" width="1.9" height="1.9" rx="0.7" />
      <rect x="17.15" y="17.15" width="1.9" height="1.9" rx="0.7" />
    </svg>
  );
}
