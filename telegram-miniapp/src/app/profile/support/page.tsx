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
      <div className="flex flex-col gap-4 mt-2">

        {/* Hero */}
        <div className="bg-gradient-to-tr from-[#E91E63] to-[#FF6B35] rounded-[28px] pt-[28px] px-6 pb-7 relative overflow-hidden shadow-[0_12px_40px_rgba(233,30,99,0.3)]">
          <div className="absolute right-[-10%] top-[-10%] w-[176px] h-[176px] bg-white/15 rounded-full blur-[40px]" />
          <div className="absolute left-[-5%] bottom-[-15%] w-[144px] h-[144px] bg-black/10 rounded-full blur-[30px]" />

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-[20px] bg-white/20 border border-white/20 flex items-center justify-center text-[28px] mb-5">🤝</div>
            <h2 className="text-[22px] font-black text-white m-0 mb-2 tracking-[-0.5px] leading-[1.2]">
              ¿Cómo te puede ayudar Rabbitty Bot?
            </h2>
            <p className="text-white/85 text-[13px] leading-[1.6] m-0 mb-5">
              Tu nuevo asistente IA de Rabbitty está aquí para resolver dudas sobre recompensas, Bunz, tu billetera y más.
            </p>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-[16px] px-4 py-[10px]">
              <div className="w-2 h-2 rounded-full bg-white" style={{ animation: 'pulse 2s infinite' }} />
              <span className="text-xs font-bold text-white">Tiempo de respuesta: &lt; 2 horas</span>
            </div>
          </div>
        </div>

        <h3 className="font-black text-[#111] text-[15px] mt-1 mx-1 mb-0 p-0">Opciones de Contacto</h3>

        {/* Option cards */}
        {OPTIONS.map((opt, i) => (
          <div key={i} className="bg-white border border-[#F0F0F0] rounded-3xl p-5 flex flex-col gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
            <div className="flex gap-4 items-start">
              <div
                className="w-[52px] h-[52px] rounded-[16px] flex shrink-0 items-center justify-center text-2xl"
                style={{ background: opt.bg }}
              >
                {opt.icon}
              </div>
              <div>
                <h4 className="font-black text-[#111] text-[15px] m-0 mb-1">{opt.title}</h4>
                <p className="text-[#888] text-xs leading-[1.6] m-0">{opt.desc}</p>
              </div>
            </div>
            <Link href={opt.link} className="block text-center font-black text-[13px] py-3 rounded-[14px] no-underline" style={{ background: opt.btnBg, color: opt.btnColor }}>
              {opt.cta}
            </Link>
          </div>
        ))}

        {/* Community card */}
        <div className="bg-gradient-to-tr from-[#1A1A2E] to-[#2D1060] rounded-3xl p-5 flex items-center gap-4 border border-white/5">
          <div className="text-[36px] shrink-0">✈️</div>
          <div className="flex-1">
            <p className="font-black text-white text-[15px] m-0 mb-1">Soporte y Comunidad</p>
            <p className="text-white/50 text-xs leading-[1.4] m-0 mb-3">
              Rabbitty Bot es tu asistente IA 24/7 para toda ayuda y consultas.
            </p>
            <a href="https://t.me/rabbittybot_bot?start=help" className="bg-[#E91E63] text-white text-xs font-black px-4 py-2 rounded-full border-none cursor-pointer no-underline inline-block">
              Hablar con Rabbitty Bot
            </a>
          </div>
        </div>

        {/* Placeholder notices */}
        <div className="bg-[#FFF9E6] rounded-[16px] p-4 border-l-4 border-l-[#F59E0B] flex items-center gap-3">
          <div className="text-xl">🚧</div>
          <div className="flex-1">
            <p className="font-bold text-[#111] text-[13px] m-0 mb-1">En construcción</p>
            <p className="text-[#666] text-xs m-0 leading-[1.4]">
              Preguntas Frecuentes y Documentación estarán disponibles en breve. Mientras tanto, Rabbitty Bot está listo para ayudarte.
            </p>
          </div>
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
