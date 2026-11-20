'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { LifeBuoy } from 'lucide-react';
import { PremiumHero } from '@/components/premium/PremiumUI';

/**
 * ── Centro de Ayuda ────────────────────────────────────────────────────────
 *
 * Todo vive dentro de Rabbitty: soporte 1:1 con el equipo (chat in-app),
 * anuncios oficiales, guías y FAQ. Sin grupos de Telegram ni bots externos.
 */
export default function SupportHubPage() {
  const links = [
    {
      title: 'Hablar con soporte',
      desc: 'Chat directo con el equipo de Rabbitty. Te responde una persona.',
      icon: '🛟',
      href: '/chat/support',
    },
    {
      title: 'Avisos oficiales',
      desc: 'Novedades, mantenimiento y tips de tu negocio.',
      icon: '📣',
      href: '/chat/bunzy',
    },
    {
      title: 'Preguntas frecuentes',
      desc: 'Respuestas rápidas a lo más común.',
      icon: '💡',
      href: '/support/faq',
    },
    {
      title: 'Guías y tutoriales',
      desc: 'Manual de usuario, POS, membresías y pagos.',
      icon: '📖',
      href: '/support/docs',
    },
  ];

  return (
    <ProfileSubpageLayout title="Centro de Ayuda">
      <div className="flex flex-col gap-4 mt-[10px]">

        <PremiumHero
          icon={LifeBuoy}
          eyebrow="CENTRO DE AYUDA"
          title="¿En qué podemos ayudarte?"
          subtitle="Soporte, avisos y guías dentro de la app."
        />

        {links.map((link) => (
          <Link key={link.href} href={link.href} className="no-underline">
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

      </div>
    </ProfileSubpageLayout>
  );
}
