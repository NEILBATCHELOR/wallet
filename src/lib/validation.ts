// src/lib/validation.ts
import { z } from 'zod'

// Schema for creating a wallet
export const createWalletSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  blockchain: z.string().min(1, 'Blockchain is required'),
  owners: z.array(z.string()).min(2, 'At least 2 owners are required'),
  threshold: z.number().min(1, 'Threshold must be at least 1')
})

// Schema for creating a transaction
export const createTransactionSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
  toAddress: z.string().min(1, 'Recipient address is required'),
  amount: z.string().min(1, 'Amount is required'),
  tokenAddress: z.string().optional(),
  data: z.string().optional(),
  nonce: z.number().optional(),
  fee: z.string().optional()
})

// Schema for signing a transaction
export const signTransactionSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
  txId: z.string().min(1, 'Transaction ID is required'),
  privateKey: z.string().min(1, 'Private key is required')
})

// Schema for broadcasting a transaction
export const broadcastTransactionSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
  txId: z.string().min(1, 'Transaction ID is required')
})

/**
 * Validate an Ethereum address
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address)
}

/**
 * Validate a blockchain ID
 */
export function isValidBlockchainId(blockchainId: string): boolean {
  const supportedBlockchains = [
    'ethereum', 'ethereum-sepolia',
    'polygon', 'polygon-mumbai',
    'avalanche', 'avalanche-fuji',
    'optimism', 'optimism-goerli',
    'bitcoin', 'bitcoin-testnet',
    'solana', 'solana-devnet',
    'ripple', 'ripple-testnet',
    'aptos', 'aptos-testnet',
    'sui', 'sui-testnet',
    'mantle', 'mantle-testnet',
    'stellar', 'stellar-testnet',
    'hedera', 'hedera-testnet',
    'base', 'base-goerli',
    'zksync', 'zksync-goerli',
    'arbitrum', 'arbitrum-goerli',
    'near', 'near-testnet'
  ]
  
  return supportedBlockchains.includes(blockchainId)
}

/**
 * Format an amount with the correct number of decimals
 */
export function formatAmount(amount: string, decimals: number = 18): string {
  // Remove any non-numeric characters except the decimal point
  const cleanAmount = amount.replace(/[^\d.]/g, '')
  
  // Split by decimal point
  const parts = cleanAmount.split('.')
  
  // Handle integer part
  const integerPart = parts[0] || '0'
  
  // Handle decimal part (if exists)
  let decimalPart = ''
  if (parts.length > 1) {
    decimalPart = parts[1].slice(0, decimals)
  }
  
  // Return formatted amount
  return decimalPart ? `${integerPart}.${decimalPart}` : integerPart
}
