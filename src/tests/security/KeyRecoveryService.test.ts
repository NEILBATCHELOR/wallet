// src/tests/security/KeyRecoveryService.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { KeyRecoveryService, RecoveryMethod } from '../../services/security/KeyRecoveryService'
import { SecureKeyService } from '../../services/security/SecureKeyService'

// Mock secure-local-storage
vi.mock('react-secure-storage', () => {
  const storage = new Map()
  return {
    default: {
      setItem: vi.fn((key, value) => storage.set(key, value)),
      getItem: vi.fn((key) => storage.get(key)),
      removeItem: vi.fn((key) => storage.delete(key)),
      clear: vi.fn(() => storage.clear()),
      length: 0,
      key: vi.fn(() => null)
    }
  }
})

// Mock SecureKeyService
vi.mock('../../services/security/SecureKeyService', () => {
  return {
    SecureKeyService: {
      getInstance: vi.fn().mockReturnValue({
        encryptData: vi.fn().mockReturnValue('encrypted-data'),
        decryptData: vi.fn().mockImplementation((data, key) => {
          if (key === 'wrong-password') {
            throw new Error('Invalid password')
          }
          return 'decrypted-data'
        })
      })
    }
  }
})

// Mock crypto-js
vi.mock('crypto-js', () => {
  return {
    default: {
      AES: {
        encrypt: vi.fn().mockReturnValue({ toString: () => 'encrypted-data' }),
        decrypt: vi.fn().mockImplementation((data, key) => {
          if (key.includes('wrong')) {
            return { toString: () => '' }
          }
          return { toString: () => 'decrypted-data' }
        })
      },
      SHA256: vi.fn().mockReturnValue({ toString: () => 'hashed-data' }),
      HmacSHA256: vi.fn().mockReturnValue({ toString: () => 'hmac-data' })
    }
  }
})

// Mock uuid
vi.mock('uuid', () => {
  let counter = 0
  return {
    v4: vi.fn().mockImplementation(() => `test-uuid-${counter++}`)
  }
})

describe('KeyRecoveryService', () => {
  let keyRecoveryService: KeyRecoveryService

  beforeEach(() => {
    keyRecoveryService = KeyRecoveryService.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Social recovery', () => {
    it('should set up social recovery with guardians', async () => {
      const walletId = 'test-wallet'
      const secret = 'test-secret'
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' },
        { name: 'Guardian 2', email: 'guardian2@example.com' },
        { name: 'Guardian 3', email: 'guardian3@example.com' }
      ]
      const threshold = 2
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupSocialRecovery(
        walletId,
        secret,
        guardians,
        threshold,
        metadata
      )
      
      expect(setup).toBeTruthy()
      expect(setup.id).toBe('test-uuid-0')
      expect(setup.method).toBe(RecoveryMethod.SOCIAL)
      expect(setup.walletId).toBe(walletId)
      expect(setup.threshold).toBe(threshold)
      expect(setup.totalShares).toBe(guardians.length)
      expect(setup.guardians).toHaveLength(guardians.length)
    })

    it('should throw when guardians count is less than threshold', () => {
      const walletId = 'test-wallet'
      const secret = 'test-secret'
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' }
      ]
      const threshold = 2
      const metadata = { blockchain: 'ethereum' }
      
      expect(() => {
        keyRecoveryService.setupSocialRecovery(
          walletId,
          secret,
          guardians,
          threshold,
          metadata
        )
      }).toThrow('Number of guardians must be greater than or equal to threshold')
    })

    it('should start recovery and collect shares', async () => {
      // Set up social recovery first
      const walletId = 'recovery-test-wallet'
      const secret = 'recovery-test-secret'
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' },
        { name: 'Guardian 2', email: 'guardian2@example.com' },
        { name: 'Guardian 3', email: 'guardian3@example.com' }
      ]
      const threshold = 2
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupSocialRecovery(
        walletId,
        secret,
        guardians,
        threshold,
        metadata
      )
      
      // Start recovery
      const recovery = keyRecoveryService.startRecovery(setup.id)
      
      expect(recovery).toBeTruthy()
      expect(recovery.recoverySetup.id).toBe(setup.id)
      expect(recovery.requiredShares).toBe(threshold)
      
      // Submit a recovery share
      const shareId = setup.guardians?.[0].shareId || ''
      const submitResult = keyRecoveryService.submitRecoveryShare(
        setup.id,
        shareId,
        'share-value'
      )
      
      expect(submitResult).toBeTruthy()
      expect(submitResult.accepted).toBe(true)
      expect(submitResult.remainingShares).toBe(threshold - 1)
      expect(submitResult.recoveryComplete).toBe(false)
      
      // Submit another share to complete recovery
      const shareId2 = setup.guardians?.[1].shareId || ''
      const submitResult2 = keyRecoveryService.submitRecoveryShare(
        setup.id,
        shareId2,
        'share-value-2'
      )
      
      expect(submitResult2).toBeTruthy()
      expect(submitResult2.remainingShares).toBe(0)
      expect(submitResult2.recoveryComplete).toBe(true)
      
      // Complete recovery
      const recoveredSecret = keyRecoveryService.completeSocialRecovery(setup.id)
      
      expect(recoveredSecret).toBe('combined-secret')
    })

    it('should prevent recovery completion with insufficient shares', async () => {
      // Set up social recovery first
      const walletId = 'insufficient-shares-wallet'
      const secret = 'insufficient-shares-secret'
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' },
        { name: 'Guardian 2', email: 'guardian2@example.com' },
        { name: 'Guardian 3', email: 'guardian3@example.com' }
      ]
      const threshold = 2
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupSocialRecovery(
        walletId,
        secret,
        guardians,
        threshold,
        metadata
      )
      
      // Start recovery
      keyRecoveryService.startRecovery(setup.id)
      
      // Submit only one share
      const shareId = setup.guardians?.[0].shareId || ''
      keyRecoveryService.submitRecoveryShare(
        setup.id,
        shareId,
        'share-value'
      )
      
      // Try to complete recovery with insufficient shares
      expect(() => {
        keyRecoveryService.completeSocialRecovery(setup.id)
      }).toThrow(/Not enough shares/)
    })
  })

  describe('Timelock recovery', () => {
    it('should set up timelock recovery', async () => {
      const walletId = 'timelock-wallet'
      const secret = 'timelock-secret'
      const durationDays = 30
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupTimelockRecovery(
        walletId,
        secret,
        durationDays,
        metadata
      )
      
      expect(setup).toBeTruthy()
      expect(setup.id).toBeTruthy()
      expect(setup.method).toBe(RecoveryMethod.TIMELOCK)
      expect(setup.walletId).toBe(walletId)
      expect(setup.status).toBe('active')
      expect(setup.metadata.timelockDuration).toBe(durationDays)
    })

    it('should prevent timelock recovery before expiration', async () => {
      // Set up timelock recovery
      const walletId = 'timelock-early-wallet'
      const secret = 'timelock-early-secret'
      const durationDays = 30
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupTimelockRecovery(
        walletId,
        secret,
        durationDays,
        metadata
      )
      
      // Try to complete before expiration
      expect(() => {
        keyRecoveryService.completeTimelockRecovery(setup.id)
      }).toThrow(/Timelock has not expired/)
    })

    // Mocking Date.now is complex; this test would mock time for the expiration check
  })

  describe('Deadman switch', () => {
    it('should set up deadman switch', async () => {
      const walletId = 'deadman-wallet'
      const secret = 'deadman-secret'
      const inactivityDays = 90
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' },
        { name: 'Guardian 2', email: 'guardian2@example.com' }
      ]
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupDeadmanSwitch(
        walletId,
        secret,
        inactivityDays,
        guardians,
        metadata
      )
      
      expect(setup).toBeTruthy()
      expect(setup.id).toBeTruthy()
      expect(setup.method).toBe(RecoveryMethod.DEADMAN)
      expect(setup.walletId).toBe(walletId)
      expect(setup.status).toBe('active')
      expect(setup.metadata.inactivityPeriod).toBe(inactivityDays)
      expect(setup.guardians).toHaveLength(guardians.length)
    })

    it('should reset deadman switch timer on checkIn', async () => {
      // Set up deadman switch
      const walletId = 'checkin-wallet'
      const secret = 'checkin-secret'
      const inactivityDays = 90
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' }
      ]
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupDeadmanSwitch(
        walletId,
        secret,
        inactivityDays,
        guardians,
        metadata
      )
      
      // Mock the current time
      const originalDateNow = Date.now
      const mockedTime = 1609459200000 // 2021-01-01
      Date.now = vi.fn(() => mockedTime)
      
      // Check in to reset timer
      const checkInResult = keyRecoveryService.checkInDeadmanSwitch(setup.id)
      
      expect(checkInResult).toBeTruthy()
      expect(checkInResult.lastCheckIn).toBe(mockedTime)
      
      // Restore original Date.now
      Date.now = originalDateNow
    })

    it('should allow guardians to recover after inactivity period', async () => {
      // Set up deadman switch
      const walletId = 'inactive-wallet'
      const secret = 'inactive-secret'
      const inactivityDays = 90
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' }
      ]
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupDeadmanSwitch(
        walletId,
        secret,
        inactivityDays,
        guardians,
        metadata
      )
      
      // Mock that we've passed the inactivity period
      vi.spyOn(keyRecoveryService, 'isInactivityPeriodExceeded').mockReturnValueOnce(true)
      
      // Recover with guardian
      const guardianId = setup.guardians?.[0].id || ''
      const recoveredSecret = keyRecoveryService.completeDeadmanSwitchRecovery(
        setup.id,
        guardianId,
        'guardian-verification-code'
      )
      
      expect(recoveredSecret).toBeTruthy()
    })

    it('should prevent recovery if inactivity period not exceeded', async () => {
      // Set up deadman switch
      const walletId = 'still-active-wallet'
      const secret = 'still-active-secret'
      const inactivityDays = 90
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' }
      ]
      const metadata = { blockchain: 'ethereum' }
      
      const setup = keyRecoveryService.setupDeadmanSwitch(
        walletId,
        secret,
        inactivityDays,
        guardians,
        metadata
      )
      
      // Mock that inactivity period hasn't been exceeded
      vi.spyOn(keyRecoveryService, 'isInactivityPeriodExceeded').mockReturnValueOnce(false)
      
      // Try to recover
      const guardianId = setup.guardians?.[0].id || ''
      
      expect(() => {
        keyRecoveryService.completeDeadmanSwitchRecovery(
          setup.id,
          guardianId,
          'guardian-verification-code'
        )
      }).toThrow(/Inactivity period not exceeded/)
    })
  })