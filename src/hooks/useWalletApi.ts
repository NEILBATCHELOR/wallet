// src/hooks/useWalletApi.ts
import { useState, useCallback } from 'react'
import { walletApi } from '@/lib/api/wallet-api'
import { ApiResponse } from '@/types/api'

interface ApiState<T = any> {
  data: T | null
  isLoading: boolean
  error: string | null
}

export function useWalletApi(userId: string) {
  const [blockchainsState, setBlockchainsState] = useState<ApiState<any[]>>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [walletsState, setWalletsState] = useState<ApiState<any[]>>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [walletState, setWalletState] = useState<ApiState>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [balanceState, setBalanceState] = useState<ApiState>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [transactionsState, setTransactionsState] = useState<ApiState<any[]>>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [transactionState, setTransactionState] = useState<ApiState>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [createWalletState, setCreateWalletState] = useState<ApiState>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [createTransactionState, setCreateTransactionState] = useState<ApiState>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [signTransactionState, setSignTransactionState] = useState<ApiState>({
    data: null,
    isLoading: false,
    error: null
  })
  
  const [broadcastTransactionState, setBroadcastTransactionState] = useState<ApiState>({
    data: null,
    isLoading: false,
    error: null
  })
  
  // Helper function to handle API responses
  const handleResponse = <T>(
    response: ApiResponse<T>,
    setState: (state: ApiState<T>) => void
  ): T | null => {
    if (response.success) {
      setState({
        data: response.data as T,
        isLoading: false,
        error: null
      })
      return response.data as T
    } else {
      setState({
        data: null,
        isLoading: false,
        error: response.error?.message || 'An error occurred'
      })
      return null
    }
  }
  
  // Get supported blockchains
  const getBlockchains = useCallback((filter?: 'mainnet' | 'testnet') => {
    setBlockchainsState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = walletApi.getSupportedBlockchains(filter)
    return handleResponse(response, setBlockchainsState)
  }, [])
  
  // Get wallets
  const getWallets = useCallback(async () => {
    setWalletsState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = await walletApi.getWallets(userId)
    return handleResponse(response, setWalletsState)
  }, [userId])
  
  // Get wallet details
  const getWallet = useCallback(async (walletId: string) => {
    setWalletState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = await walletApi.getWallet(walletId, userId)
    return handleResponse(response, setWalletState)
  }, [userId])
  
  // Get wallet balance
  const getWalletBalance = useCallback(async (walletId: string, tokenAddress?: string) => {
    setBalanceState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = await walletApi.getWalletBalance(walletId, userId, tokenAddress)
    return handleResponse(response, setBalanceState)
  }, [userId])
  
  // Get wallet transactions
  const getWalletTransactions = useCallback(async (walletId: string) => {
    setTransactionsState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = await walletApi.getWalletTransactions(walletId, userId)
    return handleResponse(response, setTransactionsState)
  }, [userId])
  
  // Get transaction details
  const getTransaction = useCallback(async (walletId: string, txId: string) => {
    setTransactionState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = await walletApi.getTransaction(walletId, txId, userId)
    return handleResponse(response, setTransactionState)
  }, [userId])
  
  // Create wallet
  const createWallet = useCallback(async (params: {
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
    
    const response = await walletApi.createWallet({
      ...params,
      userId
    })
    
    const wallet = handleResponse(response, setCreateWalletState)
    
    // Refresh wallets list if successful
    if (wallet) {
      getWallets()
    }
    
    return wallet
  }, [userId, getWallets])
  
  // Create transaction
  const createTransaction = useCallback(async (params: {
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
    
    const response = await walletApi.createTransaction({
      ...params,
      userId
    })
    
    const transaction = handleResponse(response, setCreateTransactionState)
    
    // Refresh transactions list if successful
    if (transaction && params.walletId) {
      getWalletTransactions(params.walletId)
    }
    
    return transaction
  }, [userId, getWalletTransactions])
  
  // Sign transaction
  const signTransaction = useCallback(async (params: {
    walletId: string
    txId: string
    privateKey: string
  }) => {
    setSignTransactionState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = await walletApi.signTransaction({
      ...params,
      userId
    })
    
    const result = handleResponse(response, setSignTransactionState)
    
    // Refresh transaction if successful
    if (result) {
      getTransaction(params.walletId, params.txId)
    }
    
    return result
  }, [userId, getTransaction])
  
  // Broadcast transaction
  const broadcastTransaction = useCallback(async (params: {
    walletId: string
    txId: string
  }) => {
    setBroadcastTransactionState({
      data: null,
      isLoading: true,
      error: null
    })
    
    const response = await walletApi.broadcastTransaction({
      ...params,
      userId
    })
    
    const result = handleResponse(response, setBroadcastTransactionState)
    
    // Refresh transaction if successful
    if (result) {
      getTransaction(params.walletId, params.txId)
    }
    
    return result
  }, [userId, getTransaction])
  
  // Update wallet
  const updateWallet = useCallback(async (walletId: string, name: string) => {
    const response = await walletApi.updateWallet(walletId, userId, { name })
    
    if (response.success) {
      // Refresh wallet details and wallets list
      getWallets()
      getWallet(walletId)
      return response.data
    }
    
    return null
  }, [userId, getWallets, getWallet])
  
  // Delete wallet
  const deleteWallet = useCallback(async (walletId: string) => {
    const response = await walletApi.deleteWallet(walletId, userId)
    
    if (response.success) {
      // Refresh wallets list
      getWallets()
      return true
    }
    
    return false
  }, [userId, getWallets])
  
  return {
    // States
    blockchainsState,
    walletsState,
    walletState,
    balanceState,
    transactionsState,
    transactionState,
    createWalletState,
    createTransactionState,
    signTransactionState,
    broadcastTransactionState,
    
    // Actions
    getBlockchains,
    getWallets,
    getWallet,
    getWalletBalance,
    getWalletTransactions,
    getTransaction,
    createWallet,
    updateWallet,
    deleteWallet,
    createTransaction,
    signTransaction,
    broadcastTransaction
  }
}
