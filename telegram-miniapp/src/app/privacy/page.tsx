'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { Eye, FileText, Database, ShieldOff, type LucideIcon } from 'lucide-react';

const HAIRLINE = '1px solid var(--border-subtle)';

const POLICIES: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Database, title: 'Minimización de Datos', desc: 'Solo recolectamos lo estrictamente necesario para que la app funcione. Ni tu nombre, ni tu teléfono.' },
  { icon: ShieldOff, title: 'Cero Rastreo Publicitario', desc: 'No vendemos tus datos a terceros ni usamos trackers de publicidad invasivos.' },
  { icon: FileText, title: 'Transparencia Total', desc: 'Todas las transacciones de recompensas quedan registradas inmutablemente en nuestro ledger abierto.' },
];

export default function PrivacyPage() {
  return (
    <ProfileSubpageLayout title="Privacidad">
      <div className="flex flex-col mt-2">
        <div className="px-1 pb-5" style={{ borderBottom: HAIRLINE }}>
          <Eye size={22} style={{ color: '#E91E63' }} />
          <h2 className="text-[20px] font-black m-0 mt-2 tracking-tight" style={{ color: 'var(--text-primary)' }}>
            Tu privacidad es prioridad
          </h2>
          <p className="text-[13px] leading-relaxed m-0 mt-1" style={{ color: 'var(--text-secondary)' }}>
            Tú eres dueño de tus datos y de tu dinero. Rabbitty está diseñado bajo el principio de privacidad por defecto.
          </p>
        </div>

        <h3 className="text-[13px] font-bold uppercase tracking-wider m-0 px-1 pt-5 pb-1" style={{ color: 'var(--text-muted)' }}>
          Nuestros compromisos
        </h3>

        {POLICIES.map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-start gap-3.5 px-1 py-3.5" style={{ borderBottom: HAIRLINE }}>
            <Icon size={20} strokeWidth={2} className="shrink-0 mt-0.5" style={{ color: 'var(--text-secondary)' }} />
            <div className="min-w-0">
              <h4 className="text-[15px] font-bold m-0 leading-snug" style={{ color: 'var(--text-primary)' }}>{title}</h4>
              <p className="text-[12px] leading-normal m-0 mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </ProfileSubpageLayout>
  );
}
