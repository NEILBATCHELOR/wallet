// src/hooks/useSecureTransactionSigning.ts
import { useState, useCallback } from 'react'
import { useSecureVault } from '../context/SecureVaultContext'
import { TransactionData } from '../core/interfaces'
import { SecurityMethod, SecurityContext } from '../adapters/security/SecureBlockchainAdapter'

export function useSecureTransactionSigning() {
  const { vaultClient } = useSecureVault()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sign a transaction securely
  const signTransaction = useCallback(async (
    transaction: TransactionData,
    keyId: string,
    password: string,
    securityMethod: SecurityMethod = SecurityMethod.LOCAL_PRIVATE_KEY,
    options?: any
  ) => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Create security context
      const securityContext: SecurityContext = {
        method: securityMethod,
        keyId,
        securityChecks: true,
        ...options
      }
      
      // For hardware wallet, hardware path is required
      if (securityMethod === SecurityMethod.HARDWARE_WALLET && !securityContext.hardwareWalletPath) {
        throw new Error('Hardware wallet path is required for hardware wallet signing')
      }
      
      // Convert transaction to string for vault signing
      const txData = JSON.stringify(transaction)
      
      // Sign with key in vault
      const signature = await vaultClient.signWithKey(
        keyId,
        txData,
        password,
        {
          reason: 'Transaction signing',
          metadata: {
            securityContext
          }
        }
      )
      
      setIsLoading(false)
      return signature
    } catch (err: any) {
      setError(err.message || 'Failed to sign transaction')
      setIsLoading(false)
      throw err
    }
  }, [vaultClient])

  return {
    isLoading,
    error,
    signTransaction
  }
}