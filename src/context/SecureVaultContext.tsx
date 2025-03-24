// src/context/SecureVaultContext.tsx
import { createContext, useContext, useState, useEffect, ReactNode } from "react"
import { VaultClient } from "../services/vault/VaultClient"
import { VaultStatus, VaultSecurityLevel } from "../services/vault/SecureVault"

interface SecureVaultContextType {
  vaultClient: VaultClient
  vaultStatus: VaultStatus | null
  isInitialized: boolean
  isLocked: boolean
  initializeVault: (masterPassword: string, securityLevel: VaultSecurityLevel) => Promise<boolean>
  unlockVault: (masterPassword: string, mfaCode?: string) => Promise<boolean>
  lockVault: () => Promise<boolean>
  keys: any[]
  refreshKeys: () => Promise<void>
}

const SecureVaultContext = createContext<SecureVaultContextType | undefined>(undefined)

export function SecureVaultProvider({ children }: { children: ReactNode }) {
  const [vaultClient] = useState(() => new VaultClient())
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLocked, setIsLocked] = useState(true)
  const [keys, setKeys] = useState<any[]>([])
  
  // Initialize and check vault status
  useEffect(() => {
    async function checkVaultStatus() {
      try {
        await vaultClient.waitForReady()
        const status = await vaultClient.getStatus()
        setVaultStatus(status)
        setIsInitialized(status.initialized)
        setIsLocked(status.locked)
        
        // If vault is unlocked, fetch keys
        if (status.initialized && !status.locked) {
          const vaultKeys = await vaultClient.getKeys()
          setKeys(vaultKeys)
        }
      } catch (error) {
        console.error("Error checking vault status:", error)
      }
    }
    
    checkVaultStatus()
  }, [vaultClient])
  
  // Initialize vault
  async function initializeVault(masterPassword: string, securityLevel: VaultSecurityLevel) {
    try {
      const success = await vaultClient.initialize(masterPassword, securityLevel)
      if (success) {
        const status = await vaultClient.getStatus()
        setVaultStatus(status)
        setIsInitialized(true)
        setIsLocked(true)
      }
      return success
    } catch (error) {
      console.error("Error initializing vault:", error)
      return false
    }
  }
  
  // Unlock vault
  async function unlockVault(masterPassword: string, mfaCode?: string) {
    try {
      const success = await vaultClient.unlock(masterPassword, mfaCode)
      if (success) {
        const status = await vaultClient.getStatus()
        setVaultStatus(status)
        setIsLocked(false)
        
        // Fetch keys after unlock
        const vaultKeys = await vaultClient.getKeys()
        setKeys(vaultKeys)
      }
      return success
    } catch (error) {
      console.error("Error unlocking vault:", error)
      return false
    }
  }
  
  // Lock vault
  async function lockVault() {
    try {
      const success = await vaultClient.lock()
      if (success) {
        setIsLocked(true)
        setKeys([])
      }
      return success
    } catch (error) {
      console.error("Error locking vault:", error)
      return false
    }
  }
  
  // Refresh keys
  async function refreshKeys() {
    if (!isLocked) {
      try {
        const vaultKeys = await vaultClient.getKeys()
        setKeys(vaultKeys)
      } catch (error) {
        console.error("Error refreshing keys:", error)
      }
    }
  }
  
  const value = {
    vaultClient,
    vaultStatus,
    isInitialized,
    isLocked,
    initializeVault,
    unlockVault,
    lockVault,
    keys,
    refreshKeys
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
    throw new Error("useSecureVault must be used within a SecureVaultProvider")
  }
  return context
}