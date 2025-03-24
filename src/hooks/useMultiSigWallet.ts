// src/hooks/useMultiSigWallet.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { BlockchainAdapterFactory } from '../core/BlockchainAdapterFactory';
import { TransactionData, TransactionStatus } from '../core/interfaces';

interface UseMultiSigWalletProps {
  walletId?: string;
  blockchain?: string;
}

interface MultiSigWallet {
  id: string;
  name: string;
  blockchain: string;
  address: string;
  owners: string[];
  threshold: number;
  created_by: string;
}

interface TransactionProposal {
  id: string;
  wallet_id: string;
  title: string;
  description: string | null;
  to_address: string;
  value: string;
  data: string;
  status: string;
  blockchain: string;
  token_address: string | null;
  token_symbol: string | null;
  created_by: string;
  signatures: { signer: string; signature: string }[];
}

/**
 * Hook for managing multi-signature wallets
 */
export function useMultiSigWallet({ walletId, blockchain }: UseMultiSigWalletProps = {}) {
  const [wallets, setWallets] = useState<MultiSigWallet[]>([]);
  const [currentWallet, setCurrentWallet] = useState<MultiSigWallet | null>(null);
  const [proposals, setProposals] = useState<TransactionProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Load user's wallets
  const loadWallets = useCallback(async () => {
    try {
      setLoading(true);
      
      // Query wallets from Supabase
      const { data, error } = await supabase
        .from('multi_sig_wallets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      setWallets(data || []);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading wallets:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);
  
  // Load specific wallet
  const loadWallet = useCallback(async (id: string) => {
    try {
      setLoading(true);
      
      // Query wallet from Supabase
      const { data, error } = await supabase
        .from('multi_sig_wallets')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) {
        throw error;
      }
      
      setCurrentWallet(data);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading wallet:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);
  
  // Load proposals for a wallet
  const loadProposals = useCallback(async (walletId: string) => {
    try {
      setLoading(true);
      
      // Query proposals from Supabase
      const { data: proposalsData, error: proposalsError } = await supabase
        .from('transaction_proposals')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false });
      
      if (proposalsError) {
        throw proposalsError;
      }
      
      // Query signatures for each proposal
      const proposals = await Promise.all(
        (proposalsData || []).map(async (proposal) => {
          const { data: signaturesData, error: signaturesError } = await supabase
            .from('signatures')
            .select('*')
            .eq('proposal_id', proposal.id);
          
          if (signaturesError) {
            throw signaturesError;
          }
          
          return {
            ...proposal,
            signatures: signaturesData || []
          };
        })
      );
      
      setProposals(proposals);
      setLoading(false);
    } catch (err: any) {
      console.error('Error loading proposals:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);
  
  // Create a new multi-sig wallet
  const createWallet = useCallback(async (
    name: string,
    blockchain: string,
    owners: string[],
    threshold: number
  ) => {
    try {
      setLoading(true);
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(blockchain);
      
      // Generate multi-sig address
      const address = await adapter.generateMultiSigAddress(owners, threshold);
      
      // Insert wallet into Supabase
      const { data, error } = await supabase
        .from('multi_sig_wallets')
        .insert({
          name,
          blockchain,
          address,
          owners,
          threshold
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Update wallets list
      setWallets((prev) => [data, ...prev]);
      setCurrentWallet(data);
      setLoading(false);
      
      return data;
    } catch (err: any) {
      console.error('Error creating wallet:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, []);
  
  // Create a new transaction proposal
  const createProposal = useCallback(async (
    walletId: string,
    title: string,
    description: string,
    toAddress: string,
    amount: string,
    tokenAddress?: string,
    data?: string
  ) => {
    try {
      setLoading(true);
      
      // Get wallet details
      const wallet = wallets.find(w => w.id === walletId) || currentWallet;
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain);
      
      // Create transaction data
      const txData = await adapter.createTransaction({
        fromAddress: wallet.address,
        toAddress,
        amount,
        tokenAddress,
        data
      });
      
      // Insert proposal into Supabase
      const { data: proposalData, error } = await supabase
        .from('transaction_proposals')
        .insert({
          wallet_id: walletId,
          title,
          description,
          to_address: toAddress,
          value: amount,
          data: data || '0x',
          blockchain: wallet.blockchain,
          token_address: tokenAddress,
          status: 'pending'
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Add raw transaction data to wallet_details
      await supabase
        .from('wallet_details')
        .insert({
          wallet_id: walletId,
          blockchain_specific_data: {
            rawTransaction: txData.raw
          }
        });
      
      // Update proposals list
      setProposals((prev) => [{
        ...proposalData,
        signatures: []
      }, ...prev]);
      
      setLoading(false);
      return proposalData;
    } catch (err: any) {
      console.error('Error creating proposal:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [wallets, currentWallet]);
  
  // Sign a transaction proposal
  const signProposal = useCallback(async (
    proposalId: string,
    privateKey: string
  ) => {
    try {
      setLoading(true);
      
      // Find the proposal
      const proposal = proposals.find(p => p.id === proposalId);
      
      if (!proposal) {
        throw new Error('Proposal not found');
      }
      
      // Find the wallet
      const wallet = wallets.find(w => w.id === proposal.wallet_id) || currentWallet;
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(proposal.blockchain);
      
      // Get raw transaction data
      const { data: detailsData, error: detailsError } = await supabase
        .from('wallet_details')
        .select('blockchain_specific_data')
        .eq('wallet_id', wallet.id)
        .single();
      
      if (detailsError) {
        throw detailsError;
      }
      
      // Prepare transaction data
      const txData: TransactionData = {
        id: proposal.id,
        fromAddress: wallet.address,
        toAddress: proposal.to_address,
        amount: proposal.value,
        tokenAddress: proposal.token_address || undefined,
        data: proposal.data,
        raw: detailsData.blockchain_specific_data.rawTransaction,
        signatures: proposal.signatures.map(s => s.signature),
        status: proposal.status as TransactionStatus
      };
      
      // Sign the transaction
      const signature = await adapter.signTransaction(txData, privateKey);
      
      // Get the public key from the private key
      // This would be done differently in a real app for security reasons
      // Here we're just simulating for the example
      const signerAddress = "0x" + privateKey.slice(-40); // Simplified for example
      
      // Insert signature into Supabase
      const { data: signatureData, error } = await supabase
        .from('signatures')
        .insert({
          proposal_id: proposalId,
          signer: signerAddress,
          signature
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Update proposals list
      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            signatures: [...p.signatures, {
              signer: signerAddress,
              signature
            }]
          };
        }
        return p;
      }));
      
      setLoading(false);
      return signatureData;
    } catch (err: any) {
      console.error('Error signing proposal:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [proposals, wallets, currentWallet]);
  
  // Execute a transaction proposal
  const executeProposal = useCallback(async (proposalId: string) => {
    try {
      setLoading(true);
      
      // Find the proposal
      const proposal = proposals.find(p => p.id === proposalId);
      
      if (!proposal) {
        throw new Error('Proposal not found');
      }
      
      // Find the wallet
      const wallet = wallets.find(w => w.id === proposal.wallet_id) || currentWallet;
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Check if we have enough signatures
      if (proposal.signatures.length < wallet.threshold) {
        throw new Error(`Not enough signatures: ${proposal.signatures.length}/${wallet.threshold}`);
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(proposal.blockchain);
      
      // Get raw transaction data
      const { data: detailsData, error: detailsError } = await supabase
        .from('wallet_details')
        .select('blockchain_specific_data')
        .eq('wallet_id', wallet.id)
        .single();
      
      if (detailsError) {
        throw detailsError;
      }
      
      // Prepare transaction data
      const txData: TransactionData = {
        id: proposal.id,
        fromAddress: wallet.address,
        toAddress: proposal.to_address,
        amount: proposal.value,
        tokenAddress: proposal.token_address || undefined,
        data: proposal.data,
        raw: detailsData.blockchain_specific_data.rawTransaction,
        signatures: proposal.signatures.map(s => s.signature),
        status: proposal.status as TransactionStatus
      };
      
      // Combine signatures and broadcast transaction
      const combinedTx = await adapter.combineSignatures(txData, proposal.signatures.map(s => s.signature));
      const txHash = await adapter.broadcastTransaction(combinedTx);
      
      // Update proposal status in Supabase
      const { data: updatedProposal, error } = await supabase
        .from('transaction_proposals')
        .update({
          status: 'executed',
          data: JSON.stringify({ ...JSON.parse(proposal.data || '{}'), txHash })
        })
        .eq('id', proposalId)
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Update proposals list
      setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            status: 'executed',
            data: JSON.stringify({ ...JSON.parse(p.data || '{}'), txHash })
          };
        }
        return p;
      }));
      
      setLoading(false);
      return txHash;
    } catch (err: any) {
      console.error('Error executing proposal:', err);
      setError(err.message);
      setLoading(false);
      throw err;
    }
  }, [proposals, wallets, currentWallet]);
  
  // Load initial data based on props
  useEffect(() => {
    loadWallets();
    
    if (walletId) {
      loadWallet(walletId);
      loadProposals(walletId);
    }
  }, [walletId, loadWallets, loadWallet, loadProposals]);
  
  return {
    wallets,
    currentWallet,
    proposals,
    loading,
    error,
    loadWallets,
    loadWallet,
    loadProposals,
    createWallet,
    createProposal,
    signProposal,
    executeProposal
  };
}

// src/hooks/useWalletBalance.ts
import { useState, useEffect, useCallback } from 'react';
import { BlockchainAdapterFactory } from '../core/BlockchainAdapterFactory';

interface UseWalletBalanceProps {
  address: string;
  blockchain: string;
  tokenAddress?: string;
  refreshInterval?: number;
}

/**
 * Hook for getting wallet balance
 */
export function useWalletBalance({
  address,
  blockchain,
  tokenAddress,
  refreshInterval = 15000 // 15 seconds
}: UseWalletBalanceProps) {
  const [balance, setBalance] = useState<string>('0');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const fetchBalance = useCallback(async () => {
    try {
      if (!address || !blockchain) {
        return;
      }
      
      setLoading(true);
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(blockchain);
      
      // Get balance
      const balance = await adapter.getBalance(address, tokenAddress);
      
      setBalance(balance);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      console.error('Error fetching balance:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [address, blockchain, tokenAddress]);
  
  // Fetch balance on mount and when dependencies change
  useEffect(() => {
    fetchBalance();
    
    // Set up interval for refreshing balance
    const intervalId = setInterval(fetchBalance, refreshInterval);
    
    // Clean up
    return () => clearInterval(intervalId);
  }, [fetchBalance, refreshInterval]);
  
  return {
    balance,
    loading,
    error,
    refresh: fetchBalance
  };
}