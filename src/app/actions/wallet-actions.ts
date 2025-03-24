// src/app/actions/wallet-actions.ts
import { z } from 'zod'
import { action, createSuccessResponse, createErrorResponse, validateBlockchainId } from '@/lib/api-utils'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'
import { supabase } from '@/services/supabaseClient'
import { TransactionParams, TransactionData, TransactionStatus } from '@/core/interfaces'
import { ActionResponse } from '@/types/actions'

/**
 * Schema for creating a wallet
 */
const createWalletSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  blockchain: z.string().min(1, 'Blockchain is required'),
  owners: z.array(z.string()).min(2, 'At least 2 owners are required'),
  threshold: z.number().min(1, 'Threshold must be at least 1')
})

/**
 * Schema for creating a transaction
 */
const createTransactionSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
  toAddress: z.string().min(1, 'Recipient address is required'),
  amount: z.string().min(1, 'Amount is required'),
  tokenAddress: z.string().optional(),
  data: z.string().optional(),
  nonce: z.number().optional(),
  fee: z.string().optional()
})

/**
 * Schema for signing a transaction
 */
const signTransactionSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
  txId: z.string().min(1, 'Transaction ID is required'),
  privateKey: z.string().min(1, 'Private key is required')
})

/**
 * Schema for broadcasting a transaction
 */
const broadcastTransactionSchema = z.object({
  walletId: z.string().min(1, 'Wallet ID is required'),
  txId: z.string().min(1, 'Transaction ID is required')
})

/**
 * Create a new multi-signature wallet
 */
export const createWallet = action(createWalletSchema, async ({ name, blockchain, owners, threshold }) => {
  try {
    // Validate blockchain
    if (!validateBlockchainId(blockchain)) {
      return createErrorResponse(
        'INVALID_BLOCKCHAIN',
        'Invalid or unsupported blockchain'
      )
    }
    
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
    
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
    // Create wallet in database
    const walletId = 'wallet-' + Math.random().toString(36).substring(2, 11)
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
})

/**
 * Create a new transaction for a wallet
 */
export const createTransaction = action(createTransactionSchema, async ({ 
  walletId, toAddress, amount, tokenAddress, data, nonce, fee 
}) => {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
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
})

/**
 * Sign a transaction
 */
export const signTransaction = action(signTransactionSchema, async ({ 
  walletId, txId, privateKey 
}) => {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
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
})

/**
 * Broadcast a transaction to the blockchain
 */
export const broadcastTransaction = action(broadcastTransactionSchema, async ({ 
  walletId, txId 
}) => {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
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
})

/**
 * Get a list of all wallets for the current user
 */
export async function getWallets(): Promise<ActionResponse> {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
    // Query wallets from the database
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
 * Get details for a specific wallet
 */
export async function getWallet(walletId: string): Promise<ActionResponse> {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
    // Query wallet from the database
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
 * Get wallet balance
 */
export async function getWalletBalance(
  walletId: string, 
  tokenAddress?: string
): Promise<ActionResponse> {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
    // Query wallet from the database
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
 * Get wallet transactions
 */
export async function getWalletTransactions(walletId: string): Promise<ActionResponse> {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
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
export async function getTransaction(
  walletId: string, 
  txId: string
): Promise<ActionResponse> {
  try {
    // In a real application, you would get the user ID from the auth session
    const userId = 'current-user-id'
    
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
