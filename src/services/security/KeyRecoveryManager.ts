// src/services/security/KeyRecoveryManager.ts

import { KeyRecoveryService, RecoveryMethod, RecoverySetup, RecoveryShare } from './KeyRecoveryService'
import { SecureKeyService } from './SecureKeyService'
import { BlockchainAdapterFactory } from '../../core/BlockchainAdapterFactory'
import { SecureVault } from '../vault/SecureVault'

interface RecoveryManagerOptions {
  threshold?: number
  totalShares?: number
  recoveryPeriod?: number // in days
  guardians?: { name: string; email: string }[]
}

export function useKeyRecovery() {
  const recoveryService = KeyRecoveryService.getInstance()
  const secureKeyService = SecureKeyService.getInstance()
  const vault = SecureVault.getInstance()

  // Create recovery setup for a wallet
  async function setupRecovery(
    walletId: string,
    keyId: string,
    method: RecoveryMethod,
    password: string,
    options: RecoveryManagerOptions
  ) {
    if (!walletId || !keyId) return { success: false, error: 'Missing wallet or key ID' }

    try {
      // Get key material from vault
      const keyMaterial = await vault.getKey(keyId, password, { reason: 'Setting up recovery' })
      
      // Setup recovery based on method
      let recoverySetup: RecoverySetup | null = null
      
      switch (method) {
        case RecoveryMethod.SOCIAL:
          if (!options.guardians || options.guardians.length < 2)
            return { success: false, error: 'At least 2 guardians required for social recovery' }
            
          if (!options.threshold || options.threshold > options.guardians.length)
            options.threshold = Math.ceil(options.guardians.length / 2)
            
          recoverySetup = await recoveryService.setupSocialRecovery(
            walletId,
            keyMaterial,
            options.guardians,
            options.threshold,
            { blockchain: getWalletBlockchain(walletId) }
          )
          break
          
        case RecoveryMethod.TIMELOCK:
          if (!options.recoveryPeriod) options.recoveryPeriod = 30 // Default 30 days
          
          recoverySetup = await recoveryService.setupTimelockRecovery(
            walletId,
            keyMaterial,
            options.recoveryPeriod,
            { blockchain: getWalletBlockchain(walletId) }
          )
          break
          
        case RecoveryMethod.DEADMAN:
          if (!options.recoveryPeriod) options.recoveryPeriod = 90 // Default 90 days
          if (!options.guardians) options.guardians = []
          
          recoverySetup = await recoveryService.setupDeadmanSwitch(
            walletId,
            keyMaterial,
            options.recoveryPeriod,
            options.guardians,
            { blockchain: getWalletBlockchain(walletId) }
          )
          break
          
        case RecoveryMethod.BACKUP:
          recoverySetup = await recoveryService.setupBackupRecovery(
            walletId,
            keyMaterial,
            password,
            { blockchain: getWalletBlockchain(walletId) }
          )
          break
          
        default:
          return { success: false, error: 'Unsupported recovery method' }
      }
      
      // Update key metadata to show it's backed up
      await secureKeyService.updateKeyMetadata(keyId, { isBackedUp: true, recoveryId: recoverySetup.id })
      
      return { success: true, recoverySetup }
    } catch (error) {
      console.error('Failed to setup recovery:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Initiate recovery process
  async function initiateRecovery(recoveryId: string) {
    try {
      return await recoveryService.startRecovery(recoveryId)
    } catch (error) {
      console.error('Failed to initiate recovery:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Submit recovery share
  async function submitRecoveryShare(recoveryId: string, shareId: string, shareValue: string) {
    try {
      return await recoveryService.submitRecoveryShare(recoveryId, shareId, shareValue)
    } catch (error) {
      console.error('Failed to submit recovery share:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Complete recovery process
  async function completeRecovery(recoveryId: string, method: RecoveryMethod, password?: string) {
    try {
      let recoveredKey: string
      
      switch (method) {
        case RecoveryMethod.SOCIAL:
          recoveredKey = await recoveryService.completeSocialRecovery(recoveryId)
          break
          
        case RecoveryMethod.TIMELOCK:
          recoveredKey = await recoveryService.completeTimelockRecovery(recoveryId)
          break
          
        case RecoveryMethod.BACKUP:
          if (!password) return { success: false, error: 'Password required for backup recovery' }
          recoveredKey = await recoveryService.completeBackupRecovery(recoveryId, password)
          break
          
        default:
          return { success: false, error: 'Unsupported recovery method' }
      }
      
      // Get recovery setup to determine which wallet it belongs to
      const recoverySetup = recoveryService.getRecoverySetup(recoveryId)
      if (!recoverySetup) return { success: false, error: 'Recovery setup not found' }
      
      // Restore the key with a new ID
      const newKeyId = await secureKeyService.storeEncryptedKey(
        `recovered_${Date.now()}`,
        recoveredKey,
        password || 'temporary_password', // Would be set by user in real implementation
        {
          name: `Recovered Key (${new Date().toLocaleDateString()})`,
          type: 'private_key',
          storageMethod: 'encrypted',
          metadata: {
            blockchain: recoverySetup.metadata.blockchain,
            recoveredAt: new Date(),
            recoveredFrom: recoveryId,
            securityLevel: 'high',
            isBackedUp: false
          }
        }
      )
      
      return { success: true, keyId: newKeyId }
    } catch (error) {
      console.error('Failed to complete recovery:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Helper to get blockchain from wallet ID
  function getWalletBlockchain(walletId: string): string {
    // In a real implementation, you would fetch this from your wallet storage
    // For this example, we'll return a placeholder
    return 'ethereum' // Default to Ethereum
  }
  
  return {
    setupRecovery,
    initiateRecovery,
    submitRecoveryShare,
    completeRecovery,
    getRecoveries: recoveryService.getWalletRecoveries,
    getAllRecoveries: recoveryService.getAllRecoverySetups,
    generateShareInstructions: recoveryService.generateRecoveryShareInstructions,
    cancelRecovery: recoveryService.cancelRecovery
  }
}