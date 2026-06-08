'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import Link from 'next/link';

const OPTIONS = [
  {
    icon: '💬', bg: '#FFF0F5', btnBg: '#FFF0F5', btnHover: '#FCE4EC', btnColor: '#E91E63',
    title: 'Chat de Soporte',
    desc: 'Habla con Rabbitty Bot (nuevo asistente IA de Rabbitty) para ayuda inmediata.',
    cta: 'Abrir Chat →', link: 'https://t.me/rabbittybot_bot?start=help',
  },
  {
    icon: '❓', bg: '#EEF2FF', btnBg: '#EEF2FF', btnHover: '#E0E7FF', btnColor: '#4F46E5',
    title: 'Preguntas Frecuentes',
    desc: 'Encuentra respuestas rápidas a las dudas más comunes sobre Bunz.',
    cta: 'Leer FAQs →', link: 'https://rabbitty.com/faq',
  },
  {
    icon: '📖', bg: '#F0FDF4', btnBg: '#F0FDF4', btnHover: '#DCFCE7', btnColor: '#16A34A',
    title: 'Documentación',
    desc: 'Aprende todo sobre cómo ganar, canjear y transferir tus Bunz.',
    cta: 'Ver Docs →', link: 'https://rabbitty.com/docs',
  },
];

export default function SupportPage() {
  return (
    <ProfileSubpageLayout title="Ayuda y Soporte">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>

        {/* Hero */}
        <div style={{
          background: 'linear-gradient(135deg, #E91E63 0%, #FF6B35 100%)',
          borderRadius: 28, padding: '28px 24px',
          position: 'relative', overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(233,30,99,0.3)',
        }}>
          <div style={{ position: 'absolute', right: '-10%', top: '-10%', width: 176, height: 176, background: 'rgba(255,255,255,0.15)', borderRadius: '50%', filter: 'blur(40px)' }} />
          <div style={{ position: 'absolute', left: '-5%', bottom: '-15%', width: 144, height: 144, background: 'rgba(0,0,0,0.1)', borderRadius: '50%', filter: 'blur(30px)' }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 20,
            }}>🤝</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              ¿Cómo te puede ayudar Rabbitty Bot?
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.6, margin: '0 0 20px' }}>
              Tu nuevo asistente IA de Rabbitty está aquí para resolver dudas sobre recompensas, Bunz, tu billetera y más.
            </p>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: '10px 16px',
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Tiempo de respuesta: &lt; 2 horas</span>
            </div>
          </div>
        </div>

        <h3 style={{ fontWeight: 900, color: '#111', fontSize: 15, margin: '4px 4px 0', padding: 0 }}>Opciones de Contacto</h3>

        {/* Option cards */}
        {OPTIONS.map((opt, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid #F0F0F0',
            borderRadius: 24, padding: 20,
            display: 'flex', flexDirection: 'column', gap: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
              <div style={{
                width: 52, height: 52, borderRadius: 16, background: opt.bg,
                display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                {opt.icon}
              </div>
              <div>
                <h4 style={{ fontWeight: 900, color: '#111', fontSize: 15, margin: '0 0 4px' }}>{opt.title}</h4>
                <p style={{ color: '#888', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{opt.desc}</p>
              </div>
            </div>
            <Link href={opt.link} style={{
              display: 'block', textAlign: 'center',
              background: opt.btnBg, color: opt.btnColor,
              fontWeight: 900, fontSize: 13,
              padding: '12px 0', borderRadius: 14,
              textDecoration: 'none',
            }}>
              {opt.cta}
            </Link>
          </div>
        ))}

        {/* Community card */}
        <div style={{
          background: 'linear-gradient(135deg, #1A1A2E 0%, #2D1060 100%)',
          borderRadius: 24, padding: 20,
          display: 'flex', alignItems: 'center', gap: 16,
          border: '1px solid rgba(255,255,255,0.05)',
        }}>
          <div style={{ fontSize: 36, flexShrink: 0 }}>✈️</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 900, color: '#fff', fontSize: 15, margin: '0 0 4px' }}>Soporte y Comunidad</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.4, margin: '0 0 12px' }}>
              Rabbitty Bot es tu asistente IA 24/7 para toda ayuda y consultas.
            </p>
            <a href="https://t.me/rabbittybot_bot?start=help" style={{
              background: '#E91E63', color: '#fff',
              fontSize: 12, fontWeight: 900,
              padding: '8px 16px', borderRadius: 999,
              border: 'none', cursor: 'pointer',
              textDecoration: 'none', display: 'inline-block',
            }}>
              Hablar con Rabbitty Bot
            </a>
          </div>
        </div>

        {/* Placeholder notices */}
        <div style={{
          background: '#FFF9E6', borderRadius: 16, padding: 16,
          borderLeft: '4px solid #F59E0B',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{ fontSize: 20 }}>🚧</div>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, color: '#111', fontSize: 13, margin: '0 0 4px' }}>En construcción</p>
            <p style={{ color: '#666', fontSize: 12, margin: 0, lineHeight: 1.4 }}>
              Preguntas Frecuentes y Documentación estarán disponibles en breve. Mientras tanto, Rabbitty Bot está listo para ayudarte.
            </p>
          </div>
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
