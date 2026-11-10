'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { PlatformBridge } from '@/lib/platform';
import { openBunzy } from '@/lib/bunzyLaunch';
import { LifeBuoy } from 'lucide-react';
import { PremiumHero } from '@/components/premium/PremiumUI';

const GROUP_LINK = 'https://t.me/rabbittyhub/3';

export default function SupportHubPage() {
  const [groupOpen, setGroupOpen] = useState(false);

  const links = [
    {
      title: "Leer FAQs",
      desc: "Preguntas y respuestas rápidas.",
      icon: "💡",
      href: "/support/faq"
    },
    {
      title: "Ver Docs",
      desc: "Manual de usuario y guías técnicas.",
      icon: "📖",
      href: "/support/docs"
    }
  ];

  const openTelegram = () => {
    PlatformBridge.hapticFeedback('medium');
    setGroupOpen(false);
    try {
      const webApp = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } }).Telegram?.WebApp;
      if (webApp?.openTelegramLink) {
        webApp.openTelegramLink(GROUP_LINK);
        return;
      }
    } catch {}
    window.location.href = GROUP_LINK;
  };

  const openInApp = () => {
    PlatformBridge.hapticFeedback('medium');
    setGroupOpen(false);
    openBunzy('Quisiera unirme al grupo de la comunidad');
  };

  return (
    <ProfileSubpageLayout title="Centro de Ayuda">
      <div className="flex flex-col gap-4 mt-[10px]">

        <PremiumHero
          icon={LifeBuoy}
          eyebrow="CENTRO DE AYUDA"
          title="¿En qué podemos ayudarte?"
          subtitle="Elige una opción para encontrar la respuesta que necesitas."
        />

        {links.map((link, idx) => (
          <Link key={idx} href={link.href} className="no-underline">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="bg-(--bg-elevated) rounded-[18px] p-5 flex items-center gap-4 shadow-sm border border-(--border-subtle)"
            >
              <div className="w-12 h-12 rounded-[14px] bg-(--bg-subtle) border border-(--border-subtle) flex items-center justify-center text-[26px]">
                {link.icon}
              </div>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-(--text-primary) m-0 mb-1">{link.title}</h3>
                <p className="text-[13px] text-(--text-muted) m-0">{link.desc}</p>
              </div>
              <div className="text-[#E91E63]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </motion.div>
          </Link>
        ))}

        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            PlatformBridge.hapticFeedback('light');
            setGroupOpen(true);
          }}
          className="bg-(--bg-elevated) rounded-[18px] p-5 flex items-center gap-4 shadow-sm border border-(--border-subtle) cursor-pointer"
        >
          <div className="w-12 h-12 rounded-[14px] bg-(--bg-subtle) border border-(--border-subtle) flex items-center justify-center text-[26px]">💬</div>
          <div className="flex-1">
            <h3 className="text-[16px] font-bold text-(--text-primary) m-0 mb-1">Unirse al grupo</h3>
            <p className="text-[13px] text-(--text-muted) m-0">Comunidad exclusiva de Rabbitters.</p>
          </div>
          <div className="text-[#E91E63]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </motion.div>

      </div>

      <BottomSheet isOpen={groupOpen} onClose={() => setGroupOpen(false)} title="Unirse al grupo">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, color: 'var(--text-secondary)' }}>
            ¿Cómo quieres unirte a la comunidad de Rabbitters?
          </p>
          <button
            type="button"
            onClick={openTelegram}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16,
              border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
              color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontWeight: 800,
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
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 16,
              border: '1px solid var(--border-subtle)',
              background: 'linear-gradient(135deg,#E91E63 0%,#FF4081 100%)',
              color: '#fff', cursor: 'pointer', textAlign: 'left', fontWeight: 800,
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
    </ProfileSubpageLayout>
  );
}
