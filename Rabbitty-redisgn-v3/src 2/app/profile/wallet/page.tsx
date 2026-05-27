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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-MX', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <ProfileSubpageLayout title="Ra Wallet">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Main balance card */}
        <div style={{
          background: 'linear-gradient(135deg, #0F0F1A 0%, #1A1025 50%, #2A0845 100%)',
          borderRadius: 32, padding: '28px 24px',
          position: 'relative', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          color: '#fff',
        }}>
          <div style={{ position: 'absolute', right: '-20%', top: '-20%', width: 256, height: 256, background: 'rgba(233,30,99,0.2)', borderRadius: '50%', filter: 'blur(80px)' }} />
          <div style={{ position: 'absolute', left: '-10%', bottom: '-10%', width: 160, height: 160, background: 'rgba(59,130,246,0.15)', borderRadius: '50%', filter: 'blur(60px)' }} />

          {/* Top row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M3 5h14M3 10h14M3 15h8" stroke="#E91E63" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <span style={{ fontWeight: 900, fontSize: 11, letterSpacing: 2, color: 'rgba(255,255,255,0.85)' }}>RA WALLET</span>
            </div>
            <div style={{ transform: 'scale(0.9)', transformOrigin: 'right center' }}>
              <TonConnectButton className="my-ton-btn" />
            </div>
          </div>

          {/* Balance */}
          <div style={{ position: 'relative', zIndex: 1, marginBottom: 28 }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>Balance Disponible</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <h1 style={{ fontSize: 52, fontWeight: 900, letterSpacing: -2, lineHeight: 1, margin: 0, color: '#fff' }}>{balance}</h1>
              <span style={{ color: '#E91E63', fontWeight: 900, fontSize: 20, letterSpacing: 1 }}>BUNZ</span>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, color: 'rgba(255,255,255,0.3)', fontSize: 11, fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Actualizando...' : 'Actualizar saldo'}
            </button>
          </div>

          {/* Address */}
          {wallet ? (
            <div style={{
              position: 'relative', zIndex: 1,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 20, padding: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ overflow: 'hidden', paddingRight: 16 }}>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Billetera Conectada (TON)</p>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'monospace', letterSpacing: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {wallet.account.address.substring(0, 8)}...{wallet.account.address.substring(wallet.account.address.length - 8)}
                </p>
              </div>
              <button onClick={handleCopy} style={{ padding: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', flexShrink: 0 }}>
                <Copy size={16} color="rgba(255,255,255,0.7)" />
              </button>
            </div>
          ) : (
            <div style={{
              position: 'relative', zIndex: 1,
              background: 'rgba(233,30,99,0.1)', border: '1px solid rgba(233,30,99,0.2)',
              borderRadius: 20, padding: 16,
              color: '#F48FB1', fontSize: 12, lineHeight: 1.6, textAlign: 'center', fontWeight: 500,
            }}>
              Conecta tu billetera (Tonkeeper) arriba para transferir Bunz libremente por la red TON.
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            { label: 'Recibir', Icon: ArrowDownLeft, iconBg: '#EFF6FF', iconColor: '#3B82F6' },
            { label: 'Enviar',  Icon: ArrowUpRight,  iconBg: '#FFF0F5', iconColor: '#E91E63' },
          ].map(({ label, Icon, iconBg, iconColor }) => (
            <button
              key={label}
              disabled={!wallet}
              style={{
                background: '#fff', border: '1px solid #F0F0F0',
                borderRadius: 24, padding: 24,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
                cursor: wallet ? 'pointer' : 'not-allowed', opacity: wallet ? 1 : 0.5,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={28} color={iconColor} strokeWidth={2.5} />
              </div>
              <span style={{ fontWeight: 900, color: '#111', fontSize: 14 }}>{label}</span>
            </button>
          ))}
        </div>

        {/* Transaction history */}
        <div style={{ background: '#fff', borderRadius: 24, border: '1px solid #F0F0F0', padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.03)' }}>
          <p style={{ fontWeight: 900, color: '#111', fontSize: 15, marginBottom: 16 }}>Últimas transacciones</p>

          {!address ? (
            <p style={{ textAlign: 'center', color: '#CCC', fontSize: 13, padding: '16px 0' }}>Conecta tu billetera para ver el historial</p>
          ) : historyLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', border: '2px solid rgba(233,30,99,0.3)', borderTopColor: '#E91E63', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : history.length === 0 ? (
            <p style={{ textAlign: 'center', color: '#CCC', fontSize: 13, padding: '16px 0' }}>Aún no tienes transacciones</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {history.map((tx, i) => (
                <div key={tx.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  paddingTop: i === 0 ? 0 : 12, paddingBottom: i === history.length - 1 ? 0 : 12,
                  borderBottom: i === history.length - 1 ? 'none' : '1px solid #F4F4F4',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 14, fontSize: 18,
                      background: tx.type === 'earned' ? '#F0FDF4' : '#FFF0F5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {tx.icon}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, color: '#111', fontSize: 14, margin: '0 0 2px' }}>{tx.name}</p>
                      <p style={{ color: '#AAA', fontSize: 11, margin: 0 }}>{formatDate(tx.date)}</p>
                    </div>
                  </div>
                  <span style={{ fontWeight: 900, fontSize: 15, color: tx.type === 'earned' ? '#10B981' : '#E91E63' }}>
                    {tx.amount} bunz
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .my-ton-btn button { border-radius: 999px !important; height: 36px !important; font-weight: 700 !important; font-size: 12px !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}} />
    </ProfileSubpageLayout>
  );
}
