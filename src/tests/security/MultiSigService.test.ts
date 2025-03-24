// src/tests/security/MultiSigService.test.ts
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MultiSigService, CreateMultiSigParams, SignatureStatus } from '../../services/wallet/MultiSigService'
import { BlockchainAdapterRegistry } from '../../services/adapter/BlockchainAdapterRegistry'
import { EthereumAdapter } from '../../services/adapter/EthereumAdapter'
import { BitcoinAdapter } from '../../services/adapter/BitcoinAdapter'
import { WalletService } from '../../services/wallet/WalletService'

// Mock blockchain adapters
vi.mock('../../services/adapter/BlockchainAdapterRegistry', () => {
  return {
    BlockchainAdapterRegistry: {
      getInstance: vi.fn().mockReturnValue({
        getAdapter: vi.fn().mockImplementation((blockchain) => {
          if (blockchain === 'ethereum') {
            return {
              createMultiSigWallet: vi.fn().mockResolvedValue({
                address: '0xmultisig1234',
                contractAddress: '0xfactory1234',
                owners: ['0xowner1', '0xowner2'],
                threshold: 2
              }),
              getMultiSigStatus: vi.fn().mockResolvedValue({
                isInitialized: true,
                threshold: 2,
                owners: ['0xowner1', '0xowner2'],
                transactionCount: 5
              }),
              proposeTransaction: vi.fn().mockResolvedValue({
                id: 'tx-1',
                nonce: 5,
                to: '0xrecipient',
                value: '1000000000000000000',
                data: '0x',
                executed: false,
                signers: []
              }),
              signTransaction: vi.fn().mockResolvedValue({
                signer: '0xowner1',
                signature: '0xsig1234',
                timestamp: Date.now()
              }),
              executeTransaction: vi.fn().mockResolvedValue({
                txHash: '0xexecuted1234',
                blockNumber: 12345
              })
            }
          } else if (blockchain === 'bitcoin') {
            return {
              createMultiSigWallet: vi.fn().mockResolvedValue({
                address: 'bc1qmultisig1234',
                redeemScript: '5221020000000000000022102111111111111152ae',
                owners: ['bc1qowner1', 'bc1qowner2'],
                threshold: 2
              }),
              getMultiSigStatus: vi.fn().mockResolvedValue({
                isInitialized: true,
                threshold: 2,
                owners: ['bc1qowner1', 'bc1qowner2'],
                unspentOutputs: [
                  { txid: 'tx1', vout: 0, value: 1000000 }
                ]
              }),
              proposeTransaction: vi.fn().mockResolvedValue({
                id: 'btctx-1',
                inputs: [{ txid: 'tx1', vout: 0, value: 1000000 }],
                outputs: [{ address: 'bc1qrecipient', value: 900000 }],
                fee: 10000,
                psbt: 'cHNidP8BAHECAAAAAZCUVyE...'
              }),
              signTransaction: vi.fn().mockResolvedValue({
                signer: 'bc1qowner1',
                signature: 'psbt-signature-data',
                timestamp: Date.now()
              }),
              executeTransaction: vi.fn().mockResolvedValue({
                txid: 'tx1234567890',
                fee: 10000
              })
            }
          }
          
          return null
        })
      })
    }
  }
})

// Mock wallet service
vi.mock('../../services/wallet/WalletService', () => {
  return {
    WalletService: {
      getInstance: vi.fn().mockReturnValue({
        getWallet: vi.fn().mockResolvedValue({
          id: 'wallet-1',
          name: 'Test Wallet',
          blockchain: 'ethereum',
          addresses: ['0xowner1'],
          keyInfo: { id: 'key-1' }
        }),
        signTransaction: vi.fn().mockResolvedValue('0xsignature1234')
      })
    }
  }
})

describe('MultiSigService', () => {
  let multiSigService: MultiSigService

  beforeEach(() => {
    multiSigService = MultiSigService.getInstance()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Creating multisig wallets', () => {
    it('should create Ethereum multisig wallet', async () => {
      const params: CreateMultiSigParams = {
        blockchain: 'ethereum',
        name: 'Test Ethereum MultiSig',
        owners: ['0xowner1', '0xowner2'],
        threshold: 2,
        ownerWalletId: 'wallet-1'
      }
      
      const multiSig = await multiSigService.createMultiSigWallet(params)
      
      expect(multiSig).toBeTruthy()
      expect(multiSig.id).toBeTruthy()
      expect(multiSig.name).toBe(params.name)
      expect(multiSig.blockchain).toBe(params.blockchain)
      expect(multiSig.address).toBe('0xmultisig1234')
      expect(multiSig.threshold).toBe(params.threshold)
      expect(multiSig.owners).toEqual(params.owners)
    })

    it('should create Bitcoin multisig wallet', async () => {
      const params: CreateMultiSigParams = {
        blockchain: 'bitcoin',
        name: 'Test Bitcoin MultiSig',
        owners: ['bc1qowner1', 'bc1qowner2'],
        threshold: 2,
        ownerWalletId: 'wallet-1'
      }
      
      const multiSig = await multiSigService.createMultiSigWallet(params)
      
      expect(multiSig).toBeTruthy()
      expect(multiSig.id).toBeTruthy()
      expect(multiSig.name).toBe(params.name)
      expect(multiSig.blockchain).toBe(params.blockchain)
      expect(multiSig.address).toBe('bc1qmultisig1234')
      expect(multiSig.threshold).toBe(params.threshold)
      expect(multiSig.owners).toEqual(params.owners)
    })

    it('should throw when threshold exceeds owner count', async () => {
      const params: CreateMultiSigParams = {
        blockchain: 'ethereum',
        name: 'Invalid Threshold MultiSig',
        owners: ['0xowner1', '0xowner2'],
        threshold: 3,
        ownerWalletId: 'wallet-1'
      }
      
      await expect(
        multiSigService.createMultiSigWallet(params)
      ).rejects.toThrow(/Threshold cannot exceed/)
    })

    it('should throw for unsupported blockchain', async () => {
      const params: CreateMultiSigParams = {
        blockchain: 'unsupported',
        name: 'Unsupported MultiSig',
        owners: ['owner1', 'owner2'],
        threshold: 2,
        ownerWalletId: 'wallet-1'
      }
      
      await expect(
        multiSigService.createMultiSigWallet(params)
      ).rejects.toThrow(/Unsupported blockchain/)
    })
  })

  describe('Transaction proposal and signing', () => {
    it('should propose Ethereum transaction', async () => {
      const multiSigId = 'ethereum-multisig-1'
      const walletId = 'wallet-1'
      const transaction = {
        to: '0xrecipient',
        value: ethers.utils.parseEther('1').toString(),
        data: '0x'
      }
      
      const txProposal = await multiSigService.proposeTransaction(
        multiSigId,
        walletId,
        transaction
      )
      
      expect(txProposal).toBeTruthy()
      expect(txProposal.id).toBeTruthy()
      expect(txProposal.multiSigId).toBe(multiSigId)
      expect(txProposal.proposer).toBe('0xowner1')
      expect(txProposal.status).toBe(SignatureStatus.PENDING)
      expect(txProposal.transaction.to).toBe(transaction.to)
      expect(txProposal.transaction.value).toBe(transaction.value)
      expect(txProposal.signatures).toHaveLength(0)
    })

    it('should propose Bitcoin transaction', async () => {
      const multiSigId = 'bitcoin-multisig-1'
      const walletId = 'wallet-1'
      const transaction = {
        outputs: [
          { address: 'bc1qrecipient', value: 900000 }
        ]
      }
      
      // Override wallet blockchain type for this test
      vi.spyOn(WalletService.getInstance(), 'getWallet').mockResolvedValueOnce({
        id: 'wallet-1',
        name: 'Test Wallet',
        blockchain: 'bitcoin',
        addresses: ['bc1qowner1'],
        keyInfo: { id: 'key-1' }
      } as any)
      
      const txProposal = await multiSigService.proposeTransaction(
        multiSigId,
        walletId,
        transaction
      )
      
      expect(txProposal).toBeTruthy()
      expect(txProposal.id).toBeTruthy()
      expect(txProposal.multiSigId).toBe(multiSigId)
      expect(txProposal.proposer).toBe('bc1qowner1')
      expect(txProposal.status).toBe(SignatureStatus.PENDING)
      expect(txProposal.transaction).toBeTruthy()
      expect(txProposal.signatures).toHaveLength(0)
    })

    it('should sign Ethereum transaction', async () => {
      const proposalId = 'eth-proposal-1'
      const walletId = 'wallet-1'
      const multiSigId = 'ethereum-multisig-1'
      
      // Setup a proposal in the service
      const proposal = {
        id: proposalId,
        multiSigId,
        proposer: '0xowner1',
        blockchain: 'ethereum',
        proposedAt: Date.now(),
        status: SignatureStatus.PENDING,
        transaction: {
          to: '0xrecipient',
          value: ethers.utils.parseEther('1').toString(),
          data: '0x'
        },
        signatures: []
      }
      
      vi.spyOn(multiSigService, 'getProposal').mockResolvedValueOnce(proposal)
      
      const signResult = await multiSigService.signTransaction(
        proposalId,
        walletId
      )
      
      expect(signResult).toBeTruthy()
      expect(signResult.success).toBe(true)
      expect(signResult.signature).toBeTruthy()
      expect(signResult.signerAddress).toBe('0xowner1')
    })

    it('should prevent signing already executed transaction', async () => {
      const proposalId = 'executed-proposal-1'
      const walletId = 'wallet-1'
      
      // Setup an already executed proposal
      const proposal = {
        id: proposalId,
        multiSigId: 'ethereum-multisig-1',
        proposer: '0xowner1',
        blockchain: 'ethereum',
        proposedAt: Date.now(),
        status: SignatureStatus.EXECUTED,
        transaction: {
          to: '0xrecipient',
          value: ethers.utils.parseEther('1').toString(),
          data: '0x'
        },
        signatures: [
          { signer: '0xowner1', signature: '0xsig1', timestamp: Date.now() },
          { signer: '0xowner2', signature: '0xsig2', timestamp: Date.now() }
        ],
        executedAt: Date.now(),
        transactionHash: '0xexecuted1234'
      }
      
      vi.spyOn(multiSigService, 'getProposal').mockResolvedValueOnce(proposal)
      
      await expect(
        multiSigService.signTransaction(proposalId, walletId)
      ).rejects.toThrow(/Transaction already executed/)
    })

    it('should execute Ethereum transaction when threshold is met', async () => {
      const proposalId = 'eth-enough-signatures-1'
      const walletId = 'wallet-1'
      const multiSigId = 'ethereum-multisig-1'
      
      // Setup a proposal with enough signatures
      const proposal = {
        id: proposalId,
        multiSigId,
        proposer: '0xowner1',
        blockchain: 'ethereum',
        proposedAt: Date.now(),
        status: SignatureStatus.PENDING,
        transaction: {
          to: '0xrecipient',
          value: ethers.utils.parseEther('1').toString(),
          data: '0x'
        },
        signatures: [
          { signer: '0xowner1', signature: '0xsig1', timestamp: Date.now() },
          { signer: '0xowner2', signature: '0xsig2', timestamp: Date.now() }
        ]
      }
      
      vi.spyOn(multiSigService, 'getProposal').mockResolvedValueOnce(proposal)
      vi.spyOn(multiSigService, 'getMultiSigWallet').mockResolvedValueOnce({
        id: multiSigId,
        blockchain: 'ethereum',
        address: '0xmultisig1234',
        threshold: 2,
        owners: ['0xowner1', '0xowner2']
      } as any)
      
      const executeResult = await multiSigService.executeTransaction(
        proposalId,
        walletId
      )
      
      expect(executeResult).toBeTruthy()
      expect(executeResult.success).toBe(true)
      expect(executeResult.transactionHash).toBe('0xexecuted1234')
    })

    it('should prevent execution when not enough signatures', async () => {
      const proposalId = 'eth-not-enough-signatures-1'
      const walletId = 'wallet-1'
      const multiSigId = 'ethereum-multisig-1'
      
      // Setup a proposal with not enough signatures
      const proposal = {
        id: proposalId,
        multiSigId,
        proposer: '0xowner1',
        blockchain: 'ethereum',
        proposedAt: Date.now(),
        status: SignatureStatus.PENDING,
        transaction: {
          to: '0xrecipient',
          value: ethers.utils.parseEther('1').toString(),
          data: '0x'
        },
        signatures: [
          { signer: '0xowner1', signature: '0xsig1', timestamp: Date.now() }
          // Only one signature, but threshold is 2
        ]
      }
      
      vi.spyOn(multiSigService, 'getProposal').mockResolvedValueOnce(proposal)
      vi.spyOn(multiSigService, 'getMultiSigWallet').mockResolvedValueOnce({
        id: multiSigId,
        blockchain: 'ethereum',
        address: '0xmultisig1234',
        threshold: 2,
        owners: ['0xowner1', '0xowner2', '0xowner3']
      } as any)
      
      await expect(
        multiSigService.executeTransaction(proposalId, walletId)
      ).rejects.toThrow(/Not enough signatures/)
    })
  })

  describe('MultiSig status checking', () => {
    it('should get Ethereum multisig status', async () => {
      const multiSigId = 'ethereum-status-1'
      
      vi.spyOn(multiSigService, 'getMultiSigWallet').mockResolvedValueOnce({
        id: multiSigId,
        blockchain: 'ethereum',
        address: '0xmultisig1234',
        threshold: 2,
        owners: ['0xowner1', '0xowner2']
      } as any)
      
      const status = await multiSigService.getMultiSigStatus(multiSigId)
      
      expect(status).toBeTruthy()
      expect(status.isInitialized).toBe(true)
      expect(status.threshold).toBe(2)
      expect(status.owners).toEqual(['0xowner1', '0xowner2'])
      expect(status.transactionCount).toBe(5)
    })

    it('should get Bitcoin multisig status', async () => {
      const multiSigId = 'bitcoin-status-1'
      
      vi.spyOn(multiSigService, 'getMultiSigWallet').mockResolvedValueOnce({
        id: multiSigId,
        blockchain: 'bitcoin',
        address: 'bc1qmultisig1234',
        threshold: 2,
        owners: ['bc1qowner1', 'bc1qowner2']
      } as any)
      
      const status = await multiSigService.getMultiSigStatus(multiSigId)
      
      expect(status).toBeTruthy()
      expect(status.isInitialized).toBe(true)
      expect(status.threshold).toBe(2)
      expect(status.owners).toEqual(['bc1qowner1', 'bc1qowner2'])
      expect(status.unspentOutputs).toBeTruthy()
      expect(status.unspentOutputs).toHaveLength(1)
    })
  })
})