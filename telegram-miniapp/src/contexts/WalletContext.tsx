'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { bunzWallet } from '@/services/wallet';

interface WalletContextType {
  address: string | null;
  balance: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType>({
  address: null,
  balance: '0',
  isConnected: false,
  connect: async () => {},
  disconnect: () => {},
  refreshBalance: async () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');

  const connect = async () => {
    try {
      const addr = await bunzWallet.connect();
      setAddress(addr);
      
      // Obtener balance
      const bal = await bunzWallet.getBalance(addr);
      setBalance(bal);
    } catch (error) {
      console.error('Wallet connection failed:', error);
      // Fallback para testing sin wallet
      setAddress('0x0000000000000000000000000000000000000000');
      setBalance('0');
    }
  };

  const disconnect = () => {
    setAddress(null);
    setBalance('0');
  };

  const refreshBalance = async () => {
    if (address) {
      try {
        const bal = await bunzWallet.getBalance(address);
        setBalance(bal);
      } catch (error) {
        console.error('Failed to refresh balance:', error);
      }
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

export const useWallet = () => useContext(WalletContext);
