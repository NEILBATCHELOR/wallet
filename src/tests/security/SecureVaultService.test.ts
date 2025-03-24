// src/tests/security/SecureVaultService.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SecureVaultService, VaultItem, VaultItemType, VaultPermission } from '../../services/security/SecureVaultService'
import { SecureKeyService } from '../../services/security/SecureKeyService'

// Mocks
vi.mock('../../services/security/SecureKeyService', () => {
  return {
    SecureKeyService: {
      getInstance: vi.fn().mockReturnValue({
        encryptData: vi.fn((data, password) => `encrypted:${data}`),
        decryptData: vi.fn((data, password) => {
          if (password === 'wrong-password') throw new Error('Invalid password')
          return data.replace('encrypted:', '')
        }),
      })
    }
  }
})

vi.mock('../../utils/crypto', () => {
  return {
    generateEncryptionKey: vi.fn().mockReturnValue('generated-key'),
    deriveKeyFromPassword: vi.fn().mockReturnValue('derived-key'),
    encryptWithKey: vi.fn((data, key) => `encrypted-with-key:${data}`),
    decryptWithKey: vi.fn((data, key) => {
      if (!data.startsWith('encrypted-with-key:')) throw new Error('Invalid data')
      return data.replace('encrypted-with-key:', '')
    }),
    hashPassword: vi.fn((password) => `hashed:${password}`)
  }
})

// Mock storage
const mockStorage = new Map()
vi.mock('../../utils/storage', () => {
  return {
    secureStorage: {
      setItem: vi.fn((key, value) => mockStorage.set(key, value)),
      getItem: vi.fn((key) => mockStorage.get(key)),
      removeItem: vi.fn((key) => mockStorage.delete(key))
    }
  }
})

describe('SecureVaultService', () => {
  let secureVaultService: SecureVaultService
  
  beforeEach(() => {
    mockStorage.clear()
    secureVaultService = SecureVaultService.getInstance()
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Vault initialization and management', () => {
    it('should create a new vault with password', async () => {
      const vaultName = 'Test Vault'
      const password = 'secure-password'
      
      const vault = await secureVaultService.createVault(vaultName, password)
      
      expect(vault).toBeTruthy()
      expect(vault.id).toBeTruthy()
      expect(vault.name).toBe(vaultName)
      expect(vault.items).toEqual([])
      expect(vault.createdAt).toBeInstanceOf(Date)
      
      const vaults = await secureVaultService.listVaults()
      expect(vaults).toHaveLength(1)
      expect(vaults[0].id).toBe(vault.id)
    })
    
    it('should fail when creating vault with weak password', async () => {
      const vaultName = 'Weak Password Vault'
      const weakPassword = '123'
      
      await expect(
        secureVaultService.createVault(vaultName, weakPassword)
      ).rejects.toThrow(/Password too weak/)
    })
    
    it('should open an existing vault with correct password', async () => {
      // First create a vault
      const vaultName = 'Vault to Open'
      const password = 'secure-password'
      
      const vault = await secureVaultService.createVault(vaultName, password)
      
      // Now try to open it
      const openedVault = await secureVaultService.openVault(vault.id, password)
      
      expect(openedVault).toBeTruthy()
      expect(openedVault.id).toBe(vault.id)
      expect(openedVault.name).toBe(vaultName)
    })
    
    it('should fail to open vault with incorrect password', async () => {
      // First create a vault
      const vaultName = 'Vault with Wrong Password'
      const password = 'secure-password'
      
      const vault = await secureVaultService.createVault(vaultName, password)
      
      // Try to open with wrong password
      await expect(
        secureVaultService.openVault(vault.id, 'wrong-password')
      ).rejects.toThrow(/Invalid password/)
    })
    
    it('should change vault password', async () => {
      // Create a vault
      const vaultName = 'Password Change Vault'
      const oldPassword = 'old-password'
      
      const vault = await secureVaultService.createVault(vaultName, oldPassword)
      
      // Change password
      const newPassword = 'new-secure-password'
      const changed = await secureVaultService.changeVaultPassword(
        vault.id,
        oldPassword,
        newPassword
      )
      
      expect(changed).toBe(true)
      
      // Should fail with old password
      await expect(
        secureVaultService.openVault(vault.id, oldPassword)
      ).rejects.toThrow(/Invalid password/)
      
      // Should succeed with new password
      const openedVault = await secureVaultService.openVault(vault.id, newPassword)
      expect(openedVault.id).toBe(vault.id)
    })
    
    it('should delete a vault', async () => {
      // Create a vault
      const vaultName = 'Vault to Delete'
      const password = 'secure-password'
      
      const vault = await secureVaultService.createVault(vaultName, password)
      
      // Delete the vault
      const deleted = await secureVaultService.deleteVault(vault.id, password)
      
      expect(deleted).toBe(true)
      
      // Check it's gone
      const vaults = await secureVaultService.listVaults()
      expect(vaults.find(v => v.id === vault.id)).toBeUndefined()
    })
  })
  
  describe('Vault items management', () => {
    let testVault: { id: string, name: string }
    const password = 'test-password'
    
    beforeEach(async () => {
      testVault = await secureVaultService.createVault('Item Test Vault', password)
    })
    
    it('should add private key to vault', async () => {
      const privateKeyItem: VaultItem = {
        type: VaultItemType.PRIVATE_KEY,
        name: 'Ethereum Key',
        data: {
          privateKey: '0xprivatekey1234',
          blockchain: 'ethereum',
          derivationPath: "m/44'/60'/0'/0/0"
        },
        tags: ['ethereum', 'wallet'],
        metadata: {
          address: '0x1234567890'
        }
      }
      
      const addedItem = await secureVaultService.addVaultItem(
        testVault.id,
        password,
        privateKeyItem
      )
      
      expect(addedItem).toBeTruthy()
      expect(addedItem.id).toBeTruthy()
      expect(addedItem.name).toBe(privateKeyItem.name)
      expect(addedItem.type).toBe(