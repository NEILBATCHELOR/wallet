// src/hooks/useVaultBackup.ts
import { useState, useCallback } from 'react'
import { useSecureVault } from '../context/SecureVaultContext'

export function useVaultBackup() {
  const { vaultClient } = useSecureVault()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create a backup of a key in the vault
  const createKeyBackup = useCallback(async (
    keyId: string,
    password: string,
    backupOptions: any,
    options?: any
  ) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const backup = await vaultClient.createKeyBackup(
        keyId,
        password,
        backupOptions,
        options
      )
      
      setIsLoading(false)
      return backup
    } catch (err: any) {
      setError(err.message || 'Failed to create key backup')
      setIsLoading(false)
      throw err
    }
  }, [vaultClient])

  return {
    isLoading,
    error,
    createKeyBackup
  }
}