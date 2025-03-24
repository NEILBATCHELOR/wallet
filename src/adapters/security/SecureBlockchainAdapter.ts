// src/adapters/security/SecureBlockchainAdapter.ts
import { BlockchainAdapter, NetworkInfo, TransactionParams, TransactionData, TransactionStatus } from '../../core/interfaces';
import { HardwareWalletSecurity, RiskLevel, TransactionSecurityReport } from '../../services/security/HardwareWalletSecurity';
import { KeyRecoveryService } from '../../services/security/KeyRecoveryService';
import { SecureKeyService } from '../../services/security/SecureKeyService';
import { SecureEnclaveService, KeyUsage } from '../../services/security/SecureEnclaveService';
import { MpcKeyService } from '../../services/security/MpcKeyService';
import { SmartContractVaultService } from '../../services/security/SmartContractVaultService';

/**
 * Security method used for transaction signing
 */
export enum SecurityMethod {
  LOCAL_PRIVATE_KEY = 'local_key',      // Regular private key (least secure)
  SECURE_ENCLAVE = 'secure_enclave',    // TEE/Secure Enclave
  HARDWARE_WALLET = 'hardware_wallet',  // Ledger/Trezor
  MULTI_PARTY = 'multi_party',          // MPC threshold signing
  SMART_CONTRACT = 'smart_contract'     // On-chain smart contract vault
}

/**
 * Security context for a transaction
 */
export interface SecurityContext {
  method: SecurityMethod;
  hardwareWalletPath?: string;
  keyId?: string;
  contractAddress?: string;
  mpcSessionId?: string;
  securityChecks?: boolean;
  riskThreshold?: RiskLevel;
  metadata?: Record<string, any>;
}

/**
 * Secure transaction result
 */
export interface SecureTransactionResult {
  success: boolean;
  txHash?: string;
  signatures?: string[];
  securityReport?: TransactionSecurityReport;
  error?: string;
}

/**
 * Decorator that wraps a blockchain adapter with enhanced security features
 */
export class SecureBlockchainAdapter implements BlockchainAdapter {
  private baseAdapter: BlockchainAdapter;
  private hwSecurity: HardwareWalletSecurity;
  private keyRecovery: KeyRecoveryService;
  private secureKey: SecureKeyService;
  private secureEnclave: SecureEnclaveService;
  private mpcService: MpcKeyService;
  private smartContractService: SmartContractVaultService;
  
  // Transaction history with security context
  private securityHistory: Map<string, {
    timestamp: Date;
    report?: TransactionSecurityReport;
    securityContext: SecurityContext;
  }> = new Map();

  constructor(baseAdapter: BlockchainAdapter) {
    this.baseAdapter = baseAdapter;
    this.hwSecurity = HardwareWalletSecurity.getInstance();
    this.keyRecovery = KeyRecoveryService.getInstance();
    this.secureKey = SecureKeyService.getInstance();
    this.secureEnclave = SecureEnclaveService.getInstance();
    this.mpcService = MpcKeyService.getInstance();
    this.smartContractService = SmartContractVaultService.getInstance();
  }

  /**
   * Get the network information from the base adapter
   */
  getNetworkInfo(): NetworkInfo {
    return this.baseAdapter.getNetworkInfo();
  }

  /**
   * Generate multisig address using the base adapter
   */
  async generateMultiSigAddress(owners: string[], threshold: number): Promise<string> {
    return await this.baseAdapter.generateMultiSigAddress(owners, threshold);
  }

  /**
   * Get balance using the base adapter
   */
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    return await this.baseAdapter.getBalance(address, tokenAddress);
  }

  /**
   * Create a transaction, but don't sign it yet
   */
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    return await this.baseAdapter.createTransaction(params);
  }

  /**
   * Secure transaction signing with enhanced security measures
   */
  async secureSignTransaction(
    transaction: TransactionData,
    securityContext: SecurityContext
  ): Promise<SecureTransactionResult> {
    try {
      // If security checks are enabled, analyze transaction for risks
      let securityReport: TransactionSecurityReport | undefined;
      
      if (securityContext.securityChecks !== false) {
        // Perform blockchain-specific security checks
        if (this.getNetworkInfo().name.toLowerCase().includes('ethereum') ||
            this.getNetworkInfo().name.toLowerCase().includes('polygon') ||
            this.getNetworkInfo().name.toLowerCase().includes('avalanche') ||
            this.getNetworkInfo().name.toLowerCase().includes('optimism') ||
            this.getNetworkInfo().name.toLowerCase().includes('arbitrum') ||
            this.getNetworkInfo().name.toLowerCase().includes('base')) {
          // Ethereum-compatible chains
          securityReport = await this.hwSecurity.analyzeEthereumTransaction(transaction.raw);
        } else if (this.getNetworkInfo().name.toLowerCase().includes('bitcoin')) {
          // Bitcoin
          securityReport = await this.hwSecurity.analyzeBitcoinTransaction(transaction.raw);
        } else if (this.getNetworkInfo().name.toLowerCase().includes('solana')) {
          // Solana
          securityReport = await this.hwSecurity.analyzeSolanaTransaction(transaction.raw);
        }
        
        // If security report indicates high risk and threshold is lower, abort
        const riskThreshold = securityContext.riskThreshold || RiskLevel.HIGH;
        
        if (securityReport && this.getRiskValue(securityReport.riskLevel) > this.getRiskValue(riskThreshold)) {
          // Transaction exceeds risk threshold
          return {
            success: false,
            securityReport,
            error: `Transaction security risk too high: ${securityReport.riskLevel}`
          };
        }
      }
      
      // Sign the transaction using the selected security method
      let signature: string;
      
      switch (securityContext.method) {
        case SecurityMethod.LOCAL_PRIVATE_KEY:
          // Verify keyId is provided
          if (!securityContext.keyId) {
            throw new Error('Key ID is required for local private key signing');
          }
          
          // Get the private key from secure storage
          const privateKey = await this.secureKey.retrieveKey(
            securityContext.keyId,
            securityContext.metadata?.password || ''
          );
          
          // Sign with base adapter
          signature = await this.baseAdapter.signTransaction(transaction, privateKey);
          break;
          
        case SecurityMethod.SECURE_ENCLAVE:
          // Verify keyId is provided
          if (!securityContext.keyId) {
            throw new Error('Key ID is required for secure enclave signing');
          }
          
          // Sign with secure enclave
          signature = await this.secureEnclave.signWithSecureKey(
            securityContext.keyId,
            JSON.stringify(transaction.raw),
            'Sign blockchain transaction'
          );
          break;
          
        case SecurityMethod.HARDWARE_WALLET:
          // Verify hardware wallet path is provided
          if (!securityContext.hardwareWalletPath) {
            throw new Error('Hardware wallet derivation path is required');
          }
          
          // Verify with hardware wallet security service
          const verificationResult = await this.hwSecurity.verifyTransactionWithHardware(
            this.getNetworkInfo().name.toLowerCase(),
            transaction.raw,
            securityContext.hardwareWalletPath
          );
          
          if (!verificationResult.verified) {
            throw new Error('Transaction verification failed on hardware wallet');
          }
          
          // Hardware wallet verification was successful, but we don't get the signature yet
          // The signature will be provided by the hardware wallet separately
          
          // For this implementation, we'll just return success
          return {
            success: true,
            securityReport: verificationResult.report,
            signatures: ['<<HARDWARE_WALLET_SIGNATURE>>'] // Placeholder
          };
          
        case SecurityMethod.MULTI_PARTY:
          // Verify MPC session ID is provided
          if (!securityContext.mpcSessionId) {
            throw new Error('MPC session ID is required for multi-party signing');
          }
          
          // Get the signing session
          const session = this.mpcService.getSession(securityContext.mpcSessionId);
          
          if (!session) {
            throw new Error(`MPC session ${securityContext.mpcSessionId} not found`);
          }
          
          // Check if the session is complete
          if (session.status !== 'completed') {
            return {
              success: false,
              error: 'MPC signing session is not complete'
            };
          }
          
          // Get the signature from the session
          signature = session.metadata.signature;
          break;
          
        case SecurityMethod.SMART_CONTRACT:
          // Verify contract address is provided
          if (!securityContext.contractAddress) {
            throw new Error('Contract address is required for smart contract signing');
          }
          
          // Verify blockchain and parameters are suitable for smart contract interaction
          const blockchain = this.getNetworkInfo().name.toLowerCase();
          
          // For smart contract vaults, we don't actually sign - we submit to the contract
          // This would generate a transaction to the smart contract vault
          
          // Get contract and submit transaction
          const contractInfo = this.smartContractService.getDeployedContracts()
            .find(c => c.contractAddress === securityContext.contractAddress);
          
          if (!contractInfo) {
            throw new Error(`Contract ${securityContext.contractAddress} not found`);
          }
          
          // This is a simplified example - in reality, this would involve creating
          // a transaction to the smart contract with the appropriate method call
          
          return {
            success: true,
            txHash: '<<SMART_CONTRACT_TRANSACTION>>', // Placeholder
            securityReport
          };
          
        default:
          throw new Error(`Unsupported security method: ${securityContext.method}`);
      }
      
      // Add signature to transaction
      const signedTx = await this.baseAdapter.combineSignatures(transaction, [signature]);
      
      // Record security context for future reference
      this.securityHistory.set(transaction.id, {
        timestamp: new Date(),
        report: securityReport,
        securityContext
      });
      
      return {
        success: true,
        signatures: [signature],
        securityReport
      };
    } catch (error) {
      console.error('Secure transaction signing failed:', error);
      return {
        success: false,
        error: error.message || 'Transaction signing failed',
        securityReport
      };
    }
  }

  /**
   * Sign a transaction using the base adapter
   * This is overridden to encourage using secureSignTransaction instead
   */
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    console.warn('Warning: Using base signTransaction method. Consider using secureSignTransaction for enhanced security.');
    return await this.baseAdapter.signTransaction(transaction, privateKey);
  }

  /**
   * Combine signatures using the base adapter
   */
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    return await this.baseAdapter.combineSignatures(transaction, signatures);
  }

  /**
   * Securely broadcast a transaction with final security checks
   */
  async secureBroadcastTransaction(
    transaction: TransactionData,
    securityContext?: SecurityContext
  ): Promise<string> {
    try {
      // If security context is provided, do one final check before broadcasting
      if (securityContext && securityContext.securityChecks !== false) {
        // Check if we have a security report for this transaction
        const historyEntry = this.securityHistory.get(transaction.id);
        
        if (historyEntry && historyEntry.report) {
          // Check risk level against threshold
          const riskThreshold = securityContext.riskThreshold || RiskLevel.HIGH;
          
          if (this.getRiskValue(historyEntry.report.riskLevel) > this.getRiskValue(riskThreshold)) {
            throw new Error(`Transaction security risk too high: ${historyEntry.report.riskLevel}`);
          }
        }
      }
      
      // Broadcast the transaction
      return await this.baseAdapter.broadcastTransaction(transaction);
    } catch (error) {
      console.error('Secure transaction broadcast failed:', error);
      throw new Error(`Failed to broadcast transaction: ${error.message}`);
    }
  }

  /**
   * Broadcast a transaction using the base adapter
   */
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    return await this.secureBroadcastTransaction(transaction);
  }

  /**
   * Validate an address using the base adapter
   */
  validateAddress(address: string): boolean {
    return this.baseAdapter.validateAddress(address);
  }

  /**
   * Get a transaction status using the base adapter
   */
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    return await this.baseAdapter.getTransactionStatus(txHash);
  }

  /**
   * Get security history for a transaction
   */
  getTransactionSecurityHistory(transactionId: string) {
    return this.securityHistory.get(transactionId);
  }

  /**
   * Convert risk level to numeric value for comparison
   */
  private getRiskValue(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case RiskLevel.LOW:
        return 1;
      case RiskLevel.MEDIUM:
        return 2;
      case RiskLevel.HIGH:
        return 3;
      case RiskLevel.CRITICAL:
        return 4;
      default:
        return 0;
    }
  }

  /**
   * Get the base adapter
   */
  getBaseAdapter(): BlockchainAdapter {
    return this.baseAdapter;
  }
}

// Update BlockchainAdapterFactory.ts to create secure adapters
// Add this to BlockchainAdapterFactory.ts

/**
 * Create a secure adapter for the given blockchain
 */
export function createSecureAdapter(blockchainId: string): SecureBlockchainAdapter {
  const baseAdapter = BlockchainAdapterFactory.getAdapter(blockchainId);
  return new SecureBlockchainAdapter(baseAdapter);
}