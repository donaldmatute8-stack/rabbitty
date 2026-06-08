'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

const PACKAGES = [
  { id: 'starter', label: '$10K Crédito', amount: 10000, description: 'Ideal para probar el ecosistema.' },
  { id: 'growth', label: '$20K Crédito', amount: 20000, description: 'Para negocios con afluencia regular.', popular: true },
  { id: 'pro', label: '$50K Crédito', amount: 50000, description: 'Alto volumen de recompensas.' },
  { id: 'enterprise', label: '$100K Crédito', amount: 100000, description: 'Dominio total del mercado local.' },
];

interface MintingCreditPackagesProps {
  onSelect: (amount: number) => void;
  isLoading: boolean;
}

export default function MintingCreditPackages({ onSelect, isLoading }: MintingCreditPackagesProps) {
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const handleConfirm = () => {
    if (selectedAmount) {
      onSelect(selectedAmount);
    }
  };

  return (
    <div className="max-w-md mx-auto py-10 px-6">
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-black text-black tracking-tight mb-2">Crédito de Minteo</h1>
        <p className="text-gray-500 text-sm mb-8 leading-relaxed">
          Selecciona un paquete para respaldar con tu inventario. Esto te permitirá mintear y otorgar bunz a los clientes.
        </p>

        <div className="flex flex-col gap-4">
          {PACKAGES.map((pkg, i) => (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              key={pkg.id}
              onClick={() => setSelectedAmount(pkg.amount)}
              className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all ${
                selectedAmount === pkg.amount 
                  ? 'border-pink-500 bg-pink-50' 
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-3 right-4 bg-black text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                  Popular
                </span>
              )}
              <div className="flex justify-between items-center mb-1">
                <h3 className="font-black text-lg text-black">{pkg.label}</h3>
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  selectedAmount === pkg.amount ? 'border-pink-500' : 'border-gray-300'
                }`}>
                  {selectedAmount === pkg.amount && <span className="w-2.5 h-2.5 bg-pink-500 rounded-full" />}
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-500">{pkg.description}</p>
            </motion.div>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          disabled={!selectedAmount || isLoading}
          className="w-full bg-black text-white rounded-full py-4 text-sm font-bold tracking-wide mt-8 active:scale-95 transition-transform disabled:opacity-50 disabled:active:scale-100"
        >
          {isLoading ? "Procesando..." : "Confirmar Selección"}
        </button>
      </motion.div>
    </div>
  );
}
