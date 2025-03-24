// src/hooks/useVaultKeys.ts
import { useState, useCallback } from 'react'
import { useSecureVault } from '../context/SecureVaultContext'

export function useVaultKeys() {
  const { vaultClient, isLocked } = useSecureVault()
  const [keys, setKeys] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load keys from the vault
  const loadKeys = useCallback(async () => {
    if (isLocked) {
      setKeys([])
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      const vaultKeys = await vaultClient.getKeys()
      setKeys(vaultKeys)
      
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to load keys')
      setIsLoading(false)
    }
  }, [vaultClient, isLocked])

  // Create a new key in the vault
  const createKey = useCallback(async (
    name: string,
    keyType: string,
    blockchain: string,
    keyMaterial: string,
    password: string,
    policy?: any,
    options?: any
  ) => {
    try {
      setError(null)
      
      const key = await vaultClient.createKey(
        name,
        keyType,
        blockchain,
        keyMaterial,
        password,
        policy,
        options
      )
      
      // Refresh keys after creation
      await loadKeys()
      
      return key
    } catch (err: any) {
      setError(err.message || 'Failed to create key')
      throw err
    }
  }, [vaultClient, loadKeys])

  // Sign data with a key in the vault
  const signWithKey = useCallback(async (
    keyId: string,
    data: string | Uint8Array,
    password: string,
    options?: any
  ) => {
    try {
      setError(null)
      
      return await vaultClient.signWithKey(keyId, data, password, options)
    } catch (err: any) {
      setError(err.message || 'Failed to sign with key')
      throw err
    }
  }, [vaultClient])

  // Delete a key from the vault
  const deleteKey = useCallback(async (
    keyId: string,
    password: string,
    options?: any
  ) => {
    try {
      setError(null)
      
      const success = await vaultClient.deleteKey(keyId, password, options)
      
      if (success) {
        // Refresh keys after deletion
        await loadKeys()
      }
      
      return success
    } catch (err: any) {
      setError(err.message || 'Failed to delete key')
      throw err
    }
  }, [vaultClient, loadKeys])

  return {
    keys,
    isLoading,
    error,
    loadKeys,
    createKey,
    signWithKey,
    deleteKey
  }
}