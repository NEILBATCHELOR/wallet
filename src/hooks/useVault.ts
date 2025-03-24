// src/hooks/useVault.ts
import { useState, useEffect } from 'react'
import { VaultClient } from '@/services/vault/VaultClient'
import { VaultStatus, VaultSecurityLevel } from '@/services/vault/SecureVault'

export function useVault() {
  const [status, setStatus] = useState<VaultStatus | null>(null)
  const [keys, setKeys] = useState<any[]>([])
  const [auditLog, setAuditLog] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInitializing, setIsInitializing] = useState(false)
  
  // Create a vault client instance
  const vaultClient = new VaultClient()
  
  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true)
        setError(null)
        
        // Wait for vault client to be ready
        await vaultClient.waitForReady()
        
        // Get vault status
        const vaultStatus = await vaultClient.getStatus()
        setStatus(vaultStatus)
        
        // If vault is unlocked, load keys and audit log
        if (vaultStatus && !vaultStatus.locked) {
          const vaultKeys = await vaultClient.getKeys()
          const vaultAuditLog = await vaultClient.getAuditLog(100)
          
          setKeys(vaultKeys)
          setAuditLog(vaultAuditLog)
        }
        
        setIsLoading(false)
      } catch (err: any) {
        setError(err.message)
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [])
  
  // Initialize the vault
  async function initialize(masterPassword: string, securityLevel: VaultSecurityLevel) {
    try {
      setIsInitializing(true)
      setError(null)
      
      // Validate password
      if (masterPassword.length < 8) {
        throw new Error('Master password must be at least 8 characters long')
      }
      
      // Initialize vault
      const success = await vaultClient.initialize(masterPassword, securityLevel)
      
      if (!success) {
        throw new Error('Failed to initialize vault')
      }
      
      // Update status
      const vaultStatus = await vaultClient.getStatus()
      setStatus(vaultStatus)
      
      setIsInitializing(false)
    } catch (err: any) {
      setError(err.message)
      setIsInitializing(false)
    }
  }
  
  // Unlock the vault
  async function unlock(masterPassword: string, mfaCode?: string) {
    try {
      setIsLoading(true)
      setError(null)
      
      // Unlock vault
      const success = await vaultClient.unlock(masterPassword, mfaCode)
      
      if (!success) {
        throw new Error('Failed to unlock vault')
      }
      
      // Update status
      const vaultStatus = await vaultClient.getStatus()
      setStatus(vaultStatus)
      
      // Load keys and audit log
      if (vaultStatus && !vaultStatus.locked) {
        const vaultKeys = await vaultClient.getKeys()
        const vaultAuditLog = await vaultClient.getAuditLog(100)
        
        setKeys(vaultKeys)
        setAuditLog(vaultAuditLog)
      }
      
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }
  
  // Lock the vault
  async function lock() {
    try {
      setIsLoading(true)
      setError(null)
      
      // Lock vault
      await vaultClient.lock()
      
      // Update status
      const vaultStatus = await vaultClient.getStatus()
      setStatus(vaultStatus)
      
      // Clear keys and audit log
      setKeys([])
      setAuditLog([])
      
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
    }
  }
  
  return {
    status,
    keys,
    auditLog,
    isLoading,
    error,
    initialize,
    unlock,
    lock,
    isInitializing
  }
}