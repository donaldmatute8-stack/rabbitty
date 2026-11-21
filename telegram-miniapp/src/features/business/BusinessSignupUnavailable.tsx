'use client';

/**
 * ── Pantalla para cuentas de negocio en la app nativa ─────────────────────
 *
 * Sustituye a la puerta de alta (`BusinessWebGate`) dentro de iOS/Android, donde
 * la guía 3.1.1 de App Store prohíbe el registro de negocios porque termina en
 * una compra fuera de IAP (paquete + contrato en la web).
 *
 * A propósito **no** hay enlaces externos, ni botón de registro, ni mención de
 * dónde darse de alta: es una pantalla de estado para alguien que ya opera un
 * negocio (o que entró a una sección que no le corresponde como consumidor).
 */

import { RefreshCw, Store } from 'lucide-react';

interface BusinessSignupUnavailableProps {
  onRefresh: () => void;
  refreshing?: boolean;
  /** El usuario ya tiene negocio pero la carga falló: mensaje distinto. */
  variant?: 'no-business' | 'load-failed';
}

export function BusinessSignupUnavailable({
  onRefresh,
  refreshing = false,
  variant = 'no-business',
}: BusinessSignupUnavailableProps) {
  const title = variant === 'load-failed' ? 'No pudimos cargar tu negocio' : 'Esta sección es de negocios';
  const body =
    variant === 'load-failed'
      ? 'Revisa tu conexión y vuelve a intentarlo. Tu negocio y tu panel siguen intactos.'
      : 'Esta sección es para negocios que ya operan en Rabbitty. Entra con tu cuenta de negocio y verás tu panel.';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#111',
        color: '#fff',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '32px 24px',
        textAlign: 'center',
        fontFamily: 'var(--font-family-base)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          border: '1px solid rgba(233,30,99,0.28)',
          background: 'rgba(233,30,99,0.12)',
          color: '#FF8FB8',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Store size={26} />
      </div>

      <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, lineHeight: 1.25, maxWidth: 340 }}>{title}</h1>
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'rgba(255,255,255,0.62)', maxWidth: 340 }}>
        {body}
      </p>

      <button
        onClick={onRefresh}
        disabled={refreshing}
        style={{
          marginTop: 6,
          width: '100%',
          maxWidth: 340,
          padding: '16px',
          background: 'rgba(255,255,255,0.06)',
          color: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 999,
          fontSize: 14,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          cursor: refreshing ? 'wait' : 'pointer',
          opacity: refreshing ? 0.6 : 1,
        }}
      >
        <RefreshCw size={16} style={refreshing ? { animation: 'spin 1s linear infinite' } : undefined} />
        {refreshing ? 'Buscando tu negocio…' : 'Actualizar'}
      </button>
    </div>
  );
}
