'use client';

/**
 * ── Alta de negocio: puerta única hacia la web ──
 *
 * El canal oficial para registrar un negocio es `rabbitty.me/negocios`:
 * ahí se elige giro, recompensa y paquete, se firma el contrato y el alta
 * queda en revisión. Este gate evita que un negocio nuevo entre al formulario
 * legado de la mini app; el formulario queda como alternativa secundaria.
 */

import { ArrowRight, ChevronRight, RefreshCw, Store } from 'lucide-react';
import { BunzyVideoStage } from '@/components/onboarding/BunzyVideoStage';
import { PlatformBridge } from '@/lib/platform';

const THEME_COLOR = '#E91E63';
const THEME_GRADIENT = 'linear-gradient(135deg, #E91E63 0%, #FF6B9D 100%)';

const WEB_ONBOARDING_URL =
  process.env.NEXT_PUBLIC_BUSINESS_ONBOARDING_URL || 'https://rabbitty.me/negocios';

const WEB_ONBOARDING_LINK = `${WEB_ONBOARDING_URL}?utm_source=app&utm_medium=mini_app&utm_campaign=alta_negocio`;

interface BusinessWebGateProps {
  onLocal: () => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function BusinessWebGate({ onLocal, onRefresh, refreshing = false }: BusinessWebGateProps) {
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
        fontFamily: 'var(--font-family-base)',
        overflowY: 'auto',
        padding: 'calc(max(var(--safe-top, 0px), 40px) + 24px) 24px calc(var(--safe-bottom, 0px) + 32px)',
      }}
    >
      <div style={{ margin: '0 auto', width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 10,
              fontWeight: 900,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: THEME_COLOR,
            }}
          >
            <Store size={12} /> Afiliación de negocio
          </span>
        </div>

        <BunzyVideoStage
          loop
          videoSrc="/videos/bunzy/bunzy-1-hi.mp4"
          poster="/videos/bunzy/bunzy-1-hi.jpg"
          stepLabel="ALTA OFICIAL EN LA WEB"
          title="Registra tu negocio en la web"
          description="El alta vive en rabbitty.me/negocios: eliges giro, recompensa y paquete, firmas tu contrato y queda en revisión."
          videoHeightClass="h-48 sm:h-56"
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Te toma unos 3 minutos, sin instalar nada.',
            'Firmas tu contrato digital con evidencia.',
            'Te avisamos por correo y WhatsApp al aprobarla.',
          ].map((line, i) => (
            <div
              key={line}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 16,
                padding: '12px 14px',
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: 999,
                  background: 'rgba(233,30,99,0.18)',
                  color: '#FF8FB8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 900,
                }}
              >
                {i + 1}
              </span>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.72)' }}>{line}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => void PlatformBridge.openExternalUrl(WEB_ONBOARDING_LINK)}
          style={{
            width: '100%',
            padding: '18px',
            background: THEME_GRADIENT,
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            fontSize: 17,
            fontWeight: 900,
            boxShadow: '0 8px 32px rgba(233,30,99,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: 'pointer',
          }}
        >
          Registrar mi negocio <ArrowRight size={20} />
        </button>

        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{
            width: '100%',
            padding: '15px',
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.85)',
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
          {refreshing ? 'Buscando tu negocio…' : 'Ya me aprobaron · Actualizar'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onLocal}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.42)',
              fontSize: 12,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              cursor: 'pointer',
              padding: 8,
            }}
          >
            Prefiero registrarlo desde la app <ChevronRight size={14} />
          </button>
          <p style={{ margin: '2px 0 0', fontSize: 10.5, lineHeight: 1.5, color: 'rgba(255,255,255,0.28)' }}>
            La web es el canal oficial. El alta desde la app queda como alternativa y puede tardar más en revisarse.
          </p>
        </div>
      </div>
    </div>
  );
}
