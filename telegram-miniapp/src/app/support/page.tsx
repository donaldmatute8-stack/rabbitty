'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

export default function SupportHubPage() {
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
    },
    {
      title: "Unirse al grupo",
      desc: "Comunidad exclusiva de Rabbitters.",
      icon: "💬",
      href: "https://t.me/c/rabbittyhub/3"
    }
  ];

  const handleTelegramClick = (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      if (typeof window !== 'undefined') {
        const WebApp = require('@twa-dev/sdk').default;
        WebApp.openTelegramLink("https://t.me/c/rabbittyhub/3");
      }
    } catch (error) {
      window.location.href = "https://t.me/c/rabbittyhub/3";
    }
  };

  return (
    <ProfileSubpageLayout title="Centro de Ayuda">
      <div className="flex flex-col gap-4 mt-[10px]">

        <div className="bg-[linear-gradient(135deg,#FF4081_0%,#E91E63_100%)] rounded-[20px] p-6 text-white shadow-[0_8px_32px_rgba(233,30,99,0.2)]">
          <h2 className="text-[24px] font-extrabold m-0 mb-2 leading-[1.2]">
            ¿En qué podemos ayudarte?
          </h2>
          <p className="m-0 opacity-90 text-sm">
            Elige una de las opciones para encontrar la respuesta que necesitas.
          </p>
        </div>

        {links.map((link, idx) => (
          link.href.includes('t.me') ? (
            <div key={idx} onClick={handleTelegramClick} className="no-underline cursor-pointer">
              <motion.div
                whileTap={{ scale: 0.98 }}
                className="bg-white rounded-[16px] p-5 flex items-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#F0F0F0]"
              >
                <div className="text-[28px]">{link.icon}</div>
                <div className="flex-1">
                  <h3 className="text-[16px] font-bold text-[#111] m-0 mb-1">{link.title}</h3>
                  <p className="text-[13px] text-[#888] m-0">{link.desc}</p>
                </div>
                <div className="text-[#E91E63]">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </motion.div>
            </div>
          ) : (
          <Link key={idx} href={link.href} className="no-underline">
            <motion.div
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-[16px] p-5 flex items-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#F0F0F0]"
            >
              <div className="text-[28px]">{link.icon}</div>
              <div className="flex-1">
                <h3 className="text-[16px] font-bold text-[#111] m-0 mb-1">{link.title}</h3>
                <p className="text-[13px] text-[#888] m-0">{link.desc}</p>
              </div>
              <div className="text-[#E91E63]">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </motion.div>
          </Link>
          )
        ))}

      </div>
    </ProfileSubpageLayout>
  );
}
