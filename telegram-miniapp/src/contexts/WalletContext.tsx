'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';

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
  const { user, checkAuth } = useAuth();
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState('0');

  useEffect(() => {
    if (user) {
      setAddress(user.tonWalletAddress || null);
      setBalance((((user.totalBunzEarned || 0) - (user.totalBunzSpent || 0))).toString());
    } else {
      setAddress(null);
      setBalance('0');
    }
  }, [user]);

  const connect = async () => {
    if (user?.tonWalletAddress) {
      setAddress(user.tonWalletAddress);
    }
  };

  const disconnect = async () => {
    setAddress(null);
  };

  const refreshBalance = useCallback(async () => {
    await checkAuth();
  }, [checkAuth]);

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
