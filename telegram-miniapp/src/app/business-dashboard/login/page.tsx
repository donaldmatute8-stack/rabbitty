'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export default function B2BLogin() {
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Generate a new QR session when the page loads
    const generateQR = async () => {
      try {
        const res = await fetch('/api/auth/qr/generate', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setQrToken(data.qrToken);
          setSessionId(data.sessionId);
        }
      } catch (err) {
        console.error('Failed to generate QR', err);
      } finally {
        setLoading(false);
      }
    };
    generateQR();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    // Poll the server every 3 seconds to check if the mobile app has scanned the QR
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/auth/qr/poll?sessionId=${sessionId}`);
        const data = await res.json();

        if (data.authenticated) {
          clearInterval(interval);
          // Redirect to the actual dashboard!
          router.push('/business-dashboard/portal');
        } else if (data.expired) {
          clearInterval(interval);
          // QR expired, we need to refresh
          window.location.reload();
        }
      } catch (err) {
        console.error('Poll error', err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [sessionId, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 font-sans">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-10 rounded-[32px] shadow-2xl max-w-md w-full text-center border border-gray-100"
      >
        <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-3xl">
          🐰
        </div>
        
        <h1 className="text-3xl font-black text-gray-900 tracking-tight mb-2">Rabbitty Business</h1>
        <p className="text-gray-500 mb-8 font-medium">
          Abre la Mini App en tu celular y escanea este código para entrar a tu panel de negocios.
        </p>

        <div className="flex justify-center mb-8 relative">
          {loading ? (
            <div className="w-64 h-64 bg-gray-100 rounded-2xl animate-pulse flex items-center justify-center">
              <span className="text-gray-400 font-bold">Generando QR...</span>
            </div>
          ) : qrToken ? (
            <div className="p-4 bg-white rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.05)] border border-gray-100">
              <QRCodeSVG 
                value={`https://t.me/RabbittyBot/app?startapp=qrlogin_${qrToken}`} 
                size={220}
                bgColor={"#ffffff"}
                fgColor={"#0D0D1A"}
                level={"H"}
                imageSettings={{
                  src: "https://upload.wikimedia.org/wikipedia/commons/8/82/Telegram_logo.svg",
                  x: undefined,
                  y: undefined,
                  height: 40,
                  width: 40,
                  excavate: true,
                }}
              />
            </div>
          ) : (
            <div className="text-red-500 font-bold">Error al generar QR.</div>
          )}
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 font-medium">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          Esperando escaneo mágico...
        </div>
      </motion.div>
    </div>
  );
}
