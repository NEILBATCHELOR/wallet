// src/context/WalletContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { useMultiSigWallet } from '../hooks/useMultiSigWallet';
import { BlockchainAdapterFactory } from '../core/BlockchainAdapterFactory';

interface WalletContextType {
  wallets: any[];
  currentWallet: any | null;
  isLoading: boolean;
  error: string | null;
  refreshWallets: () => Promise<void>;
  selectWallet: (walletId: string) => Promise<void>;
  createWallet: (walletData: any) => Promise<any>;
  supportedBlockchains: string[];
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [supportedBlockchains, setSupportedBlockchains] = useState<string[]>([]);
  const { 
    wallets, 
    currentWallet, 
    loading: isLoading, 
    error,
    loadWallets,
    loadWallet,
    createWallet: createMultiSigWallet
  } = useMultiSigWallet();

  useEffect(() => {
    // Get supported blockchains
    const chains = BlockchainAdapterFactory.getSupportedBlockchains();
    setSupportedBlockchains(chains);
    
    // Load wallets on mount
    loadWallets();
  }, []);

  const refreshWallets = async () => {
    await loadWallets();
  };

  const selectWallet = async (walletId: string) => {
    await loadWallet(walletId);
  };

  const createWallet = async (walletData: any) => {
    const result = await createMultiSigWallet(
      walletData.name,
      walletData.blockchain,
      walletData.owners,
      walletData.threshold
    );
    await refreshWallets();
    return result;
  };

  const value = {
    wallets,
    currentWallet,
    isLoading,
    error,
    refreshWallets,
    selectWallet,
    createWallet,
    supportedBlockchains
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}