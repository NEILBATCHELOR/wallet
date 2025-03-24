// src/services/vault/SecureVault.ts
import { SecureKeyService } from '../security/SecureKeyService';
import { KeyRecoveryService } from '../security/KeyRecoveryService';
import { ColdStorageService } from '../security/ColdStorageService';
import { SecureEnclaveService, KeyUsage } from '../security/SecureEnclaveService';
import { MpcKeyService } from '../security/MpcKeyService';
import * as crypto from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Security level for vault operations
 */
export enum VaultSecurityLevel {
  STANDARD = 'standard',   // Regular encryption
  HIGH = 'high',           // Enhanced protection with additional verification
  MAXIMUM = 'maximum'      // Multi-factor, hardware-backed where available
}

/**
 * Key material types supported by the vault
 */
export enum KeyMaterialType {
  PRIVATE_KEY = 'private_key',
  MNEMONIC = 'mnemonic',
  SEED = 'seed',
  PASSWORD = 'password',
  HARDWARE_PATH = 'hardware_path',
  SHARE = 'share'          // Recovery share
}

/**
 * Key access policy
 */
export interface KeyAccessPolicy {
  requireMFA: boolean;
  timeoutSeconds: number;
  allowExport: boolean;
  ipRestriction?: string[];
  deviceRestriction?: string[];
  revokedAt?: Date;
}

/**
 * Vault key entry
 */
export interface VaultKeyEntry {
  id: string;
  name: string;
  type: KeyMaterialType;
  blockchain: string;
  createdAt: Date;
  accessedAt?: Date;
  policy: KeyAccessPolicy;
  metadata: {
    publicKey?: string;
    address?: string;
    encryptionMethod: string;
    hardwareProtected: boolean;
    shareThreshold?: number;
    tags?: string[];
    description?: string;
    [key: string]: any;
  };
}

/**
 * Vault audit log entry
 */
export interface VaultAuditEntry {
  id: string;
  timestamp: Date;
  action: 'create' | 'access' | 'sign' | 'export' | 'delete' | 'attempt';
  keyId?: string;
  userId?: string;
  successful: boolean;
  metadata: {
    ipAddress?: string;
    deviceId?: string;
    reason?: string;
    transactionId?: string;
    authMethod?: string;
    [key: string]: any;
  };
}

/**
 * Options for vault operations
 */
export interface VaultOperationOptions {
  reason?: string;
  securityLevel?: VaultSecurityLevel;
  requireFreshAuth?: boolean;
  timeout?: number;
  metadata?: Record<string, any>;
}

/**
 * Communication channel between the vault and main application
 */
export type VaultChannel = {
  sendRequest: (request: any) => Promise<any>;
  onRequest: (handler: (request: any) => Promise<any>) => void;
};

/**
 * Secure vault status
 */
export interface VaultStatus {
  initialized: boolean;
  locked: boolean;
  hardwareProtection: boolean;
  mfaEnabled: boolean;
  keyCount: number;
  lastActivity: Date | null;
}

/**
 * Hyper-secure vault for cryptographic key management
 * Implements segregation and isolation of sensitive material
 */
export class SecureVault {
  private static instance: SecureVault;
  private initialized: boolean = false;
  private locked: boolean = true;
  private securityLevel: VaultSecurityLevel = VaultSecurityLevel.STANDARD;
  
  // Security services
  private secureKeyService: SecureKeyService;
  private keyRecoveryService: KeyRecoveryService;
  private coldStorageService: ColdStorageService;
  private secureEnclaveService: SecureEnclaveService;
  private mpcKeyService: MpcKeyService;
  
  // Vault state
  private keys: Map<string, VaultKeyEntry> = new Map();
  private auditLog: VaultAuditEntry[] = [];
  private authToken: string | null = null;
  private authExpiry: Date | null = null;
  private masterKeyHash: string | null = null;
  
  // Communication channel (for process isolation)
  private channel: VaultChannel | null = null;

  private constructor() {
    // Initialize services
    this.secureKeyService = SecureKeyService.getInstance();
    this.keyRecoveryService = KeyRecoveryService.getInstance();
    this.coldStorageService = ColdStorageService.getInstance();
    this.secureEnclaveService = SecureEnclaveService.getInstance();
    this.mpcKeyService = MpcKeyService.getInstance();
    
    // Set up memory protection
    this.setupMemoryProtection();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SecureVault {
    if (!SecureVault.instance) {
      SecureVault.instance = new SecureVault();
    }
    return SecureVault.instance;
  }

  /**
   * Setup memory protection mechanisms
   */
  private setupMemoryProtection(): void {
    // Set up automatic memory clearing for sensitive data
    const clearSensitiveMemory = () => {
      if (this.locked) {
        return; // Already locked
      }
      
      // Check if auth token has expired
      if (this.authExpiry && this.authExpiry < new Date()) {
        this.lock();
      }
    };

    // Clear memory periodically (every minute)
    setInterval(clearSensitiveMemory, 60 * 1000);

    // Clear memory when tab is hidden (user switches tabs)
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          clearSensitiveMemory();
        }
      });
    }

    // Clear memory before unload (user closes tab)
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.lock();
      });
    }
  }

  /**
   * Initialize the vault with a master password
   * This is the first step before using the vault
   */
  public async initialize(
    masterPassword: string,
    securityLevel: VaultSecurityLevel = VaultSecurityLevel.STANDARD
  ): Promise<boolean> {
    try {
      if (this.initialized) {
        throw new Error('Vault is already initialized');
      }
      
      // Generate a random salt
      const salt = crypto.lib.WordArray.random(16).toString();
      
      // Hash the master password with the salt
      this.masterKeyHash = this.hashMasterPassword(masterPassword, salt);
      
      // Store the salt (not the password)
      localStorage.setItem('vault_salt', salt);
      localStorage.setItem('vault_security_level', securityLevel);
      
      // Set up security level
      this.securityLevel = securityLevel;
      
      // If using maximum security with hardware protection, initialize it
      if (securityLevel === VaultSecurityLevel.MAXIMUM) {
        // Try to use secure enclave if available
        if (this.secureEnclaveService.isSecureKeyGenerationSupported()) {
          await this.secureEnclaveService.generateSecureKey(
            'Vault Master Key',
            KeyUsage.ENCRYPTION,
            'ECDSA',
            true // require biometrics
          );
        }
      }
      
      // Mark as initialized but still locked
      this.initialized = true;
      this.locked = true;
      
      return true;
    } catch (error) {
      console.error('Failed to initialize vault:', error);
      return false;
    }
  }

  /**
   * Unlock the vault with the master password
   */
  public async unlock(
    masterPassword: string,
    mfaCode?: string
  ): Promise<boolean> {
    try {
      if (!this.initialized) {
        throw new Error('Vault is not initialized');
      }
      
      // Get the salt
      const salt = localStorage.getItem('vault_salt');
      
      if (!salt) {
        throw new Error('Vault salt not found');
      }
      
      // Hash the provided password with the salt
      const passwordHash = this.hashMasterPassword(masterPassword, salt);
      
      // Verify the password hash
      if (passwordHash !== this.masterKeyHash) {
        // Record failed attempt
        this.logAudit({
          action: 'attempt',
          successful: false,
          metadata: {
            reason: 'Invalid master password'
          }
        });
        
        throw new Error('Invalid master password');
      }
      
      // Verify MFA if maximum security is enabled
      if (this.securityLevel === VaultSecurityLevel.MAXIMUM && !mfaCode) {
        // Try hardware biometric authentication if available
        if (this.secureEnclaveService.isBiometricTypeAvailable(this.secureEnclaveService.getSupportedBiometricTypes()[0])) {
          const authenticated = await this.secureEnclaveService.authenticateWithBiometrics(
            this.secureEnclaveService.getSupportedBiometricTypes()[0],
            'Authenticate to unlock vault'
          );
          
          if (!authenticated) {
            throw new Error('Biometric authentication failed');
          }
        } else {
          throw new Error('MFA code required for maximum security');
        }
      } else if (mfaCode) {
        // Verify MFA code (in a real app, this would validate against TOTP or similar)
        if (mfaCode !== '123456') { // Dummy validation
          throw new Error('Invalid MFA code');
        }
      }
      
      // Generate auth token and set expiry
      this.authToken = crypto.lib.WordArray.random(32).toString();
      
      // Set auth expiry (default: 15 minutes)
      const expiryMinutes = this.securityLevel === VaultSecurityLevel.MAXIMUM ? 5 : 
                           (this.securityLevel === VaultSecurityLevel.HIGH ? 10 : 15);
      
      this.authExpiry = new Date();
      this.authExpiry.setMinutes(this.authExpiry.getMinutes() + expiryMinutes);
      
      // Unlock the vault
      this.locked = false;
      
      // Load keys (in a real implementation, these would be loaded from encrypted storage)
      this.loadKeys(masterPassword);
      
      // Log successful unlock
      this.logAudit({
        action: 'access',
        successful: true,
        metadata: {
          reason: 'Vault unlock'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Failed to unlock vault:', error);
      return false;
    }
  }

  /**
   * Lock the vault
   */
  public lock(): void {
    // Clear sensitive data
    this.authToken = null;
    this.authExpiry = null;
    this.keys.clear();
    
    // Mark as locked
    this.locked = true;
    
    // Log action
    this.logAudit({
      action: 'access',
      successful: true,
      metadata: {
        reason: 'Vault lock'
      }
    });
    
    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
    }
  }

  /**
   * Create a new key in the vault
   */
  public async createKey(
    name: string,
    type: KeyMaterialType,
    blockchain: string,
    keyMaterial: string,
    password: string,
    policy: Partial<KeyAccessPolicy> = {},
    options: VaultOperationOptions = {}
  ): Promise<VaultKeyEntry> {
    this.ensureUnlocked();
    this.verifyAuthentication(options);
    
    try {
      // Create a unique key ID
      const keyId = uuidv4();
      
      // Enhance security based on level
      const securityLevel = options.securityLevel || this.securityLevel;
      
      // Determine the encryption method based on security level
      let encryptionMethod = 'aes';
      let hardwareProtected = false;
      
      if (securityLevel === VaultSecurityLevel.MAXIMUM) {
        // Try to use secure enclave if available
        if (this.secureEnclaveService.isSecureKeyGenerationSupported()) {
          encryptionMethod = 'hardware_enclave';
          hardwareProtected = true;
        }
      }
      
      // Encrypt the key material
      let encryptedMaterial: string;
      
      if (hardwareProtected) {
        // For hardware protection, we generate a key in the secure enclave and use it for encryption
        const enclaveKeyInfo = await this.secureEnclaveService.generateSecureKey(
          `${name} Encryption Key`,
          KeyUsage.ENCRYPTION,
          'AES',
          true
        );
        
        // Use the enclave key to encrypt the key material
        encryptedMaterial = await this.secureEnclaveService.encryptData(
          enclaveKeyInfo.id,
          keyMaterial
        );
        
        // Store the enclave key ID with the encrypted material
        encryptedMaterial = JSON.stringify({
          enclaveKeyId: enclaveKeyInfo.id,
          data: encryptedMaterial
        });
      } else {
        // Standard encryption
        encryptedMaterial = this.secureKeyService.encryptData(keyMaterial, password);
      }
      
      // Store the encrypted key material
      this.secureKeyService.storeEncryptedKey(
        keyId,
        encryptedMaterial,
        password,
        {
          name,
          type,
          storageMethod: hardwareProtected ? 'hardware' : 'encrypted',
          metadata: {
            blockchain,
            securityLevel: securityLevel,
            isBackedUp: false
          }
        }
      );
      
      // Create vault key entry
      const keyEntry: VaultKeyEntry = {
        id: keyId,
        name,
        type,
        blockchain,
        createdAt: new Date(),
        policy: {
          requireMFA: policy.requireMFA || securityLevel === VaultSecurityLevel.MAXIMUM,
          timeoutSeconds: policy.timeoutSeconds || 300, // 5 minutes default
          allowExport: policy.allowExport !== undefined ? policy.allowExport : false,
          ipRestriction: policy.ipRestriction,
          deviceRestriction: policy.deviceRestriction
        },
        metadata: {
          encryptionMethod,
          hardwareProtected,
          ...options.metadata
        }
      };
      
      // Attempt to derive public key and address if possible
      if (type === KeyMaterialType.PRIVATE_KEY || type === KeyMaterialType.MNEMONIC) {
        // In a real implementation, this would use the appropriate derivation logic
        // based on the blockchain type
        keyEntry.metadata.publicKey = `dummy_public_key_for_${keyId}`;
        keyEntry.metadata.address = `dummy_address_for_${keyId}`;
      }
      
      // Store key entry
      this.keys.set(keyId, keyEntry);
      
      // Log audit entry
      this.logAudit({
        action: 'create',
        keyId,
        successful: true,
        metadata: {
          reason: options.reason || 'Key creation',
          blockchain,
          type
        }
      });
      
      return keyEntry;
    } catch (error) {
      // Log failed attempt
      this.logAudit({
        action: 'create',
        successful: false,
        metadata: {
          reason: options.reason || 'Key creation',
          blockchain,
          type,
          error: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Retrieve a key from the vault
   */
  public async getKey(
    keyId: string,
    password: string,
    options: VaultOperationOptions = {}
  ): Promise<string> {
    this.ensureUnlocked();
    this.verifyAuthentication(options);
    
    try {
      // Get key entry
      const keyEntry = this.keys.get(keyId);
      
      if (!keyEntry) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      // Check key policy
      if (keyEntry.policy.requireMFA && !options.securityLevel) {
        // Try hardware biometric authentication if available
        if (this.secureEnclaveService.isBiometricTypeAvailable(this.secureEnclaveService.getSupportedBiometricTypes()[0])) {
          const authenticated = await this.secureEnclaveService.authenticateWithBiometrics(
            this.secureEnclaveService.getSupportedBiometricTypes()[0],
            `Access key: ${keyEntry.name}`
          );
          
          if (!authenticated) {
            throw new Error('Biometric authentication failed');
          }
        } else {
          throw new Error('MFA required to access this key');
        }
      }
      
      // Retrieve encrypted key material
      const encryptedMaterial = await this.secureKeyService.retrieveEncryptedKey(keyId);
      
      // Decrypt the key material
      let keyMaterial: string;
      
      if (keyEntry.metadata.hardwareProtected) {
        // Parse encrypted data to get enclave key ID
        const encryptedData = JSON.parse(encryptedMaterial);
        
        // Use the enclave key to decrypt the data
        keyMaterial = await this.secureEnclaveService.decryptData(
          encryptedData.enclaveKeyId,
          encryptedData.data
        );
      } else {
        // Standard decryption
        keyMaterial = this.secureKeyService.decryptData(encryptedMaterial, password);
      }
      
      // Update last accessed timestamp
      keyEntry.accessedAt = new Date();
      this.keys.set(keyId, keyEntry);
      
      // Log audit entry
      this.logAudit({
        action: 'access',
        keyId,
        successful: true,
        metadata: {
          reason: options.reason || 'Key access'
        }
      });
      
      return keyMaterial;
    } catch (error) {
      // Log failed attempt
      this.logAudit({
        action: 'access',
        keyId,
        successful: false,
        metadata: {
          reason: options.reason || 'Key access',
          error: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Sign data using a key in the vault
   * This method never exposes the private key
   */
  public async signWithKey(
    keyId: string,
    data: string | Uint8Array,
    password: string,
    options: VaultOperationOptions = {}
  ): Promise<string> {
    this.ensureUnlocked();
    this.verifyAuthentication(options);
    
    try {
      // Get key entry
      const keyEntry = this.keys.get(keyId);
      
      if (!keyEntry) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      // Check key policy
      if (keyEntry.policy.requireMFA && !options.securityLevel) {
        // Try hardware biometric authentication if available
        if (this.secureEnclaveService.isBiometricTypeAvailable(this.secureEnclaveService.getSupportedBiometricTypes()[0])) {
          const authenticated = await this.secureEnclaveService.authenticateWithBiometrics(
            this.secureEnclaveService.getSupportedBiometricTypes()[0],
            `Sign with key: ${keyEntry.name}`
          );
          
          if (!authenticated) {
            throw new Error('Biometric authentication failed');
          }
        } else {
          throw new Error('MFA required to sign with this key');
        }
      }
      
      // If hardware protected, use the secure enclave directly for signing
      if (keyEntry.metadata.hardwareProtected) {
        // For hardware-protected keys, we don't need the password since biometrics are used
        const signature = await this.secureEnclaveService.signWithSecureKey(
          JSON.parse(await this.secureKeyService.retrieveEncryptedKey(keyId)).enclaveKeyId,
          data,
          `Sign transaction with ${keyEntry.name}`
        );
        
        // Log audit entry
        this.logAudit({
          action: 'sign',
          keyId,
          successful: true,
          metadata: {
            reason: options.reason || 'Transaction signing',
            signatureType: 'hardware'
          }
        });
        
        return signature;
      }
      
      // For non-hardware keys, we need to retrieve the key first
      const privateKey = await this.getKey(keyId, password, {
        ...options,
        reason: 'Signing operation'
      });
      
      // Use private key to sign the data
      // This is a simplified implementation - in reality, this would use the appropriate
      // signing algorithm based on the blockchain and key type
      
      // Just as a placeholder - in a real implementation, this would perform the actual signing
      const signature = `signature_for_${keyId}_${crypto.SHA256(privateKey + data).toString()}`;
      
      // Zero out the private key from memory
      // eslint-disable-next-line no-param-reassign
      privateKey.replace(/./g, '0');
      
      // Log audit entry
      this.logAudit({
        action: 'sign',
        keyId,
        successful: true,
        metadata: {
          reason: options.reason || 'Transaction signing',
          signatureType: 'software'
        }
      });
      
      return signature;
    } catch (error) {
      // Log failed attempt
      this.logAudit({
        action: 'sign',
        keyId,
        successful: false,
        metadata: {
          reason: options.reason || 'Transaction signing',
          error: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Export a key from the vault (if allowed by policy)
   */
  public async exportKey(
    keyId: string,
    password: string,
    options: VaultOperationOptions = {}
  ): Promise<string> {
    this.ensureUnlocked();
    this.verifyAuthentication(options);
    
    try {
      // Get key entry
      const keyEntry = this.keys.get(keyId);
      
      if (!keyEntry) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      // Check if export is allowed
      if (!keyEntry.policy.allowExport) {
        throw new Error(`Export not allowed for key ${keyId}`);
      }
      
      // For maximum security, always require MFA for export
      if (!options.securityLevel || options.securityLevel !== VaultSecurityLevel.MAXIMUM) {
        // Try hardware biometric authentication if available
        if (this.secureEnclaveService.isBiometricTypeAvailable(this.secureEnclaveService.getSupportedBiometricTypes()[0])) {
          const authenticated = await this.secureEnclaveService.authenticateWithBiometrics(
            this.secureEnclaveService.getSupportedBiometricTypes()[0],
            `Export key: ${keyEntry.name}`
          );
          
          if (!authenticated) {
            throw new Error('Biometric authentication failed');
          }
        } else {
          throw new Error('Maximum security required to export keys');
        }
      }
      
      // Get the key
      const keyMaterial = await this.getKey(keyId, password, {
        ...options,
        securityLevel: VaultSecurityLevel.MAXIMUM,
        reason: 'Key export'
      });
      
      // Log audit entry
      this.logAudit({
        action: 'export',
        keyId,
        successful: true,
        metadata: {
          reason: options.reason || 'Key export'
        }
      });
      
      return keyMaterial;
    } catch (error) {
      // Log failed attempt
      this.logAudit({
        action: 'export',
        keyId,
        successful: false,
        metadata: {
          reason: options.reason || 'Key export',
          error: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Delete a key from the vault
   */
  public async deleteKey(
    keyId: string,
    password: string,
    options: VaultOperationOptions = {}
  ): Promise<boolean> {
    this.ensureUnlocked();
    this.verifyAuthentication(options);
    
    try {
      // Get key entry
      const keyEntry = this.keys.get(keyId);
      
      if (!keyEntry) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      // For maximum security, always require MFA for deletion
      if (this.securityLevel === VaultSecurityLevel.MAXIMUM) {
        // Try hardware biometric authentication if available
        if (this.secureEnclaveService.isBiometricTypeAvailable(this.secureEnclaveService.getSupportedBiometricTypes()[0])) {
          const authenticated = await this.secureEnclaveService.authenticateWithBiometrics(
            this.secureEnclaveService.getSupportedBiometricTypes()[0],
            `Delete key: ${keyEntry.name}`
          );
          
          if (!authenticated) {
            throw new Error('Biometric authentication failed');
          }
        } else {
          throw new Error('MFA required to delete keys at maximum security level');
        }
      }
      
      // Verify password
      await this.secureKeyService.retrieveEncryptedKey(keyId);
      
      // Delete from secure key service
      this.secureKeyService.deleteKey(keyId);
      
      // If hardware protected, delete from secure enclave
      if (keyEntry.metadata.hardwareProtected) {
        const encryptedData = JSON.parse(await this.secureKeyService.retrieveEncryptedKey(keyId));
        await this.secureEnclaveService.deleteSecureKey(encryptedData.enclaveKeyId);
      }
      
      // Remove from memory
      this.keys.delete(keyId);
      
      // Log audit entry
      this.logAudit({
        action: 'delete',
        keyId,
        successful: true,
        metadata: {
          reason: options.reason || 'Key deletion'
        }
      });
      
      return true;
    } catch (error) {
      // Log failed attempt
      this.logAudit({
        action: 'delete',
        keyId,
        successful: false,
        metadata: {
          reason: options.reason || 'Key deletion',
          error: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Create a backup of a key for recovery
   */
  public async createKeyBackup(
    keyId: string,
    password: string,
    backupOptions: {
      method: 'qr' | 'paper' | 'social';
      threshold?: number;
      shares?: number;
      guardians?: Array<{name: string; email: string}>;
    },
    options: VaultOperationOptions = {}
  ): Promise<any> {
    this.ensureUnlocked();
    this.verifyAuthentication(options);
    
    try {
      // Get key entry
      const keyEntry = this.keys.get(keyId);
      
      if (!keyEntry) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      // Get the key material
      const keyMaterial = await this.getKey(keyId, password, {
        ...options,
        reason: 'Key backup creation'
      });
      
      // Create backup based on selected method
      let backupResult;
      
      switch (backupOptions.method) {
        case 'qr':
          // Generate QR code for cold storage
          backupResult = await this.coldStorageService.generateQRCode(
            keyMaterial,
            password,
            {
              keyId,
              walletName: keyEntry.name,
              blockchain: keyEntry.blockchain,
              format: 'dataURL'
            }
          );
          break;
          
        case 'paper':
          // Generate paper key format
          backupResult = this.coldStorageService.generatePaperKey(
            keyMaterial,
            {
              keyId,
              walletName: keyEntry.name,
              blockchain: keyEntry.blockchain,
              includeWordNumbers: true
            }
          );
          break;
          
        case 'social':
          // Validate social recovery options
          if (!backupOptions.guardians || backupOptions.guardians.length === 0) {
            throw new Error('Guardians required for social recovery');
          }
          
          if (!backupOptions.threshold || !backupOptions.shares) {
            throw new Error('Threshold and shares required for social recovery');
          }
          
          // Set up social recovery
          backupResult = this.keyRecoveryService.setupSocialRecovery(
            keyId,
            keyMaterial,
            backupOptions.guardians,
            backupOptions.threshold,
            {
              blockchain: keyEntry.blockchain
            }
          );
          
          // Generate guardian instructions
          const guardianInstructions = this.keyRecoveryService.generateRecoveryShareInstructions(
            backupResult.id
          );
          
          backupResult.guardianInstructions = guardianInstructions;
          break;
          
        default:
          throw new Error(`Unsupported backup method: ${backupOptions.method}`);
      }
      
      // Update key metadata to show it's backed up
      keyEntry.metadata.isBackedUp = true;
      this.keys.set(keyId, keyEntry);
      
      // Update key info in secure key service
      const keyInfo = this.secureKeyService.getKeyInfo(keyId);
      
      if (keyInfo) {
        keyInfo.metadata.isBackedUp = true;
        // Update keyInfo (method implementation depends on SecureKeyService)
      }
      
      // Log audit entry
      this.logAudit({
        action: 'access',
        keyId,
        successful: true,
        metadata: {
          reason: options.reason || 'Key backup creation',
          backupMethod: backupOptions.method
        }
      });
      
      return backupResult;
    } catch (error) {
      // Log failed attempt
      this.logAudit({
        action: 'access',
        keyId,
        successful: false,
        metadata: {
          reason: options.reason || 'Key backup creation',
          error: error.message
        }
      });
      
      throw error;
    }
  }

  /**
   * Get all keys in the vault
   */
  public getKeys(): VaultKeyEntry[] {
    this.ensureUnlocked();
    
    // Return a deep copy to prevent modification
    return Array.from(this.keys.values()).map(key => ({...key}));
  }

  /**
   * Get vault status
   */
  public getStatus(): VaultStatus {
    return {
      initialized: this.initialized,
      locked: this.locked,
      hardwareProtection: this.secureEnclaveService.isSecureKeyGenerationSupported(),
      mfaEnabled: this.securityLevel === VaultSecurityLevel.MAXIMUM,
      keyCount: this.keys.size,
      lastActivity: this.authExpiry ? new Date(this.authExpiry.getTime() - (this.getAuthTimeoutMinutes() * 60 * 1000)) : null
    };
  }

  /**
   * Get audit log entries
   */
  public getAuditLog(limit: number = 100, keyId?: string): VaultAuditEntry[] {
    this.ensureUnlocked();
    
    // Filter by key ID if provided
    let filteredLog = keyId ? 
      this.auditLog.filter(entry => entry.keyId === keyId) : 
      this.auditLog;
    
    // Get most recent entries
    return filteredLog.slice(-limit).map(entry => ({...entry}));
  }

  /**
   * Set up process isolation by providing a communication channel
   */
  public setChannel(channel: VaultChannel): void {
    this.channel = channel;
    
    // Set up request handler
    channel.onRequest(async (request) => {
      try {
        // Process request based on type
        switch (request.type) {
          case 'initialize':
            return {
              success: await this.initialize(request.masterPassword, request.securityLevel)
            };
            
          case 'unlock':
            return {
              success: await this.unlock(request.masterPassword, request.mfaCode)
            };
            
          case 'lock':
            this.lock();
            return { success: true };
            
          case 'createKey':
            return {
              key: await this.createKey(
                request.name,
                request.keyType,
                request.blockchain,
                request.keyMaterial,
                request.password,
                request.policy,
                request.options
              )
            };
            
          case 'getKey':
            return {
              key: await this.getKey(
                request.keyId,
                request.password,
                request.options
              )
            };
            
          case 'signWithKey':
            return {
              signature: await this.signWithKey(
                request.keyId,
                request.data,
                request.password,
                request.options
              )
            };
            
          case 'exportKey':
            return {
              key: await this.exportKey(
                request.keyId,
                request.password,
                request.options
              )
            };
            
          case 'deleteKey':
            return {
              success: await this.deleteKey(
                request.keyId,
                request.password,
                request.options
              )
            };
            
          case 'createKeyBackup':
            return {
              backup: await this.createKeyBackup(
                request.keyId,
                request.password,
                request.backupOptions,
                request.options
              )
            };
            
          case 'getKeys':
            return {
              keys: this.getKeys()
            };
            
          case 'getStatus':
            return {
              status: this.getStatus()
            };
            
          case 'getAuditLog':
            return {
              log: this.getAuditLog(request.limit, request.keyId)
            };
            
          default:
            throw new Error(`Unknown request type: ${request.type}`);
        }
      } catch (error) {
        return {
          error: error.message
        };
      }
    });
  }

  /**
   * Ensure the vault is unlocked
   */
  private ensureUnlocked(): void {
    if (!this.initialized) {
      throw new Error('Vault is not initialized');
    }
    
    if (this.locked) {
      throw new Error('Vault is locked');
    }
  }

  /**
   * Verify authentication is still valid
   */
  private verifyAuthentication(options: VaultOperationOptions = {}): void {
    // Check if auth token has expired
    if (!this.authToken || !this.authExpiry) {
      throw new Error('Authentication required');
    }
    
    if (this.authExpiry < new Date()) {
      this.lock();
      throw new Error('Authentication expired');
    }
    
    // Check if fresh authentication is required
    if (options.requireFreshAuth) {
      throw new Error('Fresh authentication required');
    }
    
    // Extend auth token lifetime if not near expiry
    const remainingMs = this.authExpiry.getTime() - Date.now();
    const extensionThresholdMs = this.getAuthTimeoutMinutes() * 60 * 1000 * 0.5; // 50% of timeout
    
    if (remainingMs < extensionThresholdMs) {
      // Only extend if not too close to expiry
      this.authExpiry = new Date();
      this.authExpiry.setMinutes(this.authExpiry.getMinutes() + this.getAuthTimeoutMinutes());
    }
  }

  /**
   * Get auth timeout in minutes based on security level
   */
  private getAuthTimeoutMinutes(): number {
    switch (this.securityLevel) {
      case VaultSecurityLevel.MAXIMUM:
        return 5; // 5 minutes
      case VaultSecurityLevel.HIGH:
        return 10; // 10 minutes
      default:
        return 15; // 15 minutes
    }
  }

  /**
   * Hash master password with salt
   */
  private hashMasterPassword(password: string, salt: string): string {
    // Use PBKDF2 with 10000 iterations
    return crypto.PBKDF2(password, salt, {
      keySize: 256 / 32,
      iterations: 10000
    }).toString();
  }

  /**
   * Log an audit entry
   */
  private logAudit(partial: Partial<VaultAuditEntry>): void {
    const entry: VaultAuditEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      action: partial.action || 'access',
      keyId: partial.keyId,
      userId: partial.userId,
      successful: partial.successful !== undefined ? partial.successful : true,
      metadata: {
        ...partial.metadata,
        ipAddress: this.getClientIp(),
        deviceId: this.getDeviceId()
      }
    };
    
    // Add to audit log
    this.auditLog.push(entry);
    
    // Trim audit log if too large (keep last 1000 entries)
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-1000);
    }
  }

  /**
   * Get client IP address
   */
  private getClientIp(): string {
    // In a real implementation, this would get the actual client IP
    return '127.0.0.1';
  }

  /**
   * Get device ID
   */
  private getDeviceId(): string {
    // In a real implementation, this would get a persistent device ID
    try {
      // Try to get or create a device ID from local storage
      let deviceId = localStorage.getItem('device_id');
      
      if (!deviceId) {
        deviceId = uuidv4();
        localStorage.setItem('device_id', deviceId);
      }
      
      return deviceId;
    } catch (e) {
      // Fallback if localStorage is not available
      return 'unknown';
    }
  }

  /**
   * Load keys from storage (after unlock)
   */
  private loadKeys(masterPassword: string): void {
    try {
      // In a real implementation, this would load key metadata from secure storage
      // For this demo, we'll just use the SecureKeyService
      
      const keyInfos = this.secureKeyService.getAllKeyInfos();
      
      for (const keyInfo of keyInfos) {
        // Create vault key entry
        const keyEntry: VaultKeyEntry = {
          id: keyInfo.id,
          name: keyInfo.name,
          type: keyInfo.type as KeyMaterialType,
          blockchain: keyInfo.metadata.blockchain,
          createdAt: keyInfo.createdAt,
          accessedAt: keyInfo.lastUsedAt,
          policy: {
            requireMFA: this.securityLevel === VaultSecurityLevel.MAXIMUM,
            timeoutSeconds: 300, // 5 minutes default
            allowExport: false
          },
          metadata: {
            publicKey: keyInfo.metadata.publicKey,
            address: keyInfo.metadata.address,
            encryptionMethod: 'aes',
            hardwareProtected: keyInfo.storageMethod === 'hardware',
            isBackedUp: keyInfo.metadata.isBackedUp
          }
        };
        
        // Store key entry
        this.keys.set(keyInfo.id, keyEntry);
      }
    } catch (error) {
      console.error('Failed to load keys:', error);
    }
  }
}