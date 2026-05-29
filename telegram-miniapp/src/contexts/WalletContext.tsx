'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { TonConnectUIProvider, useTonWallet, useTonConnectUI } from '@tonconnect/ui-react';

interface WalletContextType {
  address: string | null;
  balance: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  balance: '0',
  isConnected: false,
  connect: async () => {},
  disconnect: async () => {},
  refreshBalance: async () => {},
});

function WalletProviderInner({ children }: { children: React.ReactNode }) {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const [balance, setBalance] = useState('0');

  const address = wallet ? wallet.account.address : null;

  useEffect(() => {
    if (address) {
      refreshBalance();
    } else {
      setBalance('0');
    }
  }, [address]);

  const connect = async () => {
    try {
      await tonConnectUI.openModal();
    } catch (error) {
      console.error('TON connection failed:', error);
    }
  };

  const disconnect = async () => {
    try {
      await tonConnectUI.disconnect();
    } catch (error) {
      console.error('TON disconnect failed:', error);
    }
  };

  const refreshBalance = async () => {
    if (address) {
      // Mock balance for now. In a real app, you'd fetch Jetton balance via TON API
      setBalance('10.00');
    }
  };

  return (
    <WalletContext.Provider value={{
      address,
      balance,
      isConnected: !!address,
      connect,
      disconnect,
      refreshBalance,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  // Use Vercel URL or local
  const manifestUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/tonconnect-manifest.json`
    : 'https://rabbitty.app/tonconnect-manifest.json';

  return (
    <TonConnectUIProvider manifestUrl={manifestUrl}>
      <WalletProviderInner>
        {children}
      </WalletProviderInner>
    </TonConnectUIProvider>
  );
}

export const useWallet = () => useContext(WalletContext);
