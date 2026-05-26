'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';

export default function PrivacyPage() {
  return (
    <ProfileSubpageLayout title="Privacidad">
      <div className="flex flex-col gap-4 mt-4 text-[#111111]">
        <div className="bg-white rounded-3xl p-6 border shadow-sm">
          <h2 className="text-lg font-black mb-2">Política de Privacidad</h2>
          <p className="text-sm text-gray-500 mb-4 leading-relaxed">
            Tu privacidad es lo más importante en Rabbitty. La información que recopilamos se utiliza exclusivamente para operar el motor de recompensas y conectarte con negocios afiliados.
          </p>
          
          <h3 className="font-bold text-sm mb-1 mt-4">1. Datos Recopilados</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Recopilamos tu correo electrónico, dirección de billetera (Smart Wallet generada), historial de consumos y ubicación aproximada (si autorizas el GPS) para mostrarte negocios cercanos.
          </p>

          <h3 className="font-bold text-sm mb-1">2. Terceros</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            No vendemos tus datos a terceros. Usamos Thirdweb para la gestión de tu identidad Web3 y Neon Database para el almacenamiento seguro.
          </p>

          <h3 className="font-bold text-sm mb-1">3. Eliminación de cuenta</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Puedes solicitar la eliminación total de tus datos en cualquier momento desde Soporte. Ten en cuenta que si migras tus tokens a la red principal (Blockchain), ese registro público será inmutable.
          </p>
        </div>
      </div>
    </ProfileSubpageLayout>
  );
}
