'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useActiveWallet } from 'thirdweb/react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';

export default function ClaimPage() {
  const router = useRouter();
  const wallet = useActiveWallet();
  
  const [step, setStep] = useState(1); // 1: Search, 2: Amount, 3: Success
  const [searchQuery, setSearchQuery] = useState('');
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [selectedBusiness, setSelectedBusiness] = useState<any>(null);
  
  const [fiatAmount, setFiatAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Auto-fetch location and nearest businesses (simulated for now, falls back to search)
  useEffect(() => {
    if (searchQuery.length > 1) {
      const delaySearch = setTimeout(async () => {
        try {
          const res = await fetch(`/api/business/search?q=${searchQuery}`);
          const data = await res.json();
          if (data.success) {
            setBusinesses(data.businesses);
          }
        } catch (e) {
          console.error(e);
        }
      }, 500);
      return () => clearTimeout(delaySearch);
    } else if (searchQuery.length === 0) {
      // Fetch default active businesses
      fetch(`/api/business/search?q=`).then(r => r.json()).then(d => {
        if(d.success) setBusinesses(d.businesses);
      });
    }
  }, [searchQuery]);

  const handleClaim = async () => {
    if (!wallet || !selectedBusiness || !fiatAmount) return;
    setSubmitting(true);
    
    try {
      const res = await fetch('/api/transaction/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rabbitterWallet: wallet.getAccount()?.address,
          businessId: selectedBusiness.id,
          fiatAmount: parseInt(fiatAmount, 10)
        })
      });
      const data = await res.json();
      if (data.success) {
        setStep(3);
      } else {
        alert(data.error);
        setSubmitting(false);
      }
    } catch (e) {
      console.error(e);
      alert('Error de conexión');
      setSubmitting(false);
    }
  };

  const claimTitle = (
    <div>
      <p className="text-[18px] font-black text-black leading-tight m-0">Obtener Recompensa</p>
      <p className="text-[13px] text-gray-500 m-0">Solicita bunz por tu consumo</p>
    </div>
  );

  return (
    <ProfileSubpageLayout title={claimTitle}>
      <div className="pb-24">
        
        {step === 1 && (
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <div className="mb-6">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">¿Dónde estás?</label>
              <input 
                type="text" 
                placeholder="Busca el nombre del negocio..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl px-4 py-3 font-medium text-black outline-none focus:border-pink-500 transition-colors placeholder:text-gray-400"
              />
            </div>

            <div className="flex flex-col gap-3">
              {businesses.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No se encontraron negocios</p>
              ) : (
                businesses.map((b) => (
                  <div 
                    key={b.id}
                    onClick={() => { setSelectedBusiness(b); setStep(2); }}
                    className="bg-white border border-gray-100 p-4 rounded-2xl flex items-center gap-4 active:scale-95 transition-transform cursor-pointer shadow-sm"
                  >
                    <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                      {b.logo_base64 ? (
                        <img src={b.logo_base64} alt={b.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xl">🏪</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-black text-base">{b.name}</p>
                      <p className="text-xs text-gray-500">{b.category}</p>
                    </div>
                    <div className="bg-pink-50 text-pink-500 text-[10px] font-black px-2 py-1 rounded-md">
                      +{b.reward_percentage}% BUNZ
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        {step === 2 && selectedBusiness && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <button onClick={() => setStep(1)} className="text-gray-400 text-sm font-bold mb-6 flex items-center gap-1 active:opacity-50">
              ← Cambiar negocio
            </button>

            <div className="flex items-center gap-4 mb-8 bg-gray-50 p-4 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-white shadow-sm overflow-hidden flex items-center justify-center flex-shrink-0">
                {selectedBusiness.logo_base64 ? (
                  <img src={selectedBusiness.logo_base64} alt={selectedBusiness.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl">🏪</span>
                )}
              </div>
              <div>
                <p className="font-black text-black text-lg">{selectedBusiness.name}</p>
                <p className="text-xs text-gray-500">¿Cuánto pagaste en total?</p>
              </div>
            </div>

            <div className="mb-8">
              <div className="relative">
                <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-gray-300">$</span>
                <input 
                  type="number" 
                  placeholder="0.00"
                  value={fiatAmount}
                  onChange={(e) => setFiatAmount(e.target.value)}
                  className="w-full bg-white border-2 border-gray-200 rounded-3xl py-6 pl-14 pr-6 text-4xl font-black text-black outline-none focus:border-pink-500 transition-colors"
                />
              </div>
              <p className="text-center text-xs font-bold text-gray-400 mt-3">
                Recibirás aproximadamente <span className="text-pink-500">+{Math.floor((Number(fiatAmount) || 0) * (selectedBusiness.reward_percentage / 100))} Bunz</span>
              </p>
            </div>

            <button 
              onClick={handleClaim}
              disabled={submitting || !fiatAmount || Number(fiatAmount) <= 0}
              className="w-full bg-black text-white rounded-full py-4 font-black active:scale-95 transition-transform disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                "Enviar Solicitud"
              )}
            </button>
            <p className="text-center text-[10px] text-gray-400 mt-4 leading-relaxed px-4">
              El negocio verificará tu ticket de compra. Si el monto es incorrecto, el negocio lo editará según el ticket real.
            </p>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center justify-center pt-10">
            <div className="w-20 h-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </div>
            <h2 className="text-2xl font-black text-black mb-2 text-center">¡Solicitud Enviada!</h2>
            <p className="text-gray-500 text-sm text-center mb-10 px-4 leading-relaxed">
              El negocio validará tu consumo y los Bunz se agregarán automáticamente a tu saldo.
            </p>
            <button 
              onClick={() => router.push('/')}
              className="bg-gray-100 text-black px-8 py-3 rounded-full font-bold active:scale-95 transition-transform"
            >
              Volver al inicio
            </button>
          </motion.div>
        )}

      </div>
    </ProfileSubpageLayout>
  );
}
