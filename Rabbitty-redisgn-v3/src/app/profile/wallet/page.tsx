'use client';

import { useEffect, useState } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { TonConnectButton, useTonWallet } from '@tonconnect/ui-react';
import { ArrowUpRight, ArrowDownLeft, Copy, RefreshCw } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';

interface Transaction {
  id: string;
  name: string;
  category: string;
  amount: string;
  type: 'spent' | 'earned';
  date: string;
  icon: string;
}

export default function WalletPage() {
  const wallet = useTonWallet();
  const { balance, refreshBalance, address } = useWallet();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (address) fetchHistory();
  }, [address]);

  const fetchHistory = async () => {
    if (!address) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history?wallet=${address}`);
      const data = await res.json();
      if (data.success) setHistory(data.history.slice(0, 5));
    } catch (err) {
      console.error('[Wallet] history fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBalance();
    await fetchHistory();
    setRefreshing(false);
  };

  const handleCopy = () => {
    if (wallet?.account.address) {
      navigator.clipboard.writeText(wallet.account.address);
      alert('¡Dirección copiada!');
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <ProfileSubpageLayout title="Ra Wallet">
      <div className="flex flex-col gap-5">

        {/* Main balance card */}
        <div className="bg-gradient-to-br from-[#0F0F1A] via-[#1A1025] to-[#2A0845] text-white rounded-[32px] p-7 relative overflow-hidden border border-white/8 shadow-2xl">
          <div className="absolute right-[-20%] top-[-20%] w-64 h-64 bg-pink-500/20 rounded-full blur-[80px]" />
          <div className="absolute left-[-10%] bottom-[-10%] w-40 h-40 bg-blue-500/15 rounded-full blur-[60px]" />

          {/* Top row */}
          <div className="flex justify-between items-center mb-8 relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center border border-white/5">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 5h14M3 10h14M3 15h8" stroke="#E91E63" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-black text-[11px] tracking-[2px] text-white/85">RA WALLET</span>
            </div>
            <div className="scale-90 origin-right">
              <TonConnectButton className="my-ton-btn" />
            </div>
          </div>

          {/* Balance */}
          <div className="relative z-10 mb-7">
            <p className="text-white/50 text-[11px] font-semibold tracking-widest uppercase mb-2">Balance Disponible</p>
            <div className="flex items-baseline gap-2">
              <h1 className="text-[52px] font-black tracking-[-2px] leading-none">{balance}</h1>
              <span className="text-[#E91E63] font-black text-xl tracking-wider">BUNZ</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="mt-2 flex items-center gap-1.5 text-white/30 text-[11px] font-medium active:text-white/60 transition-colors"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Actualizando...' : 'Actualizar saldo'}
            </button>
          </div>

          {/* Wallet address */}
          {wallet ? (
            <div className="relative z-10 bg-white/6 border border-white/6 rounded-[20px] p-4 flex items-center justify-between">
              <div className="truncate pr-4">
                <p className="text-white/40 text-[9px] uppercase font-black tracking-widest mb-1.5">Billetera Conectada (TON)</p>
                <p className="text-white/85 text-[13px] font-mono tracking-wide truncate">
                  {wallet.account.address.substring(0, 8)}...{wallet.account.address.substring(wallet.account.address.length - 8)}
                </p>
              </div>
              <button onClick={handleCopy}
                className="p-3 bg-white/8 rounded-[14px] hover:bg-white/15 active:scale-95 transition-all border border-white/5">
                <Copy className="w-4 h-4 text-white/70" />
              </button>
            </div>
          ) : (
            <div className="relative z-10 bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[12px] p-4 rounded-[20px] leading-relaxed text-center font-medium">
              Conecta tu billetera (Tonkeeper) arriba para transferir Bunz libremente por la red TON.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Recibir', Icon: ArrowDownLeft, bg: 'bg-blue-50', iconColor: 'text-blue-500' },
            { label: 'Enviar',  Icon: ArrowUpRight,  bg: 'bg-pink-50',  iconColor: 'text-[#E91E63]' },
          ].map(({ label, Icon, bg, iconColor }) => (
            <button key={label} disabled={!wallet}
              className="bg-white border border-[#F0F0F0] rounded-[24px] p-6 flex flex-col items-center gap-4 active:scale-95 transition-all disabled:opacity-50 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
              <div className={`w-14 h-14 rounded-full ${bg} flex items-center justify-center`}>
                <Icon className={`w-7 h-7 ${iconColor}`} strokeWidth={2.5} />
              </div>
              <span className="font-black text-[#111] text-[14px]">{label}</span>
            </button>
          ))}
        </div>

        {/* Real transaction history */}
        <div className="bg-white rounded-[24px] border border-[#F0F0F0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <p className="font-black text-[#111] text-[15px] mb-4">Últimas transacciones</p>

          {!address ? (
            <p className="text-center text-[#CCC] text-[13px] py-4">Conecta tu billetera para ver el historial</p>
          ) : historyLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 border-2 border-[#E91E63]/30 border-t-[#E91E63] rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-[#CCC] text-[13px] py-4">Aún no tienes transacciones</p>
          ) : (
            <div className="flex flex-col divide-y divide-[#F4F4F4]">
              {history.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-[14px] flex items-center justify-center text-lg ${tx.type === 'earned' ? 'bg-emerald-50' : 'bg-pink-50'}`}>
                      {tx.icon}
                    </div>
                    <div>
                      <p className="font-bold text-[#111] text-[14px]">{tx.name}</p>
                      <p className="text-[#AAA] text-[11px]">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <span className={`font-black text-[15px] ${tx.type === 'earned' ? 'text-emerald-500' : 'text-[#E91E63]'}`}>
                    {tx.amount} bunz
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `.my-ton-btn button { border-radius: 999px !important; height: 36px !important; font-weight: 700 !important; font-size: 12px !important; }`}} />
    </ProfileSubpageLayout>
  );
}
