// src/hooks/useRecoverySetup.ts
import { useState } from 'react'
import { KeyRecoveryService, RecoveryMethod } from '@/services/security/KeyRecoveryService'

export interface Guardian {
  name: string
  email: string
}

interface UseRecoverySetupProps {
  walletId: string
  secretPhrase: string
  blockchain: string
}

interface RecoveryOptions {
  method: RecoveryMethod
  threshold?: number
  guardians?: Guardian[]
  timelockDays?: number
  deadmanDays?: number
  backupPassword?: string
}

export function useRecoverySetup({
  walletId,
  secretPhrase,
  blockchain
}: UseRecoverySetupProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Recovery service instance
  const recoveryService = KeyRecoveryService.getInstance()
  
  async function setupRecovery(options: RecoveryOptions) {
    try {
      setIsLoading(true)
      setError(null)
      
      let result
      
      // Setup recovery based on method
      switch (options.method) {
        case RecoveryMethod.SOCIAL: {
          // Validate guardians
          if (!options.guardians || !options.threshold) {
            throw new Error('Guardians and threshold are required for social recovery')
          }
          
          const validGuardians = options.guardians.filter(g => g.name && g.email)
          
          if (validGuardians.length < options.threshold) {
            throw new Error(`At least ${options.threshold} valid guardians required`)
          }
          
          // Setup social recovery
          result = await recoveryService.setupSocialRecovery(
            walletId,
            secretPhrase,
            validGuardians,
            options.threshold,
            { blockchain }
          )
          break
        }
        
        case RecoveryMethod.TIMELOCK: {
          // Validate timelock days
          if (!options.timelockDays || options.timelockDays < 1) {
            throw new Error('Timelock period must be at least 1 day')
          }
          
          // Setup timelock recovery
          result = await recoveryService.setupTimelockRecovery(
            walletId,
            secretPhrase,
            options.timelockDays,
            { blockchain }
          )
          break
        }
        
        case RecoveryMethod.DEADMAN: {
          // Validate deadman switch days
          if (!options.deadmanDays || options.deadmanDays < 30) {
            throw new Error('Dead man switch period must be at least 30 days')
          }
          
          // Validate guardians
          if (!options.guardians) {
            throw new Error('Guardians are required for deadman switch')
          }
          
          const validGuardians = options.guardians.filter(g => g.name && g.email)
          
          if (validGuardians.length === 0) {
            throw new Error('At least one guardian required')
          }
          
          // Setup deadman switch
          result = await recoveryService.setupDeadmanSwitch(
            walletId,
            secretPhrase,
            options.deadmanDays,
            validGuardians,
            { blockchain }
          )
          break
        }
        
        case RecoveryMethod.BACKUP: {
          // Validate password
          if (!options.backupPassword) {
            throw new Error('Password is required')
          }
          
          // Setup backup recovery
          result = await recoveryService.setupBackupRecovery(
            walletId,
            secretPhrase,
            options.backupPassword,
            { blockchain }
          )
          break
        }
        
        default:
          throw new Error('Please select a recovery method')
      }
      
      setIsLoading(false)
      return result
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
      throw err
    }
  }
  
  return {
    setupRecovery,
    isLoading,
    error
  }
}