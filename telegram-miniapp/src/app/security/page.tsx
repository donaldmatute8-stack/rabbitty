'use client';

import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import EmptyState from '@/components/ui/EmptyState';

export default function SecurityPage() {
  return (
    <ProfileSubpageLayout title="Seguridad">
      <div className="flex flex-col gap-4 mt-4 text-[#111111]">
        
        {/* Wallet Security */}
        <div className="bg-gradient-to-br from-gray-900 to-black text-white rounded-3xl p-6 shadow-lg relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
          <h2 className="text-xl font-black mb-2 relative z-10">Billetera In-App</h2>
          <p className="text-gray-400 text-sm mb-4 relative z-10 leading-relaxed">
            Rabbitty no custodia tus activos web3. Utilizamos Thirdweb para generar una Smart Wallet (ERC-4337) que está criptográficamente vinculada a tu correo electrónico.
          </p>
          <div className="bg-white/10 p-3 rounded-xl border border-white/10 relative z-10">
            <p className="text-xs text-gray-300">
              Solo tú puedes autorizar transacciones. Nuestro motor aprueba operaciones off-chain usando claves delegadas de sesión para que no pagues comisiones por cada consumo.
            </p>
          </div>
        </div>

        {/* Local Security */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm mt-2">
          <h3 className="font-bold text-gray-900 mb-2">Transacciones Seguras</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Cada vez que escaneas un código QR, el sistema verifica bidireccionalmente el consumo con el negocio. Las reservas expiran automáticamente en 2 horas si no se completan.
          </p>
          
          <h3 className="font-bold text-gray-900 mb-2">Sesión en Telegram</h3>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Tu sesión está protegida por la validación de inicio de sesión de Telegram (initData). Si cambias de dispositivo, simplemente re-autentícate con tu correo para recuperar tu Smart Wallet intacta.
          </p>
        </div>

      </div>
    </ProfileSubpageLayout>
  );
}
