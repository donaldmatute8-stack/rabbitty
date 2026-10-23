'use client';

import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useState } from 'react';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PlatformBridge } from '@/lib/platform';
import { openBunzy } from '@/lib/bunzyLaunch';

interface TelegramWebApp {
  openTelegramLink?: (url: string) => void;
  openInvoice?: (url: string, cb: (status: string) => void) => void;
}

export interface GroupDefinition {
  id: string;
  name: string;
  desc: string;
  badge: string;
  link: string;
  color: string;
  gradient: string;
  borderGlow: string;
  iconSvg: React.ReactNode;
}

export const GROUPS: GroupDefinition[] = [
  {
    id: 'general',
    name: 'General & Anuncios',
    desc: 'Comunidad oficial global y lanzamientos exclusivos de Rabbitty',
    badge: 'General',
    link: 'https://t.me/rabbittyhub',
    color: '#0088CC',
    gradient: 'linear-gradient(135deg, #0088CC 0%, #005F8F 100%)',
    borderGlow: 'rgba(0, 136, 204, 0.4)',
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 11 18-5v12L3 13v-2z" />
        <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
      </svg>
    ),
  },
  {
    id: 'tech-support',
    name: 'Soporte Técnico',
    desc: 'Mesa de ayuda directa, resolución de dudas, tickets y hardware POS',
    badge: 'Soporte',
    link: 'https://t.me/rabbittyhub/5',
    color: '#9333EA',
    gradient: 'linear-gradient(135deg, #A855F7 0%, #7E22CE 100%)',
    borderGlow: 'rgba(168, 85, 247, 0.4)',
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    id: 'demo-support',
    name: 'Soporte Demos & Onboarding',
    desc: 'Sesiones guiadas de onboarding, tutoriales y acompañamiento en vivo',
    badge: 'Demos',
    link: 'https://t.me/rabbittyhub/10',
    color: '#EC4899',
    gradient: 'linear-gradient(135deg, #EC4899 0%, #BE185D 100%)',
    borderGlow: 'rgba(236, 72, 153, 0.4)',
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" fillOpacity="0.2" />
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    ),
  },
  {
    id: 'affiliates-circle',
    name: 'Affiliates Business Circle',
    desc: 'Comunidad selecta de comercios afiliados, restaurantes y dueños de negocio',
    badge: 'Afiliados',
    link: 'https://t.me/rabbittyhub/4',
    color: '#FF8A00',
    gradient: 'linear-gradient(135deg, #FF8A00 0%, #D9534F 100%)',
    borderGlow: 'rgba(255, 138, 0, 0.4)',
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
        <path d="M2 7h20" />
      </svg>
    ),
  },
  {
    id: 'rabbitters-zone',
    name: 'Rabbitters Zone & Loyalty Lounge',
    desc: 'Espacio de recompensas Bunz, experiencias gourmet y comunidad activa',
    badge: 'Rabbitters',
    link: 'https://t.me/rabbittyhub/3',
    color: '#10B981',
    gradient: 'linear-gradient(135deg, #10B981 0%, #047857 100%)',
    borderGlow: 'rgba(16, 185, 129, 0.4)',
    iconSvg: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
      </svg>
    ),
  },
];

export function openTelegramLink(link: string) {
  try {
    const webApp = (window as unknown as { Telegram?: { WebApp?: TelegramWebApp } }).Telegram?.WebApp;
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(link);
      return;
    }
  } catch {
    // fallback abajo
  }
  window.location.href = link;
}

export default function GroupsStrip() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<typeof GROUPS[number] | null>(null);

  const openChoice = (g: typeof GROUPS[number]) => {
    PlatformBridge.hapticFeedback('light');
    setActive(g);
    setOpen(true);
  };

  const openTelegram = () => {
    if (!active) return;
    PlatformBridge.hapticFeedback('medium');
    setOpen(false);
    openTelegramLink(active.link);
  };

  const openInApp = () => {
    PlatformBridge.hapticFeedback('medium');
    setOpen(false);
    openBunzy('Quisiera unirme al grupo ' + (active?.name ?? 'Rabbitty'));
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={18} style={{ color: 'var(--text-secondary)' }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 900, color: 'var(--text-primary)' }}>Grupos</h3>
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Comunidad oficial</span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          padding: '4px 2px 2px',
          scrollbarWidth: 'none',
        }}
        className="hide-scrollbar"
      >
        {GROUPS.map((g) => (
          <motion.button
            key={g.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => openChoice(g)}
            style={{
              flex: '0 0 auto',
              minWidth: 220,
              scrollSnapAlign: 'start',
              border: '1px solid var(--border-subtle)',
              background: g.gradient || g.color,
              color: '#fff',
              borderRadius: 18,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: `0 8px 24px -6px ${g.borderGlow || 'rgba(0,0,0,0.4)'}`,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.2)',
                backdropFilter: 'blur(8px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.3)',
              }}
            >
              {g.iconSvg}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 900, fontSize: 15, lineHeight: 1.1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {g.name}
              </span>
              <span style={{ fontSize: 12, opacity: 0.95, lineHeight: 1.2, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {g.desc}
              </span>
            </div>
            <div style={{ marginLeft: 'auto', opacity: 0.95 }}>→</div>
          </motion.button>
        ))}
      </div>

      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Unirse al grupo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-secondary)' }}>
            ¿Cómo quieres unirte a <strong style={{ color: 'var(--text-primary)' }}>{active?.name}</strong>?
          </p>

          <button
            type="button"
            onClick={openTelegram}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: 800,
            }}
          >
            <span style={{ fontSize: 20 }}>✈️</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Abrir en Telegram</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>Ir al enlace del grupo</span>
            </div>
          </button>

          <button
            type="button"
            onClick={openInApp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 16px',
              borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              background: 'linear-gradient(135deg,#E91E63 0%,#FF4081 100%)',
              color: '#fff',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: 800,
            }}
          >
            <span style={{ fontSize: 20 }}>🐰</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span>Chat de Soporte en Rabbitty</span>
              <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.95 }}>Preguntarle a Bunzy para unirme</span>
            </div>
          </button>
        </div>
      </BottomSheet>
    </section>
  );
}
