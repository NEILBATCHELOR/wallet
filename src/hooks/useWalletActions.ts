// src/hooks/useWalletActions.ts
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import * as walletActions from '@/app/actions/wallet-actions'
import { ActionResponse } from '@/types/actions'

interface ActionState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
}

export function useWalletActions() {
  const router = useRouter()
  
  // Create wallet state
  const [createWalletState, setCreateWalletState] = useState<ActionState<any>>({
    data: null,
    isLoading: false,
    error: null
  })
  
  // Create transaction state
  const [createTransactionState, setCreateTransactionState] = useState<ActionState<any>>({
    data: null,
    isLoading: false,
    error: null
  })
  
  // Sign transaction state
  const [signTransactionState, setSignTransactionState] = useState<ActionState<any>>({
    data: null,
    isLoading: false,
    error: null
  })
  
  // Broadcast transaction state
  const [broadcastTransactionState, setBroadcastTransactionState] = useState<ActionState<any>>({
    data: null,
    isLoading: false,
    error: null
  })
  
  /**
   * Create a wallet
   */
  const createWallet = async (data: {
    name: string
    blockchain: string
    owners: string[]
    threshold: number
  }) => {
    setCreateWalletState({
      data: null,
      isLoading: true,
      error: null
    })
    
    try {
      const result = await walletActions.createWallet(data)
      
      setCreateWalletState({
        data: result.data,
        isLoading: false,
        error: result.success ? null : result.error?.message || 'Unknown error'
      })
      
      if (result.success) {
        router.refresh()
        return result.data
      }
      
      return null
    } catch (error) {
      setCreateWalletState({
        data: null,
        isLoading: false,
        error: 'Failed to create wallet'
      })
      return null
    }
  }
  
  /**
   * Create a transaction
   */
  const createTransaction = async (data: {
    walletId: string
    toAddress: string
    amount: string
    tokenAddress?: string
    data?: string
    nonce?: number
    fee?: string
  }) => {
    setCreateTransactionState({
      data: null,
      isLoading: true,
      error: null
    })
    
    try {
      const result = await walletActions.createTransaction(data)
      
      setCreateTransactionState({
        data: result.data,
        isLoading: false,
        error: result.success ? null : result.error?.message || 'Unknown error'
      })
      
      if (result.success) {
        router.refresh()
        return result.data
      }
      
      return null
    } catch (error) {
      setCreateTransactionState({
        data: null,
        isLoading: false,
        error: 'Failed to create transaction'
      })
      return null
    }
  }
  
  /**
   * Sign a transaction
   */
  const signTransaction = async (data: {
    walletId: string
    txId: string
    privateKey: string
  }) => {
    setSignTransactionState({
      data: null,
      isLoading: true,
      error: null
    })
    
    try {
      const result = await walletActions.signTransaction(data)
      
      setSignTransactionState({
        data: result.data,
        isLoading: false,
        error: result.success ? null : result.error?.message || 'Unknown error'
      })
      
      if (result.success) {
        router.refresh()
        return result.data
      }
      
      return null
    } catch (error) {
      setSignTransactionState({
        data: null,
        isLoading: false,
        error: 'Failed to sign transaction'
      })
      return null
    }
  }
  
  /**
   * Broadcast a transaction
   */
  const broadcastTransaction = async (data: {
    walletId: string
    txId: string
  }) => {
    setBroadcastTransactionState({
      data: null,
      isLoading: true,
      error: null
    })
    
    try {
      const result = await walletActions.broadcastTransaction(data)
      
      setBroadcastTransactionState({
        data: result.data,
        isLoading: false,
        error: result.success ? null : result.error?.message || 'Unknown error'
      })
      
      if (result.success) {
        router.refresh()
        return result.data
      }
      
      return null
    } catch (error) {
      setBroadcastTransactionState({
        data: null,
        isLoading: false,
        error: 'Failed to broadcast transaction'
      })
      return null
    }
  }
  
  /**
   * Fetch wallets
   */
  const fetchWallets = async (): Promise<any[] | null> => {
    try {
      const result = await walletActions.getWallets()
      return result.success ? result.data : null
    } catch (error) {
      return null
    }
  }
  
  /**
   * Fetch wallet details
   */
  const fetchWallet = async (walletId: string): Promise<any | null> => {
    try {
      const result = await walletActions.getWallet(walletId)
      return result.success ? result.data : null
    } catch (error) {
      return null
    }
  }
  
  /**
   * Fetch wallet balance
   */
  const fetchWalletBalance = async (walletId: string, tokenAddress?: string): Promise<any | null> => {
    try {
      const result = await walletActions.getWalletBalance(walletId, tokenAddress)
      return result.success ? result.data : null
    } catch (error) {
      return null
    }
  }
  
  /**
   * Fetch wallet transactions
   */
  const fetchWalletTransactions = async (walletId: string): Promise<any[] | null> => {
    try {
      const result = await walletActions.getWalletTransactions(walletId)
      return result.success ? result.data : null
    } catch (error) {
      return null
    }
  }
  
  /**
   * Fetch transaction details
   */
  const fetchTransaction = async (walletId: string, txId: string): Promise<any | null> => {
    try {
      const result = await walletActions.getTransaction(walletId, txId)
      return result.success ? result.data : null
    } catch (error) {
      return null
    }
  }
  
  return {
    // Actions with state
    createWallet,
    createWalletState,
    createTransaction,
    createTransactionState,
    signTransaction,
    signTransactionState,
    broadcastTransaction,
    broadcastTransactionState,
    
    // Simple fetch functions
    fetchWallets,
    fetchWallet,
    fetchWalletBalance,
    fetchWalletTransactions,
    fetchTransaction
  }
}
