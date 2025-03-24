// src/tests/security/HardwareWalletSecurity.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { HardwareWalletSecurity, RiskLevel, TransactionType } from '../../services/security/HardwareWalletSecurity'
import { LedgerService } from '../../services/ledger/LedgerService'
import { LedgerEthereumService } from '../../services/ledger/LedgerEthereumService'
import { LedgerBitcoinService } from '../../services/ledger/LedgerBitcoinService'
import { LedgerSolanaService } from '../../services/ledger/LedgerSolanaService'

// Mock the ledger services
vi.mock('../../services/ledger/LedgerService', () => {
  return {
    LedgerService: {
      getInstance: vi.fn().mockReturnValue({
        isConnected: vi.fn().mockReturnValue(true),
        getTransport: vi.fn().mockReturnValue({}),
        connect: vi.fn().mockResolvedValue(true),
        disconnect: vi.fn().mockResolvedValue(true)
      })
    }
  }
})

vi.mock('../../services/ledger/LedgerEthereumService', () => {
  return {
    LedgerEthereumService: {
      getInstance: vi.fn().mockReturnValue({
        getAppConfiguration: vi.fn().mockResolvedValue({ version: '1.9.12', arbitraryDataEnabled: 1 }),
        getAddress: vi.fn().mockResolvedValue('0x123456'),
        signTransaction: vi.fn().mockResolvedValue('0xsigned-transaction')
      })
    },
    ETHEREUM_DERIVATION_PATHS: ['m/44\'/60\'/0\'/0/0']
  }
})

vi.mock('../../services/ledger/LedgerBitcoinService', () => {
  return {
    LedgerBitcoinService: {
      getInstance: vi.fn().mockReturnValue({
        getAppVersion: vi.fn().mockResolvedValue('2.1.0'),
        getAddress: vi.fn().mockResolvedValue('bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'),
        signTransaction: vi.fn().mockResolvedValue('signed-bitcoin-transaction')
      })
    },
    BITCOIN_DERIVATION_PATHS: ['m/84\'/0\'/0\'/0/0']
  }
})

vi.mock('../../services/ledger/LedgerSolanaService', () => {
  return {
    LedgerSolanaService: {
      getInstance: vi.fn().mockReturnValue({
        getAppVersion: vi.fn().mockResolvedValue('1.2.3'),
        getAddress: vi.fn().mockResolvedValue('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin'),
        signTransaction: vi.fn().mockResolvedValue('signed-solana-transaction')
      })
    },
    SOLANA_DERIVATION_PATHS: ['44\'/501\'/0\'/0\'']
  }
})

describe('HardwareWalletSecurity', () => {
  let hardwareWalletSecurity: HardwareWalletSecurity

  beforeEach(() => {
    hardwareWalletSecurity = HardwareWalletSecurity.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Transaction risk analysis', () => {
    it('should analyze Ethereum transaction for simple transfers', async () => {
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: ethers.utils.parseEther('0.1').toString(),
        data: '0x',
        gasLimit: '21000',
        gasPrice: '20000000000'
      }
      
      const report = await hardwareWalletSecurity.analyzeEthereumTransaction(transaction)
      
      expect(report).toBeTruthy()
      expect(report.transactionType).toBe(TransactionType.TRANSFER)
      expect(report.riskLevel).toBe(RiskLevel.LOW)
    })

    it('should flag high risk for Ethereum token approvals with unlimited allowance', async () => {
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: '0',
        data: '0x095ea7b3000000000000000000000000a1b2c3d4e5f67890123456789abcdef0fedcba9876543210000000000000000000000000000000000000000ffffffffffffffffffffffffffffffff',
        gasLimit: '60000',
        gasPrice: '20000000000'
      }
      
      const report = await hardwareWalletSecurity.analyzeEthereumTransaction(transaction)
      
      expect(report).toBeTruthy()
      expect(report.riskLevel).toBe(RiskLevel.HIGH)
      expect(report.warnings.some(w => w.includes('UNLIMITED token approval'))).toBe(true)
    })

    it('should identify and warn about NFT permissions', async () => {
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: '0',
        data: '0xa22cb465000000000000000000000000a1b2c3d4e5f67890123456789abcdef0fedcba98000000000000000000000000000000000000000000000000000000000000001',
        gasLimit: '60000',
        gasPrice: '20000000000'
      }
      
      const report = await hardwareWalletSecurity.analyzeEthereumTransaction(transaction)
      
      expect(report).toBeTruthy()
      expect(report.riskLevel).toBe(RiskLevel.HIGH)
      expect(report.warnings.some(w => w.includes('ALL of your NFTs'))).toBe(true)
    })

    it('should analyze Bitcoin transaction and flag high fees', async () => {
      const transaction = {
        txHex: '01000000000101c84f9...',
        fee: '100000', // High fee
        outputs: [{ address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh', value: 1000000 }]
      }
      
      const report = await hardwareWalletSecurity.analyzeBitcoinTransaction(transaction)
      
      expect(report).toBeTruthy()
      expect(report.warnings.some(w => w.includes('Unusually high transaction fee'))).toBe(true)
    })

    it('should analyze Solana transaction with multiple instructions', async () => {
      const transaction = {
        instructions: [
          { programId: { toString: () => '11111111111111111111111111111111' } },
          { programId: { toString: () => 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' } },
          { programId: { toString: () => 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s' } },
          { programId: { toString: () => 'unknownProgram' } },
          { programId: { toString: () => 'anotherUnknownProgram' } }
        ],
        signatures: [{ publicKey: { equals: () => true }, signature: new Uint8Array([]) }]
      }
      
      const report = await hardwareWalletSecurity.analyzeSolanaTransaction(transaction)
      
      expect(report).toBeTruthy()
      expect(report.warnings.some(w => w.includes('contains many instructions'))).toBe(true)
      expect(report.warnings.some(w => w.includes('not recognized'))).toBe(true)
    })
  })

  describe('Hardware wallet verification', () => {
    it('should verify transaction with hardware wallet', async () => {
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: ethers.utils.parseEther('0.1').toString(),
        data: '0x',
        gasLimit: '21000',
        gasPrice: '20000000000'
      }
      
      const path = 'm/44\'/60\'/0\'/0/0'
      
      const result = await hardwareWalletSecurity.verifyTransactionWithHardware(
        'ethereum',
        transaction,
        path
      )
      
      expect(result).toBeTruthy()
      expect(result.verified).toBe(true)
      expect(result.hardwareInfo).toBeTruthy()
      expect(result.hardwareInfo.appName).toBe('Ethereum')
    })

    it('should throw error if hardware wallet not connected', async () => {
      vi.spyOn(LedgerService.getInstance(), 'isConnected').mockReturnValueOnce(false)
      
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: ethers.utils.parseEther('0.1').toString()
      }
      
      const path = 'm/44\'/60\'/0\'/0/0'
      
      await expect(
        hardwareWalletSecurity.verifyTransactionWithHardware('ethereum', transaction, path)
      ).rejects.toThrow('Hardware wallet not connected')
    })

    it('should check Ethereum contract data signing is enabled', async () => {
      vi.spyOn(LedgerEthereumService.getInstance(), 'getAppConfiguration')
        .mockResolvedValueOnce({ version: '1.9.12', arbitraryDataEnabled: 0 })
      
      const transaction = {
        to: '0x1234567890123456789012345678901234567890',
        value: '0',
        data: '0x095ea7b3...' // Contract interaction
      }
      
      const path = 'm/44\'/60\'/0\'/0/0'
      
      const result = await hardwareWalletSecurity.verifyTransactionWithHardware(
        'ethereum',
        transaction,
        path
      )
      
      expect(result).toBeTruthy()
      expect(result.report.warnings.some(w => w.includes('Contract data signing is not enabled'))).toBe(true)
      expect(result.report.riskLevel).toBe(RiskLevel.HIGH)
    })
  })

  describe('Trusted derivation paths', () => {
    it('should return the correct derivation paths for Ethereum', () => {
      const paths = hardwareWalletSecurity.getTrustedDerivationPaths('ethereum')
      expect(paths).toEqual(['m/44\'/60\'/0\'/0/0'])
    })

    it('should return the correct derivation paths for Bitcoin', () => {
      const paths = hardwareWalletSecurity.getTrustedDerivationPaths('bitcoin')
      expect(paths).toEqual(['m/84\'/0\'/0\'/0/0'])
    })

    it('should return the correct derivation paths for Solana', () => {
      const paths = hardwareWalletSecurity.getTrustedDerivationPaths('solana')
      expect(paths).toEqual(['44\'/501\'/0\'/0\''])
    })

    it('should return empty array for unsupported blockchain', () => {
      const paths = hardwareWalletSecurity.getTrustedDerivationPaths('unknown')
      expect(paths).toEqual([])
    })
  })

  describe('Dangerous contract detection', () => {
    it('should identify transactions to known dangerous contracts', async () => {
      // Add a dangerous contract
      hardwareWalletSecurity.addDangerousContract('0xbadc0de5badc0de5badc0de5badc0de5badc0de5')
      
      const transaction = {
        to: '0xbadc0de5badc0de5badc0de5badc0de5badc0de5',
        value: ethers.utils.parseEther('0.1').toString(),
        data: '0x'
      }
      
      const report = await hardwareWalletSecurity.analyzeEthereumTransaction(transaction)
      
      expect(report).toBeTruthy()
      expect(report.riskLevel).toBe(RiskLevel.CRITICAL)
      expect(report.warnings.some(w => w.includes('known malicious contract'))).toBe(true)
    })

    it('should recognize safe contracts', async () => {
      // Add a safe contract
      hardwareWalletSecurity.addSafeContract('0xsafec0de5safec0de5safec0de5safec0de5safec0', 'Trusted DEX')
      
      const transaction = {
        to: '0xsafec0de5safec0de5safec0de5safec0de5safec0',
        value: '0',
        data: '0xabcdef'
      }
      
      const report = await hardwareWalletSecurity.analyzeEthereumTransaction(transaction)
      
      expect(report).toBeTruthy()
      expect(report.details.contractName).toBe('Trusted DEX')
      expect(report.recommendations.some(r => r.includes('verified interaction'))).toBe(true)
    })
  })
})