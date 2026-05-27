'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

const FEATURES = [
  { icon: "🔑", color: "#10B981", bg: "bg-emerald-50", title: "Llaves Privadas", desc: "Tus llaves privadas de TON nunca tocan nuestros servidores. Se encriptan localmente en tu dispositivo con AES-256." },
  { icon: "🛡️", color: "#6366F1", bg: "bg-indigo-50", title: "Contratos Auditados", desc: "Nuestros Smart Contracts en la blockchain han sido auditados por firmas de seguridad independientes." },
  { icon: "🫶", color: "#F59E0B", bg: "bg-amber-50", title: "Biometría", desc: "Soporte completo para Face ID y Touch ID a través de Telegram y tu wallet nativa de TON." },
  { icon: "🕵️", color: "#EC4899", bg: "bg-pink-50", title: "Zero-Knowledge", desc: "El saldo de tu billetera es privado. Los negocios solo ven tu dirección pública cuando interactúas." },
];

export default function SecurityPage() {
  return (
    <ProfileSubpageLayout title="Seguridad">
      <div className="flex flex-col gap-4 mt-2">

        {/* Hero */}
        <div className="bg-gradient-to-br from-[#0A0A0A] via-[#111827] to-[#0D2818] text-white rounded-[28px] p-7 relative overflow-hidden border border-white/5 shadow-2xl">
          <div className="absolute right-[-8%] top-[-8%] w-44 h-44 bg-emerald-500/15 rounded-full blur-[50px]" />
          <div className="absolute left-[-5%] bottom-[-5%] w-32 h-32 bg-indigo-500/10 rounded-full blur-[40px]" />

          {/* Status */}
          <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-3 py-1 mb-5 relative z-10">
            <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#10B981]" />
            <span className="text-[10px] font-black text-emerald-400 tracking-wide">SISTEMA PROTEGIDO</span>
          </div>

          <div className="relative z-10">
            <div className="w-16 h-16 rounded-[20px] bg-emerald-500/12 border border-emerald-500/20 flex items-center justify-center text-3xl mb-4">🔒</div>
            <h2 className="text-[22px] font-black mb-2 tracking-tight leading-snug">Seguridad de Nivel Bancario</h2>
            <p className="text-white/55 text-[13px] leading-relaxed">
              Rabbitty utiliza criptografía de última generación y la infraestructura descentralizada de TON para garantizar que tus activos estén siempre a salvo.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-5 relative z-10">
            {[["0", "Hackeos", "text-emerald-400"], ["100%", "Uptime", "text-indigo-400"], ["256-bit", "AES", "text-amber-400"]].map(([val, label, cls]) => (
              <div key={label} className="bg-white/5 rounded-2xl p-3 text-center border border-white/4">
                <p className={`text-lg font-black ${cls}`}>{val}</p>
                <p className="text-[10px] text-white/35 font-semibold mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <h3 className="font-black text-[#111] text-base mt-1 px-1">Características Clave</h3>

        {/* Features */}
        <div className="flex flex-col gap-3">
          {FEATURES.map((feat, i) => (
            <div key={i} className="bg-white border border-[#F0F0F0] rounded-[24px] p-5 flex gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)] items-start">
              <div className={`w-[52px] h-[52px] rounded-[16px] ${feat.bg} flex flex-shrink-0 items-center justify-center text-2xl mt-0.5`}>
                {feat.icon}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-black text-[#111] text-[15px]">{feat.title}</h4>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: feat.color }} />
                </div>
                <p className="text-[#888] text-[12px] leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
