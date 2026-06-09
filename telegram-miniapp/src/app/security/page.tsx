'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

const FEATURES = [
  { icon: '🔑', color: '#10B981', bg: '#F0FDF4', title: 'Llaves Privadas',    desc: 'Tus llaves privadas de TON nunca tocan nuestros servidores. Se encriptan localmente en tu dispositivo con AES-256.' },
  { icon: '🛡️', color: '#6366F1', bg: '#EEF2FF', title: 'Contratos Auditados', desc: 'Nuestros Smart Contracts en la blockchain han sido auditados por firmas de seguridad independientes.' },
  { icon: '🫶', color: '#F59E0B', bg: '#FFFBEB', title: 'Biometría',           desc: 'Soporte completo para Face ID y Touch ID a través de Telegram y tu wallet nativa de TON.' },
  { icon: '🕵️', color: '#E91E63', bg: '#FFF0F5', title: 'Zero-Knowledge',     desc: 'El saldo de tu billetera es privado. Los negocios solo ven tu dirección pública cuando interactúas.' },
];

const STATS = [
  { val: '0',    label: 'Hackeos',  color: '#10B981' },
  { val: '100%', label: 'Uptime',   color: '#6366F1' },
  { val: '256b', label: 'AES',      color: '#F59E0B' },
];

export default function SecurityPage() {
  return (
    <ProfileSubpageLayout title="Seguridad">
      <div className="flex flex-col gap-4 mt-2">

        {/* Hero card */}
        <div
          className="relative overflow-hidden rounded-[28px] px-6 py-7 border border-[rgba(255,255,255,0.05)] shadow-[0_20px_60px_rgba(0,0,0,0.3)]"
          style={{ background: 'linear-gradient(135deg, #0A0A0A 0%, #111827 55%, #0D2818 100%)' }}
        >
          {/* Glow blobs */}
          <div className="absolute -right-[8%] -top-[8%] w-[176px] h-[176px] rounded-full blur-[50px]" style={{ background: 'rgba(16,185,129,0.15)' }} />
          <div className="absolute -left-[5%] -bottom-[5%] w-[128px] h-[128px] rounded-full blur-[40px]" style={{ background: 'rgba(99,102,241,0.1)' }} />

          {/* Status badge */}
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 mb-5 relative z-10"
            style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <div className="w-2 h-2 rounded-full bg-[#34D399] shadow-[0_0_6px_#10B981]" />
            <span className="text-[10px] font-black text-[#34D399] tracking-[1.5px]">SISTEMA PROTEGIDO</span>
          </div>

          <div className="relative z-10">
            <div
              className="w-16 h-16 rounded-[20px] flex items-center justify-center text-[28px] mb-4"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}
            >🔒</div>
            <h2 className="text-[22px] font-black text-white m-0 mb-2 tracking-[-0.5px] leading-[1.2]">
              Seguridad de Nivel Bancario
            </h2>
            <p className="text-[13px] leading-[1.6] m-0" style={{ color: 'rgba(255,255,255,0.55)' }}>
              Rabbitty utiliza criptografía de última generación y la infraestructura descentralizada de TON para garantizar que tus activos estén siempre a salvo.
            </p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-5 relative z-10">
            {STATS.map(({ val, label, color }) => (
              <div
                key={label}
                className="rounded-[16px] p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <p className="text-lg font-black m-0 mb-0.5" style={{ color }}>{val}</p>
                <p className="text-[10px] font-semibold m-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <h3 className="font-black text-[#111] text-[15px] mt-1 mx-1 mb-0 p-0">Características Clave</h3>

        {/* Feature cards */}
        {FEATURES.map((feat, i) => (
          <div
            key={i}
            className="bg-white border border-[#F0F0F0] rounded-[24px] p-5 flex gap-4 items-start shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
          >
            <div
              className="w-[52px] h-[52px] rounded-[16px] flex shrink-0 items-center justify-center text-[24px] mt-0.5"
              style={{ background: feat.bg }}
            >
              {feat.icon}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-black text-[#111] text-[15px] m-0">{feat.title}</h4>
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: feat.color }} />
              </div>
              <p className="text-[#888] text-xs leading-[1.6] m-0">{feat.desc}</p>
            </div>
          </div>
        ))}

      </div>
    </ProfileSubpageLayout>
  );
}
