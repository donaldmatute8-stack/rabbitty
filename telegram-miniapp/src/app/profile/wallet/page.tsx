'use client';

import { useEffect, useState } from 'react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { TonConnectButton, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';
import { ArrowUpRight, ArrowDownLeft, Copy, RefreshCw, X } from 'lucide-react';
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
  const [tonConnectUI] = useTonConnectUI();
  const { balance, refreshBalance, address } = useWallet();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals state
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendAddress, setSendAddress] = useState('');
  const [sendAmount, setSendAmount] = useState('');

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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleSend = async () => {
    if (!sendAddress || !sendAmount) {
      alert('Ingresa una dirección y cantidad válida.');
      return;
    }
    try {
      const nanoTon = Math.floor(parseFloat(sendAmount) * 1000000000).toString();
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 360,
        messages: [
          {
            address: sendAddress,
            amount: nanoTon,
          }
        ]
      };
      await tonConnectUI.sendTransaction(transaction);
      alert('Transacción enviada a la red.');
      setShowSend(false);
      setSendAddress('');
      setSendAmount('');
    } catch (e) {
      console.error(e);
      alert('Transacción cancelada o fallida.');
    }
  };

  return (
    <ProfileSubpageLayout title="Ra Wallet">
      <div className="flex flex-col gap-5">

        {/* Main balance card */}
        <div style={{
          background: 'linear-gradient(135deg, #0F0F1A 0%, #1A1025 50%, #2A0845 100%)',
        }} className="rounded-[32px] px-6 py-7 relative overflow-hidden border border-[rgba(255,255,255,0.08)] shadow-[0_20px_60px_rgba(0,0,0,0.4)] text-white">
          <div className="absolute right-[-20%] top-[-20%] w-[256px] h-[256px] bg-[rgba(233,30,99,0.2)] rounded-full" style={{ filter: 'blur(80px)' }} />
          <div className="absolute left-[-10%] bottom-[-10%] w-[160px] h-[160px] bg-[rgba(59,130,246,0.15)] rounded-full" style={{ filter: 'blur(60px)' }} />

          {/* Top row */}
          <div className="flex justify-between items-center mb-8 relative z-[1]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.08)] flex items-center justify-center border border-[rgba(255,255,255,0.05)]">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 5h14M3 10h14M3 15h8" stroke="#E91E63" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-extrabold text-[11px] tracking-widest text-[rgba(255,255,255,0.85)]">RA WALLET</span>
            </div>
            <div className="scale-90 origin-[right_center]">
              <TonConnectButton className="my-ton-btn" />
            </div>
          </div>

          {/* Balance */}
          <div className="relative z-[1] mb-7">
            <p className="text-[rgba(255,255,255,0.5)] text-[11px] font-semibold tracking-widest uppercase mb-2">Balance Disponible</p>
            <div className="flex items-baseline gap-2">
              <h1 className="text-[52px] font-extrabold tracking-tighter leading-none m-0 text-white">{balance}</h1>
              <span className="text-[#E91E63] font-extrabold text-xl tracking-wide">BUNZ</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="mt-2 flex items-center gap-1.5 text-[rgba(255,255,255,0.3)] text-[11px] font-medium bg-transparent border-0 cursor-pointer p-0"
            >
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Actualizando...' : 'Actualizar saldo'}
            </button>
          </div>

          {/* Address */}
          {wallet ? (
            <div className="relative z-[1] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-[20px] p-4 flex items-center justify-between">
              <div className="overflow-hidden pr-4">
                <p className="text-[rgba(255,255,255,0.4)] text-[9px] font-extrabold tracking-widest uppercase mb-1.5">Billetera Conectada (TON)</p>
                <p className="text-[rgba(255,255,255,0.85)] text-[13px] font-mono tracking-wide truncate">
                  {wallet.account.address.substring(0, 8)}...{wallet.account.address.substring(wallet.account.address.length - 8)}
                </p>
              </div>
              <button onClick={handleCopy} className="p-3 bg-[rgba(255,255,255,0.08)] rounded-[14px] border border-[rgba(255,255,255,0.05)] cursor-pointer shrink-0">
                <Copy size={16} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          ) : (
            <div className="relative z-[1] bg-[rgba(233,30,99,0.1)] border border-[rgba(233,30,99,0.2)] rounded-[20px] p-4 text-[#F48FB1] text-xs leading-relaxed text-center font-medium">
              Conecta tu billetera (Tonkeeper) arriba para transferir Bunz libremente por la red TON.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-6">
          <button
            onClick={() => setShowReceive(true)}
            disabled={!wallet}
            className="w-[140px] h-[140px] bg-white border border-[#F0F0F0] rounded-2xl p-4 flex flex-col items-center justify-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            style={{ cursor: wallet ? 'pointer' : 'not-allowed', opacity: wallet ? 1 : 0.5 }}
          >
            <div className="w-12 h-12 rounded-full bg-[#EFF6FF] flex items-center justify-center">
              <ArrowDownLeft size={24} color={'#3B82F6'} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-[#111] text-sm">Recibir</span>
          </button>

          <button
            onClick={() => setShowSend(true)}
            disabled={!wallet}
            className="w-[140px] h-[140px] bg-white border border-[#F0F0F0] rounded-2xl p-4 flex flex-col items-center justify-center gap-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]"
            style={{ cursor: wallet ? 'pointer' : 'not-allowed', opacity: wallet ? 1 : 0.5 }}
          >
            <div className="w-12 h-12 rounded-full bg-[#FFF0F5] flex items-center justify-center">
              <ArrowUpRight size={24} color={'#E91E63'} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-[#111] text-sm">Enviar</span>
          </button>
        </div>

        {/* Transaction history */}
        <div className="bg-white rounded-2xl border border-[#F0F0F0] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <p className="font-extrabold text-[#111] text-[15px] mb-4">Últimas transacciones</p>

          {!address ? (
            <p className="text-center text-[#CCC] text-[13px] py-4">Conecta tu billetera para ver el historial</p>
          ) : historyLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-6 h-6 rounded-full border-2 border-[rgba(233,30,99,0.3)] border-t-[#E91E63]" style={{ animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-[#CCC] text-[13px] py-4">Aún no tienes transacciones</p>
          ) : (
            <div className="flex flex-col">
              {history.map((tx, i) => (
                <div key={tx.id} className="flex items-center justify-between" style={{
                  paddingTop: i === 0 ? 0 : 12, paddingBottom: i === history.length - 1 ? 0 : 12,
                  borderBottom: i === history.length - 1 ? 'none' : '1px solid #F4F4F4',
                }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] text-lg flex items-center justify-center" style={{
                      background: tx.type === 'earned' ? '#F0FDF4' : '#FFF0F5',
                    }}>
                      {tx.icon}
                    </div>
                    <div>
                      <p className="font-bold text-[#111] text-sm m-0 mb-0.5">{tx.name}</p>
                      <p className="text-[#AAA] text-[11px] m-0">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-[15px]" style={{ color: tx.type === 'earned' ? '#10B981' : '#E91E63' }}>
                    {tx.amount} bunz
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* RECEIVE MODAL */}
      {showReceive && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-[5px] p-5">
          <div className="bg-white rounded-2xl w-full max-w-[400px] p-6 relative">
            <button onClick={() => setShowReceive(false)} className="absolute top-4 right-4 bg-transparent border-0 cursor-pointer">
              <X size={24} color="#888" />
            </button>
            <h3 className="text-xl font-extrabold m-0 mb-4 text-center">Recibir (TON / Bunz)</h3>
            <div className="bg-[#F8F8F8] rounded-2xl p-5 text-center mb-5">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ton://transfer/${wallet?.account.address}`} alt="QR" className="w-[200px] h-[200px] rounded-xl mx-auto" />
            </div>
            <p className="text-[11px] font-extrabold text-[#AAA] uppercase mb-2 text-center">Tu Dirección TON</p>
            <div className="flex items-center justify-between bg-[#F0F0F0] p-3 rounded-xl">
              <p className="text-xs font-mono m-0 truncate">{wallet?.account.address}</p>
              <button onClick={handleCopy} className="bg-transparent border-0 cursor-pointer p-1">
                <Copy size={16} color="#111" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND MODAL */}
      {showSend && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.6)] backdrop-blur-[5px] p-5">
          <div className="bg-white rounded-2xl w-full max-w-[400px] p-6 relative">
            <button onClick={() => setShowSend(false)} className="absolute top-4 right-4 bg-transparent border-0 cursor-pointer">
              <X size={24} color="#888" />
            </button>
            <h3 className="text-xl font-extrabold m-0 mb-4">Enviar TON</h3>
            <p className="text-[13px] text-[#666] mb-5">Ingresa la dirección TON de destino y la cantidad.</p>
            
            <input 
              value={sendAddress} onChange={e => setSendAddress(e.target.value)} 
              placeholder="Dirección TON del destinatario" 
              className="w-full p-3.5 rounded-xl border border-[#CCC] mb-3 text-sm"
            />
            <input 
              type="number" value={sendAmount} onChange={e => setSendAmount(e.target.value)} 
              placeholder="Cantidad (ej: 0.5)" 
              className="w-full p-3.5 rounded-xl border border-[#CCC] mb-6 text-sm"
            />
            
            <button 
              onClick={handleSend}
              className="w-full p-4 bg-[#E91E63] text-white border-0 rounded-[14px] font-extrabold text-[15px] cursor-pointer"
            >
              Confirmar Envío
            </button>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .my-ton-btn button { border-radius: 999px !important; height: 36px !important; font-weight: 700 !important; font-size: 12px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
    </ProfileSubpageLayout>
  );
}
