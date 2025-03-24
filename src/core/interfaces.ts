// src/core/interfaces.ts

export interface BlockchainAdapter {
  // Network information
  getNetworkInfo(): NetworkInfo;
  
  // Account management
  generateMultiSigAddress(owners: string[], threshold: number): Promise<string>;
  getBalance(address: string, tokenAddress?: string): Promise<string>;
  
  // Transaction handling
  createTransaction(params: TransactionParams): Promise<TransactionData>;
  signTransaction(transaction: TransactionData, privateKey: string): Promise<string>;
  combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData>;
  broadcastTransaction(transaction: TransactionData): Promise<string>; // Returns txHash
  
  // Utility functions
  validateAddress(address: string): boolean;
  getTransactionStatus(txHash: string): Promise<TransactionStatus>;
}

export interface NetworkInfo {
  name: string;
  chainId?: string | number;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet: boolean;
}

export interface TransactionParams {
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress?: string; // If sending a token
  data?: string; // For contract interactions
  nonce?: number; // For some blockchains
  fee?: string; // Gas price/fee
}

export interface TransactionData {
  id: string; // Can be a hash or UUID
  fromAddress: string;
  toAddress: string;
  amount: string;
  tokenAddress?: string;
  data?: string;
  raw: any; // Blockchain-specific raw transaction data
  signatures: string[];
  status: TransactionStatus;
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  REJECTED = 'rejected'
}

// Cryptographic curve and signing algorithm interfaces
export interface SigningProvider {
  signMessage(message: Uint8Array, privateKey: string): Promise<string>;
  verifySignature(message: Uint8Array, signature: string, publicKey: string): Promise<boolean>;
  derivePublicKey(privateKey: string): string;
}

// Specific curve implementations
export interface SECP256K1Provider extends SigningProvider {
  // ECDSA with secp256k1 curve (Ethereum, Bitcoin, etc.)
}

export interface ED25519Provider extends SigningProvider {
  // EdDSA with Ed25519 curve (Solana, Stellar, etc.)
}