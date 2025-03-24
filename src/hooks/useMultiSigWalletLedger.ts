// src/hooks/useMultiSigWalletLedger.ts
import { useState, useCallback } from 'react';
import { useMultiSigWallet } from './useMultiSigWallet';
import { useLedger, LedgerAppType } from './useLedger';
import { BlockchainAdapterFactory } from '../core/BlockchainAdapterFactory';

interface UseMultiSigWalletLedgerProps {
  walletId?: string;
  blockchain?: string;
}

/**
 * Hook combining multi-sig wallet with Ledger hardware wallet
 */
export function useMultiSigWalletLedger({ walletId, blockchain }: UseMultiSigWalletLedgerProps = {}) {
  const multiSigWallet = useMultiSigWallet({ walletId, blockchain });
  const [ledgerAddress, setLedgerAddress] = useState<string | null>(null);
  const [ledgerPath, setLedgerPath] = useState<string | null>(null);
  const [ledgerAppType, setLedgerAppType] = useState<LedgerAppType>('ethereum');

  // Get the correct Ledger app type based on blockchain
  const getLedgerAppTypeForBlockchain = useCallback((blockchain: string): LedgerAppType => {
    const baseChain = blockchain.split('-')[0]; // Remove network suffix like -testnet
    
    if (['ethereum', 'polygon', 'avalanche', 'optimism', 'base', 'arbitrum', 'zksync', 'mantle'].includes(baseChain)) {
      return 'ethereum';
    } else if (baseChain === 'bitcoin') {
      return 'bitcoin';
    } else if (baseChain === 'solana') {
      return 'solana';
    } else if (baseChain === 'ripple') {
      return 'ripple';
    } else if (baseChain === 'near') {
      return 'near';
    }
    
    // Default to Ethereum
    return 'ethereum';
  }, []);

  // Update the ledger app type whenever the blockchain changes
  useState(() => {
    if (blockchain) {
      const appType = getLedgerAppTypeForBlockchain(blockchain);
      setLedgerAppType(appType);
    } else if (multiSigWallet.currentWallet?.blockchain) {
      const appType = getLedgerAppTypeForBlockchain(multiSigWallet.currentWallet.blockchain);
      setLedgerAppType(appType);
    }
  });

  // Initialize Ledger hook with the appropriate app
  const ledger = useLedger(ledgerAppType);

  // Handle Ledger address selection
  const handleLedgerAddressSelect = useCallback((address: string, path: string) => {
    setLedgerAddress(address);
    setLedgerPath(path);
  }, []);

  // Sign a transaction proposal with Ledger
  const signProposalWithLedger = useCallback(async (
    proposalId: string
  ) => {
    try {
      if (!ledgerAddress || !ledgerPath) {
        throw new Error('No Ledger address selected');
      }
      
      if (!ledger.isConnected) {
        throw new Error('Ledger not connected');
      }
      
      // Find the proposal
      const proposal = multiSigWallet.proposals.find(p => p.id === proposalId);
      
      if (!proposal) {
        throw new Error('Proposal not found');
      }
      
      // Find the wallet
      const wallet = multiSigWallet.wallets.find(w => w.id === proposal.wallet_id) || multiSigWallet.currentWallet;
      
      if (!wallet) {
        throw new Error('Wallet not found');
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(proposal.blockchain);
      
      // Get wallet details (raw transaction data)
      const { data: detailsData, error: detailsError } = await multiSigWallet.supabase
        .from('wallet_details')
        .select('blockchain_specific_data')
        .eq('wallet_id', wallet.id)
        .single();
      
      if (detailsError) {
        throw detailsError;
      }
      
      // Prepare transaction data
      const txData = {
        id: proposal.id,
        fromAddress: wallet.address,
        toAddress: proposal.to_address,
        amount: proposal.value,
        tokenAddress: proposal.token_address || undefined,
        data: proposal.data,
        raw: detailsData.blockchain_specific_data.rawTransaction,
        signatures: proposal.signatures.map(s => s.signature),
        status: proposal.status
      };
      
      // Prepare transaction for signing based on blockchain type
      let transactionToSign;
      
      if (ledgerAppType === 'ethereum') {
        // For Ethereum, create a raw transaction object that Ledger can sign
        transactionToSign = {
          chainId: txData.raw.chainId,
          nonce: txData.raw.nonce,
          gasLimit: txData.raw.gasLimit,
          gasPrice: txData.raw.gasPrice,
          to: txData.toAddress,
          value: txData.raw.value,
          data: txData.data || '0x'
        };
      } else if (ledgerAppType === 'bitcoin') {
        // For Bitcoin, prepare transaction with inputs and outputs
        transactionToSign = {
          txHex: txData.raw.txHex,
          inputs: txData.raw.inputs,
          associatedKeysets: [ledgerPath], // Using the selected path
          changePath: txData.raw.changePath
        };
      } else if (ledgerAppType === 'solana') {
        // For Solana, we need the Transaction object
        transactionToSign = txData.raw.transaction;
      } else {
        throw new Error(`Unsupported ledger app type: ${ledgerAppType}`);
      }
      
      // Sign the transaction with Ledger
      const signature = await ledger.signTransaction(transactionToSign);
      
      // Add signature to the database
      const { data: signatureData, error } = await multiSigWallet.supabase
        .from('signatures')
        .insert({
          proposal_id: proposalId,
          signer: ledgerAddress,
          signature
        })
        .select()
        .single();
      
      if (error) {
        throw error;
      }
      
      // Update proposals list
      multiSigWallet.setProposals(prev => prev.map(p => {
        if (p.id === proposalId) {
          return {
            ...p,
            signatures: [...p.signatures, {
              signer: ledgerAddress,
              signature
            }]
          };
        }
        return p;
      }));
      
      return signatureData;
    } catch (err: any) {
      console.error('Error signing proposal with Ledger:', err);
      throw new Error(`Failed to sign with Ledger: ${err.message}`);
    }
  }, [ledger, ledgerAddress, ledgerPath, ledgerAppType, multiSigWallet]);

  return {
    ...multiSigWallet,
    ledger,
    ledgerAddress,
    ledgerPath,
    ledgerAppType,
    handleLedgerAddressSelect,
    signProposalWithLedger
  };
}

// src/components/LedgerTransactionSigner.tsx
import React, { useState } from 'react';
import { LedgerConnect } from './ledger/LedgerConnect';
import { LedgerTransactionSigner as LedgerSigner } from './ledger/LedgerTransactionSigner';
import { useMultiSigWalletLedger } from '../hooks/useMultiSigWalletLedger';

interface LedgerTransactionSignerProps {
  proposalId: string;
  walletId: string;
  onComplete: () => void;
  onCancel: () => void;
}

const LedgerTransactionSigner: React.FC<LedgerTransactionSignerProps> = ({
  proposalId,
  walletId,
  onComplete,
  onCancel
}) => {
  const {
    proposals,
    currentWallet,
    ledger,
    ledgerAppType,
    handleLedgerAddressSelect,
    signProposalWithLedger
  } = useMultiSigWalletLedger({ walletId });

  const [step, setStep] = useState<'connect' | 'sign'>('connect');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Find the proposal
  const proposal = proposals.find(p => p.id === proposalId);
  
  if (!proposal) {
    return <div className="error-message">Proposal not found</div>;
  }

  // Handle Ledger connection
  const handleLedgerConnect = () => {
    setStep('sign');
  };

  // Handle transaction signing
  const handleSign = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      await signProposalWithLedger(proposalId);
      
      setIsLoading(false);
      onComplete();
    } catch (err: any) {
      setError(err.message || 'Failed to sign transaction');
      setIsLoading(false);
    }
  };

  // Create a transaction object based on the proposal data
  // This will vary by blockchain type
  const createTransactionObject = () => {
    // For simplicity, we'll just return the basic transaction data
    // In a real app, you'd need to format this properly for each blockchain
    
    if (ledgerAppType === 'ethereum') {
      return {
        to: proposal.to_address,
        value: proposal.value,
        data: proposal.data
      };
    } else if (ledgerAppType === 'bitcoin') {
      // Simplified - in a real app, you'd need to fetch actual UTXOs and build the tx
      return {
        outputs: [{ address: proposal.to_address, value: proposal.value }],
        fee: '1000' // Satoshis
      };
    } else if (ledgerAppType === 'solana') {
      return {
        recipient: proposal.to_address,
        amount: proposal.value,
        recentBlockhash: 'simulated-blockhash'
      };
    }
    
    return {
      to: proposal.to_address,
      value: proposal.value,
      data: proposal.data
    };
  };

  return (
    <div className="ledger-transaction-signer-container">
      {error && <div className="error-message">{error}</div>}
      
      {step === 'connect' ? (
        <LedgerConnect
          appType={ledgerAppType}
          onAddressSelect={handleLedgerAddressSelect}
          onConnect={handleLedgerConnect}
          onDisconnect={onCancel}
        />
      ) : (
        <LedgerSigner
          appType={ledgerAppType}
          transaction={createTransactionObject()}
          onSignComplete={handleSign}
          onCancel={() => setStep('connect')}
        />
      )}
    </div>
  );
};

export { LedgerTransactionSigner };