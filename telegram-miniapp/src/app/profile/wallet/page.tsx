'use client';

import { useEffect } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { ArrowUpRight, ArrowDownLeft, Copy, Wallet, RefreshCw } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';

export default function WalletPage() {
  const wallet = useTonWallet();
  const { balance, refreshBalance } = useWallet();

  const handleCopy = () => {
    if (wallet?.account.address) {
      navigator.clipboard.writeText(wallet.account.address);
      alert('¡Dirección copiada!');
    }
  };

  return (
    <ProfileSubpageLayout title="Ra Wallet">
      <div className="flex flex-col gap-6 mt-4">
        
        {/* Main Wallet Card */}
        <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-black text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>
          
          <div className="flex justify-between items-center mb-6 relative z-10">
            <div className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-pink-400" />
              <span className="font-bold text-sm tracking-widest text-pink-100">BUNZ WALLET</span>
            </div>
            {/* Native TON Connect Button */}
            <TonConnectButton className="my-ton-btn" />
          </div>

          <div className="relative z-10">
            <p className="text-white/60 text-sm mb-1">Balance Total</p>
            <div className="flex items-baseline gap-2">
              <h1 className="text-4xl font-black">{balance}</h1>
              <span className="text-pink-400 font-bold">BUNZ</span>
            </div>
            <p className="text-white/40 text-xs mt-1">≈ $0.00 USD</p>
          </div>

          {wallet && (
            <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
              <div className="truncate pr-4">
                <p className="text-white/50 text-[10px] uppercase font-bold tracking-wider mb-1">TON Address</p>
                <p className="text-white/90 text-xs font-mono truncate">
                  {wallet.account.address.substring(0, 6)}...{wallet.account.address.substring(wallet.account.address.length - 6)}
                </p>
              </div>
              <button onClick={handleCopy} className="p-2 bg-white/10 rounded-full active:bg-white/20 transition-colors">
                <Copy className="w-4 h-4 text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <button className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50" disabled={!wallet}>
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Recibir</span>
          </button>
          
          <button className="bg-white border border-gray-100 shadow-sm rounded-2xl p-4 flex flex-col items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-50" disabled={!wallet}>
            <div className="w-12 h-12 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <span className="font-bold text-gray-900 text-sm">Enviar</span>
          </button>
        </div>

        {/* Info Box */}
        {!wallet && (
          <div className="bg-blue-50 text-blue-800 text-xs p-4 rounded-2xl leading-relaxed text-center">
            Conecta tu billetera nativa de Telegram (o Tonkeeper) para activar tu Ra Wallet y poder transferir Bunz libremente por la red TON.
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .my-ton-btn button {
          border-radius: 999px !important;
          height: 36px !important;
          font-weight: 700 !important;
          font-size: 13px !important;
        }
      `}} />
    </ProfileSubpageLayout>
  );
}
