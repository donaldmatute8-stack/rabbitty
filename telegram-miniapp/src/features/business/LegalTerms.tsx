'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function LegalTerms({ onNext }: { onNext: () => void }) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedResponsibility, setAcceptedResponsibility] = useState(false);

  const canProceed = acceptedTerms && acceptedResponsibility;

  return (
    <div className="max-w-md mx-auto py-10 px-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-black tracking-tight mb-2">Contrato de Adhesión</h1>
        <p className="text-gray-500 text-xs mb-6 leading-relaxed">
          Para Creación de Recompensas Digitales (Bunz) dentro del Ecosistema Rabbitty en los Estados Unidos Mexicanos.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6 h-64 overflow-y-auto text-xs text-gray-600 leading-relaxed custom-scrollbar">
          <p className="font-bold mb-2">1. DECLARACIONES</p>
          <p className="mb-4">
            El presente acuerdo legal vincula a "El Establecimiento" con "Rabbitty", estableciendo los términos y condiciones bajo los cuales El Establecimiento participará en la emisión, otorgamiento y recepción de recompensas digitales denominadas "Bunz".
          </p>

          <p className="font-bold mb-2">2. NATURALEZA DEL BUNZ</p>
          <p className="mb-4">
            El Establecimiento reconoce y acepta que "Bunz" NO es una moneda de curso legal (Pesos Mexicanos), divisa extranjera, ni valor financiero regulado por Banxico o la CNBV. Bunz es un sistema cerrado de puntos y recompensas tecnológicas. La paridad de "1 Bunz = 1 MXN" es exclusivamente referencial para el cálculo interno de promociones.
          </p>

          <p className="font-bold mb-2">3. RESPALDO DE INVENTARIO</p>
          <p className="mb-4">
            Al seleccionar un "Paquete de Crédito de Minteo", El Establecimiento se compromete irrevocable a aceptar Bunz como forma de canje o descuento por sus productos o servicios físicos, respaldando dicho crédito de minteo con su propio inventario. Rabbitty funge exclusivamente como proveedor tecnológico (Ledger/Oracle) y no asume responsabilidad ni riesgo por el cumplimiento de la entrega de bienes de El Establecimiento hacia el cliente final (Rabbitter).
          </p>

          <p className="font-bold mb-2">4. NEGATIVA DE SERVICIO</p>
          <p className="mb-4">
            El Establecimiento se compromete a no discriminar ni negar el servicio a usuarios del ecosistema Rabbitty que deseen canjear sus Bunz legítimamente obtenidos. El incumplimiento de esta cláusula resultará en la baja definitiva de la plataforma y posibles responsabilidades de protección al consumidor (PROFECO).
          </p>
          
          <p className="font-bold mb-2">5. JURISDICCIÓN</p>
          <p>
            Para la interpretación y cumplimiento de este contrato, las partes se someten a las leyes aplicables y tribunales de la Ciudad de México, renunciando a cualquier otro fuero.
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-8">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input 
                type="checkbox" 
                className="appearance-none w-5 h-5 border-2 border-gray-300 rounded peer checked:bg-black checked:border-black transition-colors"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none">
                <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium group-hover:text-black transition-colors">
              He leído y acepto los Términos y Condiciones, así como el Aviso de Privacidad.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative flex items-center justify-center mt-0.5">
              <input 
                type="checkbox" 
                className="appearance-none w-5 h-5 border-2 border-gray-300 rounded peer checked:bg-black checked:border-black transition-colors"
                checked={acceptedResponsibility}
                onChange={(e) => setAcceptedResponsibility(e.target.checked)}
              />
              <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 pointer-events-none" viewBox="0 0 14 10" fill="none">
                <path d="M1 5L4.5 8.5L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span className="text-xs text-gray-600 font-medium group-hover:text-black transition-colors">
              Entiendo que al aceptar crédito de minteo me obligo a recibir clientes con bunz y entregarles mis productos o servicios.
            </span>
          </label>
        </div>

        <button
          onClick={onNext}
          disabled={!canProceed}
          className="w-full bg-black text-white rounded-full py-4 text-sm font-bold tracking-wide active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          Firmar y Continuar
        </button>
      </motion.div>
    </div>
  );
}
