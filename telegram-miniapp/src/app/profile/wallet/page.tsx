'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import ProfileSubpageLayout from '@/components/ui/ProfileSubpageLayout';
import { ArrowUpRight, ArrowDownLeft, Copy, RefreshCw, X } from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import { useAuth } from '@/features/auth/AuthProvider';
import { PlatformBridge } from '@/lib/platform';

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
  const { balance, refreshBalance, address } = useWallet();
  const { user } = useAuth();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals state
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendAmount, setSendAmount] = useState('');

  // Resolvable P2P handle: @username (preferred, human) or uuid id (always exists).
  const payHandle = user?.username ? `@${user.username}` : (user?.id || '');
  const payPayload = payHandle ? `rabbitty://pay?to=${encodeURIComponent(payHandle)}` : '';

  const newIdempotencyKey = () =>
    (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : `k_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const openSend = (preset?: string) => {
    PlatformBridge.hapticFeedback('light');
    setIdempotencyKey(newIdempotencyKey());
    if (preset) setSendRecipient(preset.replace(/^rabbitty:\/\/pay\?to=/, ''));
    setShowSend(true);
  };

  useEffect(() => {
    if (address) fetchHistory();
  }, [address]);

  // Prefill P2P recipient when arrived from a scanned "rabbitty://pay?to=..." code.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const to = url.searchParams.get('to');
      if (to) {
        setIdempotencyKey(newIdempotencyKey());
        setSendRecipient(decodeURIComponent(to));
        setShowSend(true);
        window.history.replaceState({}, '', '/profile/wallet');
      }
    } catch {}
  }, []);


  const fetchHistory = async () => {
    if (!address) return;
    setHistoryLoading(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/history`, { headers });
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
    if (address) {
      navigator.clipboard.writeText(address);
      alert('¡Dirección copiada!');
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const [sendRecipient, setSendRecipient] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [sending, setSending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

  const handleSend = async () => {
    if (!sendRecipient.trim()) {
      alert('Ingresa el @usuario o ID del destinatario');
      return;
    }
    const amt = parseInt(sendAmount, 10);
    if (isNaN(amt) || amt <= 0) {
      alert('Ingresa una cantidad válida de Bunz');
      return;
    }
    if (amt > parseInt(balance, 10)) {
      alert('Saldo insuficiente de Bunz');
      return;
    }

    setSending(true);
    try {
      await PlatformBridge.hapticFeedback('medium');
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch('/api/wallet/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: JSON.stringify({
          recipient: sendRecipient.trim(),
          amount: amt,
          note: sendNote.trim(),
          idempotencyKey: idempotencyKey || newIdempotencyKey(),
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'No se pudo realizar la transferencia');
      }

      await PlatformBridge.hapticFeedback('success');
      alert(`🎉 ¡Enviaste con éxito ${amt} BUNZ a ${data.data?.recipientName || sendRecipient}!`);
      setShowSend(false);
      setSendRecipient('');
      setSendAmount('');
      setSendNote('');
      setIdempotencyKey('');
      await handleRefresh();
    } catch (err: any) {
      await PlatformBridge.hapticFeedback('error');
      alert(err.message || 'Error al enviar Bunz');
    } finally {
      setSending(false);
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
          {address ? (
            <div className="relative z-[1] bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.06)] rounded-[20px] p-4 flex items-center justify-between">
              <div className="overflow-hidden pr-4">
                <p className="text-[rgba(255,255,255,0.4)] text-[9px] font-extrabold tracking-widest uppercase mb-1.5">Billetera Conectada</p>
                <p className="text-[rgba(255,255,255,0.85)] text-[13px] font-mono tracking-wide truncate">
                  {address.substring(0, 8)}...{address.substring(address.length - 8)}
                </p>
              </div>
              <button onClick={handleCopy} className="p-3 bg-[rgba(255,255,255,0.08)] rounded-[14px] border border-[rgba(255,255,255,0.05)] cursor-pointer shrink-0">
                <Copy size={16} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          ) : (
            <div className="relative z-[1] bg-[rgba(233,30,99,0.1)] border border-[rgba(233,30,99,0.2)] rounded-[20px] p-4 text-[#F48FB1] text-xs leading-relaxed text-center font-medium">
              Tu cuenta está lista para transferir Bunz libremente.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setShowReceive(true);
            }}
            className="flex-1 max-w-[170px] h-[130px] bg-[#161622] hover:bg-[#1C1C2B] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-transform active:scale-95 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center">
              <ArrowDownLeft size={22} color={'#60A5FA'} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-white text-sm">Recibir</span>
          </button>

          <button
            onClick={() => openSend()}
            className="flex-1 max-w-[170px] h-[130px] bg-[#161622] hover:bg-[#1C1C2B] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-transform active:scale-95 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-[#E91E63]/15 border border-[#E91E63]/30 flex items-center justify-center">
              <ArrowUpRight size={22} color={'#E91E63'} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-white text-sm">Enviar</span>
          </button>
        </div>

        {/* Transaction history */}
        <div className="bg-[#161622] rounded-2xl border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <p className="font-extrabold text-white text-[15px] mb-4">Últimas transacciones</p>

          {!address ? (
            <p className="text-center text-white/40 text-[13px] py-4">Conecta tu billetera para ver el historial</p>
          ) : historyLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((_, i) => (
                <div key={i} className="flex items-center justify-between py-2 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] bg-white/5" />
                    <div className="flex flex-col gap-2">
                      <div className="w-24 h-4 rounded bg-white/5" />
                      <div className="w-16 h-3 rounded bg-white/5" />
                    </div>
                  </div>
                  <div className="w-16 h-4 rounded bg-white/5" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-white/40 text-[13px] py-4">Aún no tienes transacciones</p>
          ) : (
            <div className="flex flex-col">
              {history.map((tx, i) => (
                <div key={tx.id} className="flex items-center justify-between" style={{
                  paddingTop: i === 0 ? 0 : 12, paddingBottom: i === history.length - 1 ? 0 : 12,
                  borderBottom: i === history.length - 1 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[14px] text-lg flex items-center justify-center" style={{
                      background: tx.type === 'earned' ? 'rgba(16,185,129,0.15)' : 'rgba(233,30,99,0.15)',
                    }}>
                      {tx.icon}
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm m-0 mb-0.5">{tx.name}</p>
                      <p className="text-white/40 text-[11px] m-0">{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <span className="font-extrabold text-[15px]" style={{ color: tx.type === 'earned' ? '#34D399' : '#F472B6' }}>
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.7)] backdrop-blur-[8px] p-5">
          <div className="bg-[#181824] border border-white/10 text-white rounded-2xl w-full max-w-[400px] p-6 relative shadow-2xl">
            <button onClick={() => setShowReceive(false)} className="absolute top-4 right-4 bg-transparent border-0 cursor-pointer text-white/60 hover:text-white">
              <X size={22} />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#3B82F6]/20 flex items-center justify-center text-[#3B82F6]">
                <ArrowDownLeft size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-extrabold m-0">Recibir Bunz</h3>
            </div>
            <p className="text-[13px] text-white/60 mb-4">Muestra este código para que te transfieran Bunz. Escanéalo desde la pestaña de escáner de Rabbitty.</p>
            <div className="rounded-3xl p-4 text-center mb-5 flex justify-center bg-white border border-pink-500/30">
              {payPayload ? (
                <QRCodeSVG value={payPayload} size={180} level="M" bgColor="#ffffff" fgColor="#111111" />
              ) : (
                <span className="text-[#111] text-sm py-16">Inicia sesión para generar tu código</span>
              )}
            </div>
            <p className="text-[11px] font-extrabold text-white/40 uppercase mb-2 text-center">Tu Identificador para recibir</p>
            <div className="flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-xl">
              <p className="text-xs font-mono m-0 truncate text-white/80">{payHandle || 'rabbitty_user'}</p>
              <button
                onClick={() => {
                  if (payHandle) {
                    navigator.clipboard.writeText(payHandle);
                    alert(`¡${payHandle} copiado!`);
                  }
                }}
                className="bg-white/10 hover:bg-white/20 border-0 cursor-pointer p-2 rounded-lg text-white"
              >
                <Copy size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND MODAL */}
      {showSend && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[rgba(0,0,0,0.7)] backdrop-blur-[8px] p-5">
          <div className="bg-[#181824] border border-white/10 text-white rounded-2xl w-full max-w-[400px] p-6 relative shadow-2xl">
            <button onClick={() => setShowSend(false)} className="absolute top-4 right-4 bg-transparent border-0 cursor-pointer text-white/60 hover:text-white">
              <X size={22} />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-[#E91E63]/20 flex items-center justify-center text-[#E91E63]">
                <ArrowUpRight size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-xl font-extrabold m-0">Enviar Bunz P2P</h3>
            </div>
            <p className="text-[13px] text-white/60 mb-5">Transfiere Bunz instantáneamente a cualquier amigo o negocio sin comisiones.</p>
            
            <label className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider block mb-1.5">Destinatario</label>
            <input 
              value={sendRecipient} onChange={e => setSendRecipient(e.target.value)} 
              placeholder="@usuario o ID de usuario" 
              className="w-full p-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 mb-4 text-sm focus:outline-none focus:border-[#E91E63]"
            />

            <label className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider block mb-1.5">Cantidad de Bunz</label>
            <div className="relative mb-4">
              <input 
                type="number" value={sendAmount} onChange={e => setSendAmount(e.target.value)} 
                placeholder="0" 
                className="w-full p-3.5 pr-16 rounded-xl bg-white/5 border border-white/10 text-white font-extrabold placeholder-white/30 text-lg focus:outline-none focus:border-[#E91E63]"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[#E91E63]">BUNZ</span>
            </div>

            <label className="text-[11px] font-extrabold text-white/50 uppercase tracking-wider block mb-1.5">Mensaje o Nota (Opcional)</label>
            <input 
              value={sendNote} onChange={e => setSendNote(e.target.value)} 
              placeholder="ej: ¡Gracias por los tacos! 🌮" 
              className="w-full p-3.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 mb-6 text-sm focus:outline-none focus:border-[#E91E63]"
            />
            
            <button 
              onClick={handleSend}
              disabled={sending}
              className="w-full p-4 bg-gradient-to-r from-[#E91E63] to-[#FF4081] text-white border-0 rounded-[14px] font-extrabold text-[15px] cursor-pointer shadow-lg shadow-[#E91E63]/30 disabled:opacity-50"
            >
              {sending ? 'Transfiriendo...' : 'Confirmar Envío de Bunz'}
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
