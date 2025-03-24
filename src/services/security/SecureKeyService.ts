// src/services/security/SecureKeyService.ts
import * as bip39 from 'bip39';
import * as ecc from 'tiny-secp256k1';
import * as shamir from 'shamir';
import * as crypto from 'crypto-js';
import secureLocalStorage from 'react-secure-storage';

/**
 * Security level for different key operations
 */
export enum SecurityLevel {
  LOW = 'low',       // For testing or low-value assets
  MEDIUM = 'medium', // For regular personal use
  HIGH = 'high',     // For substantial value storage
  MAXIMUM = 'maximum' // For institutional/extremely high value
}

/**
 * Key types supported by the wallet
 */
export enum KeyType {
  MNEMONIC = 'mnemonic',   // BIP-39 seed phrase
  PRIVATE_KEY = 'private', // Raw private key
  KEYSTORE = 'keystore',   // Encrypted keystore file
  HARDWARE = 'hardware',   // Hardware wallet (no private key exposure)
  MULTISIG = 'multisig',   // Shared key (requires multiple signatures)
  WATCH = 'watch'          // Watch-only (public key/address only)
}

/**
 * Key storage method
 */
export enum StorageMethod {
  NONE = 'none',          // Not stored (hardware wallets)
  MEMORY = 'memory',      // In-memory only (cleared on browser close)
  ENCRYPTED = 'encrypted', // Encrypted with password
  SHARDED = 'sharded'      // Split using Shamir's Secret Sharing
}

/**
 * Wallet key information
 */
export interface WalletKeyInfo {
  id: string;
  name: string;
  type: KeyType;
  storageMethod: StorageMethod;
  createdAt: Date;
  lastUsedAt?: Date;
  metadata: {
    blockchain: string;
    derivationPath?: string;
    addressIndex?: number;
    hardwareType?: string;
    securityLevel: SecurityLevel;
    isBackedUp: boolean;
    hasPassphrase?: boolean;
    multisigRequirements?: {
      requiredSignatures: number;
      totalSigners: number;
    };
  };
}

/**
 * Service for secure key management
 */
export class SecureKeyService {
  private static instance: SecureKeyService;
  private activeKeys: Map<string, { info: WalletKeyInfo, expiresAt?: Date }> = new Map();

  private constructor() {
    // Private constructor to enforce singleton pattern
    this.setupMemoryProtection();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SecureKeyService {
    if (!SecureKeyService.instance) {
      SecureKeyService.instance = new SecureKeyService();
    }
    return SecureKeyService.instance;
  }

  /**
   * Set up memory protection mechanisms
   */
  private setupMemoryProtection(): void {
    // Set up automatic memory clearing for sensitive data
    const clearSensitiveMemory = () => {
      // Clear any in-memory keys that should be removed
      const now = new Date();
      this.activeKeys.forEach((keyData, id) => {
        if (keyData.expiresAt && keyData.expiresAt < now) {
          this.activeKeys.delete(id);
        }
      });
    };

    // Clear memory periodically (every 5 minutes)
    setInterval(clearSensitiveMemory, 5 * 60 * 1000);

    // Clear memory when tab is hidden (user switches tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        clearSensitiveMemory();
      }
    });

    // Clear memory before unload (user closes tab)
    window.addEventListener('beforeunload', () => {
      // Force clear all in-memory keys
      this.activeKeys.clear();
    });
  }

  /**
   * Generate a secure mnemonic phrase (BIP-39)
   */
  public generateMnemonic(strength: 128 | 256 = 256): string {
    try {
      // Use BIP-39 to generate a secure mnemonic
      const mnemonic = bip39.generateMnemonic(strength);
      
      // Clear memory after operation
      setTimeout(() => {
        (global as any).gc && (global as any).gc();
      }, 0);
      
      return mnemonic;
    } catch (error) {
      console.error('Failed to generate mnemonic:', error);
      throw new Error('Failed to generate secure mnemonic');
    }
  }

  /**
   * Encrypt sensitive data with a password
   */
  public encryptData(data: string, password: string): string {
    try {
      // Use AES encryption
      const encrypted = crypto.AES.encrypt(data, password).toString();
      
      return encrypted;
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      throw new Error('Failed to encrypt sensitive data');
    }
  }

  /**
   * Decrypt sensitive data with a password
   */
  public decryptData(encryptedData: string, password: string): string {
    try {
      // Use AES decryption
      const decrypted = crypto.AES.decrypt(encryptedData, password).toString(crypto.enc.Utf8);
      
      if (!decrypted) {
        throw new Error('Invalid password or corrupted data');
      }
      
      return decrypted;
    } catch (error) {
      console.error('Failed to decrypt data:', error);
      throw new Error('Failed to decrypt data: Invalid password');
    }
  }

  /**
   * Securely store a key with encryption
   */
  public storeEncryptedKey(
    id: string,
    key: string,
    password: string,
    keyInfo: Omit<WalletKeyInfo, 'id' | 'createdAt'>
  ): WalletKeyInfo {
    try {
      // Encrypt the key
      const encryptedKey = this.encryptData(key, password);
      
      // Create the key info object
      const fullKeyInfo: WalletKeyInfo = {
        id,
        ...keyInfo,
        createdAt: new Date()
      };
      
      // Store encrypted key in secure storage
      secureLocalStorage.setItem(`key_${id}`, encryptedKey);
      
      // Store key info (metadata only, not the actual key)
      secureLocalStorage.setItem(`info_${id}`, JSON.stringify(fullKeyInfo));
      
      return fullKeyInfo;
    } catch (error) {
      console.error('Failed to store encrypted key:', error);
      throw new Error('Failed to securely store key');
    }
  }

  /**
   * Retrieve a key from secure storage
   */
  public retrieveKey(id: string, password: string): string {
    try {
      // Get encrypted key from secure storage
      const encryptedKey = secureLocalStorage.getItem(`key_${id}`);
      
      if (!encryptedKey) {
        throw new Error('Key not found');
      }
      
      // Decrypt the key
      const key = this.decryptData(encryptedKey as string, password);
      
      // Update last used timestamp
      const keyInfo = this.getKeyInfo(id);
      if (keyInfo) {
        keyInfo.lastUsedAt = new Date();
        secureLocalStorage.setItem(`info_${id}`, JSON.stringify(keyInfo));
      }
      
      return key;
    } catch (error) {
      console.error('Failed to retrieve key:', error);
      throw new Error('Failed to retrieve key: Invalid password or key not found');
    }
  }

  /**
   * Get key info (metadata only, not the actual key)
   */
  public getKeyInfo(id: string): WalletKeyInfo | null {
    try {
      const keyInfo = secureLocalStorage.getItem(`info_${id}`);
      
      if (!keyInfo) {
        return null;
      }
      
      return JSON.parse(keyInfo as string) as WalletKeyInfo;
    } catch (error) {
      console.error('Failed to get key info:', error);
      return null;
    }
  }

  /**
   * Get all stored key infos (metadata only, not the actual keys)
   */
  public getAllKeyInfos(): WalletKeyInfo[] {
    try {
      const keyInfos: WalletKeyInfo[] = [];
      
      // Iterate through all keys in secure storage
      for (let i = 0; i < secureLocalStorage.length; i++) {
        const key = secureLocalStorage.key(i);
        
        if (key && key.startsWith('info_')) {
          const id = key.substring(5); // Remove 'info_' prefix
          const keyInfo = this.getKeyInfo(id);
          
          if (keyInfo) {
            keyInfos.push(keyInfo);
          }
        }
      }
      
      return keyInfos;
    } catch (error) {
      console.error('Failed to get all key infos:', error);
      return [];
    }
  }

  /**
   * Securely delete a key
   */
  public deleteKey(id: string): boolean {
    try {
      // Remove from secure storage
      secureLocalStorage.removeItem(`key_${id}`);
      secureLocalStorage.removeItem(`info_${id}`);
      
      // Remove from active keys
      this.activeKeys.delete(id);
      
      return true;
    } catch (error) {
      console.error('Failed to delete key:', error);
      return false;
    }
  }

  /**
   * Add a key to active memory (for temporary use)
   */
  public activateKey(id: string, keyInfo: WalletKeyInfo, ttlMinutes?: number): void {
    let expiresAt: Date | undefined = undefined;
    
    if (ttlMinutes) {
      expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + ttlMinutes);
    }
    
    this.activeKeys.set(id, { info: keyInfo, expiresAt });
  }

  /**
   * Remove a key from active memory
   */
  public deactivateKey(id: string): void {
    this.activeKeys.delete(id);
  }

  /**
   * Check if a key is currently active in memory
   */
  public isKeyActive(id: string): boolean {
    const keyData = this.activeKeys.get(id);
    
    if (!keyData) {
      return false;
    }
    
    // Check if key has expired
    if (keyData.expiresAt && keyData.expiresAt < new Date()) {
      this.activeKeys.delete(id);
      return false;
    }
    
    return true;
  }

  /**
   * Split a secret using Shamir's Secret Sharing
   */
  public splitSecret(secret: string, totalShares: number, requiredShares: number): string[] {
    try {
      if (totalShares < requiredShares) {
        throw new Error('Total shares must be greater than or equal to required shares');
      }
      
      // Convert secret to bytes
      const secretBytes = Buffer.from(secret, 'utf8');
      
      // Split the secret
      const shares = shamir.split(secretBytes, totalShares, requiredShares);
      
      // Convert shares to hex strings
      const shareStrings = shares.map(share => Buffer.from(share).toString('hex'));
      
      return shareStrings;
    } catch (error) {
      console.error('Failed to split secret:', error);
      throw new Error('Failed to split secret into shares');
    }
  }

  /**
   * Combine shares to reconstruct a secret
   */
  public combineShares(shares: string[]): string {
    try {
      // Convert hex strings to byte arrays
      const shareBytes = shares.map(share => Buffer.from(share, 'hex'));
      
      // Combine the shares
      const secretBytes = shamir.combine(shareBytes);
      
      // Convert back to string
      const secret = Buffer.from(secretBytes).toString('utf8');
      
      return secret;
    } catch (error) {
      console.error('Failed to combine shares:', error);
      throw new Error('Failed to reconstruct secret from shares');
    }
  }

  /**
   * Validate a mnemonic phrase
   */
  public validateMnemonic(mnemonic: string): boolean {
    return bip39.validateMnemonic(mnemonic);
  }

  /**
   * Create a secure passphrase (for BIP-39 seed phrases)
   */
  public generateSecurePassphrase(length: number = 32): string {
    const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let passphrase = '';
    
    // Use secure random values
    const values = new Uint32Array(length);
    window.crypto.getRandomValues(values);
    
    // Generate the passphrase
    for (let i = 0; i < length; i++) {
      passphrase += charset[values[i] % charset.length];
    }
    
    return passphrase;
  }

  /**
   * Check password strength
   */
  public checkPasswordStrength(password: string): {
    score: number;
    feedback: string;
  } {
    // Calculate password entropy score (0-100)
    let score = 0;
    
    // Length check (up to 40 points)
    score += Math.min(password.length * 4, 40);
    
    // Character variety (up to 20 points)
    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    
    if (hasLower) score += 5;
    if (hasUpper) score += 5;
    if (hasDigit) score += 5;
    if (hasSpecial) score += 5;
    
    // Penalize repetitive patterns (up to -30 points)
    const repetitionPenalty = (password.length - new Set(password).size) * 3;
    score = Math.max(0, score - repetitionPenalty);
    
    // Common password check
    const commonPasswords = ['password', '123456', 'qwerty', 'admin'];
    if (commonPasswords.includes(password.toLowerCase())) {
      score = Math.min(score, 10);
    }
    
    // Generate feedback
    let feedback = '';
    if (score < 30) {
      feedback = 'Very weak password. Consider using a longer password with a mix of character types.';
    } else if (score < 50) {
      feedback = 'Weak password. Add more varied characters and increase length.';
    } else if (score < 70) {
      feedback = 'Moderate password. Could be improved with special characters.';
    } else if (score < 90) {
      feedback = 'Strong password.';
    } else {
      feedback = 'Very strong password.';
    }
    
    return { score, feedback };
  }

  /**
   * Securely clear memory after operations
   */
  public clearMemory(): void {
    // Clear sensitive data
    this.activeKeys.clear();
    
    // Force garbage collection if available
    if ((global as any).gc) {
      (global as any).gc();
    }
  }
}