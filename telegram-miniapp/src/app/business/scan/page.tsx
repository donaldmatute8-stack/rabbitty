'use client';

import { useState, useEffect } from 'react';
import QRScanner from '@/features/transactions/QRScanner';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';
import { resolveScannedPayload } from '@/lib/scannerResolver';

interface MerchantBusiness {
  id: string;
  name?: string;
}

export default function BusinessScanPage() {
  const { user } = useAuth();
  const [business, setBusiness] = useState<MerchantBusiness | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [showMintModal, setShowMintModal] = useState(false);
  const [scannedAddress, setScannedAddress] = useState('');
  const [fiatAmount, setFiatAmount] = useState('');
  const [processing, setProcessing] = useState(false);

  // ── Modo: dar Bunz (recompensa) o cobrar Bunz (consumo) ──
  const [mode, setMode] = useState<"mint" | "charge">("mint");
  const [chargeCustomer, setChargeCustomer] = useState<{ id: string; name: string } | null>(null);
  const [chargeStage, setChargeStage] = useState<"idle" | "waiting" | "done">("idle");
  const [chargeInfo, setChargeInfo] = useState<{ requestId: string; orderId: string } | null>(null);
  const [onCellular, setOnCellular] = useState(false);

  // Igual que el comandero: cobrar exige conexión del local, no datos móviles.
  useEffect(() => {
    const conn = (navigator as unknown as { connection?: { type?: string } }).connection;
    if (!conn) return;
    const check = () => setOnCellular(String(conn.type || "") === "cellular");
    check();
    const el = conn as unknown as EventTarget;
    el.addEventListener?.("change", check);
    return () => el.removeEventListener?.("change", check);
  }, []);

  useEffect(() => {
    if (user?.id) {
      PlatformBridge.getAuthHeaders()
        .then(headers => fetch(`/api/business`, { headers }))
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

    // ── Fuente única de la verdad: resolver el payload con el motor central ──
    try {
      const res = await resolveScannedPayload(decodedText);
      if (res.type === 'user' && res.user?.id) {
        setScannedAddress(res.user.id);
        if (mode === "charge") {
          setChargeCustomer({ id: res.user.id, name: res.user.name || "Rabbitter" });
          setChargeStage("idle");
          toast.success(`Cliente identificado: ${res.user.name}`);
        } else {
          setShowMintModal(true);
          toast.success(`Cliente identificado: ${res.user.name}`);
        }
        return;
      }
      if (res.raw) {
        setScannedAddress(res.raw);
        setShowMintModal(true);
        return;
      }
    } catch (err) {
      console.warn('[BusinessScanPage] Error resolving scanned customer:', err);
    }

    setScannedAddress(decodedText);
    setShowMintModal(true);
  };

  const getCoords = (): Promise<{ lat?: number; lng?: number }> =>
    new Promise((resolve) => {
      if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30_000 },
      );
    });

  const startCharge = async () => {
    if (!business || !chargeCustomer) return;
    const amount = Number(fiatAmount);
    if (!amount || amount <= 0) return toast.error("Ingresa un monto válido");
    if (onCellular) return toast.error("Conéctate al Wi-Fi del local para cobrar.");

    setProcessing(true);
    const toastId = toast.loading("Creando cobro…");
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const coords = await getCoords();
      const res = await fetch("/api/business/scan/charge", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: business.id, customerId: chargeCustomer.id, amount, ...coords }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "No se pudo crear el cobro", { id: toastId });
        return;
      }
      setChargeInfo({ requestId: data.requestId, orderId: data.orderId });
      setChargeStage("waiting");
      toast.success("Pídele al cliente aprobar en su app", { id: toastId });

      // Se sondea la captura: el endpoint responde 409 mientras no apruebe.
      const started = Date.now();
      const timer = setInterval(async () => {
        if (Date.now() - started > 5 * 60_000) {
          clearInterval(timer);
          setChargeStage("idle");
          toast.error("La solicitud expiró. Vuelve a intentar.");
          return;
        }
        try {
          const r = await fetch("/api/business/scan/charge/settle", {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ businessId: business.id, requestId: data.requestId }),
          });
          if (r.ok) {
            const ok = await r.json();
            clearInterval(timer);
            setChargeStage("done");
            setFiatAmount("");
            toast.success(`Cobrado: ${ok.amount} Bunz`, { duration: 5000 });
          }
        } catch { /* sigue esperando */ }
      }, 3000);
    } catch (err) {
      console.error(err);
      toast.error("Error al cobrar", { id: toastId });
    } finally {
      setProcessing(false);
    }
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
      const headers = await PlatformBridge.getAuthHeaders();

      const res = await fetch('/api/business/scan/mint', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId: scannedAddress, // The customer's scanned ID/telegramId/wallet
          businessId: business.id,     // The merchant's business ID
          fiatAmount: Number(fiatAmount),
          initData,
          idempotencyKey: crypto.randomUUID()
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
        <div className="flex-1">
          <h1 className="text-2xl font-black text-black tracking-tight">Escáner de Caja</h1>
          <p className="text-gray-500 text-sm mt-1">
            {mode === "charge"
              ? "Cobra con Bunz al Rabbitter. Se crea una orden real: la ves en el POS, en los turnos y en los reportes."
              : "Escanea el código QR de los Rabbitters para validar sus certificados o asignarles recompensas por sus consumos."}
          </p>
        </div>
      </div>

      {/* Dar Bunz (recompensa) vs Cobrar Bunz (consumo) */}
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
        {([
          { key: "mint" as const, label: "Dar Bunz" },
          { key: "charge" as const, label: "Cobrar Bunz" },
        ]).map((opt) => (
          <button
            key={opt.key}
            onClick={() => setMode(opt.key)}
            className={`rounded-xl py-3 text-sm font-black transition-all ${
              mode === opt.key ? "bg-black text-white shadow" : "text-gray-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "charge" && onCellular && (
        <p className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-800">
          Estás con datos móviles. Para cobrar, conéctate al Wi-Fi del local.
        </p>
      )}

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

      {/* Charge Modal */}
      {chargeCustomer && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-4xl w-full max-w-md p-6 shadow-2xl relative">
            <h2 className="text-2xl font-black text-gray-900 mb-1">
              {chargeStage === "done" ? "Cobrado" : "Cobrar en Bunz"}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {chargeStage === "done"
                ? "El cobro quedó registrado en la orden y en el turno."
                : `Cliente: ${chargeCustomer.name}. Se le pedirá aprobar el cobro en su app.`}
            </p>

            {chargeStage !== "done" && (
              <>
                <div className="bg-gray-50 p-4 rounded-2xl mb-6 border border-gray-100">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Monto a cobrar (MXN)
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
                      min="1"
                      disabled={chargeStage === "waiting"}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-gray-500">
                    Se descuentan {Number(fiatAmount || 0)} Bunz del saldo del cliente.
                  </p>
                </div>

                {chargeStage === "waiting" && (
                  <p className="mb-4 rounded-2xl border border-violet-200 bg-violet-50 p-3 text-xs font-bold text-violet-700">
                    Esperando que {chargeCustomer.name} apruebe en su app…
                  </p>
                )}
              </>
            )}

            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => { setChargeCustomer(null); setChargeStage("idle"); setFiatAmount(""); setChargeInfo(null); }}
                className="flex-1 py-4 font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition-colors"
                disabled={processing || chargeStage === "waiting"}
              >
                {chargeStage === "done" ? "Cerrar" : "Cancelar"}
              </button>
              {chargeStage !== "done" && (
                <button
                  type="button"
                  onClick={startCharge}
                  className="flex-1 py-4 font-bold text-white bg-black rounded-2xl active:scale-95 transition-transform disabled:opacity-50"
                  disabled={processing || chargeStage === "waiting" || !fiatAmount || onCellular}
                >
                  {chargeStage === "waiting" ? "Esperando…" : "Cobrar"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mint Modal */}
      {showMintModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-4xl w-full max-w-md p-6 shadow-2xl relative">
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
