// src/services/security/SecureEnclaveService.ts
import * as crypto from 'crypto-js';
import { v4 as uuidv4 } from 'uuid';
import secureLocalStorage from 'react-secure-storage';
import { SecureKeyService } from './SecureKeyService';

/**
 * Biometric authentication type
 */
export enum BiometricType {
  FINGERPRINT = 'fingerprint',
  FACE_ID = 'face_id',
  IRIS = 'iris',
  NONE = 'none'
}

/**
 * Secure enclave key usage
 */
export enum KeyUsage {
  AUTHENTICATION = 'authentication',
  SIGNING = 'signing',
  ENCRYPTION = 'encryption'
}

/**
 * Authentication information
 */
export interface AuthInfo {
  id: string;
  type: BiometricType;
  createdAt: Date;
  lastUsedAt?: Date;
  status: 'active' | 'revoked';
}

/**
 * Enclave key information
 */
export interface EnclaveKeyInfo {
  id: string;
  name: string;
  keyUsage: KeyUsage;
  algorithm: string;
  createdAt: Date;
  lastUsedAt?: Date;
  biometricProtected: boolean;
  hardwareProtected: boolean;
  metadata: {
    publicKey?: string;
    keyHash: string;
    keyType: string;
    canBeExported: boolean;
  }
}

/**
 * Platform-specific secure enclave capabilities
 */
export interface EnclaveCapabilities {
  hasTEE: boolean;
  hasSecureEnclave: boolean;
  hasKeystore: boolean;
  hasBiometrics: boolean;
  supportedBiometrics: BiometricType[];
  supportedAlgorithms: string[];
  isHardwareBacked: boolean;
  attestationSupport: boolean;
}

/**
 * Service for secure enclave / TEE operations
 */
export class SecureEnclaveService {
  private static instance: SecureEnclaveService;
  private secureKeyService: SecureKeyService;
  
  // Authentication state
  private authenticated: boolean = false;
  private authInfo: AuthInfo | null = null;
  private lastAuthTime: Date | null = null;
  
  // Key information storage
  private enclaveKeys: Map<string, EnclaveKeyInfo> = new Map();
  
  // Platform capabilities (detected at runtime)
  private capabilities: EnclaveCapabilities = {
    hasTEE: false,
    hasSecureEnclave: false,
    hasKeystore: false,
    hasBiometrics: false,
    supportedBiometrics: [],
    supportedAlgorithms: [],
    isHardwareBacked: false,
    attestationSupport: false
  };
  
  // Auth timeout in milliseconds (default: 5 minutes)
  private authTimeout: number = 5 * 60 * 1000;

  private constructor() {
    this.secureKeyService = SecureKeyService.getInstance();
    this.detectCapabilities();
    this.loadSavedKeys();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SecureEnclaveService {
    if (!SecureEnclaveService.instance) {
      SecureEnclaveService.instance = new SecureEnclaveService();
    }
    return SecureEnclaveService.instance;
  }

  /**
   * Detect platform-specific secure enclave capabilities
   */
  private async detectCapabilities(): Promise<void> {
    try {
      // Detect platform type
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      
      // Set basic capabilities
      this.capabilities.hasBiometrics = isMobile;
      
      if (isIOS) {
        // iOS has Secure Enclave on modern devices
        this.capabilities.hasSecureEnclave = true;
        this.capabilities.isHardwareBacked = true;
        this.capabilities.supportedBiometrics = [BiometricType.FACE_ID, BiometricType.FINGERPRINT];
        this.capabilities.supportedAlgorithms = ['ECDSA', 'ECDH', 'RSA'];
        this.capabilities.attestationSupport = true;
      } else if (isAndroid) {
        // Android has multiple security options depending on device
        this.capabilities.hasKeystore = true;
        this.capabilities.supportedBiometrics = [BiometricType.FINGERPRINT, BiometricType.FACE_ID, BiometricType.IRIS];
        this.capabilities.supportedAlgorithms = ['ECDSA', 'RSA'];
        
        // Additional capability detections would be performed by native code
        // For this implementation, we'll assume modern Android with StrongBox
        this.capabilities.isHardwareBacked = true;
        this.capabilities.hasTEE = true;
      } else {
        // Desktop browsers generally don't have secure enclaves
        // But WebAuthn provides some similar capabilities
        const supportsWebAuthn = typeof window !== 'undefined' && 
                               typeof window.PublicKeyCredential !== 'undefined';
        
        if (supportsWebAuthn) {
          this.capabilities.hasBiometrics = await this.checkWebAuthnSupport();
          this.capabilities.supportedBiometrics = this.capabilities.hasBiometrics ? 
            [BiometricType.FINGERPRINT] : [];
          this.capabilities.supportedAlgorithms = ['ECDSA'];
        }
      }
      
      console.log('Secure enclave capabilities detected:', this.capabilities);
    } catch (error) {
      console.error('Failed to detect secure enclave capabilities:', error);
    }
  }

  /**
   * Check if WebAuthn is supported and available
   */
  private async checkWebAuthnSupport(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || 
          typeof window.PublicKeyCredential === 'undefined') {
        return false;
      }
      
      // Check if platform authentication is available
      if (!window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
        return false;
      }
      
      // Check if platform authenticator is available (e.g. Windows Hello, Touch ID on Mac)
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (error) {
      console.error('Failed to check WebAuthn support:', error);
      return false;
    }
  }

  /**
   * Load saved keys from secure storage
   */
  private loadSavedKeys(): void {
    try {
      // Look for saved keys in secure storage
      for (let i = 0; i < secureLocalStorage.length; i++) {
        const key = secureLocalStorage.key(i);
        
        if (key && key.startsWith('enclave_key_')) {
          const keyData = secureLocalStorage.getItem(key);
          
          if (keyData) {
            const keyInfo = JSON.parse(keyData as string) as EnclaveKeyInfo;
            this.enclaveKeys.set(keyInfo.id, keyInfo);
          }
        }
      }
      
      console.log(`Loaded ${this.enclaveKeys.size} saved enclave keys`);
    } catch (error) {
      console.error('Failed to load saved enclave keys:', error);
    }
  }

  /**
   * Authenticate with biometrics
   */
  public async authenticateWithBiometrics(
    type: BiometricType = BiometricType.FINGERPRINT,
    reason: string = 'Authenticate to access secure keys'
  ): Promise<boolean> {
    // Check if biometrics are supported
    if (!this.capabilities.hasBiometrics) {
      throw new Error('Biometric authentication not supported on this device');
    }
    
    try {
      // In a real implementation, this would use platform-specific APIs:
      // - LocalAuthentication framework on iOS
      // - BiometricPrompt on Android
      // - WebAuthn on Desktop
      
      // For this simulation, we'll always succeed
      // In a real app, this would show the biometric UI
      console.log(`Simulating biometric authentication (${type}) for: ${reason}`);
      
      // Create authentication info
      this.authInfo = {
        id: uuidv4(),
        type,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        status: 'active'
      };
      
      // Set authenticated state
      this.authenticated = true;
      this.lastAuthTime = new Date();
      
      return true;
    } catch (error) {
      console.error('Biometric authentication failed:', error);
      this.authenticated = false;
      this.authInfo = null;
      return false;
    }
  }

  /**
   * Check if currently authenticated
   */
  public isAuthenticated(): boolean {
    // If no auth session, not authenticated
    if (!this.authenticated || !this.lastAuthTime) {
      return false;
    }
    
    // Check if authentication has timed out
    const now = new Date();
    const elapsed = now.getTime() - this.lastAuthTime.getTime();
    
    if (elapsed > this.authTimeout) {
      // Authentication has timed out
      this.authenticated = false;
      return false;
    }
    
    return true;
  }

  /**
   * Extend authentication session
   */
  public extendAuthSession(): boolean {
    if (this.isAuthenticated()) {
      this.lastAuthTime = new Date();
      return true;
    }
    
    return false;
  }

  /**
   * End authentication session
   */
  public endAuthSession(): void {
    this.authenticated = false;
    this.lastAuthTime = null;
  }

  /**
   * Get available secure enclave capabilities
   */
  public getCapabilities(): EnclaveCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Check if secure key generation is supported
   */
  public isSecureKeyGenerationSupported(): boolean {
    return this.capabilities.hasSecureEnclave || 
           this.capabilities.hasKeystore || 
           this.capabilities.hasTEE;
  }

  /**
   * Generate a key in the secure enclave
   */
  public async generateSecureKey(
    keyName: string,
    keyUsage: KeyUsage,
    algorithm: string = 'ECDSA',
    requireBiometrics: boolean = true,
    metadata: Record<string, any> = {}
  ): Promise<EnclaveKeyInfo> {
    // Verify that secure key generation is supported
    if (!this.isSecureKeyGenerationSupported()) {
      throw new Error('Secure key generation not supported on this device');
    }
    
    // Verify algorithm is supported
    if (!this.capabilities.supportedAlgorithms.includes(algorithm)) {
      throw new Error(`Algorithm ${algorithm} not supported on this device`);
    }
    
    // Verify authenticated if biometrics are required
    if (requireBiometrics && !this.isAuthenticated()) {
      throw new Error('Biometric authentication required to generate secure key');
    }
    
    try {
      // In a real implementation, this would use platform-specific APIs:
      // - Keychain API on iOS with kSecAttrAccessibleWhenPasscodeSetThisDeviceOnly
      // - Android Keystore with setUserAuthenticationRequired
      
      // For this simulation, we'll generate a key and simulate storing it securely
      const keyId = uuidv4();
      
      // Generate a dummy keypair and extract public key
      // In a real implementation, the private key would never leave the secure element
      const keyPair = await this.generateKeyPair(algorithm);
      
      // Create enclave key info
      const keyInfo: EnclaveKeyInfo = {
        id: keyId,
        name: keyName,
        keyUsage,
        algorithm,
        createdAt: new Date(),
        biometricProtected: requireBiometrics,
        hardwareProtected: this.capabilities.isHardwareBacked,
        metadata: {
          publicKey: keyPair.publicKey,
          keyHash: crypto.SHA256(keyPair.publicKey).toString(),
          keyType: algorithm,
          canBeExported: false,
          ...metadata
        }
      };
      
      // Store key info (not the actual key)
      this.enclaveKeys.set(keyId, keyInfo);
      
      // Save to secure storage
      secureLocalStorage.setItem(`enclave_key_${keyId}`, JSON.stringify(keyInfo));
      
      // Simulate recording the key alias in the secure element
      console.log(`Key ${keyId} generated in secure enclave simulation`);
      
      return keyInfo;
    } catch (error) {
      console.error('Failed to generate secure key:', error);
      throw new Error(`Failed to generate secure key: ${error.message}`);
    }
  }

  /**
   * Sign data using a key in the secure enclave
   */
  public async signWithSecureKey(
    keyId: string,
    data: string | Uint8Array,
    promptMessage: string = 'Sign transaction'
  ): Promise<string> {
    try {
      // Get key info
      const keyInfo = this.enclaveKeys.get(keyId);
      
      if (!keyInfo) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      // Check if key is for signing
      if (keyInfo.keyUsage !== KeyUsage.SIGNING) {
        throw new Error(`Key ${keyId} is not for signing`);
      }
      
      // Check authentication if biometric protected
      if (keyInfo.biometricProtected && !this.isAuthenticated()) {
        // Prompt for biometric authentication
        const authenticated = await this.authenticateWithBiometrics(
          BiometricType.FINGERPRINT,
          promptMessage
        );
        
        if (!authenticated) {
          throw new Error('Biometric authentication failed');
        }
      }
      
      // In a real implementation, this would use platform-specific APIs
      // to sign with the key in the secure element
      
      // For this simulation, we'll generate a dummy signature
      let dataToSign: string;
      
      if (typeof data === 'string') {
        dataToSign = data;
      } else {
        dataToSign = new TextDecoder().decode(data);
      }
      
      // Create a dummy signature
      const signature = crypto.HmacSHA256(dataToSign, keyId).toString();
      
      // Update key usage time
      keyInfo.lastUsedAt = new Date();
      this.enclaveKeys.set(keyId, keyInfo);
      secureLocalStorage.setItem(`enclave_key_${keyId}`, JSON.stringify(keyInfo));
      
      return signature;
    } catch (error) {
      console.error('Failed to sign with secure key:', error);
      throw new Error(`Failed to sign with secure key: ${error.message}`);
    }
  }

  /**
   * Get public key for an enclave key
   */
  public getPublicKey(keyId: string): string | undefined {
    const keyInfo = this.enclaveKeys.get(keyId);
    return keyInfo?.metadata.publicKey;
  }

  /**
   * Get all enclave keys
   */
  public getAllKeys(): EnclaveKeyInfo[] {
    return Array.from(this.enclaveKeys.values());
  }

  /**
   * Delete a key from the secure enclave
   */
  public async deleteSecureKey(keyId: string): Promise<boolean> {
    try {
      // Get key info
      const keyInfo = this.enclaveKeys.get(keyId);
      
      if (!keyInfo) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      // In a real implementation, this would use platform-specific APIs
      // to delete the key from the secure element
      
      // Remove from memory
      this.enclaveKeys.delete(keyId);
      
      // Remove from secure storage
      secureLocalStorage.removeItem(`enclave_key_${keyId}`);
      
      return true;
    } catch (error) {
      console.error('Failed to delete secure key:', error);
      throw new Error(`Failed to delete secure key: ${error.message}`);
    }
  }

  /**
   * Generate a key pair (simulation)
   */
  private async generateKeyPair(algorithm: string): Promise<{ publicKey: string, privateKey: string }> {
    // In a real implementation, this would use platform-specific APIs
    // and the private key would never leave the secure element
    
    // For this simulation, we'll generate a dummy key pair
    const privateKey = crypto.lib.WordArray.random(32).toString();
    const publicKey = crypto.SHA256(privateKey).toString();
    
    return { publicKey, privateKey };
  }

  /**
   * Set authentication timeout
   */
  public setAuthTimeout(timeoutMs: number): void {
    this.authTimeout = timeoutMs;
  }

  /**
   * Get current authentication info
   */
  public getAuthInfo(): AuthInfo | null {
    return this.authInfo;
  }

  /**
   * Check if a specific biometric type is available
   */
  public isBiometricTypeAvailable(type: BiometricType): boolean {
    return this.capabilities.supportedBiometrics.includes(type);
  }

  /**
   * Get device attestation
   * Used to prove the device has secure hardware capabilities
   */
  public async getDeviceAttestation(challenge: string): Promise<any> {
    if (!this.capabilities.attestationSupport) {
      throw new Error('Device attestation not supported');
    }
    
    try {
      // In a real implementation, this would use platform-specific APIs
      // to get an attestation statement from the secure element
      
      // For this simulation, we'll return a dummy attestation
      const attestation = {
        challenge: crypto.SHA256(challenge).toString(),
        timestamp: new Date().toISOString(),
        deviceInfo: {
          hasSecureElement: this.capabilities.hasSecureEnclave || this.capabilities.hasTEE,
          isHardwareBacked: this.capabilities.isHardwareBacked,
          supportsBiometrics: this.capabilities.hasBiometrics
        },
        signature: crypto.HmacSHA256(challenge, 'attestation_key').toString()
      };
      
      return attestation;
    } catch (error) {
      console.error('Failed to get device attestation:', error);
      throw new Error(`Failed to get device attestation: ${error.message}`);
    }
  }

  /**
   * Create WebAuthn credential (for desktop browsers)
   */
  public async createWebAuthnCredential(
    username: string,
    displayName: string
  ): Promise<EnclaveKeyInfo> {
    if (typeof window === 'undefined' || 
        typeof window.PublicKeyCredential === 'undefined') {
      throw new Error('WebAuthn not supported in this environment');
    }
    
    try {
      // Create a random user ID
      const userId = new Uint8Array(16);
      window.crypto.getRandomValues(userId);
      
      // Create credential options
      const credentialCreationOptions = {
        challenge: window.crypto.getRandomValues(new Uint8Array(32)),
        rp: {
          name: 'Multi-Chain Wallet',
          id: window.location.hostname
        },
        user: {
          id: userId,
          name: username,
          displayName: displayName
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 } // ES256 algorithm
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform', // Use platform authenticator (e.g. Windows Hello, Touch ID)
          userVerification: 'required', // Require biometric or PIN
          requireResidentKey: true // Store key on device
        },
        timeout: 60000, // 1 minute
        attestation: 'direct' // Request attestation from authenticator
      };
      
      // Create credential
      const credential = await (navigator as any).credentials.create({
        publicKey: credentialCreationOptions
      });
      
      // Extract credential ID and public key
      const credentialId = credential.id;
      const publicKey = btoa(String.fromCharCode.apply(null, new Uint8Array(credential.response.getPublicKey())));
      
      // Create enclave key info
      const keyInfo: EnclaveKeyInfo = {
        id: credentialId,
        name: `WebAuthn Key - ${displayName}`,
        keyUsage: KeyUsage.SIGNING,
        algorithm: 'ECDSA',
        createdAt: new Date(),
        biometricProtected: true,
        hardwareProtected: true, // Assuming platform authenticator is hardware-backed
        metadata: {
          publicKey,
          keyHash: crypto.SHA256(publicKey).toString(),
          keyType: 'ECDSA',
          canBeExported: false,
          webAuthnId: credentialId
        }
      };
      
      // Store key info
      this.enclaveKeys.set(keyInfo.id, keyInfo);
      secureLocalStorage.setItem(`enclave_key_${keyInfo.id}`, JSON.stringify(keyInfo));
      
      return keyInfo;
    } catch (error) {
      console.error('Failed to create WebAuthn credential:', error);
      throw new Error(`Failed to create WebAuthn credential: ${error.message}`);
    }
  }

  /**
   * Sign with WebAuthn credential (for desktop browsers)
   */
  public async signWithWebAuthn(
    keyId: string,
    challenge: string
  ): Promise<string> {
    if (typeof window === 'undefined' || 
        typeof window.PublicKeyCredential === 'undefined') {
      throw new Error('WebAuthn not supported in this environment');
    }
    
    try {
      // Get key info
      const keyInfo = this.enclaveKeys.get(keyId);
      
      if (!keyInfo) {
        throw new Error(`Key ${keyId} not found`);
      }
      
      if (!keyInfo.metadata.webAuthnId) {
        throw new Error(`Key ${keyId} is not a WebAuthn credential`);
      }
      
      // Create assertion options
      const assertionOptions = {
        challenge: new TextEncoder().encode(challenge),
        allowCredentials: [{
          id: Uint8Array.from(atob(keyInfo.metadata.webAuthnId), c => c.charCodeAt(0)),
          type: 'public-key'
        }],
        userVerification: 'required', // Require biometric or PIN
        timeout: 60000 // 1 minute
      };
      
      // Get assertion
      const assertion = await (navigator as any).credentials.get({
        publicKey: assertionOptions
      });
      
      // Extract signature
      const signature = btoa(String.fromCharCode.apply(null, new Uint8Array(assertion.response.signature)));
      
      // Update key usage time
      keyInfo.lastUsedAt = new Date();
      this.enclaveKeys.set(keyId, keyInfo);
      secureLocalStorage.setItem(`enclave_key_${keyId}`, JSON.stringify(keyInfo));
      
      return signature;
    } catch (error) {
      console.error('Failed to sign with WebAuthn:', error);
      throw new Error(`Failed to sign with WebAuthn: ${error.message}`);
    }
  }
}