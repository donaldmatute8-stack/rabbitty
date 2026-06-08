'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { Eye, FileText, Database, ShieldOff } from 'lucide-react';

export default function PrivacyPage() {
  const policies = [
    { icon: <Database />, title: "Minimización de Datos", desc: "Solo recolectamos lo estrictamente necesario para que la app funcione. Ni tu nombre, ni tu teléfono." },
    { icon: <ShieldOff />, title: "Cero Rastreo Publicitario", desc: "No vendemos tus datos a terceros ni usamos trackers de publicidad invasivos." },
    { icon: <FileText />, title: "Transparencia Total", desc: "Todas las transacciones de recompensas quedan registradas inmutablemente en nuestro ledger abierto." },
  ];

  return (
    <ProfileSubpageLayout title="Privacidad">
      <div className="flex flex-col gap-6 mt-4">
        
        {/* Hero Section */}
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 text-white rounded-[32px] p-8 shadow-2xl relative overflow-hidden border border-white/10">
          <div className="absolute right-[-10%] top-[-10%] w-40 h-40 bg-blue-400/20 rounded-full blur-[60px]"></div>
          
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/5 mb-6">
            <Eye className="w-8 h-8 text-blue-300" />
          </div>
          
          <h2 className="text-2xl font-black mb-2 tracking-tight">Tu Privacidad es Prioridad</h2>
          <p className="text-white/60 text-sm leading-relaxed">
            Creemos firmemente en la Web3. Tú eres dueño de tus datos y de tu dinero. Rabbitty está diseñado bajo el principio de privacidad por defecto.
          </p>
        </div>

        <h3 className="font-bold text-gray-900 text-lg mt-2 px-2">Nuestros Compromisos</h3>

        {/* Policies List */}
        <div className="flex flex-col gap-4">
          {policies.map((pol, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-3xl p-5 flex gap-4 shadow-sm items-start">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex flex-shrink-0 items-center justify-center mt-1">
                {pol.icon}
              </div>
              <div>
                <h4 className="font-black text-gray-900 text-[15px] mb-1">{pol.title}</h4>
                <p className="text-gray-500 text-[13px] leading-relaxed">{pol.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
