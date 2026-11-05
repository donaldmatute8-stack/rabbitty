'use client';

import Link from 'next/link';
import { Sparkles, ArrowUpRight } from 'lucide-react';
import { PlatformBridge } from '@/lib/platform';

const CATEGORY_LABEL: Record<string, string> = {
  PRODUCT: 'Actualización de producto',
  TIP: 'Tip para tu negocio',
  NEWS: 'Novedad de Rabbitty',
  SYSTEM: 'Aviso importante',
};

interface BunzyUpdateMessage {
  id: string;
  content: string;
  createdAt?: string | Date | null;
  metadata?: unknown;
}

/**
 * Tarjeta institucional de Bunzy Connect.
 * Se renderiza cuando `messages.type === 'BUNZY_UPDATE'`. No es una respuesta
 * de IA: es contenido editorial oficial con identidad de Bunzy.
 */
export function BunzyUpdateCard({ message }: { message: BunzyUpdateMessage }) {
  const meta = (message.metadata ?? {}) as {
    category?: string;
    title?: string;
    ctaLabel?: string | null;
    ctaUrl?: string | null;
    official?: boolean;
  };
  const category = meta.category || 'PRODUCT';
  const title = meta.title || 'Actualización de Rabbitty';
  const body = message.content || '';
  const ctaLabel = meta.ctaLabel || null;
  const ctaUrl = meta.ctaUrl || null;

  return (
    <div style={{ display: 'flex', gap: 10, width: '100%', margin: '8px 0', alignItems: 'flex-start' }}>
      <div
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 999,
          background: 'linear-gradient(135deg, #E91E63, #FF6B9D)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 17,
          overflow: 'hidden',
          boxShadow: '0 4px 14px rgba(233,30,99,0.35)',
        }}
        aria-hidden
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/bunzy-avatar.png" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <div
        style={{
          flex: 1,
          minWidth: 0,
          borderRadius: 18,
          border: '1px solid rgba(233,30,99,0.28)',
          background: 'linear-gradient(180deg, rgba(233,30,99,0.10), rgba(255,255,255,0.03))',
          padding: '12px 14px',
          color: 'var(--text-primary, #fff)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--text-primary, #fff)' }}>Bunzy</span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: '#FF8FB8',
              border: '1px solid rgba(233,30,99,0.35)',
              borderRadius: 999,
              padding: '1px 6px',
            }}
          >
            Oficial
          </span>
        </div>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 9.5,
            fontWeight: 800,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: '#FF8FB8',
            marginBottom: 6,
          }}
        >
          <Sparkles size={10} /> {CATEGORY_LABEL[category] || CATEGORY_LABEL.PRODUCT}
        </span>

        <p style={{ margin: 0, fontSize: 15, fontWeight: 900, lineHeight: 1.3 }}>{title}</p>
        <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--text-secondary, rgba(255,255,255,0.72))' }}>
          {body}
        </p>

        {ctaLabel && ctaUrl && (
          <button
            type="button"
            onClick={() => void PlatformBridge.openExternalUrl(ctaUrl)}
            style={{
              marginTop: 10,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: 'none',
              borderRadius: 999,
              background: '#E91E63',
              color: '#fff',
              fontSize: 12,
              fontWeight: 900,
              padding: '8px 13px',
              cursor: 'pointer',
            }}
          >
            {ctaLabel} <ArrowUpRight size={13} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 }}>
          {message.createdAt ? (
            <span style={{ fontSize: 9.5, color: 'var(--text-muted, rgba(255,255,255,0.4))' }}>
              {new Date(message.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
            </span>
          ) : (
            <span />
          )}
          <Link
            href="/settings"
            style={{ fontSize: 9.5, fontWeight: 700, color: 'rgba(255,143,184,0.85)', textDecoration: 'underline' }}
          >
            Gestionar preferencias
          </Link>
        </div>
      </div>
    </div>
  );
}
