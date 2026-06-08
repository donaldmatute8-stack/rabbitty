'use client';

import { motion } from 'framer-motion';

export default function MarketingComparison({ onNext }: { onNext: () => void }) {
  return (
    <div className="max-w-md mx-auto py-10 px-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black text-black tracking-tight mb-2">El Secreto de Mintear Bunz</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Las plataformas tradicionales te cobran en efectivo por conseguir clientes. En Rabbitty, el costo de marketing es simplemente tu <strong>Costo de Inventario (COGS)</strong>.
        </p>

        <div className="flex flex-col gap-4 mb-8">
          {/* Tarjeta Publicidad Tradicional */}
          <div className="border border-gray-200 rounded-[20px] p-5 bg-white relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-red-100 text-red-600 text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Facebook / Google Ads
            </div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 mt-2">Publicidad Tradicional</p>
            
            <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-3">
              <span className="text-sm font-semibold text-gray-600">Costo Adquisición (CAC)</span>
              <span className="text-base font-black text-black">~$200 MXN</span>
            </div>
            <div className="flex justify-between items-center mb-3 border-b border-gray-100 pb-3">
              <span className="text-sm font-semibold text-gray-600">Forma de Pago</span>
              <span className="text-sm font-black text-red-500">Efectivo Frontal</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-600">Garantía de Venta</span>
              <span className="text-sm font-black text-red-500">Ninguna (0%)</span>
            </div>
          </div>

          {/* Tarjeta Rabbitty */}
          <div className="border-2 border-pink-500 rounded-[20px] p-5 bg-pink-50 relative overflow-hidden shadow-lg shadow-pink-500/10">
            <div className="absolute top-0 right-0 bg-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              Ecosistema Rabbitty
            </div>
            <p className="text-xs font-bold text-pink-500 uppercase tracking-wider mb-4 mt-2">Minteo de Bunz</p>
            
            <div className="flex justify-between items-center mb-3 border-b border-pink-200 pb-3">
              <span className="text-sm font-semibold text-gray-700">Costo de Recompensa</span>
              <span className="text-base font-black text-black">Tu Costo de Insumo (COGS)</span>
            </div>
            <div className="flex justify-between items-center mb-3 border-b border-pink-200 pb-3">
              <span className="text-sm font-semibold text-gray-700">Ejemplo ($100 Recompensa)</span>
              <span className="text-sm font-black text-pink-600">Te cuesta ~$35 MXN</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Garantía de Venta</span>
              <span className="text-sm font-black text-pink-600">Solo pagas si consumen</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-8">
          <p className="text-xs text-gray-500 leading-relaxed font-medium">
            💡 <strong>Resumen:</strong> No "compras" bunz, tú creas (minteas) valor respaldado en tu propio producto. Entregar 100 bunz de recompensa te cuesta solo lo que te cuesta producir 100 pesos de tu producto.
          </p>
        </div>

        <button
          onClick={onNext}
          className="w-full bg-black text-white rounded-full py-4 text-sm font-bold tracking-wide active:scale-95 transition-transform"
        >
          Entendido, quiero participar
        </button>
      </motion.div>
    </div>
  );
}
