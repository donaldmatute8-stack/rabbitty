'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ethers } from 'ethers';

const BUNZ_CONTRACT = '0x8d0CC6dcD796e9B14bd25BA2A21291aa3Af39fcB';
const BUNZ_ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function spendBunz(address business, uint256 amount)"
];

export default function WalletPage() {
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState('0');
  const [loading, setLoading] = useState(false);
  const [WebApp, setWebApp] = useState<any>(null);

  useEffect(() => {
    import('@twa-dev/sdk').then((mod) => {
      const app = mod.default;
      app.ready();
      app.expand();
      setWebApp(app);
      
      const tgUser = app.initDataUnsafe.user;
      if (tgUser) {
        setUser(tgUser);
        const wallet = generateWalletFromUserId(tgUser.id);
        loadBalance(wallet.address);
      }
    });
  }, []);

  const generateWalletFromUserId = (userId: number) => {
    const privateKey = ethers.keccak256(ethers.toUtf8Bytes(`rabbitty-${userId}-seed`));
    return new ethers.Wallet(privateKey);
  };

  const loadBalance = async (address: string) => {
    try {
      const provider = new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com');
      const contract = new ethers.Contract(BUNZ_CONTRACT, BUNZ_ABI, provider);
      const bal = await contract.balanceOf(address);
      setBalance(ethers.formatEther(bal));
    } catch (error) {
      console.error('Error loading balance:', error);
    }
  };

  const handleQRScan = async (qrCode: string) => {
    setLoading(true);
    try {
      const response = await fetch('https://rabbitty-oracle-production.up.railway.app/process-consumption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptHash: qrCode })
      });
      const data = await response.json();
      
      if (data.success) {
        if (WebApp) {
          WebApp.showPopup({
            title: '¡Ganaste bunz!',
            message: `Recibiste ${data.reward} bunz`,
            buttons: [{ type: 'ok' }]
          });
        }
        const wallet = generateWalletFromUserId(user!.id);
        loadBalance(wallet.address);
      }
    } catch (error) {
      if (WebApp) WebApp.showAlert('Código QR inválido');
    } finally {
      setLoading(false);
    }
  };

  const scanQR = () => {
    if (WebApp) {
      WebApp.showScanQrPopup({
        text: 'Escanea el QR del negocio para ganar bunz'
      }, (qrCode: string) => {
        handleQRScan(qrCode);
        return true;
      });
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#FF6B35] to-[#FF4081] flex items-center justify-center p-6">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto mb-6 bg-white rounded-3xl flex items-center justify-center shadow-2xl">
            <Image 
              src="/logo.png" 
              alt="Rabbitty" 
              width={100} 
              height={100}
              className="rounded-2xl"
            />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Rabbitty</h1>
          <p className="text-white/80 mb-8">Abre en Telegram para continuar</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-br from-[#FF6B35] to-[#FF4081] px-6 pt-12 pb-8 rounded-b-[32px]">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-lg">
              <Image src="/logo.png" alt="Rabbitty" width={40} height={40} />
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Rabbitty</h1>
              <p className="text-white/70 text-sm">Tu billetera bunz</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {user.photo_url ? (
              <img src={user.photo_url} alt="Profile" className="w-10 h-10 rounded-full border-2 border-white/30" />
            ) : (
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white font-bold">
                {user.first_name?.[0]}
              </div>
            )}
          </div>
        </div>

        <div className="text-center">
          <p className="text-white/70 text-base mb-1">Tu balance</p>
          <p className="text-white text-5xl font-bold mb-1">
            {Number(balance).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-white/80 text-lg">bunz</p>
        </div>
      </div>

      <div className="px-6 -mt-4">
        <button
          onClick={scanQR}
          disabled={loading}
          className="w-full bg-white rounded-2xl py-5 shadow-lg flex items-center justify-center gap-3 mb-6 active:scale-[0.98] transition"
        >
          <span className="text-2xl">📷</span>
          <span className="text-gray-800 font-semibold text-lg">
            {loading ? 'Procesando...' : 'Escanear para ganar'}
          </span>
        </button>

        <div className="grid grid-cols-4 gap-3 mb-6">
          <a href="/map" className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <span className="text-2xl block mb-1">🗺️</span>
            <span className="text-xs text-gray-600 font-medium">Mapa</span>
          </a>
          <a href="/pay" className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <span className="text-2xl block mb-1">💳</span>
            <span className="text-xs text-gray-600 font-medium">Pagar</span>
          </a>
          <a href="/history" className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <span className="text-2xl block mb-1">📊</span>
            <span className="text-xs text-gray-600 font-medium">Historial</span>
          </a>
          <a href="/referral" className="bg-white rounded-2xl p-4 text-center shadow-sm">
            <span className="text-2xl block mb-1">🎁</span>
            <span className="text-xs text-gray-600 font-medium">Invitar</span>
          </a>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-24">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-gray-800 font-bold text-lg">Actividad reciente</h2>
            <a href="/history" className="text-[#FF6B35] text-sm font-medium">Ver todo</a>
          </div>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">☕</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Café Cultura</p>
                  <p className="text-xs text-gray-500">Hoy, 10:30</p>
                </div>
              </div>
              <span className="text-green-600 font-bold">+50</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🍕</span>
                <div>
                  <p className="font-semibold text-gray-800 text-sm">Pizza Napoli</p>
                  <p className="text-xs text-gray-500">Ayer, 19:00</p>
                </div>
              </div>
              <span className="text-red-500 font-bold">-100</span>
            </div>
          </div>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t px-6 py-3">
        <div className="flex justify-around">
          <a href="/" className="flex flex-col items-center gap-1 text-[#FF6B35]">
            <span className="text-xl">💰</span>
            <span className="text-xs font-medium">Wallet</span>
          </a>
          <a href="/map" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">🗺️</span>
            <span className="text-xs font-medium">Mapa</span>
          </a>
          <a href="/social" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">📱</span>
            <span className="text-xs font-medium">Social</span>
          </a>
          <a href="/profile" className="flex flex-col items-center gap-1 text-gray-400">
            <span className="text-xl">👤</span>
            <span className="text-xs font-medium">Perfil</span>
          </a>
        </div>
      </nav>
    </div>
  );
}
