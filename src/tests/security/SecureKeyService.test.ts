// src/tests/security/SecureKeyService.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SecureKeyService, SecurityLevel, KeyType, StorageMethod } from '../../services/security/SecureKeyService'

// Mock crypto module
vi.mock('crypto-js', () => {
  return {
    default: {
      AES: {
        encrypt: vi.fn().mockReturnValue({ toString: () => 'encrypted-data' }),
        decrypt: vi.fn().mockImplementation((data, key) => {
          if (key === 'wrong-password') {
            return { toString: () => '' }
          }
          return { toString: () => 'decrypted-data' }
        })
      },
      SHA256: vi.fn().mockReturnValue({ toString: () => 'hashed-data' }),
      PBKDF2: vi.fn().mockReturnValue({ toString: () => 'derived-key' }),
      lib: {
        WordArray: {
          random: vi.fn().mockReturnValue({ toString: () => 'random-data' })
        }
      }
    }
  }
})

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

// Mock shamir's secret sharing
vi.mock('shamir', () => {
  return {
    split: vi.fn().mockReturnValue([Buffer.from('share1'), Buffer.from('share2')]),
    combine: vi.fn().mockReturnValue(Buffer.from('combined-secret'))
  }
})

describe('SecureKeyService', () => {
  let secureKeyService: SecureKeyService

  beforeEach(() => {
    secureKeyService = SecureKeyService.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Key generation and encryption', () => {
    it('should generate a secure mnemonic phrase', () => {
      const mnemonic = secureKeyService.generateMnemonic()
      expect(mnemonic).toBeTruthy()
    })

    it('should encrypt data with a password', () => {
      const encrypted = secureKeyService.encryptData('test-data', 'password')
      expect(encrypted).toBe('encrypted-data')
    })

    it('should decrypt data with correct password', () => {
      const decrypted = secureKeyService.decryptData('encrypted-data', 'password')
      expect(decrypted).toBe('decrypted-data')
    })

    it('should throw when decrypting with wrong password', () => {
      expect(() => {
        secureKeyService.decryptData('encrypted-data', 'wrong-password')
      }).toThrow('Invalid password or corrupted data')
    })
  })

  describe('Key storage and retrieval', () => {
    it('should store and retrieve a key', () => {
      const keyInfo = secureKeyService.storeEncryptedKey(
        'test-id',
        'test-key',
        'password',
        {
          name: 'Test Key',
          type: KeyType.MNEMONIC,
          storageMethod: StorageMethod.ENCRYPTED,
          createdAt: new Date(),
          metadata: {
            blockchain: 'ethereum',
            securityLevel: SecurityLevel.HIGH,
            isBackedUp: false
          }
        }
      )

      expect(keyInfo).toBeTruthy()
      expect(keyInfo.id).toBe('test-id')
      expect(keyInfo.name).toBe('Test Key')

      const retrievedKey = secureKeyService.retrieveKey('test-id', 'password')
      expect(retrievedKey).toBe('decrypted-data')
    })

    it('should throw when retrieving non-existent key', () => {
      expect(() => {
        secureKeyService.retrieveKey('non-existent-id', 'password')
      }).toThrow('Key not found')
    })

    it('should delete a key', () => {
      secureKeyService.storeEncryptedKey(
        'delete-test-id',
        'test-key',
        'password',
        {
          name: 'Delete Test Key',
          type: KeyType.MNEMONIC,
          storageMethod: StorageMethod.ENCRYPTED,
          createdAt: new Date(),
          metadata: {
            blockchain: 'ethereum',
            securityLevel: SecurityLevel.HIGH,
            isBackedUp: false
          }
        }
      )

      const deleted = secureKeyService.deleteKey('delete-test-id')
      expect(deleted).toBe(true)

      expect(() => {
        secureKeyService.retrieveKey('delete-test-id', 'password')
      }).toThrow('Key not found')
    })
  })

  describe('Secret sharing', () => {
    it('should split a secret into shares', () => {
      const shares = secureKeyService.splitSecret('test-secret', 3, 2)
      expect(shares).toHaveLength(3)
      expect(shares[0]).toBeTruthy()
    })

    it('should combine shares to recover a secret', () => {
      const shares = ['share1', 'share2']
      const secret = secureKeyService.combineShares(shares)
      expect(secret).toBe('combined-secret')
    })

    it('should throw when trying to split with invalid parameters', () => {
      expect(() => {
        secureKeyService.splitSecret('test-secret', 1, 2)
      }).toThrow('Total shares must be greater than or equal to required shares')
    })
  })

  describe('Password security', () => {
    it('should validate password strength', () => {
      const weakResult = secureKeyService.checkPasswordStrength('123')
      expect(weakResult.score).toBeLessThan(50)
      
      const strongResult = secureKeyService.checkPasswordStrength('Complex!Password123')
      expect(strongResult.score).toBeGreaterThan(70)
    })

    it('should generate a secure passphrase', () => {
      const passphrase = secureKeyService.generateSecurePassphrase(32)
      expect(passphrase.length).toBe(32)
    })
  })
})