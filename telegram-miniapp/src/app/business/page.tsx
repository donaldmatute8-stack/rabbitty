'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useActiveWallet } from "thirdweb/react";
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import BusinessSetupForm from '@/features/business/BusinessSetupForm';
import MarketingComparison from '@/features/business/MarketingComparison';
import LegalTerms from '@/features/business/LegalTerms';
import MintingCreditPackages from '@/features/business/MintingCreditPackages';
import QRScanner from '@/features/transactions/QRScanner';

function QRCode() {
  const cells: boolean[][] = [];
  const seed = [1,0,1,1,0,1,0,1, 0,1,0,0,1,0,1,0, 1,1,1,0,1,1,0,1, 0,0,1,1,0,0,1,1, 1,0,0,1,1,0,1,0, 0,1,1,0,0,1,0,1, 1,0,1,0,1,1,1,0, 0,1,0,1,0,0,1,1];
  for (let i = 0; i < 8; i++) {
    cells.push(seed.map(v => !!v));
  }
  return (
    <div style={{ display: "inline-grid", gridTemplateColumns: "repeat(8, 10px)", gap: 2 }}>
      {cells.flat().map((on, i) => (
        <div key={i} style={{ width: 10, height: 10, backgroundColor: on ? "#111" : "transparent", borderRadius: 1 }} />
      ))}
    </div>
  );
}

export default function BusinessPage() {
  const wallet = useActiveWallet();
  const [business, setBusiness] = useState<any>(undefined);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [setupStep, setSetupStep] = useState(1); // 1: Form, 2: Marketing, 3: Legal, 4: Packages
  
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  const [transactions, setTransactions] = useState<any[]>([]);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
    });
  }, []);

  const fetchBusiness = async () => {
    try {
      const res = await fetch(`/api/business?wallet=${wallet?.getAccount()?.address}`);
      const data = await res.json();
      if (data.success) {
        setBusiness(data.business);
        
        // Fetch transactions if active
        if (data.business?.is_active) {
          fetchTransactions();
        }
      } else {
        setBusiness(null);
      }
    } catch (e) {
      console.error(e);
      setBusiness(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch(`/api/business/transactions?wallet=${wallet?.getAccount()?.address}`);
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (wallet) {
      fetchBusiness();
    } else {
      setLoading(false);
    }
  }, [wallet]);

  const handleCreateBusiness = async (formData: any) => {
    if (!wallet) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.getAccount()?.address,
          ...formData
        })
      });
      const data = await res.json();
      if (data.success) {
        setBusiness(data.business);
        setSetupStep(2);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFundCredit = async (amount: number) => {
    if (!wallet) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/business/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress: wallet.getAccount()?.address,
          packageCreditAmount: amount
        })
      });
      const data = await res.json();
      if (data.success) {
        setBusiness(data.business);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const handleScan = async (text: string) => {
    setIsScanning(false);
    
    if (text.startsWith('rabbitty:auth:')) {
      const sessionId = text.split(':')[2];
      try {
        const res = await fetch('/api/auth/qr-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            walletAddress: wallet?.getAccount()?.address
          })
        });
        const data = await res.json();
        if (data.success) {
          alert('¡Sesión web aprobada exitosamente!');
        } else {
          alert('Error al aprobar la sesión: ' + data.error);
        }
      } catch (e) {
        alert('Error de conexión');
      }
    } else {
      // Futuro: Transacción con Rabbitter
      setScanResult(text);
      alert('QR Escaneado (Rabbitter): ' + text);
    }
  };

  const handleApproveTransaction = async () => {
    if (!selectedTx || !wallet) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/transaction/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transactionId: selectedTx.id,
          affiliateWallet: wallet.getAccount()?.address,
          finalFiatAmount: editAmount ? parseInt(editAmount, 10) : selectedTx.fiat_amount_claimed,
          receiptPhotoBase64: receiptPhoto
        })
      });
      const data = await res.json();
      if (data.success) {
        alert('Transacción aprobada');
        setSelectedTx(null);
        setEditAmount('');
        setReceiptPhoto(null);
        fetchBusiness(); // Refresh balance
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Error al aprobar');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-white"><div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin" /></div>;
  }

  // Flujo 1: Crear Negocio
  if (business === null) {
    return <BusinessSetupForm onSubmit={handleCreateBusiness} isLoading={submitting} />;
  }

  // Flujo Intermedio: Aprobaciones Legales y Educativas (si no está activo aún)
  if (business && !business.is_active) {
    if (setupStep === 2) {
      return <MarketingComparison onNext={() => setSetupStep(3)} />;
    }
    if (setupStep === 3) {
      return <LegalTerms onNext={() => setSetupStep(4)} />;
    }
    // Paso final antes de activarse:
    return <MintingCreditPackages onSelect={handleFundCredit} isLoading={submitting} />;
  }

  // Flujo 3: Dashboard Activo
  const businessTitle = (
    <div className="flex items-center gap-3">
      {business?.logo_base64 && (
        <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 shrink-0">
          <img src={business.logo_base64} alt="Logo" className="w-full h-full object-cover" />
        </div>
      )}
      <div>
        <h1 className="text-2xl font-black text-black tracking-tight leading-none mb-1">{business?.name || "Cargando..."}</h1>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{business?.category || "Negocio"}</p>
      </div>
    </div>
  );

  const STATS = [
    { value: "0", label: "TRANSACCIONES", delta: "-", color: "#E91E63" },
    { value: "0", label: "CLIENTES", delta: "-", color: "#E91E63" },
    { value: "0", label: "BUNZ DADOS", delta: "-", color: "#E91E63" },
  ];

  return (
    <ProfileSubpageLayout title={businessTitle}>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-2 mb-4"
        >
          {STATS.map((s, i) => (
            <motion.div 
              key={s.label} 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="flex-1 border border-gray-100 rounded-2xl p-3 text-center bg-white"
            >
              <p className="text-xl font-black text-black tracking-tight">{s.value}</p>
              <p className="text-[9px] font-bold text-gray-400 tracking-wider my-1">{s.label}</p>
              <p className="text-[10px] font-bold text-pink-500">{s.delta}</p>
            </motion.div>
          ))}
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-black rounded-[20px] p-5 mb-4 flex items-center justify-between shadow-lg"
        >
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <span className="text-lg">📷</span>
              </div>
              <div>
                <p className="text-sm font-black text-white">Escanear Cliente o Web</p>
                <p className="text-xs text-white/50 font-medium mt-0.5">Autoriza inicio de sesión web</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsScanning(true)}
            className="bg-white text-black font-bold text-xs px-4 py-2 rounded-full active:scale-95 transition-transform"
          >
            Escanear
          </button>
        </motion.div>

        {isScanning && (
          <QRScanner 
            onScan={handleScan} 
            onClose={() => setIsScanning(false)} 
          />
        )}

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="border border-gray-100 rounded-[20px] p-5 mb-4 bg-white"
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-sm font-black text-black mb-0.5">Crédito de Minteo</p>
              <p className="text-xs font-semibold text-gray-400">Total minteado: 0 bunz</p>
            </div>
            <p className="text-lg font-black text-pink-600">{business?.minting_credit?.toLocaleString()} bunz</p>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: "0%" }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-pink-500 rounded-full" 
            />
          </div>
          <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-wide">0% usado</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="border border-gray-100 rounded-[20px] p-5 mb-4 bg-white"
        >
          <div className="flex justify-between items-center mb-1">
            <div>
              <p className="text-sm font-black text-black">Tasa de Recompensa</p>
              <p className="text-xs font-semibold text-gray-400">Compromiso por compra</p>
            </div>
            <p className="text-2xl font-black text-black">{business?.reward_percentage}%</p>
          </div>
        </motion.div>

        {/* Transactions Inbox */}
        <div className="mt-8">
          <h2 className="text-xl font-black text-black mb-4">Reclamos Pendientes</h2>
          <div className="flex flex-col gap-3">
            {transactions.filter(t => t.status === 'PENDING').length === 0 ? (
              <p className="text-sm text-gray-400 bg-gray-50 p-4 rounded-xl text-center font-medium">
                No tienes reclamos pendientes.
              </p>
            ) : (
              transactions.filter(t => t.status === 'PENDING').map(t => (
                <div key={t.id} className="bg-white border-2 border-pink-100 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                  <div>
                    <p className="font-bold text-black text-sm">{t.rabbitter?.first_name || 'Usuario'}</p>
                    <p className="text-xs text-gray-500">Reporta: <span className="font-bold text-black">${t.fiat_amount_claimed}</span></p>
                    <p className="text-[10px] text-pink-500 font-bold mt-1">Recompensa a otorgar: ~{t.bunz_amount} Bunz</p>
                  </div>
                  <button 
                    onClick={() => { setSelectedTx(t); setEditAmount(t.fiat_amount_claimed.toString()); }}
                    className="bg-black text-white text-xs font-bold px-4 py-2 rounded-full active:scale-95 transition-transform"
                  >
                    Revisar
                  </button>
                </div>
              ))
            )}
          </div>

          <h2 className="text-lg font-bold text-black mt-8 mb-4">Últimas Aprobadas</h2>
          <div className="flex flex-col gap-2 opacity-70">
            {transactions.filter(t => t.status === 'APPROVED').slice(0,5).map(t => (
              <div key={t.id} className="bg-gray-50 p-3 rounded-xl flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-800 text-xs">{t.rabbitter?.first_name || 'Usuario'} <span className="text-green-600 ml-1">✓</span></p>
                  <p className="text-[10px] text-gray-500">Ticket: ${t.fiat_amount_approved} • Otorgados: {t.bunz_amount} Bunz</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Modal de Aprobación */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center sm:p-4">
            <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 relative animate-in slide-in-from-bottom-10">
              <button onClick={() => setSelectedTx(null)} className="absolute top-4 right-4 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold">×</button>
              
              <h3 className="text-xl font-black text-black mb-1">Validar Consumo</h3>
              <p className="text-xs text-gray-500 mb-6">El usuario reportó un ticket de <strong className="text-black">${selectedTx.fiat_amount_claimed}</strong></p>

              <div className="mb-4">
                <label className="text-xs font-bold text-gray-500 uppercase">Monto Real del Ticket (MXN)</label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input 
                    type="number"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-gray-100 rounded-xl py-3 pl-8 pr-4 font-black text-black text-lg outline-none focus:border-pink-500 transition-colors"
                  />
                </div>
                {Number(editAmount) !== selectedTx.fiat_amount_claimed && (
                  <p className="text-[10px] text-orange-500 font-bold mt-2">Has modificado el monto reportado.</p>
                )}
              </div>

              <div className="mb-8">
                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">Foto del Ticket (Opcional pero recomendado)</label>
                <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center relative hover:bg-gray-50 transition-colors cursor-pointer">
                  <input type="file" accept="image/*" onChange={handlePhotoUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  {receiptPhoto ? (
                    <div className="flex flex-col items-center">
                      <span className="text-green-500 text-2xl mb-1">✓</span>
                      <span className="text-xs font-bold text-green-600">Ticket Cargado</span>
                    </div>
                  ) : (
                    <span className="text-xs font-bold text-gray-400">Tocar para subir foto</span>
                  )}
                </div>
              </div>

              <button 
                onClick={handleApproveTransaction}
                disabled={submitting}
                className="w-full bg-black text-white rounded-full py-4 font-black text-sm active:scale-95 transition-transform disabled:opacity-50"
              >
                {submitting ? 'Procesando...' : 'Aprobar y Otorgar Bunz'}
              </button>
            </div>
          </div>
        )}

    </ProfileSubpageLayout>
  );
}
