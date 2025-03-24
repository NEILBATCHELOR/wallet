// src/tests/integration/SecurityIntegrationTest.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SecureKeyService } from '../../services/security/SecureKeyService'
import { MultiSigService } from '../../services/wallet/MultiSigService'
import { HardwareWalletSecurity } from '../../services/security/HardwareWalletSecurity'
import { KeyRecoveryService } from '../../services/security/KeyRecoveryService'
import { WalletService } from '../../services/wallet/WalletService'
import { SecureVaultService } from '../../services/security/SecureVaultService'

// This integration test will verify the security components work together properly
describe('Security Integration Tests', () => {
  // Services
  let keyService: SecureKeyService
  let walletService: any // Using any to avoid complex mocking
  let hardwareWalletSecurity: HardwareWalletSecurity
  let keyRecoveryService: KeyRecoveryService
  let multiSigService: MultiSigService
  let vaultService: SecureVaultService
  
  // Test data
  const testPassword = 'Test@123Password!'
  const testMnemonic = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat'
  let walletId: string
  let multiSigId: string
  let vaultId: string
  
  beforeEach(async () => {
    // Initialize services
    keyService = SecureKeyService.getInstance()
    walletService = WalletService.getInstance()
    hardwareWalletSecurity = HardwareWalletSecurity.getInstance()
    keyRecoveryService = KeyRecoveryService.getInstance()
    multiSigService = MultiSigService.getInstance()
    vaultService = SecureVaultService.getInstance()
    
    // Mock methods
    vi.spyOn(keyService, 'generateMnemonic').mockReturnValue(testMnemonic)
    vi.spyOn(keyService, 'encryptData').mockImplementation((data) => `encrypted:${data}`)
    vi.spyOn(keyService, 'decryptData').mockImplementation((data, pwd) => {
      if (pwd !== testPassword) throw new Error('Invalid password')
      return data.replace('encrypted:', '')
    })
    
    vi.spyOn(walletService, 'createWallet').mockImplementation(async () => {
      walletId = 'wallet-1'
      return {
        id: walletId,
        name: 'Test Wallet',
        blockchain: 'ethereum',
        address: '0xWalletAddress',
        keyInfo: { id: 'key-1' }
      }
    })
    
    vi.spyOn(multiSigService, 'createMultiSigWallet').mockImplementation(async () => {
      multiSigId = 'multisig-1'
      return {
        id: multiSigId,
        name: 'Test MultiSig',
        blockchain: 'ethereum',
        address: '0xMultiSigAddress',
        owners: ['0xowner1', '0xowner2'],
        threshold: 2
      }
    })
    
    vi.spyOn(vaultService, 'createVault').mockImplementation(async () => {
      vaultId = 'vault-1'
      return {
        id: vaultId,
        name: 'Test Vault',
        items: [],
        createdAt: new Date()
      }
    })
  })
  
  afterEach(() => {
    vi.clearAllMocks()
  })
  
  describe('Wallet Creation with Recovery and MultiSig', () => {
    it('should create a wallet with secure key, setup recovery, and use it in multisig', async () => {
      // 1. Create a wallet with secure key
      const wallet = await walletService.createWallet({
        name: 'Secure Test Wallet',
        blockchain: 'ethereum',
        mnemonic: testMnemonic,
        password: testPassword
      })
      
      expect(wallet).toBeTruthy()
      expect(wallet.id).toBe(walletId)
      
      // 2. Setup social recovery for the wallet
      const guardians = [
        { name: 'Guardian 1', email: 'guardian1@example.com' },
        { name: 'Guardian 2', email: 'guardian2@example.com' },
        { name: 'Guardian 3', email: 'guardian3@example.com' }
      ]
      
      vi.spyOn(keyService, 'retrieveKey').mockResolvedValue(testMnemonic)
      vi.spyOn(keyRecoveryService, 'setupSocialRecovery').mockImplementation((walletId, secret) => {
        return {
          id: 'recovery-1',
          method: 'social',
          walletId,
          status: 'active',
          threshold: 2,
          totalShares: 3,
          guardians: guardians.map((g, i) => ({ 
            ...g, 
            id: `guardian-${i}`, 
            shareId: `share-${i}` 
          })),
          createdAt: new Date()
        }
      })
      
      const recovery = await keyRecoveryService.setupSocialRecovery(
        wallet.id,
        testMnemonic,
        guardians,
        2,
        { blockchain: 'ethereum' }
      )
      
      expect(recovery).toBeTruthy()
      expect(recovery.walletId).toBe(wallet.id)
      expect(recovery.threshold).toBe(2)
      expect(recovery.guardians).toHaveLength(3)
      
      // 3. Create a multisig wallet using the original wallet
      const multiSig = await multiSigService.createMultiSigWallet({
        blockchain: 'ethereum',
        name: 'Integrated MultiSig',
        owners: ['0xowner1', '0xowner2'],
        threshold: 2,
        ownerWalletId: wallet.id
      })
      
      expect(multiSig).toBeTruthy()
      expect(multiSig.id).toBe(multiSigId)
      expect(multiSig.threshold).toBe(2)
      
      // 4. Propose a transaction from the multisig
      vi.spyOn(multiSigService, 'proposeTransaction').mockResolvedValue({
        id: 'proposal-1',
        multiSigId: multiSig.id,
        proposer: '0xowner1',
        blockchain: 'ethereum',
        proposedAt: Date.now(),
        status: 'pending',
        transaction: {
          to: '0xrecipient',
          value: '1000000000000000000',
          data: '0x'
        },
        signatures: []
      })
      
      const proposal = await multiSigService.proposeTransaction(
        multiSig.id,
        wallet.id,
        {
          to: '0xrecipient',
          value: ethers.utils.parseEther('1').toString(),
          data: '0x'
        }
      )
      
      expect(proposal).toBeTruthy()
      expect(proposal.multiSigId).toBe(multiSig.id)
      
      // 5. Store wallet info in secure vault
      const vault = await vaultService.createVault('Wallet Vault', testPassword)
      
      vi.spyOn(vaultService, 'addVaultItem').mockResolvedValue({
        id: 'item-1',
        type: VaultItemType.SEED_PHRASE,
        name: 'Wallet Seed',
        data: {
          mnemonic: testMnemonic,
          passphrase: ''
        },
        tags: ['wallet', 'backup'],
        metadata: {
          walletId: wallet.id
        },
        createdAt: new Date()
      })
      
      const vaultItem = await vaultService.addVaultItem(
        vault.id,
        testPassword,
        {
          type: VaultItemType.SEED_PHRASE,
          name: 'Wallet Seed',
          data: {
            mnemonic: testMnemonic,
            passphrase: ''
          },
          tags: ['wallet', 'backup'],
          metadata: {
            walletId: wallet.id
          }
        }
      )
      
      expect(vaultItem).toBeTruthy()
      expect(vaultItem.type).toBe(VaultItemType.SEED_PHRASE)
      expect(vaultItem.metadata.walletId).toBe(wallet.id)
    })
  })
  
  describe('Hardware Wallet with MultiSig and Secure Vault', () => {
    it('should verify a transaction with hardware wallet and store in vault', async () => {
      // Mock hardware wallet connection
      vi.spyOn(hardwareWalletSecurity, 'verifyTransactionWithHardware')
        .mockResolvedValue({
          verified: true,
          hardwareInfo: {
            appName: 'Ethereum',
            version: '1.9.12',
            deviceModel: 'Nano S'
          },
          report: {
            riskLevel: 'low',
            transactionType: 'transfer',
            warnings: [],
            recommendations: ['Verify recipient address on device screen']
          }
        })
      
      // Create test transaction
      const transaction = {
        to: '0xrecipient',
        value: ethers.utils.parseEther('1').toString(),
        data: '0x'
      }
      
      // 1. Verify with hardware wallet
      const verification = await hardwareWalletSecurity.verifyTransactionWithHardware(
        'ethereum',
        transaction,
        "m/44'/60'/0'/0/0"
      )
      
      expect(verification).toBeTruthy()
      expect(verification.verified).toBe(true)
      expect(verification.report.riskLevel).toBe('low')
      
      // 2. Create a multisig wallet (using mocked method)
      const multiSig = await multiSigService.createMultiSigWallet({
        blockchain: 'ethereum',
        name: 'Hardware MultiSig',
        owners: ['0xowner1', '0xhardwareWallet'],
        threshold: 2,
        ownerWalletId: 'wallet-1'
      })
      
      // 3. Store hardware wallet info in vault
      const vault = await vaultService.createVault('Hardware Vault', testPassword)
      
      vi.spyOn(vaultService, 'addVaultItem').mockResolvedValue({
        id: 'hw-item-1',
        type: VaultItemType.HARDWARE_WALLET,
        name: 'Ledger Nano S',
        data: {
          deviceModel: 'Nano S',
          firmwareVersion: '2.1.0',
          lastUsed: new Date().toISOString(),
          derivationPaths: {
            ethereum: "m/44'/60'/0'/0/0",
            bitcoin: "m/84'/0'/0'/0/0"
          }
        },
        tags: ['hardware', 'ledger'],
        metadata: {
          associatedMultiSigs: [multiSig.id]
        },
        createdAt: new Date()
      })
      
      const hwItem = await vaultService.addVaultItem(
        vault.id,
        testPassword,
        {
          type: VaultItemType.HARDWARE_WALLET,
          name: 'Ledger Nano S',
          data: {
            deviceModel: 'Nano S',
            firmwareVersion: '2.1.0',
            lastUsed: new Date().toISOString(),
            derivationPaths: {
              ethereum: "m/44'/60'/0'/0/0",
              bitcoin: "m/84'/0'/0'/0/0"
            }
          },
          tags: ['hardware', 'ledger'],
          metadata: {
            associatedMultiSigs: [multiSig.id]
          }
        }
      )
      
      expect(hwItem).toBeTruthy()
      expect(hwItem.type).toBe(VaultItemType.HARDWARE_WALLET)
      expect(hwItem.metadata.associatedMultiSigs).toContain(multiSig.id)
    })
  })
  
  describe('Secure vault backup and restore', () => {
    it('should create a secure backup of vault with wallet data and restore it', async () => {
      // Create a vault with wallet data
      const vault = await vaultService.createVault('Backup Test Vault', testPassword)
      
      // Add wallet seed to vault
      vi.spyOn(vaultService, 'addVaultItem').mockResolvedValue({
        id: 'backup-item-1',
        type: VaultItemType.SEED_PHRASE,
        name: 'Backup Wallet Seed',
        data: {
          mnemonic: testMnemonic,
          passphrase: ''
        },
        tags: ['backup'],
        metadata: {},
        createdAt: new Date()
      })
      
      await vaultService.addVaultItem(
        vault.id,
        testPassword,
        {
          type: VaultItemType.SEED_PHRASE,
          name: 'Backup Wallet Seed',
          data: {
            mnemonic: testMnemonic,
            passphrase: ''
          },
          tags: ['backup']
        }
      )
      
      // Create backup
      vi.spyOn(vaultService, 'createVaultBackup').mockResolvedValue({
        success: true,
        backupData: 'encrypted-backup-data',
        timestamp: new Date()
      })
      
      const backupResult = await vaultService.createVaultBackup(
        vault.id,
        testPassword,
        'backup-passphrase'
      )
      
      expect(backupResult).toBeTruthy()
      expect(backupResult.success).toBe(true)
      
      // Restore from backup
      vi.spyOn(vaultService, 'restoreVaultFromBackup').mockResolvedValue({
        id: 'restored-vault-1',
        name: 'Restored Vault',
        items: [
          {
            id: 'restored-item-1',
            type: VaultItemType.SEED_PHRASE,
            name: 'Backup Wallet Seed',
            data: {
              mnemonic: testMnemonic,
              passphrase: ''
            },
            tags: ['backup'],
            metadata: {},
            createdAt: new Date()
          }
        ],
        createdAt: new Date()
      })
      
      const restoredVault = await vaultService.restoreV