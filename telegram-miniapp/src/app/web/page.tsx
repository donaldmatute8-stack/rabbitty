'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';

export default function WebLogin() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('LOADING'); // LOADING, PENDING, APPROVED, EXPIRED
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const initSession = async () => {
    setStatus('LOADING');
    try {
      const res = await fetch('/api/auth/qr-session', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSessionId(data.sessionId);
        setStatus('PENDING');
      }
    } catch (e) {
      console.error(e);
      setStatus('EXPIRED');
    }
  };

  useEffect(() => {
    initSession();
  }, []);

  useEffect(() => {
    if (status !== 'PENDING' || !sessionId) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr-session?sessionId=${sessionId}`);
        const data = await res.json();
        
        if (data.status === 'APPROVED') {
          clearInterval(pollingRef.current!);
          setStatus('APPROVED');
          // In a real flow, we might set a cookie or local storage, but since it's Web3, 
          // we could redirect and pass the wallet (or use NextAuth). For now, we simulate.
          // We will save the wallet to localStorage for the web session.
          if (typeof window !== 'undefined') {
            localStorage.setItem('web_wallet', data.wallet_address);
            router.push('/business');
          }
        } else if (data.status === 'EXPIRED') {
          clearInterval(pollingRef.current!);
          setStatus('EXPIRED');
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000); // Poll every 3 seconds

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessionId, status, router]);

  return (
    <div className="flex h-screen bg-[#F0F0F0] items-center justify-center p-6">
      <div className="max-w-4xl w-full bg-white rounded-3xl shadow-2xl flex overflow-hidden h-[500px]">
        {/* Left Info */}
        <div className="w-1/2 bg-black p-12 text-white flex flex-col justify-between">
          <div>
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-8">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </div>
            <h1 className="text-4xl font-black mb-4 leading-tight">Panel de<br/>Negocios</h1>
            <p className="text-gray-400 font-medium text-sm leading-relaxed">
              Administra tus recompensas, verifica transacciones y gestiona tu inventario desde tu computadora.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Powered by Rabbitty</p>
          </div>
        </div>

        {/* Right QR */}
        <div className="w-1/2 p-12 flex flex-col items-center justify-center bg-white relative">
          
          <h2 className="text-2xl font-black text-black mb-2 text-center">Inicia Sesión</h2>
          <p className="text-sm text-gray-500 mb-8 text-center">Escanea este código con tu app de Rabbitty (Escáner de Afiliado).</p>

          <div className="w-64 h-64 bg-white border-2 border-gray-100 rounded-3xl flex items-center justify-center shadow-lg relative overflow-hidden p-4">
            {status === 'LOADING' && (
              <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin" />
            )}
            
            {status === 'PENDING' && sessionId && (
              <div className="text-center w-full h-full p-4 bg-white rounded-2xl flex flex-col items-center justify-center">
                <QRCodeSVG 
                  value={`rabbitty:auth:${sessionId}`} 
                  size={200}
                  level="Q"
                  includeMargin={false}
                  fgColor="#111111"
                  bgColor="#ffffff"
                />
              </div>
            )}

            {status === 'APPROVED' && (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl">✓</span>
                </div>
                <p className="text-sm font-black text-black">Aprobado</p>
                <p className="text-xs text-gray-500">Redirigiendo...</p>
              </div>
            )}

            {status === 'EXPIRED' && (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                  <span className="text-2xl">!</span>
                </div>
                <p className="text-sm font-black text-black mb-2">El código expiró</p>
                <button onClick={initSession} className="px-4 py-2 bg-black text-white text-xs font-bold rounded-full active:scale-95 transition-transform">
                  Generar nuevo
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
