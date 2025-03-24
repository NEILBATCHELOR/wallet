// src/lib/api/wallet-api.ts
import { WalletService } from '@/services/wallet-service'
import { ApiResponse } from '@/types/api'

/**
 * Client-side API for wallet operations
 */
export const walletApi = {
  /**
   * Get all supported blockchains
   * @param filter - Optional filter for mainnet or testnet blockchains
   */
  getSupportedBlockchains(filter?: 'mainnet' | 'testnet'): ApiResponse {
    return WalletService.getSupportedBlockchains(filter)
  },
  
  /**
   * Get all wallets for the current user
   */
  async getWallets(userId: string): Promise<ApiResponse> {
    return await WalletService.getWallets(userId)
  },
  
  /**
   * Create a new wallet
   */
  async createWallet(params: {
    name: string
    blockchain: string
    owners: string[]
    threshold: number
    userId: string
  }): Promise<ApiResponse> {
    return await WalletService.createWallet(params)
  },
  
  /**
   * Get a specific wallet's details
   */
  async getWallet(walletId: string, userId: string): Promise<ApiResponse> {
    return await WalletService.getWallet(walletId, userId)
  },
  
  /**
   * Update a wallet's details (currently only supports changing name)
   */
  async updateWallet(
    walletId: string, 
    userId: string, 
    data: { name: string }
  ): Promise<ApiResponse> {
    return await WalletService.updateWallet(walletId, userId, data)
  },
  
  /**
   * Delete a wallet from the user's account
   */
  async deleteWallet(walletId: string, userId: string): Promise<ApiResponse> {
    return await WalletService.deleteWallet(walletId, userId)
  },
  
  /**
   * Get a wallet's balance
   */
  async getWalletBalance(
    walletId: string, 
    userId: string, 
    tokenAddress?: string
  ): Promise<ApiResponse> {
    return await WalletService.getWalletBalance(walletId, userId, tokenAddress)
  },
  
  /**
   * Get a wallet's transactions
   */
  async getWalletTransactions(
    walletId: string, 
    userId: string
  ): Promise<ApiResponse> {
    return await WalletService.getWalletTransactions(walletId, userId)
  },
  
  /**
   * Create a new transaction
   */
  async createTransaction(params: {
    walletId: string
    userId: string
    toAddress: string
    amount: string
    tokenAddress?: string
    data?: string
    nonce?: number
    fee?: string
  }): Promise<ApiResponse> {
    return await WalletService.createTransaction(params)
  },
  
  /**
   * Get transaction details
   */
  async getTransaction(
    walletId: string, 
    txId: string, 
    userId: string
  ): Promise<ApiResponse> {
    return await WalletService.getTransaction(walletId, txId, userId)
  },
  
  /**
   * Sign a transaction
   */
  async signTransaction(params: {
    walletId: string
    txId: string
    privateKey: string
    userId: string
  }): Promise<ApiResponse> {
    return await WalletService.signTransaction(params)
  },
  
  /**
   * Broadcast a transaction to the blockchain
   */
  async broadcastTransaction(params: {
    walletId: string
    txId: string
    userId: string
  }): Promise<ApiResponse> {
    return await WalletService.broadcastTransaction(params)
  }
}
