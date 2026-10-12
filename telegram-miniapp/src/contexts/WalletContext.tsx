'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

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

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');

  const connect = async () => {
    // Identity is managed authoritatively by Telegram Auth and API Server session
    setAddress('connected');
  };

  const disconnect = async () => {
    setAddress(null);
  };

  const refreshBalance = async () => {
    // Balance is authoritatively fetched from server via AuthProvider/tRPC
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
