// src/context/SecureVaultContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { VaultClient } from "../services/vault/VaultClient"
import { VaultSecurityLevel } from "../services/vault/SecureVault"

interface SecureVaultContextType {
  vaultClient: VaultClient | null
  isInitialized: boolean
  isLocked: boolean
  isReady: boolean
  error: string | null
  initializeVault: (masterPassword: string, securityLevel?: VaultSecurityLevel) => Promise<boolean>
  unlockVault: (masterPassword: string, mfaCode?: string) => Promise<boolean>
  lockVault: () => Promise<boolean>
  getStatus: () => Promise<any>
}

const SecureVaultContext = createContext<SecureVaultContextType | undefined>(undefined)

interface SecureVaultProviderProps {
  children: ReactNode
  vaultClient?: VaultClient
}

export function SecureVaultProvider({ children, vaultClient: externalVaultClient }: SecureVaultProviderProps) {
  const [vaultClient, setVaultClient] = useState<VaultClient | null>(externalVaultClient || null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize the vault client if not provided externally
  useEffect(() => {
    if (externalVaultClient) {
      setVaultClient(externalVaultClient)
      setIsReady(true)
      
      // Check vault status
      externalVaultClient.getStatus()
        .then(status => {
          setIsInitialized(status.initialized)
          setIsLocked(status.locked)
        })
        .catch(err => {
          setError(err.message || 'Failed to get vault status')
        })
    }
  }, [externalVaultClient])

  // Initialize the vault with a master password
  const initializeVault = async (masterPassword: string, securityLevel?: VaultSecurityLevel) => {
    if (!vaultClient) return false
    
    try {
      setError(null)
      
      if (!isReady) {
        throw new Error('Vault worker is not ready')
      }
      
      const success = await vaultClient.initialize(masterPassword, securityLevel)
      
      if (success) {
        setIsInitialized(true)
        setIsLocked(true)
      }
      
      return success
    } catch (err: any) {
      setError(err.message || 'Failed to initialize vault')
      return false
    }
  }

  // Unlock the vault with the master password
  const unlockVault = async (masterPassword: string, mfaCode?: string) => {
    if (!vaultClient) return false
    
    try {
      setError(null)
      
      if (!isReady) {
        throw new Error('Vault worker is not ready')
      }
      
      if (!isInitialized) {
        throw new Error('Vault is not initialized')
      }
      
      const success = await vaultClient.unlock(masterPassword, mfaCode)
      
      if (success) {
        setIsLocked(false)
      }
      
      return success
    } catch (err: any) {
      setError(err.message || 'Failed to unlock vault')
      return false
    }
  }

  // Lock the vault
  const lockVault = async () => {
    if (!vaultClient) return false
    
    try {
      setError(null)
      
      if (!isReady) {
        throw new Error('Vault worker is not ready')
      }
      
      const success = await vaultClient.lock()
      
      if (success) {
        setIsLocked(true)
      }
      
      return success
    } catch (err: any) {
      setError(err.message || 'Failed to lock vault')
      return false
    }
  }

  // Get the vault status
  const getStatus = async () => {
    if (!vaultClient) throw new Error('Vault client not available')
    
    try {
      if (!isReady) {
        throw new Error('Vault worker is not ready')
      }
      
      return await vaultClient.getStatus()
    } catch (err: any) {
      setError(err.message || 'Failed to get vault status')
      throw err
    }
  }

  const value = {
    vaultClient,
    isInitialized,
    isLocked,
    isReady,
    error,
    initializeVault,
    unlockVault,
    lockVault,
    getStatus
  }

  return (
    <SecureVaultContext.Provider value={value}>
      {children}
    </SecureVaultContext.Provider>
  )
}

export function useSecureVault() {
  const context = useContext(SecureVaultContext)
  
  if (context === undefined) {
    throw new Error('useSecureVault must be used within a SecureVaultProvider')
  }
  
  return context
}