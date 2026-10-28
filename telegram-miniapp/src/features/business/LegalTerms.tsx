'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { resolveNicheWelcomeRuleSync } from '@/lib/welcomeBonusConfig';

export default function LegalTerms({
  onNext,
  category = 'Cafetería',
  selectedPackage = 'Starter',
}: {
  onNext: (signatureData?: { signedBy: string; signedAt: string }) => void;
  category?: string;
  selectedPackage?: string;
}) {
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedResponsibility, setAcceptedResponsibility] = useState(false);
  const [acceptedSplitClause, setAcceptedSplitClause] = useState(false);
  const [signerName, setSignerName] = useState('');

  const { rule, affiliateBunz, treasuryBunz } = resolveNicheWelcomeRuleSync(category);
  const canProceed =
    acceptedTerms && acceptedResponsibility && acceptedSplitClause && signerName.trim().length >= 3;

  return (
    <div className="max-w-md mx-auto py-10 px-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-black tracking-tight mb-2">Contrato Digital de Adhesión</h1>
        <p className="text-gray-500 text-xs mb-6 leading-relaxed">
          Acuerdo de Colateralización de Paquete y Co-Emisión de Recompensas Digitales (Bunz) en los Estados Unidos Mexicanos.
        </p>

        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 mb-6 h-64 overflow-y-auto text-xs text-gray-600 leading-relaxed custom-scrollbar">
          <p className="font-bold mb-2">1. DECLARACIONES</p>
          <p className="mb-4">
            El presente acuerdo legal vincula a &ldquo;El Establecimiento&rdquo; con &ldquo;Rabbitty&rdquo;, estableciendo los términos y condiciones bajo los cuales El Establecimiento participará en la emisión, otorgamiento y recepción de recompensas digitales denominadas &ldquo;Bunz&rdquo;.
          </p>

          <p className="font-bold mb-2">2. NATURALEZA DEL BUNZ</p>
          <p className="mb-4">
            El Establecimiento reconoce y acepta que &ldquo;Bunz&rdquo; NO es una moneda de curso legal (Pesos Mexicanos), divisa extranjera, ni valor financiero regulado por Banxico o la CNBV. Bunz es un sistema cerrado de puntos y recompensas tecnológicas. La paridad de &ldquo;1 Bunz = 1 MXN&rdquo; es exclusivamente referencial para el cálculo interno de promociones.
          </p>

          <p className="font-bold mb-2">3. RESPALDO DE INVENTARIO Y PAQUETE ({selectedPackage || 'Estándar'})</p>
          <p className="mb-4">
            Al adquirir o activar un &ldquo;Paquete de Crédito de Minteo&rdquo;, El Establecimiento se compromete irrevocablemente a aceptar Bunz como forma de canje o descuento por sus productos o servicios físicos, respaldando 1:1 dicho crédito de minteo con su propio inventario comercial.
          </p>

          <p className="font-bold mb-2">4. CO-INVERSIÓN Y SPLIT DINÁMICO DE BONOS DE BIENVENIDA POR NICHO</p>
          <p className="mb-4">
            Para incentivar la captación de clientes nuevos mediante los códigos QR físicos en mesa y mostrador, las partes acuerdan un esquema de Co-Emisión (&ldquo;Split Triangular&rdquo;) calculado dinámicamente según el nicho de mercado ({rule.label}): el bono base actual es de <strong>{rule.baseBunz} Bunz</strong> por nuevo usuario verificado (rango dinámico del nicho: {rule.recommendedFutureRange}), de los cuales el <strong>{rule.affiliateSplitPct}% ({affiliateBunz} Bunz)</strong> se deduce del paquete de crédito de El Establecimiento y el <strong>{rule.treasurySplitPct}% ({treasuryBunz} Bunz)</strong> es subsidiado por la Tesorería de Rabbitty.
          </p>

          <p className="font-bold mb-2">5. PROHIBICIÓN DE NEGATIVA DE SERVICIO</p>
          <p className="mb-4">
            El Establecimiento se compromete a no discriminar ni negar el servicio a usuarios del ecosistema Rabbitty que deseen canjear sus Bunz legítimamente obtenidos. El incumplimiento de esta cláusula resultará en la baja definitiva de la plataforma.
          </p>

          <p className="font-bold mb-2">6. FIRMA ELECTRÓNICA Y JURISDICCIÓN</p>
          <p>
            De conformidad con el Artículo 89 del Código de Comercio, la firma electrónica estampada al calce produce los mismos efectos jurídicos que la firma autógrafa. Para la interpretación y cumplimiento de este contrato, las partes se someten a las leyes aplicables y tribunales de los Estados Unidos Mexicanos.
          </p>
        </div>

        <div className="flex flex-col gap-3.5 mb-6">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-black"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
            />
            <span className="text-xs text-gray-600 font-medium group-hover:text-black transition-colors">
              He leído y acepto los Términos y Condiciones, así como el Aviso de Privacidad.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-black"
              checked={acceptedResponsibility}
              onChange={(e) => setAcceptedResponsibility(e.target.checked)}
            />
            <span className="text-xs text-gray-600 font-medium group-hover:text-black transition-colors">
              Entiendo que al aceptar crédito de minteo me obligo a respaldarlo con mis productos o servicios.
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 w-4 h-4 accent-black"
              checked={acceptedSplitClause}
              onChange={(e) => setAcceptedSplitClause(e.target.checked)}
            />
            <span className="text-xs text-gray-600 font-medium group-hover:text-black transition-colors">
              Acepto la Cláusula 4 de Split por Nicho ({affiliateBunz} Bunz Afiliado / {treasuryBunz} Bunz Rabbitty en bonos de bienvenida).
            </span>
          </label>

          <div className="pt-2">
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
              Firma Digital (Nombre Completo del Titular o Representante Legal)
            </label>
            <input
              type="text"
              placeholder="Escribe tu nombre completo para firmar"
              value={signerName}
              onChange={(e) => setSignerName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs text-black focus:border-black outline-none"
            />
          </div>
        </div>

        <button
          onClick={() =>
            onNext({
              signedBy: signerName.trim(),
              signedAt: new Date().toISOString(),
            })
          }
          disabled={!canProceed}
          className="w-full bg-black text-white rounded-full py-4 text-sm font-bold tracking-wide active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          Firmar Contrato Digital y Continuar
        </button>
      </motion.div>
    </div>
  );
}
