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
      // Intentar abrir nativamente si es WebApp
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 10 }}>
        
        <div style={{ 
          background: 'linear-gradient(135deg, #FF4081 0%, #E91E63 100%)', 
          borderRadius: 20, 
          padding: 24, 
          color: 'white',
          boxShadow: '0 8px 32px rgba(233, 30, 99, 0.2)'
        }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 8px', lineHeight: 1.2 }}>
            ¿En qué podemos ayudarte?
          </h2>
          <p style={{ margin: 0, opacity: 0.9, fontSize: 14 }}>
            Elige una de las opciones para encontrar la respuesta que necesitas.
          </p>
        </div>

        {links.map((link, idx) => (
          link.href.includes('t.me') ? (
            <div key={idx} onClick={handleTelegramClick} style={{ textDecoration: 'none', cursor: 'pointer' }}>
              <motion.div
                whileTap={{ scale: 0.98 }}
                style={{
                  background: '#FFFFFF',
                  borderRadius: 16,
                  padding: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                  border: '1px solid #F0F0F0'
                }}
              >
                <div style={{ fontSize: 28 }}>{link.icon}</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{link.title}</h3>
                  <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{link.desc}</p>
                </div>
                <div style={{ color: '#E91E63' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </motion.div>
            </div>
          ) : (
          <Link key={idx} href={link.href} style={{ textDecoration: 'none' }}>
            <motion.div
              whileTap={{ scale: 0.98 }}
              style={{
                background: '#FFFFFF',
                borderRadius: 16,
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
                border: '1px solid #F0F0F0'
              }}
            >
              <div style={{ fontSize: 28 }}>{link.icon}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', margin: '0 0 4px' }}>{link.title}</h3>
                <p style={{ fontSize: 13, color: '#888', margin: 0 }}>{link.desc}</p>
              </div>
              <div style={{ color: '#E91E63' }}>
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
