'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import RabbittyCode from '@/components/ui/RabbittyCode';
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
  const { balance, refreshBalance } = useWallet();
  const { user } = useAuth();
  const [history, setHistory] = useState<Transaction[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modals state
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [sendAmount, setSendAmount] = useState('');
  const [sendStep, setSendStep] = useState(1);
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendNote, setSendNote] = useState('');
  const [sending, setSending] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState('');

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
    setSendStep(preset ? 2 : 1);
    setShowSend(true);
  };

  useEffect(() => {
    let active = true;
    if (!user?.id) return;

    Promise.resolve().then(() => {
      if (active) setHistoryLoading(true);
      return PlatformBridge.getAuthHeaders();
    })
      .then((headers) => fetch('/api/history', { headers }))
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        if (data.success && Array.isArray(data.history)) {
          setHistory(data.history.slice(0, 5));
        }
      })
      .catch((err) => {
        console.error('[Wallet] history fetch error:', err);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.id]);

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const headers = await PlatformBridge.getAuthHeaders();
      const res = await fetch(`/api/history`, { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.history)) {
        setHistory(data.history.slice(0, 5));
      }
    } catch (err) {
      console.error('[Wallet] history fetch error:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Prefill P2P recipient when arrived from a scanned "rabbitty://pay?to=..." code.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const url = new URL(window.location.href);
      const to = url.searchParams.get('to');
      if (to) {
        const recipient = decodeURIComponent(to);
        window.history.replaceState({}, '', '/profile/wallet');
        queueMicrotask(() => {
          setIdempotencyKey(newIdempotencyKey());
          setSendRecipient(recipient);
          setSendStep(2);
          setShowSend(true);
        });
      }
    } catch {}
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshBalance();
    await fetchHistory();
    setRefreshing(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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
    const currentBal = parseInt(balance, 10);
    if (!isNaN(currentBal) && amt > currentBal) {
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
      setSendStep(1);
      setIdempotencyKey('');
      await handleRefresh();
    } catch (err: unknown) {
      await PlatformBridge.hapticFeedback('error');
      const msg = err instanceof Error ? err.message : 'Error al enviar Bunz';
      alert(msg);
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
        }} className="rounded-4xl px-6 py-7 relative overflow-hidden border border-[rgba(255,255,255,0.08)] shadow-[0_20px_60px_rgba(0,0,0,0.4)] text-white">
          <div className="absolute right-[-20%] top-[-20%] w-64 h-64 bg-[rgba(233,30,99,0.2)] rounded-full" style={{ filter: 'blur(80px)' }} />
          <div className="absolute left-[-10%] bottom-[-10%] w-40 h-40 bg-[rgba(59,130,246,0.15)] rounded-full" style={{ filter: 'blur(60px)' }} />

          {/* Top row */}
          <div className="flex justify-between items-center mb-8 relative z-1">
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
          <div className="relative z-1 mb-7">
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

          {/* Rabbitter Identifier Pill */}
          <div className="relative z-1 bg-white/[0.06] border border-white/10 rounded-2xl p-4 flex items-center justify-between">
            <div className="overflow-hidden pr-3">
              <p className="text-white/40 text-[9px] font-extrabold tracking-widest uppercase mb-1">Tu Identificador Bunz</p>
              <p className="text-white font-mono font-bold text-sm tracking-wide truncate">
                {payHandle || `@${user?.username || 'rabbitter'}`}
              </p>
            </div>
            <button
              onClick={() => {
                const h = payHandle || `@${user?.username || 'rabbitter'}`;
                navigator.clipboard.writeText(h);
                alert(`¡${h} copiado!`);
              }}
              className="p-2.5 bg-white/10 hover:bg-white/20 border-none rounded-xl cursor-pointer shrink-0 text-white transition-colors"
              title="Copiar identificador"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          <button
            onClick={() => {
              PlatformBridge.hapticFeedback('light');
              setShowReceive(true);
            }}
            className="flex-1 max-w-42.5 h-32.5 bg-[#161622] hover:bg-[#1C1C2B] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-transform active:scale-95 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 flex items-center justify-center">
              <ArrowDownLeft size={22} color={'#60A5FA'} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-white text-sm">Recibir</span>
          </button>

          <button
            onClick={() => openSend()}
            className="flex-1 max-w-42.5 h-32.5 bg-[#161622] hover:bg-[#1C1C2B] border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center gap-3 shadow-[0_8px_20px_rgba(0,0,0,0.3)] transition-transform active:scale-95 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full bg-[#E91E63]/15 border border-[#E91E63]/30 flex items-center justify-center">
              <ArrowUpRight size={22} color={'#E91E63'} strokeWidth={2.5} />
            </div>
            <span className="font-extrabold text-white text-sm">Enviar</span>
          </button>
        </div>

        {/* Transaction history */}
        <div className="bg-[#161622] rounded-2xl border border-white/10 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.25)]">
          <p className="font-extrabold text-white text-[15px] mb-4">Últimas transacciones (Ledger)</p>

          {historyLoading ? (
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
            <p className="text-center text-white/40 text-[13px] py-4">Aún no tienes transacciones en el Ledger</p>
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

      {/* RECEIVE MODAL — Con QR Neón de Rabbitty */}
      {showReceive && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-[#120B1D] border border-pink-500/30 text-white rounded-3xl w-full max-w-sm p-6 relative shadow-[0_0_50px_rgba(233,30,99,0.25)] flex flex-col items-center text-center">
            <button 
              onClick={() => setShowReceive(false)} 
              className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 border-none rounded-full w-8 h-8 flex items-center justify-center cursor-pointer text-white/70 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2 mb-1.5 self-start">
              <div className="w-8 h-8 rounded-full bg-[#E91E63]/20 flex items-center justify-center text-[#E91E63]">
                <ArrowDownLeft size={18} strokeWidth={2.5} />
              </div>
              <h3 className="text-lg font-black m-0 text-white">Recibir Bunz</h3>
            </div>
            
            <p className="text-xs text-white/60 mb-4 text-left self-start">
              Muestra tu QR Neón para que otros Rabbitters o comercios te transfieran Bunz escaneando directamente desde su app Rabbitty.
            </p>

            {/* QR escaneable (cámara estándar / app Rabbitty) con marco + firma neón */}
            <div className="w-full flex flex-col items-center py-2 mb-3">
              <div className="p-3 rounded-[32px] bg-[#0A0314] border-2 border-pink-500/40 shadow-[0_0_35px_rgba(233,30,99,0.3)]">
                <div className="bg-white rounded-2xl p-2.5">
                  <QRCodeSVG
                    value={payPayload || `rabbitty://pay?to=${encodeURIComponent(user?.username || 'rabbitter')}`}
                    size={172}
                    level="H"
                    includeMargin={false}
                  />
                </div>
                <div className="mt-1.5 flex justify-center opacity-95">
                  <RabbittyCode
                    data={payPayload || `rabbitty://pay?to=${encodeURIComponent(user?.username || 'rabbitter')}`}
                    size={64}
                    showCardFrame={false}
                  />
                </div>
              </div>
            </div>
            <p className="text-[10px] text-white/50 mb-3 text-left self-start leading-snug">
              Escanea el QR con la cámara del iPhone o con el escáner de la App Rabbitty 📷 · La onda neón es tu firma Rabbitty
            </p>

            <p className="text-[10px] font-black text-[#E91E63] uppercase tracking-wider mb-2">Tu Identificador para recibir</p>
            <div className="w-full flex items-center justify-between bg-white/5 border border-white/10 p-3 rounded-2xl">
              <p className="text-xs font-mono font-bold m-0 truncate text-white">{payHandle || `@${user?.username || 'rabbitter'}`}</p>
              <button
                onClick={() => {
                  const val = payHandle || `@${user?.username || 'rabbitter'}`;
                  navigator.clipboard.writeText(val);
                  alert(`¡${val} copiado!`);
                }}
                className="bg-white/10 hover:bg-white/20 border-none cursor-pointer p-2 rounded-xl text-white transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <Copy size={14} />
                <span>Copiar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEND MODAL — flujo conversacional por pasos */}
      {showSend && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-[rgba(0,0,0,0.7)] backdrop-blur-sm p-5">
          <div className="bg-[#181824] border border-white/10 text-white rounded-2xl w-full max-w-100 p-6 relative shadow-2xl">
            <button onClick={() => { setShowSend(false); setSendStep(1); }} className="absolute top-4 right-4 bg-transparent border-0 cursor-pointer text-white/60 hover:text-white">
              <X size={22} />
            </button>

            {/* Indicador de pasos */}
            <div className="flex items-center gap-1.5 mb-4 pr-8">
              {[1, 2, 3].map((st) => (
                <div
                  key={st}
                  className="h-1.5 flex-1 rounded-full transition-colors"
                  style={{ background: sendStep >= st ? '#E91E63' : 'rgba(255,255,255,0.1)' }}
                />
              ))}
            </div>

            <div className="flex flex-col gap-3 mb-5">
              <div className="self-start max-w-[85%] bg-white/5 border border-white/10 rounded-2xl rounded-bl-md px-4 py-2.5 text-[14px] font-semibold">
                {sendStep === 1 && '👋 ¿A quién quieres enviarle Bunz?'}
                {sendStep === 2 && `💸 ¿Cuántos Bunz le envías a ${sendRecipient || '...'}?`}
                {sendStep === 3 && '📝 ¿Quieres agregar un mensaje? (opcional)'}
              </div>

              {sendStep === 1 && (
                <input
                  value={sendRecipient}
                  onChange={(e) => setSendRecipient(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && sendRecipient.trim()) { PlatformBridge.hapticFeedback('light'); setSendStep(2); } }}
                  placeholder="@usuario o ID"
                  autoFocus
                  className="self-end w-[70%] p-3 rounded-2xl rounded-br-md bg-[#E91E63] border border-[#E91E63] text-white placeholder-white/50 text-sm font-semibold focus:outline-none"
                />
              )}

              {sendStep === 2 && (
                <div className="self-end w-full flex flex-col items-end gap-2">
                  <div className="relative w-[70%]">
                    <input
                      type="number"
                      value={sendAmount}
                      onChange={(e) => setSendAmount(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && parseInt(sendAmount, 10) > 0) { PlatformBridge.hapticFeedback('light'); setSendStep(3); } }}
                      placeholder="0"
                      autoFocus
                      className="w-full p-3 pr-14 rounded-2xl rounded-br-md bg-[#E91E63] border border-[#E91E63] text-white font-extrabold placeholder-white/50 text-lg focus:outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-white/80">BUNZ</span>
                  </div>
                  <div className="flex gap-2">
                    {[10, 50, 100].map((q) => (
                      <button
                        key={q}
                        onClick={() => setSendAmount(String(q))}
                        className="px-3 py-1.5 rounded-full text-[11px] font-black border border-white/15 bg-white/5 text-white/80 cursor-pointer hover:bg-white/10"
                      >
                        {q}
                      </button>
                    ))}
                    <button
                      onClick={() => setSendAmount(balance || '0')}
                      className="px-3 py-1.5 rounded-full text-[11px] font-black border border-[#E91E63]/40 bg-[#E91E63]/15 text-[#E91E63] cursor-pointer"
                    >
                      Todo
                    </button>
                  </div>
                  <span className="text-[11px] text-white/40 font-semibold">Saldo disponible: {balance} BUNZ</span>
                </div>
              )}

              {sendStep === 3 && (
                <div className="self-end w-full flex flex-col items-end gap-2">
                  <input
                    value={sendNote}
                    onChange={(e) => setSendNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
                    placeholder="ej: ¡Gracias por los tacos! 🌮"
                    autoFocus
                    className="w-[75%] p-3 rounded-2xl rounded-br-md bg-[#E91E63] border border-[#E91E63] text-white placeholder-white/50 text-sm font-semibold focus:outline-none"
                  />
                  <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-3.5 text-left">
                    <p className="text-[11px] font-extrabold text-white/40 uppercase tracking-wider m-0 mb-1">Resumen</p>
                    <p className="text-[15px] font-extrabold m-0 text-white">
                      {sendAmount || '0'} BUNZ → {sendRecipient || '—'}
                    </p>
                    {sendNote.trim() && <p className="text-[12px] text-white/60 m-0 mt-1">“{sendNote.trim()}”</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex gap-2">
              {sendStep > 1 && (
                <button
                  onClick={() => setSendStep(sendStep - 1)}
                  disabled={sending}
                  className="flex-1 p-3.5 bg-white/5 border border-white/10 text-white/70 rounded-[14px] font-extrabold text-sm cursor-pointer disabled:opacity-50"
                >
                  Atrás
                </button>
              )}
              {sendStep < 3 ? (
                <button
                  onClick={() => {
                    if (sendStep === 1 && !sendRecipient.trim()) return;
                    if (sendStep === 2 && (!parseInt(sendAmount, 10) || parseInt(sendAmount, 10) <= 0)) return;
                    PlatformBridge.hapticFeedback('light');
                    setSendStep(sendStep + 1);
                  }}
                  disabled={(sendStep === 1 && !sendRecipient.trim()) || (sendStep === 2 && (!parseInt(sendAmount, 10) || parseInt(sendAmount, 10) <= 0))}
                  className="flex-2 p-3.5 bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white border-0 rounded-[14px] font-extrabold text-[15px] cursor-pointer shadow-lg shadow-[#E91E63]/30 disabled:opacity-40"
                >
                  Continuar →
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={sending}
                  className="flex-2 p-3.5 bg-linear-to-r from-[#E91E63] to-[#FF4081] text-white border-0 rounded-[14px] font-extrabold text-[15px] cursor-pointer shadow-lg shadow-[#E91E63]/30 disabled:opacity-50"
                >
                  {sending ? 'Transfiriendo…' : `Enviar ${sendAmount || '0'} BUNZ 🚀`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
    </ProfileSubpageLayout>
  );
}
