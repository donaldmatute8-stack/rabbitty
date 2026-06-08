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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>

        {/* Hero card */}
        <div style={{
          background: 'linear-gradient(135deg, #0A0A0A 0%, #111827 55%, #0D2818 100%)',
          borderRadius: 28, padding: '28px 24px',
          position: 'relative', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}>
          {/* Glow blobs */}
          <div style={{ position: 'absolute', right: '-8%', top: '-8%', width: 176, height: 176, background: 'rgba(16,185,129,0.15)', borderRadius: '50%', filter: 'blur(50px)' }} />
          <div style={{ position: 'absolute', left: '-5%', bottom: '-5%', width: 128, height: 128, background: 'rgba(99,102,241,0.1)', borderRadius: '50%', filter: 'blur(40px)' }} />

          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
            borderRadius: 999, padding: '4px 12px', marginBottom: 20,
            position: 'relative', zIndex: 1,
          }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#34D399', boxShadow: '0 0 6px #10B981' }} />
            <span style={{ fontSize: 10, fontWeight: 900, color: '#34D399', letterSpacing: 1.5 }}>SISTEMA PROTEGIDO</span>
          </div>

          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20,
              background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 28, marginBottom: 16,
            }}>🔒</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
              Seguridad de Nivel Bancario
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 1.6, margin: 0 }}>
              Rabbitty utiliza criptografía de última generación y la infraestructura descentralizada de TON para garantizar que tus activos estén siempre a salvo.
            </p>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 20, position: 'relative', zIndex: 1 }}>
            {STATS.map(({ val, label, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 12,
                textAlign: 'center', border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <p style={{ fontSize: 18, fontWeight: 900, color, margin: '0 0 2px' }}>{val}</p>
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600, margin: 0 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>

        <h3 style={{ fontWeight: 900, color: '#111', fontSize: 15, margin: '4px 4px 0', padding: 0 }}>Características Clave</h3>

        {/* Feature cards */}
        {FEATURES.map((feat, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid #F0F0F0',
            borderRadius: 24, padding: 20,
            display: 'flex', gap: 16, alignItems: 'flex-start',
            boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
          }}>
            <div style={{
              width: 52, height: 52, borderRadius: 16, background: feat.bg,
              display: 'flex', flexShrink: 0, alignItems: 'center', justifyContent: 'center',
              fontSize: 24, marginTop: 2,
            }}>
              {feat.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <h4 style={{ fontWeight: 900, color: '#111', fontSize: 15, margin: 0 }}>{feat.title}</h4>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: feat.color, flexShrink: 0 }} />
              </div>
              <p style={{ color: '#888', fontSize: 12, lineHeight: 1.6, margin: 0 }}>{feat.desc}</p>
            </div>
          </div>
        ))}

      </div>
    </ProfileSubpageLayout>
  );
}
