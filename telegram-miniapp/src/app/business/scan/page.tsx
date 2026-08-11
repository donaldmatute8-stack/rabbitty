'use client';

import { useState, useEffect } from 'react';
import QRScanner from '@/features/transactions/QRScanner';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthProvider';

export default function BusinessScanPage() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<any>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user?.telegramId) {
      fetch(`/api/business?telegramId=${user.telegramId}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.business) {
            setBusiness(data.business);
          }
        })
        .catch(err => console.error("Error loading business info:", err));
    }
  }, [user]);

  const handleScan = async (decodedText: string) => {
    setIsScanning(false);
    // Treat as Wallet Address / Telegram ID for general consumption
    setScannedAddress(decodedText);
    setShowMintModal(true);
  };

  const handleMintSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fiatAmount || Number(fiatAmount) <= 0) return toast.error("Ingresa un monto válido");
    if (!business) return toast.error("No se cargó el perfil del negocio administrador");
    
    setProcessing(true);
    const toastId = toast.loading("Procesando recompensa...");
    
    try {
      const mod = await import('@twa-dev/sdk');
      const app = mod.default;
      const initData = typeof window !== 'undefined' ? app.initData : '';

      const res = await fetch('/api/business/scan/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: scannedAddress, // The customer's scanned ID/telegramId/wallet
          businessId: business.id,     // The merchant's business ID
          fiatAmount: Number(fiatAmount),
          initData
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        toast.success(`¡Listo! Se enviaron ${data.bunzRewarded} Bunz al cliente.`, { id: toastId, duration: 5000 });
        setShowMintModal(false);
        setFiatAmount('');
        setScannedAddress('');
      } else {
        toast.error(data.error || "Error al otorgar Bunz", { id: toastId, duration: 5000 });
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al procesar la recompensa", { id: toastId });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="px-6 pb-6 max-w-2xl mx-auto w-full" style={{ paddingTop: 'calc(max(env(safe-area-inset-top), 16px) + 24px)' }}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-black tracking-tight">Escáner de Caja</h1>
          <p className="text-gray-500 text-sm mt-1">
            Escanea el código QR de los Rabbitters para validar sus certificados o asignarles recompensas por sus consumos.
          </p>
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center mt-12">
        <div className="w-24 h-24 bg-white rounded-full shadow-sm flex items-center justify-center mb-6">
          <span className="text-4xl">📷</span>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Listo para escanear</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          Apunta la cámara al código QR mostrado en la aplicación del cliente.
        </p>
        
        <button 
          onClick={() => setIsScanning(true)}
          disabled={processing}
          className="bg-black text-white px-8 py-4 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 disabled:opacity-50"
        >
          {processing ? 'Procesando...' : 'Abrir Escáner'}
        </button>
      </div>

      {isScanning && (
        <QRScanner 
          onScan={handleScan}
          onClose={() => setIsScanning(false)}
        />
      )}

      {/* Mint Modal */}
      {showMintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-2xl font-black text-gray-900 mb-1">Registrar Consumo</h2>
            <p className="text-sm text-gray-500 mb-6">
              Ingresa el total pagado por el cliente para calcular automáticamente su recompensa en Bunz.
            </p>

            <form onSubmit={handleMintSubmit}>
              <div className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100">
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Total de la cuenta (MXN)
                </label>
                <div className="flex items-center">
                  <span className="text-2xl font-bold text-gray-400 mr-2">$</span>
                  <input 
                    type="number"
                    value={fiatAmount}
                    onChange={(e) => setFiatAmount(e.target.value)}
                    className="w-full bg-transparent text-4xl font-black text-black outline-none placeholder:text-gray-300"
                    placeholder="0.00"
                    autoFocus
                    required
                    min="1"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button 
                  type="button"
                  onClick={() => setShowMintModal(false)}
                  className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-colors"
                  disabled={processing}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-4 font-bold text-white bg-[#E91E63] rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
                  disabled={processing || !fiatAmount}
                >
                  {processing ? 'Enviando...' : 'Otorgar Bunz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
