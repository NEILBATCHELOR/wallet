// src/services/security/VaultBlockchainIntegration.ts

import { SecureVault, VaultKeyEntry, VaultSecurityLevel } from '../vault/SecureVault'
import { SecureBlockchainAdapter, SecurityMethod } from '../../adapters/security/SecureBlockchainAdapter'
import { BlockchainAdapterFactory } from '../../core/BlockchainAdapterFactory'
import { SecureEnclaveService } from './SecureEnclaveService'
import { HardwareWalletSecurity, RiskLevel } from './HardwareWalletSecurity'

interface SignOptions {
  securityLevel?: VaultSecurityLevel
  requireBiometrics?: boolean
  riskThreshold?: RiskLevel
}

export function useVaultBlockchainIntegration() {
  const vault = SecureVault.getInstance()
  const secureEnclave = SecureEnclaveService.getInstance()
  const hwSecurity = HardwareWalletSecurity.getInstance()
  
  // Sign transaction using vault key
  async function signTransaction(
    keyId: string,
    blockchain: string,
    transaction: any,
    password: string,
    options: SignOptions = {}
  ) {
    if (!keyId || !blockchain || !transaction)
      return { success: false, error: 'Missing required parameters' }
      
    try {
      // Get vault key entry
      const keys = vault.getKeys()
      const keyEntry = keys.find(k => k.id === keyId)
      if (!keyEntry) return { success: false, error: 'Key not found' }
      
      // Determine security method based on key metadata
      const securityMethod = determineSecurityMethod(keyEntry)
      
      // Get secure blockchain adapter
      const adapter = BlockchainAdapterFactory.createSecureAdapter(blockchain)
      
      // Create security context
      const securityContext = {
        method: securityMethod,
        keyId,
        securityChecks: true,
        riskThreshold: options.riskThreshold || RiskLevel.HIGH
      }
      
      // If using hardware wallet, add derivation path
      if (securityMethod === SecurityMethod.HARDWARE_WALLET && keyEntry.metadata.derivationPath) {
        securityContext.hardwareWalletPath = keyEntry.metadata.derivationPath
      }
      
      // If biometrics are required, verify first
      if (options.requireBiometrics && secureEnclave.getCapabilities().hasBiometrics) {
        const authenticated = await secureEnclave.authenticateWithBiometrics(
          secureEnclave.getCapabilities().supportedBiometrics[0],
          'Sign blockchain transaction'
        )
        
        if (!authenticated) return { success: false, error: 'Biometric authentication failed' }
      }
      
      // Sign transaction
      const signResult = await adapter.secureSignTransaction(transaction, securityContext)
      
      if (!signResult.success) {
        return { success: false, error: signResult.error || 'Failed to sign transaction' }
      }
      
      // Return the signed transaction or signature
      return {
        success: true,
        signature: signResult.signatures?.[0],
        signatures: signResult.signatures,
        securityReport: signResult.securityReport
      }
    } catch (error) {
      console.error('Failed to sign transaction with vault key:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Determine security method based on key entry
  function determineSecurityMethod(keyEntry: VaultKeyEntry): SecurityMethod {
    // Use hardware wallet if key type is hardware path
    if (keyEntry.type === 'hardware_path') {
      return SecurityMethod.HARDWARE_WALLET
    }
    
    // Use secure enclave if hardware protected
    if (keyEntry.metadata.hardwareProtected) {
      return SecurityMethod.SECURE_ENCLAVE
    }
    
    // Use multi-party computation if key has MPC metadata
    if (keyEntry.metadata.isMpcKey) {
      return SecurityMethod.MULTI_PARTY
    }
    
    // Use smart contract if key has contract address
    if (keyEntry.metadata.contractAddress) {
      return SecurityMethod.SMART_CONTRACT
    }
    
    // Default to local private key
    return SecurityMethod.LOCAL_PRIVATE_KEY
  }
  
  // Broadcast a signed transaction
  async function broadcastTransaction(
    blockchain: string,
    transaction: any,
    securityContext?: any
  ) {
    if (!blockchain || !transaction)
      return { success: false, error: 'Missing required parameters' }
      
    try {
      // Get secure blockchain adapter
      const adapter = BlockchainAdapterFactory.createSecureAdapter(blockchain)
      
      // Broadcast transaction
      const txHash = await adapter.secureBroadcastTransaction(transaction, securityContext)
      
      return { success: true, txHash }
    } catch (error) {
      console.error('Failed to broadcast transaction:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Verify transaction before signing
  async function verifyTransaction(
    blockchain: string,
    transaction: any,
    riskThreshold: RiskLevel = RiskLevel.HIGH
  ) {
    if (!blockchain || !transaction)
      return { success: false, error: 'Missing required parameters' }
      
    try {
      // Get blockchain adapter
      const adapter = BlockchainAdapterFactory.createSecureAdapter(blockchain)
      
      // Analyze transaction for security risks
      let securityReport
      
      if (blockchain.includes('ethereum') || blockchain.includes('polygon') || 
          blockchain.includes('avalanche') || blockchain.includes('optimism') || 
          blockchain.includes('arbitrum') || blockchain.includes('base')) {
        // Ethereum-compatible chains
        securityReport = await hwSecurity.analyzeEthereumTransaction(transaction)
      } else if (blockchain.includes('bitcoin')) {
        // Bitcoin
        securityReport = await hwSecurity.analyzeBitcoinTransaction(transaction)
      } else if (blockchain.includes('solana')) {
        // Solana
        securityReport = await hwSecurity.analyzeSolanaTransaction(transaction)
      } else {
        return { success: false, error: 'Unsupported blockchain for security analysis' }
      }
      
      // Check risk level against threshold
      const isHighRisk = getRiskValue(securityReport.riskLevel) > getRiskValue(riskThreshold)
      
      return {
        success: true,
        isHighRisk,
        securityReport
      }
    } catch (error) {
      console.error('Failed to verify transaction:', error)
      return { success: false, error: error.message }
    }
  }
  
  // Convert risk level to numeric value for comparison
  function getRiskValue(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case RiskLevel.LOW: return 1
      case RiskLevel.MEDIUM: return 2
      case RiskLevel.HIGH: return 3
      case RiskLevel.CRITICAL: return 4
      default: return 0
    }
  }
  
  return {
    signTransaction,
    broadcastTransaction,
    verifyTransaction
  }
}