'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import Link from 'next/link';

const OPTIONS = [
  { icon: "💬", bg: "bg-pink-50", color: "text-[#E91E63]", btnBg: "bg-pink-50 hover:bg-pink-100", btnText: "text-[#E91E63]", title: "Chat de Soporte", desc: "Habla con nuestro equipo en Telegram para ayuda inmediata.", cta: "Abrir Chat →", link: "https://t.me/RabbittySupport" },
  { icon: "❓", bg: "bg-indigo-50", color: "text-indigo-500", btnBg: "bg-indigo-50 hover:bg-indigo-100", btnText: "text-indigo-600", title: "Preguntas Frecuentes", desc: "Encuentra respuestas rápidas a las dudas más comunes sobre Bunz.", cta: "Leer FAQs →", link: "#" },
  { icon: "📖", bg: "bg-emerald-50", color: "text-emerald-600", btnBg: "bg-emerald-50 hover:bg-emerald-100", btnText: "text-emerald-700", title: "Documentación", desc: "Aprende todo sobre cómo ganar, canjear y transferir tus Bunz.", cta: "Ver Docs →", link: "#" },
];

export default function SupportPage() {
  return (
    <ProfileSubpageLayout title="Soporte">
      <div className="flex flex-col gap-4 mt-2">

        {/* Hero */}
        <div className="bg-gradient-to-br from-[#E91E63] to-[#FF6B35] text-white rounded-[28px] p-7 relative overflow-hidden shadow-xl">
          <div className="absolute right-[-10%] top-[-10%] w-44 h-44 bg-white/15 rounded-full blur-[40px]" />
          <div className="absolute left-[-5%] bottom-[-15%] w-36 h-36 bg-black/10 rounded-full blur-[30px]" />

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-[20px] bg-white/20 border border-white/20 flex items-center justify-center text-3xl mb-5">🤝</div>
            <h2 className="text-[22px] font-black mb-2 tracking-tight leading-snug">¿Cómo te podemos ayudar?</h2>
            <p className="text-white/85 text-[13px] leading-relaxed mb-5">
              Estamos aquí para resolver cualquier duda sobre Rabbitty, tus recompensas o tu Billetera Ra.
            </p>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-2xl px-4 py-2.5">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-[12px] font-bold">Tiempo de respuesta: &lt; 2 horas</span>
            </div>
          </div>
        </div>

        <h3 className="font-black text-[#111] text-base mt-1 px-1">Opciones de Contacto</h3>

        {/* Options */}
        <div className="flex flex-col gap-3">
          {OPTIONS.map((opt, i) => (
            <div key={i} className="bg-white border border-[#F0F0F0] rounded-[24px] p-5 flex flex-col gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className="flex gap-4 items-start">
                <div className={`w-[52px] h-[52px] rounded-[16px] ${opt.bg} flex flex-shrink-0 items-center justify-center text-2xl`}>
                  {opt.icon}
                </div>
                <div>
                  <h4 className={`font-black text-[#111] text-[15px] mb-1`}>{opt.title}</h4>
                  <p className="text-[#888] text-[12px] leading-relaxed">{opt.desc}</p>
                </div>
              </div>
              <Link href={opt.link} className={`${opt.btnBg} ${opt.btnText} font-black text-[13px] text-center py-3 rounded-[14px] transition-colors w-full active:scale-95 block`}>
                {opt.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Community card */}
        <div className="bg-gradient-to-br from-[#1A1A2E] to-[#2D1060] rounded-[24px] p-5 flex items-center gap-4 border border-white/5">
          <div className="text-4xl flex-shrink-0">✈️</div>
          <div className="flex-1">
            <p className="font-black text-white text-[15px] mb-1">Comunidad Telegram</p>
            <p className="text-white/50 text-[12px] leading-snug mb-3">Únete a +2,400 rabbitters. Noticias, tips y soporte de la comunidad.</p>
            <button className="bg-[#E91E63] text-white text-[12px] font-black px-4 py-2 rounded-full active:scale-95 transition-transform">
              Unirse al grupo
            </button>
          </div>
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
