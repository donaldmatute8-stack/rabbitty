'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { LifeBuoy } from 'lucide-react';
import { PremiumHero } from '@/components/premium/PremiumUI';
import { PlatformBridge } from '@/lib/platform';
import { openBunzy } from '@/lib/bunzyLaunch';

type SupportBusiness = { id: string; name: string };

/**
 * ── Centro de Ayuda ────────────────────────────────────────────────────────
 *
 * Todo vive dentro de Rabbitty: soporte 1:1 con el equipo (chat in-app),
 * anuncios oficiales, guías y FAQ. Sin grupos de Telegram ni bots externos.
 *
 * Si el afiliado tiene varios negocios, elige con cuál abre el caso: cada
 * negocio tiene su propio hilo y su propio historial.
 */
export default function SupportHubPage() {
  const [businesses, setBusinesses] = useState<SupportBusiness[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const headers = await PlatformBridge.getAuthHeaders();
        const res = await fetch('/api/business?all=1', { headers });
        const data = await res.json().catch(() => null);
        if (alive) {
          setBusinesses(Array.isArray(data?.businesses) ? data.businesses : []);
        }
      } catch {
        if (alive) setBusinesses([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  const supportLinks = (businesses ?? []).map((biz) => ({
    title: businesses && businesses.length > 1 ? `Hablar con soporte · ${biz.name}` : 'Hablar con soporte',
    desc: `Chat directo con el equipo de Rabbitty para ${biz.name}. Te responde una persona.`,
    icon: '🛟',
    href: `/chat/support?businessId=${encodeURIComponent(biz.id)}`,
  }));

  const links = [
    ...(businesses && businesses.length > 0
      ? supportLinks
      : businesses === null
        ? []
        : [{
            title: 'Preguntar a Bunzy',
            desc: 'Tu asistente de Rabbitty responde al instante.',
            icon: '🐰',
            href: '#bunzy',
          }]),
    {
      title: 'Avisos oficiales',
      desc: 'Novedades, mantenimiento y tips para tus salidas.',
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
      desc: 'POS, membresías, pagos y todo sobre tus Bunz.',
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

        {businesses === null && (
          <p className="text-center text-xs text-(--text-muted) m-0">Preparando tu ayuda…</p>
        )}

        {links.map((link) => {
          const isBunzy = link.href === '#bunzy';
          const card = (
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
          );

          return isBunzy ? (
            <button
              key={link.title}
              type="button"
              onClick={() => openBunzy('Necesito ayuda con mi cuenta en Rabbitty')}
              className="no-underline text-left bg-transparent border-0 p-0 cursor-pointer"
            >
              {card}
            </button>
          ) : (
            <Link key={link.href} href={link.href} className="no-underline">
              {card}
            </Link>
          );
        })}

        <p className="m-0 px-1 text-[11px] leading-relaxed text-(--text-muted)">
          Si es urgente, empieza tu mensaje con “URGENTE”. Te responde una persona
          del equipo; no hay grupos ni canales externos.
        </p>

      </div>
    </ProfileSubpageLayout>
  );
}
