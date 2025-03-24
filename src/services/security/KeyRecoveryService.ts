// src/services/security/KeyRecoveryService.ts
import * as crypto from 'crypto-js';
import * as shamir from 'shamir';
import secureLocalStorage from 'react-secure-storage';
import { v4 as uuidv4 } from 'uuid';
import { SecureKeyService } from './SecureKeyService';

/**
 * Recovery method supported by the system
 */
export enum RecoveryMethod {
  // Social recovery (trusted contacts hold shares)
  SOCIAL = 'social',
  
  // Time-based recovery (reveal after time delay)
  TIMELOCK = 'timelock',
  
  // Dead-man switch (automatic transfer after inactivity)
  DEADMAN = 'deadman',
  
  // Recovery phrases stored offline
  BACKUP = 'backup'
}

/**
 * Recovery share for social recovery or sharding
 */
export interface RecoveryShare {
  id: string;
  shareValue: string;
  guardianEmail?: string;
  guardianName?: string;
  createdAt: Date;
  expiresAt?: Date;
  isVerified: boolean;
  recoveryId: string;
  metadata: {
    shareIndex: number;
    threshold: number;
    totalShares: number;
    walletId?: string;
    keyType?: string;
    blockchain?: string;
  };
}

/**
 * Recovery setup information
 */
export interface RecoverySetup {
  id: string;
  method: RecoveryMethod;
  walletId: string;
  threshold: number;
  totalShares: number;
  createdAt: Date;
  activatedAt?: Date;
  expiresAt?: Date;
  guardians?: {
    email: string;
    name: string;
    shareId: string;
    hasVerified: boolean;
  }[];
  status: 'setup' | 'active' | 'recovered' | 'expired';
  metadata: {
    blockchain: string;
    timelockDuration?: number; // In days
    deadmanCheckInterval?: number; // In days
    safeAddress?: string; // For on-chain recovery with smart contracts
    recoveryContractAddress?: string;
  };
}

/**
 * Service for key recovery operations
 */
export class KeyRecoveryService {
  private static instance: KeyRecoveryService;
  private secureKeyService: SecureKeyService;
  private activeRecoveries: Map<string, {
    attempts: number;
    lastAttempt: Date;
    collectedShares: RecoveryShare[];
  }> = new Map();
  
  // Maximum allowed recovery attempts
  private MAX_ATTEMPTS = 5;
  
  // Lockout period after max attempts (in milliseconds)
  private LOCKOUT_PERIOD = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    this.secureKeyService = SecureKeyService.getInstance();
    this.setupPeriodicChecks();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): KeyRecoveryService {
    if (!KeyRecoveryService.instance) {
      KeyRecoveryService.instance = new KeyRecoveryService();
    }
    return KeyRecoveryService.instance;
  }

  /**
   * Set up periodic checks for timelocks and dead-man switches
   */
  private setupPeriodicChecks(): void {
    // Check once per day
    setInterval(() => {
      this.checkTimelockRecoveries();
      this.checkDeadmanSwitches();
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Check timelock recoveries that may have matured
   */
  private async checkTimelockRecoveries(): Promise<void> {
    try {
      const recoveries = this.getAllRecoverySetups();
      const now = new Date();
      
      for (const recovery of recoveries) {
        if (recovery.method === RecoveryMethod.TIMELOCK && 
            recovery.status === 'active' &&
            recovery.activatedAt) {
          
          // Calculate expiration date
          const expirationDate = new Date(recovery.activatedAt);
          expirationDate.setDate(expirationDate.getDate() + (recovery.metadata.timelockDuration || 0));
          
          // Check if timelock has expired
          if (now >= expirationDate) {
            // Update recovery status
            recovery.status = 'recovered';
            this.updateRecoverySetup(recovery);
            
            // Notify about available recovery
            console.log(`Timelock recovery ${recovery.id} is now available for wallet ${recovery.walletId}`);
            // In a real app, would send notifications or emails
          }
        }
      }
    } catch (error) {
      console.error('Failed to check timelock recoveries:', error);
    }
  }

  /**
   * Check dead-man switches that may have triggered
   */
  private async checkDeadmanSwitches(): Promise<void> {
    try {
      const recoveries = this.getAllRecoverySetups();
      const now = new Date();
      
      for (const recovery of recoveries) {
        if (recovery.method === RecoveryMethod.DEADMAN && 
            recovery.status === 'active') {
          
          // Get last activity timestamp for the wallet
          const lastActivity = this.getLastWalletActivity(recovery.walletId);
          
          if (!lastActivity) {
            continue;
          }
          
          // Calculate threshold date
          const thresholdDate = new Date(lastActivity);
          thresholdDate.setDate(thresholdDate.getDate() + (recovery.metadata.deadmanCheckInterval || 0));
          
          // Check if dead-man switch should trigger
          if (now >= thresholdDate) {
            // Update recovery status
            recovery.status = 'recovered';
            this.updateRecoverySetup(recovery);
            
            // Notify guardians
            this.notifyDeadmanSwitchGuardians(recovery);
          }
        }
      }
    } catch (error) {
      console.error('Failed to check dead-man switches:', error);
    }
  }
  
  /**
   * Get last wallet activity timestamp
   */
  private getLastWalletActivity(walletId: string): Date | null {
    // In a real app, this would check transaction history or login timestamps
    // For this implementation, we'll use a stored value
    const lastActivityStr = secureLocalStorage.getItem(`last_activity_${walletId}`);
    
    if (!lastActivityStr) {
      return null;
    }
    
    return new Date(lastActivityStr as string);
  }
  
  /**
   * Update wallet activity timestamp
   */
  public updateWalletActivity(walletId: string): void {
    secureLocalStorage.setItem(`last_activity_${walletId}`, new Date().toISOString());
  }
  
  /**
   * Notify guardians for dead-man switch activation
   */
  private notifyDeadmanSwitchGuardians(recovery: RecoverySetup): void {
    // In a real app, this would send emails or notifications to guardians
    console.log(`Dead-man switch activated for wallet ${recovery.walletId}. Notifying guardians.`);
    
    if (recovery.guardians) {
      for (const guardian of recovery.guardians) {
        console.log(`Would notify guardian ${guardian.name} at ${guardian.email}`);
        // Actual notification logic would go here
      }
    }
  }

  /**
   * Setup a new social recovery
   */
  public setupSocialRecovery(
    walletId: string,
    secret: string, // The sensitive data to recover (e.g., mnemonic)
    guardians: { name: string; email: string }[],
    threshold: number,
    metadata: {
      blockchain: string;
      [key: string]: any;
    }
  ): RecoverySetup {
    try {
      if (guardians.length < threshold) {
        throw new Error('Number of guardians must be greater than or equal to threshold');
      }
      
      // Create recovery ID
      const recoveryId = uuidv4();
      
      // Generate shares using Shamir's Secret Sharing
      const secretBytes = Buffer.from(secret, 'utf8');
      const shares = shamir.split(secretBytes, guardians.length, threshold);
      
      // Create recovery setup
      const setup: RecoverySetup = {
        id: recoveryId,
        method: RecoveryMethod.SOCIAL,
        walletId,
        threshold,
        totalShares: guardians.length,
        createdAt: new Date(),
        status: 'setup',
        guardians: [],
        metadata: {
          blockchain: metadata.blockchain,
          ...metadata
        }
      };
      
      // Create shares for each guardian
      for (let i = 0; i < guardians.length; i++) {
        const shareId = uuidv4();
        const shareValue = Buffer.from(shares[i]).toString('hex');
        
        // Store share information
        const recoveryShare: RecoveryShare = {
          id: shareId,
          shareValue,
          guardianEmail: guardians[i].email,
          guardianName: guardians[i].name,
          createdAt: new Date(),
          isVerified: false,
          recoveryId,
          metadata: {
            shareIndex: i + 1,
            threshold,
            totalShares: guardians.length,
            walletId,
            blockchain: metadata.blockchain
          }
        };
        
        // Store share in secure storage
        secureLocalStorage.setItem(`share_${shareId}`, JSON.stringify(recoveryShare));
        
        // Add guardian to setup
        setup.guardians?.push({
          email: guardians[i].email,
          name: guardians[i].name,
          shareId,
          hasVerified: false
        });
      }
      
      // Store recovery setup
      secureLocalStorage.setItem(`recovery_${recoveryId}`, JSON.stringify(setup));
      
      return setup;
    } catch (error) {
      console.error('Failed to setup social recovery:', error);
      throw new Error('Failed to setup social recovery');
    }
  }

  /**
   * Set up a timelock recovery
   */
  public setupTimelockRecovery(
    walletId: string,
    secret: string,
    durationDays: number,
    metadata: {
      blockchain: string;
      [key: string]: any;
    }
  ): RecoverySetup {
    try {
      // Create recovery ID
      const recoveryId = uuidv4();
      
      // Encrypt the secret with a known password
      // In a real system, this would be more complex, possibly using a smart contract
      const encryptedSecret = crypto.AES.encrypt(
        secret,
        `timelock_${recoveryId}_${walletId}`
      ).toString();
      
      // Store the encrypted secret
      secureLocalStorage.setItem(`timelock_secret_${recoveryId}`, encryptedSecret);
      
      // Create recovery setup
      const setup: RecoverySetup = {
        id: recoveryId,
        method: RecoveryMethod.TIMELOCK,
        walletId,
        threshold: 1,
        totalShares: 1,
        createdAt: new Date(),
        status: 'active',
        activatedAt: new Date(), // Timelock starts immediately
        metadata: {
          blockchain: metadata.blockchain,
          timelockDuration: durationDays,
          ...metadata
        }
      };
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + durationDays);
      setup.expiresAt = expiresAt;
      
      // Store recovery setup
      secureLocalStorage.setItem(`recovery_${recoveryId}`, JSON.stringify(setup));
      
      return setup;
    } catch (error) {
      console.error('Failed to setup timelock recovery:', error);
      throw new Error('Failed to setup timelock recovery');
    }
  }

  /**
   * Set up a dead-man switch recovery
   */
  public setupDeadmanSwitch(
    walletId: string,
    secret: string,
    inactivityDays: number,
    guardians: { name: string; email: string }[],
    metadata: {
      blockchain: string;
      [key: string]: any;
    }
  ): RecoverySetup {
    try {
      // Create recovery ID
      const recoveryId = uuidv4();
      
      // Encrypt the secret
      const encryptedSecret = crypto.AES.encrypt(
        secret,
        `deadman_${recoveryId}_${walletId}`
      ).toString();
      
      // Store the encrypted secret
      secureLocalStorage.setItem(`deadman_secret_${recoveryId}`, encryptedSecret);
      
      // Create recovery setup
      const setup: RecoverySetup = {
        id: recoveryId,
        method: RecoveryMethod.DEADMAN,
        walletId,
        threshold: 1,
        totalShares: guardians.length,
        createdAt: new Date(),
        status: 'active',
        activatedAt: new Date(),
        guardians: guardians.map(guardian => ({
          email: guardian.email,
          name: guardian.name,
          shareId: uuidv4(), // Just for identification, not actual shares
          hasVerified: false
        })),
        metadata: {
          blockchain: metadata.blockchain,
          deadmanCheckInterval: inactivityDays,
          ...metadata
        }
      };
      
      // Set initial wallet activity
      this.updateWalletActivity(walletId);
      
      // Store recovery setup
      secureLocalStorage.setItem(`recovery_${recoveryId}`, JSON.stringify(setup));
      
      return setup;
    } catch (error) {
      console.error('Failed to setup dead-man switch:', error);
      throw new Error('Failed to setup dead-man switch');
    }
  }

  /**
   * Add backup recovery phrases
   */
  public setupBackupRecovery(
    walletId: string,
    secret: string,
    password: string,
    metadata: {
      blockchain: string;
      [key: string]: any;
    }
  ): RecoverySetup {
    try {
      // Create recovery ID
      const recoveryId = uuidv4();
      
      // Encrypt the secret with provided password
      const encryptedSecret = crypto.AES.encrypt(secret, password).toString();
      
      // Store the encrypted secret
      secureLocalStorage.setItem(`backup_secret_${recoveryId}`, encryptedSecret);
      
      // Create recovery setup
      const setup: RecoverySetup = {
        id: recoveryId,
        method: RecoveryMethod.BACKUP,
        walletId,
        threshold: 1,
        totalShares: 1,
        createdAt: new Date(),
        status: 'active',
        activatedAt: new Date(),
        metadata: {
          blockchain: metadata.blockchain,
          ...metadata
        }
      };
      
      // Store recovery setup
      secureLocalStorage.setItem(`recovery_${recoveryId}`, JSON.stringify(setup));
      
      return setup;
    } catch (error) {
      console.error('Failed to setup backup recovery:', error);
      throw new Error('Failed to setup backup recovery');
    }
  }

  /**
   * Start recovery process
   */
  public startRecovery(
    recoveryId: string
  ): {
    recoverySetup: RecoverySetup;
    requiredShares: number;
  } {
    try {
      // Check if recovery exists
      const recoverySetupStr = secureLocalStorage.getItem(`recovery_${recoveryId}`);
      
      if (!recoverySetupStr) {
        throw new Error('Recovery setup not found');
      }
      
      const recoverySetup = JSON.parse(recoverySetupStr as string) as RecoverySetup;
      
      // Check if recovery is active
      if (recoverySetup.status !== 'active' && recoverySetup.status !== 'setup') {
        if (recoverySetup.status === 'recovered') {
          throw new Error('This recovery has already been completed');
        } else {
          throw new Error('This recovery is not active');
        }
      }
      
      // Check rate limiting
      const recoveryAttempt = this.activeRecoveries.get(recoveryId);
      
      if (recoveryAttempt) {
        if (recoveryAttempt.attempts >= this.MAX_ATTEMPTS) {
          const timeSinceLastAttempt = Date.now() - recoveryAttempt.lastAttempt.getTime();
          
          if (timeSinceLastAttempt < this.LOCKOUT_PERIOD) {
            const remainingLockout = Math.ceil((this.LOCKOUT_PERIOD - timeSinceLastAttempt) / (60 * 1000));
            throw new Error(`Too many recovery attempts. Please try again in ${remainingLockout} minutes.`);
          } else {
            // Reset attempts after lockout period
            this.activeRecoveries.set(recoveryId, {
              attempts: 1,
              lastAttempt: new Date(),
              collectedShares: []
            });
          }
        } else {
          // Increment attempts
          this.activeRecoveries.set(recoveryId, {
            attempts: recoveryAttempt.attempts + 1,
            lastAttempt: new Date(),
            collectedShares: recoveryAttempt.collectedShares
          });
        }
      } else {
        // Initialize recovery attempt
        this.activeRecoveries.set(recoveryId, {
          attempts: 1,
          lastAttempt: new Date(),
          collectedShares: []
        });
      }
      
      return {
        recoverySetup,
        requiredShares: recoverySetup.threshold
      };
    } catch (error) {
      console.error('Failed to start recovery:', error);
      throw error;
    }
  }

  /**
   * Submit a recovery share
   */
  public submitRecoveryShare(
    recoveryId: string,
    shareId: string,
    shareValue: string
  ): {
    accepted: boolean;
    remainingShares: number;
    recoveryComplete: boolean;
  } {
    try {
      // Get recovery attempt
      const recoveryAttempt = this.activeRecoveries.get(recoveryId);
      
      if (!recoveryAttempt) {
        throw new Error('Recovery not started');
      }
      
      // Get recovery setup
      const recoverySetupStr = secureLocalStorage.getItem(`recovery_${recoveryId}`);
      
      if (!recoverySetupStr) {
        throw new Error('Recovery setup not found');
      }
      
      const recoverySetup = JSON.parse(recoverySetupStr as string) as RecoverySetup;
      
      if (recoverySetup.method !== RecoveryMethod.SOCIAL) {
        throw new Error('This recovery method does not use shares');
      }
      
      // Validate share
      const shareStr = secureLocalStorage.getItem(`share_${shareId}`);
      
      if (!shareStr) {
        throw new Error('Share not found');
      }
      
      const share = JSON.parse(shareStr as string) as RecoveryShare;
      
      if (share.recoveryId !== recoveryId) {
        throw new Error('Share does not belong to this recovery');
      }
      
      // Check if share is already submitted
      if (recoveryAttempt.collectedShares.some(s => s.id === shareId)) {
        throw new Error('Share already submitted');
      }
      
      // Add share to collected shares
      recoveryAttempt.collectedShares.push({
        ...share,
        shareValue // Use provided value for verification
      });
      
      // Update active recovery
      this.activeRecoveries.set(recoveryId, {
        ...recoveryAttempt,
        lastAttempt: new Date()
      });
      
      // Check if we have enough shares
      const remainingShares = Math.max(0, recoverySetup.threshold - recoveryAttempt.collectedShares.length);
      const recoveryComplete = remainingShares === 0;
      
      return {
        accepted: true,
        remainingShares,
        recoveryComplete
      };
    } catch (error) {
      console.error('Failed to submit recovery share:', error);
      throw error;
    }
  }

  /**
   * Complete social recovery and retrieve secret
   */
  public completeSocialRecovery(
    recoveryId: string
  ): string {
    try {
      // Get recovery attempt
      const recoveryAttempt = this.activeRecoveries.get(recoveryId);
      
      if (!recoveryAttempt) {
        throw new Error('Recovery not started');
      }
      
      // Get recovery setup
      const recoverySetupStr = secureLocalStorage.getItem(`recovery_${recoveryId}`);
      
      if (!recoverySetupStr) {
        throw new Error('Recovery setup not found');
      }
      
      const recoverySetup = JSON.parse(recoverySetupStr as string) as RecoverySetup;
      
      // Check if we have enough shares
      if (recoveryAttempt.collectedShares.length < recoverySetup.threshold) {
        throw new Error(`Not enough shares. Need ${recoverySetup.threshold}, have ${recoveryAttempt.collectedShares.length}`);
      }
      
      // Convert shares to the format expected by shamir-secret-sharing
      const shares = recoveryAttempt.collectedShares.map(share => {
        const shareIndex = share.metadata.shareIndex;
        const shareBytes = Buffer.from(share.shareValue, 'hex');
        return { i: shareIndex, v: shareBytes };
      });
      
      // Combine shares
      const combinedSecret = shamir.combine(shares);
      const secret = Buffer.from(combinedSecret).toString('utf8');
      
      // Update recovery status
      recoverySetup.status = 'recovered';
      secureLocalStorage.setItem(`recovery_${recoveryId}`, JSON.stringify(recoverySetup));
      
      // Clean up
      this.activeRecoveries.delete(recoveryId);
      
      return secret;
    } catch (error) {
      console.error('Failed to complete social recovery:', error);
      throw error;
    }
  }

  /**
   * Complete timelock recovery
   */
  public completeTimelockRecovery(
    recoveryId: string
  ): string {
    try {
      // Get recovery setup
      const recoverySetupStr = secureLocalStorage.getItem(`recovery_${recoveryId}`);
      
      if (!recoverySetupStr) {
        throw new Error('Recovery setup not found');
      }
      
      const recoverySetup = JSON.parse(recoverySetupStr as string) as RecoverySetup;
      
      if (recoverySetup.method !== RecoveryMethod.TIMELOCK) {
        throw new Error('This is not a timelock recovery');
      }
      
      // Check if timelock has expired
      const now = new Date();
      const expirationDate = new Date(recoverySetup.activatedAt!);
      expirationDate.setDate(expirationDate.getDate() + (recoverySetup.metadata.timelockDuration || 0));
      
      if (now < expirationDate) {
        const remainingDays = Math.ceil((expirationDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
        throw new Error(`Timelock has not expired. ${remainingDays} days remaining.`);
      }
      
      // Get encrypted secret
      const encryptedSecret = secureLocalStorage.getItem(`timelock_secret_${recoveryId}`);
      
      if (!encryptedSecret) {
        throw new Error('Encrypted secret not found');
      }
      
      // Decrypt the secret
      const decryptedSecret = crypto.AES.decrypt(
        encryptedSecret as string,
        `timelock_${recoveryId}_${recoverySetup.walletId}`
      ).toString(crypto.enc.Utf8);
      
      // Update recovery status
      recoverySetup.status = 'recovered';
      secureLocalStorage.setItem(`recovery_${recoveryId}`, JSON.stringify(recoverySetup));
      
      return decryptedSecret;
    } catch (error) {
      console.error('Failed to complete timelock recovery:', error);
      throw error;
    }
  }

  /**
   * Complete backup recovery
   */
  public completeBackupRecovery(
    recoveryId: string,
    password: string
  ): string {
    try {
      // Get recovery setup
      const recoverySetupStr = secureLocalStorage.getItem(`recovery_${recoveryId}`);
      
      if (!recoverySetupStr) {
        throw new Error('Recovery setup not found');
      }
      
      const recoverySetup = JSON.parse(recoverySetupStr as string) as RecoverySetup;
      
      if (recoverySetup.method !== RecoveryMethod.BACKUP) {
        throw new Error('This is not a backup recovery');
      }
      
      // Get encrypted secret
      const encryptedSecret = secureLocalStorage.getItem(`backup_secret_${recoveryId}`);
      
      if (!encryptedSecret) {
        throw new Error('Encrypted secret not found');
      }
      
      // Decrypt the secret
      const decryptedSecret = crypto.AES.decrypt(
        encryptedSecret as string,
        password
      ).toString(crypto.enc.Utf8);
      
      if (!decryptedSecret) {
        throw new Error('Invalid password');
      }
      
      // Update recovery status
      recoverySetup.status = 'recovered';
      secureLocalStorage.setItem(`recovery_${recoveryId}`, JSON.stringify(recoverySetup));
      
      return decryptedSecret;
    } catch (error) {
      console.error('Failed to complete backup recovery:', error);
      throw error;
    }
  }

  /**
   * Get all recovery setups for a wallet
   */
  public getWalletRecoveries(walletId: string): RecoverySetup[] {
    try {
      const recoveries: RecoverySetup[] = [];
      
      // Iterate through all recoveries in secure storage
      for (let i = 0; i < secureLocalStorage.length; i++) {
        const key = secureLocalStorage.key(i);
        
        if (key && key.startsWith('recovery_')) {
          const recoveryStr = secureLocalStorage.getItem(key);
          
          if (recoveryStr) {
            const recovery = JSON.parse(recoveryStr as string) as RecoverySetup;
            
            if (recovery.walletId === walletId) {
              recoveries.push(recovery);
            }
          }
        }
      }
      
      return recoveries;
    } catch (error) {
      console.error('Failed to get wallet recoveries:', error);
      return [];
    }
  }

  /**
   * Get all recovery setups
   */
  public getAllRecoverySetups(): RecoverySetup[] {
    try {
      const recoveries: RecoverySetup[] = [];
      
      // Iterate through all recoveries in secure storage
      for (let i = 0; i < secureLocalStorage.length; i++) {
        const key = secureLocalStorage.key(i);
        
        if (key && key.startsWith('recovery_')) {
          const recoveryStr = secureLocalStorage.getItem(key);
          
          if (recoveryStr) {
            const recovery = JSON.parse(recoveryStr as string) as RecoverySetup;
            recoveries.push(recovery);
          }
        }
      }
      
      return recoveries;
    } catch (error) {
      console.error('Failed to get all recovery setups:', error);
      return [];
    }
  }

  /**
   * Update recovery setup
   */
  private updateRecoverySetup(recovery: RecoverySetup): void {
    secureLocalStorage.setItem(`recovery_${recovery.id}`, JSON.stringify(recovery));
  }

  /**
   * Generate recovery share QR codes and printable instructions
   */
  public generateRecoveryShareInstructions(
    recoveryId: string
  ): {
    guardianInstructions: Array<{
      guardianName: string;
      guardianEmail: string;
      shareId: string;
      qrCodeData: string;
      instructions: string;
    }>;
  } {
    try {
      // Get recovery setup
      const recoverySetupStr = secureLocalStorage.getItem(`recovery_${recoveryId}`);
      
      if (!recoverySetupStr) {
        throw new Error('Recovery setup not found');
      }
      
      const recoverySetup = JSON.parse(recoverySetupStr as string) as RecoverySetup;
      
      if (recoverySetup.method !== RecoveryMethod.SOCIAL || !recoverySetup.guardians) {
        throw new Error('This recovery does not have guardian shares');
      }
      
      const guardianInstructions: Array<{
        guardianName: string;
        guardianEmail: string;
        shareId: string;
        qrCodeData: string;
        instructions: string;
      }> = [];
      
      // Generate instructions for each guardian
      for (const guardian of recoverySetup.guardians) {
        // Get share
        const shareStr = secureLocalStorage.getItem(`share_${guardian.shareId}`);
        
        if (!shareStr) {
          continue;
        }
        
        const share = JSON.parse(shareStr as string) as RecoveryShare;
        
        // Create QR code data
        const qrData = {
          shareId: share.id,
          recoveryId: share.recoveryId,
          shareValue: share.shareValue,
          walletId: share.metadata.walletId,
          threshold: share.metadata.threshold,
          totalShares: share.metadata.totalShares,
          shareIndex: share.metadata.shareIndex
        };
        
        const qrCodeData = JSON.stringify(qrData);
        
        // Generate instructions
        const instructions = `
          Recovery Instructions for ${guardian.name}
          
          You have been trusted as a guardian for a cryptocurrency wallet recovery.
          
          If the wallet owner ever needs to recover their wallet, they will contact you
          and ask you to provide this recovery share. This is share ${share.metadata.shareIndex} 
          of ${share.metadata.totalShares}, and at least ${share.metadata.threshold} shares are 
          needed for recovery.
          
          Instructions for recovery:
          1. The wallet owner will provide you with a recovery link or QR code
          2. Scan the QR code below or enter the share ID and value manually
          3. Follow the on-screen instructions to help recover the wallet
          
          IMPORTANT SECURITY NOTES:
          - Keep this document in a secure location
          - Do not share this information with anyone other than the wallet owner
          - Verify the identity of anyone requesting this recovery information
          
          Share ID: ${share.id}
          Recovery ID: ${share.recoveryId}
        `;
        
        guardianInstructions.push({
          guardianName: guardian.name,
          guardianEmail: guardian.email,
          shareId: guardian.shareId,
          qrCodeData,
          instructions
        });
      }
      
      return { guardianInstructions };
    } catch (error) {
      console.error('Failed to generate recovery share instructions:', error);
      throw error;
    }
  }

  /**
   * Cancel a recovery setup
   */
  public cancelRecovery(recoveryId: string): boolean {
    try {
      // Get recovery setup
      const recoverySetupStr = secureLocalStorage.getItem(`recovery_${recoveryId}`);
      
      if (!recoverySetupStr) {
        throw new Error('Recovery setup not found');
      }
      
      const recoverySetup = JSON.parse(recoverySetupStr as string) as RecoverySetup;
      
      // Delete recovery data based on method
      if (recoverySetup.method === RecoveryMethod.SOCIAL) {
        // Delete all shares
        if (recoverySetup.guardians) {
          for (const guardian of recoverySetup.guardians) {
            secureLocalStorage.removeItem(`share_${guardian.shareId}`);
          }
        }
      } else if (recoverySetup.method === RecoveryMethod.TIMELOCK) {
        secureLocalStorage.removeItem(`timelock_secret_${recoveryId}`);
      } else if (recoverySetup.method === RecoveryMethod.DEADMAN) {
        secureLocalStorage.removeItem(`deadman_secret_${recoveryId}`);
      } else if (recoverySetup.method === RecoveryMethod.BACKUP) {
        secureLocalStorage.removeItem(`backup_secret_${recoveryId}`);
      }
      
      // Delete recovery setup
      secureLocalStorage.removeItem(`recovery_${recoveryId}`);
      
      // Clean up active recovery if exists
      this.activeRecoveries.delete(recoveryId);
      
      return true;
    } catch (error) {
      console.error('Failed to cancel recovery:', error);
      return false;
    }
  }
}