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

export const GROUPS = [
  {
    id: 'rabbitty-hub',
    name: 'Rabbitty Hub',
    desc: 'Comunidad oficial y anuncios',
    icon: '🐰',
    link: 'https://t.me/rabbittyhub/3',
    color: 'linear-gradient(135deg,#E91E63 0%,#FF4081 100%)',
  },
  {
    id: 'rabbitty-bizz',
    name: 'Rabbitty Bizz',
    desc: 'Negocios, alianzas y casos de uso',
    icon: '🏪',
    link: 'https://t.me/rabbittyhub',
    color: 'linear-gradient(135deg,#3F51B5 0%,#5C6BC0 100%)',
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
              background: g.color,
              color: '#fff',
              borderRadius: 18,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              textAlign: 'left',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              {g.icon}
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
