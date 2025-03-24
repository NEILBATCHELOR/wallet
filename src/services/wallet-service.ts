// src/services/wallet-service.ts
import { supabase } from '@/lib/supabase-client'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'
import { TransactionParams, TransactionData, TransactionStatus } from '@/core/interfaces'
import { createSuccessResponse, createErrorResponse, ApiResponse } from '@/types/api'
import { v4 as uuidv4 } from 'uuid'

export class WalletService {
  /**
   * Get all supported blockchains
   */
  static getSupportedBlockchains(filter?: 'mainnet' | 'testnet'): ApiResponse {
    try {
      let blockchains
      
      if (filter === 'mainnet') {
        blockchains = BlockchainAdapterFactory.getMainnetBlockchains()
      } else if (filter === 'testnet') {
        blockchains = BlockchainAdapterFactory.getTestnetBlockchains()
      } else {
        blockchains = BlockchainAdapterFactory.getSupportedBlockchains()
      }
      
      // Map blockchains to include network information
      const result = blockchains.map(id => {
        const networkInfo = BlockchainAdapterFactory.getNetworkInfo(id)
        return {
          id,
          name: networkInfo.name,
          isTestnet: networkInfo.isTestnet,
          nativeCurrency: networkInfo.nativeCurrency
        }
      })
      
      return createSuccessResponse(result)
    } catch (error) {
      console.error('Error fetching blockchains:', error)
      return createErrorResponse(
        'GET_BLOCKCHAINS_ERROR',
        'Failed to fetch supported blockchains'
      )
    }
  }

  /**
   * Create a new wallet
   */
  static async createWallet(params: {
    name: string
    blockchain: string
    owners: string[]
    threshold: number
    userId: string
  }): Promise<ApiResponse> {
    try {
      const { name, blockchain, owners, threshold, userId } = params
      
      // Validate threshold
      if (threshold > owners.length) {
        return createErrorResponse(
          'INVALID_THRESHOLD',
          'Threshold cannot be greater than the number of owners'
        )
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(blockchain)
      
      // Generate multi-signature address
      const address = await adapter.generateMultiSigAddress(owners, threshold)
      
      // Create wallet in database
      const walletId = uuidv4()
      const newWallet = {
        id: walletId,
        user_id: userId,
        name,
        blockchain,
        address,
        owners,
        threshold,
        created_at: new Date().toISOString()
      }
      
      const { data, error } = await supabase
        .from('wallets')
        .insert(newWallet)
        .select()
      
      if (error) {
        throw error
      }
      
      return createSuccessResponse(data[0])
    } catch (error) {
      console.error('Error creating wallet:', error)
      return createErrorResponse(
        'CREATE_WALLET_ERROR',
        'Failed to create wallet'
      )
    }
  }

  /**
   * Get all wallets for a user
   */
  static async getWallets(userId: string): Promise<ApiResponse> {
    try {
      const { data: wallets, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('user_id', userId)
      
      if (error) {
        throw error
      }
      
      return createSuccessResponse(wallets)
    } catch (error) {
      console.error('Error fetching wallets:', error)
      return createErrorResponse(
        'GET_WALLETS_ERROR',
        'Failed to fetch wallets'
      )
    }
  }

  /**
   * Get wallet details
   */
  static async getWallet(walletId: string, userId: string): Promise<ApiResponse> {
    try {
      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          return createErrorResponse(
            'WALLET_NOT_FOUND',
            'Wallet not found'
          )
        }
        throw error
      }
      
      return createSuccessResponse(wallet)
    } catch (error) {
      console.error('Error fetching wallet details:', error)
      return createErrorResponse(
        'GET_WALLET_ERROR',
        'Failed to fetch wallet details'
      )
    }
  }

  /**
   * Update wallet details
   */
  static async updateWallet(
    walletId: string, 
    userId: string, 
    updates: { name: string }
  ): Promise<ApiResponse> {
    try {
      // Check if wallet exists and belongs to the user
      const { data: existingWallet, error: fetchError } = await supabase
        .from('wallets')
        .select('id')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (fetchError || !existingWallet) {
        return createErrorResponse(
          'WALLET_NOT_FOUND',
          'Wallet not found or access denied'
        )
      }
      
      const { data: updatedWallet, error: updateError } = await supabase
        .from('wallets')
        .update(updates)
        .eq('id', walletId)
        .select()
        .single()
      
      if (updateError) {
        throw updateError
      }
      
      return createSuccessResponse(updatedWallet)
    } catch (error) {
      console.error('Error updating wallet:', error)
      return createErrorResponse(
        'UPDATE_WALLET_ERROR',
        'Failed to update wallet'
      )
    }
  }

  /**
   * Delete wallet
   */
  static async deleteWallet(walletId: string, userId: string): Promise<ApiResponse> {
    try {
      // Check if wallet exists and belongs to the user
      const { data: existingWallet, error: fetchError } = await supabase
        .from('wallets')
        .select('id')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (fetchError || !existingWallet) {
        return createErrorResponse(
          'WALLET_NOT_FOUND',
          'Wallet not found or access denied'
        )
      }
      
      const { error: deleteError } = await supabase
        .from('wallets')
        .delete()
        .eq('id', walletId)
      
      if (deleteError) {
        throw deleteError
      }
      
      return createSuccessResponse({ message: 'Wallet deleted successfully' })
    } catch (error) {
      console.error('Error deleting wallet:', error)
      return createErrorResponse(
        'DELETE_WALLET_ERROR',
        'Failed to delete wallet'
      )
    }
  }

  /**
   * Get wallet balance
   */
  static async getWalletBalance(
    walletId: string, 
    userId: string, 
    tokenAddress?: string
  ): Promise<ApiResponse> {
    try {
      const { data: wallet, error } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (error) {
        if (error.code === 'PGRST116') {
          return createErrorResponse(
            'WALLET_NOT_FOUND',
            'Wallet not found'
          )
        }
        throw error
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
      
      // Get wallet balance
      const balance = await adapter.getBalance(wallet.address, tokenAddress)
      
      // Get network info
      const networkInfo = adapter.getNetworkInfo()
      
      return createSuccessResponse({
        balance,
        address: wallet.address,
        blockchain: wallet.blockchain,
        tokenAddress,
        currency: tokenAddress 
          ? { symbol: 'TOKEN', decimals: 18 } // In a real app, you'd fetch token details
          : networkInfo.nativeCurrency
      })
    } catch (error) {
      console.error('Error fetching wallet balance:', error)
      return createErrorResponse(
        'GET_BALANCE_ERROR',
        'Failed to fetch wallet balance'
      )
    }
  }

  /**
   * Create a transaction
   */
  static async createTransaction(params: {
    walletId: string
    userId: string
    toAddress: string
    amount: string
    tokenAddress?: string
    data?: string
    nonce?: number
    fee?: string
  }): Promise<ApiResponse> {
    try {
      const { 
        walletId, userId, toAddress, amount, 
        tokenAddress, data, nonce, fee 
      } = params
      
      // Get wallet from database
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (walletError) {
        return createErrorResponse(
          'WALLET_NOT_FOUND',
          'Wallet not found or access denied'
        )
      }
      
      // Create transaction parameters
      const txParams: TransactionParams = {
        fromAddress: wallet.address,
        toAddress,
        amount,
        tokenAddress,
        data,
        nonce,
        fee
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
      
      // Create transaction
      const transaction = await adapter.createTransaction(txParams)
      
      // Save transaction to database
      const { data: savedTx, error } = await supabase
        .from('transactions')
        .insert({
          id: transaction.id,
          wallet_id: walletId,
          from_address: transaction.fromAddress,
          to_address: transaction.toAddress,
          amount: transaction.amount,
          token_address: transaction.tokenAddress,
          data: transaction.data,
          raw_data: transaction.raw,
          signatures: transaction.signatures,
          status: transaction.status,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        throw error
      }
      
      return createSuccessResponse(savedTx)
    } catch (error) {
      console.error('Error creating transaction:', error)
      return createErrorResponse(
        'CREATE_TRANSACTION_ERROR',
        'Failed to create transaction'
      )
    }
  }

  /**
   * Get wallet transactions
   */
  static async getWalletTransactions(
    walletId: string, 
    userId: string
  ): Promise<ApiResponse> {
    try {
      // Check if wallet exists and belongs to the user
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('id')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (walletError) {
        if (walletError.code === 'PGRST116') {
          return createErrorResponse(
            'WALLET_NOT_FOUND',
            'Wallet not found'
          )
        }
        throw walletError
      }
      
      // Query transactions from the database
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('wallet_id', walletId)
        .order('created_at', { ascending: false })
      
      if (error) {
        throw error
      }
      
      return createSuccessResponse(transactions)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      return createErrorResponse(
        'GET_TRANSACTIONS_ERROR',
        'Failed to fetch transactions'
      )
    }
  }

  /**
   * Get transaction details
   */
  static async getTransaction(
    walletId: string, 
    txId: string, 
    userId: string
  ): Promise<ApiResponse> {
    try {
      // Check if wallet exists and belongs to the user
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (walletError) {
        if (walletError.code === 'PGRST116') {
          return createErrorResponse(
            'WALLET_NOT_FOUND',
            'Wallet not found'
          )
        }
        throw walletError
      }
      
      // Query transaction from the database
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', txId)
        .eq('wallet_id', walletId)
        .single()
      
      if (txError) {
        if (txError.code === 'PGRST116') {
          return createErrorResponse(
            'TRANSACTION_NOT_FOUND',
            'Transaction not found'
          )
        }
        throw txError
      }
      
      // If there's a blockchain transaction hash, check its status
      if (tx.tx_hash) {
        const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
        const currentStatus = await adapter.getTransactionStatus(tx.tx_hash)
        
        // Update status if it has changed
        if (currentStatus !== tx.status) {
          await supabase
            .from('transactions')
            .update({ status: currentStatus })
            .eq('id', txId)
          
          tx.status = currentStatus
        }
      }
      
      return createSuccessResponse(tx)
    } catch (error) {
      console.error('Error fetching transaction details:', error)
      return createErrorResponse(
        'GET_TRANSACTION_ERROR',
        'Failed to fetch transaction details'
      )
    }
  }

  /**
   * Sign a transaction
   */
  static async signTransaction(params: {
    walletId: string
    txId: string
    privateKey: string
    userId: string
  }): Promise<ApiResponse> {
    try {
      const { walletId, txId, privateKey, userId } = params
      
      // Get wallet from database
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (walletError) {
        return createErrorResponse(
          'WALLET_NOT_FOUND',
          'Wallet not found or access denied'
        )
      }
      
      // Get transaction from database
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', txId)
        .eq('wallet_id', walletId)
        .single()
      
      if (txError) {
        return createErrorResponse(
          'TRANSACTION_NOT_FOUND',
          'Transaction not found'
        )
      }
      
      // Convert database transaction to TransactionData format
      const transactionData: TransactionData = {
        id: tx.id,
        fromAddress: tx.from_address,
        toAddress: tx.to_address,
        amount: tx.amount,
        tokenAddress: tx.token_address,
        data: tx.data,
        raw: tx.raw_data,
        signatures: tx.signatures || [],
        status: tx.status
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
      
      // Sign the transaction
      const signature = await adapter.signTransaction(transactionData, privateKey)
      
      // Update transaction signatures
      let signatures = [...transactionData.signatures]
      if (!signatures.includes(signature)) {
        signatures.push(signature)
      }
      
      // Update database
      const { data: updatedTx, error: updateError } = await supabase
        .from('transactions')
        .update({ signatures })
        .eq('id', txId)
        .select()
        .single()
      
      if (updateError) {
        throw updateError
      }
      
      return createSuccessResponse({
        signature,
        transaction: updatedTx
      })
    } catch (error) {
      console.error('Error signing transaction:', error)
      return createErrorResponse(
        'SIGN_TRANSACTION_ERROR',
        'Failed to sign transaction'
      )
    }
  }

  /**
   * Broadcast a transaction
   */
  static async broadcastTransaction(params: {
    walletId: string
    txId: string
    userId: string
  }): Promise<ApiResponse> {
    try {
      const { walletId, txId, userId } = params
      
      // Get wallet from database
      const { data: wallet, error: walletError } = await supabase
        .from('wallets')
        .select('*')
        .eq('id', walletId)
        .eq('user_id', userId)
        .single()
      
      if (walletError) {
        return createErrorResponse(
          'WALLET_NOT_FOUND',
          'Wallet not found or access denied'
        )
      }
      
      // Get transaction from database
      const { data: tx, error: txError } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', txId)
        .eq('wallet_id', walletId)
        .single()
      
      if (txError) {
        return createErrorResponse(
          'TRANSACTION_NOT_FOUND',
          'Transaction not found'
        )
      }
      
      // Check if transaction has enough signatures
      if (!tx.signatures || tx.signatures.length < wallet.threshold) {
        return createErrorResponse(
          'INSUFFICIENT_SIGNATURES',
          `Transaction requires at least ${wallet.threshold} signatures, but only has ${tx.signatures ? tx.signatures.length : 0}`
        )
      }
      
      // Check if transaction is already broadcast
      if (tx.tx_hash) {
        return createErrorResponse(
          'ALREADY_BROADCAST',
          'Transaction has already been broadcast'
        )
      }
      
      // Convert database transaction to TransactionData format
      const transactionData: TransactionData = {
        id: tx.id,
        fromAddress: tx.from_address,
        toAddress: tx.to_address,
        amount: tx.amount,
        tokenAddress: tx.token_address,
        data: tx.data,
        raw: tx.raw_data,
        signatures: tx.signatures,
        status: tx.status
      }
      
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
      
      // Broadcast transaction
      const txHash = await adapter.broadcastTransaction(transactionData)
      
      // Update transaction in database
      const { data: updatedTx, error: updateError } = await supabase
        .from('transactions')
        .update({
          tx_hash: txHash,
          status: TransactionStatus.PENDING,
          broadcast_at: new Date().toISOString()
        })
        .eq('id', txId)
        .select()
        .single()
      
      if (updateError) {
        throw updateError
      }
      
      return createSuccessResponse({
        txHash,
        transaction: updatedTx
      })
    } catch (error) {
      console.error('Error broadcasting transaction:', error)
      return createErrorResponse(
        'BROADCAST_TRANSACTION_ERROR',
        'Failed to broadcast transaction'
      )
    }
  }
}
