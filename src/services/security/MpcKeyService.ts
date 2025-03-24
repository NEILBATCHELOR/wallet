// src/services/security/MpcKeyService.ts
import * as crypto from 'crypto-js';
import * as bip39 from 'bip39';
import * as elliptic from 'elliptic';
import { v4 as uuidv4 } from 'uuid';
import { SecureKeyService } from './SecureKeyService';

// Initialize elliptic curve
const ec = new elliptic.ec('secp256k1');

/**
 * Threshold Key Share
 */
export interface KeyShare {
  id: string;
  index: number;
  share: string; // Encrypted share value
  publicKey: string;
  participantId: string;
  keyId: string;
  createdAt: Date;
}

/**
 * MPC Ceremony session
 */
export interface MpcSession {
  id: string;
  type: 'generation' | 'signing';
  status: 'initialized' | 'in_progress' | 'completed' | 'failed';
  participants: string[];
  threshold: number;
  startedAt: Date;
  completedAt?: Date;
  keyId?: string;
  metadata: {
    sessionData?: any;
    tempPublicData?: any;
    transactionData?: any;
  };
}

/**
 * MPC Key information
 */
export interface MpcKeyInfo {
  id: string;
  name: string;
  publicKey: string;
  addresses: {
    [blockchain: string]: string;
  };
  threshold: number;
  participants: string[];
  createdAt: Date;
  algorithm: 'ecdsa-secp256k1' | 'ed25519';
  metadata: {
    verificationData: string;
    description?: string;
    tags?: string[];
  };
}

/**
 * Participant information
 */
export interface Participant {
  id: string;
  name: string;
  publicKey: string;
  deviceInfo?: {
    type: string;
    lastConnection?: Date;
  };
}

/**
 * MPC Signing request
 */
export interface SigningRequest {
  id: string;
  keyId: string;
  message: string; // Message to sign (hex encoded)
  requester: string;
  requiredParticipants: string[];
  threshold: number;
  createdAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'rejected';
  metadata: {
    transactionData?: any;
    description?: string;
    urgency?: 'low' | 'medium' | 'high';
  };
}

/**
 * Service for Multi-Party Computation key generation and signing
 */
export class MpcKeyService {
  private static instance: MpcKeyService;
  private secureKeyService: SecureKeyService;
  
  // In-memory storage (in a real app, these would be stored securely)
  private keyShares: Map<string, KeyShare> = new Map();
  private sessions: Map<string, MpcSession> = new Map();
  private keys: Map<string, MpcKeyInfo> = new Map();
  private participants: Map<string, Participant> = new Map();
  private signingRequests: Map<string, SigningRequest> = new Map();
  
  // Temporary session data (per device)
  private sessionData: Map<string, any> = new Map();

  private constructor() {
    this.secureKeyService = SecureKeyService.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): MpcKeyService {
    if (!MpcKeyService.instance) {
      MpcKeyService.instance = new MpcKeyService();
    }
    return MpcKeyService.instance;
  }

  /**
   * Initialize a new participant
   */
  public registerParticipant(name: string): Participant {
    // Generate a keypair for the participant for communication
    const keyPair = ec.genKeyPair();
    const publicKey = keyPair.getPublic('hex');
    const privateKey = keyPair.getPrivate('hex');
    
    // Create participant ID
    const id = uuidv4();
    
    // Create participant
    const participant: Participant = {
      id,
      name,
      publicKey,
      deviceInfo: {
        type: 'browser',
        lastConnection: new Date()
      }
    };
    
    // Store participant
    this.participants.set(id, participant);
    
    // Store private key securely (in a real app, this would be stored more securely)
    this.secureKeyService.storeEncryptedKey(
      `participant_${id}`,
      privateKey,
      'internal_secret',
      {
        name: `Participant ${name} Communication Key`,
        type: 'private_key',
        storageMethod: 'encrypted',
        metadata: {
          blockchain: 'internal',
          securityLevel: 'high',
          isBackedUp: false
        }
      }
    );
    
    return participant;
  }

  /**
   * Initiate MPC key generation
   */
  public initiateKeyGeneration(
    participantIds: string[],
    threshold: number,
    keyName: string,
    algorithm: 'ecdsa-secp256k1' | 'ed25519' = 'ecdsa-secp256k1'
  ): MpcSession {
    if (participantIds.length < threshold) {
      throw new Error('Number of participants must be greater than or equal to threshold');
    }
    
    // Validate all participants exist
    for (const participantId of participantIds) {
      if (!this.participants.has(participantId)) {
        throw new Error(`Participant ${participantId} does not exist`);
      }
    }
    
    // Create session ID
    const sessionId = uuidv4();
    
    // Create session
    const session: MpcSession = {
      id: sessionId,
      type: 'generation',
      status: 'initialized',
      participants: participantIds,
      threshold,
      startedAt: new Date(),
      metadata: {
        sessionData: {
          algorithm,
          keyName,
          step: 0,
          participantData: {}
        }
      }
    };
    
    // Store session
    this.sessions.set(sessionId, session);
    
    return session;
  }

  /**
   * Participate in key generation
   * This is a simplified implementation of Threshold ECDSA
   */
  public participateInKeyGeneration(
    sessionId: string,
    participantId: string,
    data?: any
  ): { success: boolean; nextStep?: number; completed?: boolean; data?: any } {
    // Get session
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (session.type !== 'generation') {
      throw new Error('Session is not for key generation');
    }
    
    if (!session.participants.includes(participantId)) {
      throw new Error('Participant is not part of this session');
    }
    
    // Update session status
    if (session.status === 'initialized') {
      session.status = 'in_progress';
    }
    
    // Get current step
    const currentStep = session.metadata.sessionData.step;
    
    // Process step
    switch (currentStep) {
      case 0: // Step 1: Generate key share
        // Generate a random polynomial for Shamir's Secret Sharing
        // In a real implementation, this would use proper MPC protocols
        const keyShare = this.generateKeyShare(participantId, session);
        
        // Store key share for this participant
        session.metadata.sessionData.participantData[participantId] = {
          commitments: keyShare.commitments,
          publicKey: keyShare.publicKey
        };
        
        // Increment step if all participants have submitted
        if (Object.keys(session.metadata.sessionData.participantData).length === session.participants.length) {
          session.metadata.sessionData.step = 1;
        }
        
        return {
          success: true,
          nextStep: 1,
          data: {
            commitments: keyShare.commitments,
            publicKey: keyShare.publicKey
          }
        };
        
      case 1: // Step 2: Exchange commitments and verify
        // Validate submitted data
        if (!data || !data.verificationData) {
          throw new Error('Invalid data submitted');
        }
        
        // In a real implementation, this would verify other participants' commitments
        session.metadata.sessionData.participantData[participantId].verified = true;
        
        // Check if all participants have verified
        const allVerified = Object.keys(session.metadata.sessionData.participantData)
          .every(pid => session.metadata.sessionData.participantData[pid].verified);
        
        if (allVerified) {
          // Generate the shared public key (in a real MPC implementation, this would be calculated)
          const sharedPublicKey = this.calculateSharedPublicKey(session);
          
          // Create key ID
          const keyId = uuidv4();
          
          // Create MPC key info
          const keyInfo: MpcKeyInfo = {
            id: keyId,
            name: session.metadata.sessionData.keyName,
            publicKey: sharedPublicKey,
            addresses: {},
            threshold: session.threshold,
            participants: session.participants,
            createdAt: new Date(),
            algorithm: session.metadata.sessionData.algorithm,
            metadata: {
              verificationData: crypto.SHA256(sharedPublicKey).toString()
            }
          };
          
          // Store key info
          this.keys.set(keyId, keyInfo);
          
          // Update session
          session.status = 'completed';
          session.completedAt = new Date();
          session.keyId = keyId;
          session.metadata.sessionData.step = 2;
          
          return {
            success: true,
            nextStep: 2,
            completed: true,
            data: {
              keyId,
              publicKey: sharedPublicKey
            }
          };
        }
        
        return {
          success: true,
          nextStep: 1,
          data: {
            verified: true
          }
        };
        
      default:
        throw new Error(`Invalid step: ${currentStep}`);
    }
  }

  /**
   * Generate a key share for a participant
   * In a real MPC implementation, this would use proper ECDSA threshold protocols
   */
  private generateKeyShare(participantId: string, session: MpcSession): any {
    // Generate a key pair for this participant
    const keyPair = ec.genKeyPair();
    const privateKey = keyPair.getPrivate('hex');
    const publicKey = keyPair.getPublic('hex');
    
    // Generate a nonce commitment (in a real implementation, this would follow MPC protocols)
    const nonce = crypto.lib.WordArray.random(32).toString();
    const commitment = crypto.SHA256(nonce + publicKey).toString();
    
    // Create a key share ID
    const shareId = uuidv4();
    
    // Encrypt the private key with a secret only this participant can access
    const encryptedShare = this.secureKeyService.encryptData(
      privateKey,
      `participant_secret_${participantId}`
    );
    
    // Create key share
    const keyShare: KeyShare = {
      id: shareId,
      index: session.participants.indexOf(participantId),
      share: encryptedShare,
      publicKey,
      participantId,
      keyId: '', // Will be set when key generation is complete
      createdAt: new Date()
    };
    
    // Store key share
    this.keyShares.set(shareId, keyShare);
    
    // Save in-memory session data
    this.sessionData.set(`session_${session.id}_${participantId}`, {
      privateKey,
      nonce,
      shareId
    });
    
    return {
      commitments: [commitment],
      publicKey
    };
  }

  /**
   * Calculate the shared public key from all participants
   * In a real MPC implementation, this would follow proper protocols
   */
  private calculateSharedPublicKey(session: MpcSession): string {
    // In a real implementation, this would be calculated using the MPC protocol
    // For this simplified implementation, we'll simulate it
    
    // Get all participant data
    const participantData = session.metadata.sessionData.participantData;
    
    // Create a dummy aggregated public key
    // In a real implementation, this would combine the participants' public keys
    return Object.values(participantData)
      .map((data: any) => data.publicKey)
      .join('_');
  }

  /**
   * Initiate a signing request
   */
  public initiateSigningRequest(
    keyId: string,
    message: string,
    requesterId: string,
    metadata: any = {}
  ): SigningRequest {
    // Get key info
    const keyInfo = this.keys.get(keyId);
    
    if (!keyInfo) {
      throw new Error('Key not found');
    }
    
    // Create signing request ID
    const requestId = uuidv4();
    
    // Create signing request
    const request: SigningRequest = {
      id: requestId,
      keyId,
      message,
      requester: requesterId,
      requiredParticipants: keyInfo.participants,
      threshold: keyInfo.threshold,
      createdAt: new Date(),
      status: 'pending',
      metadata: {
        ...metadata
      }
    };
    
    // Set expiration if provided
    if (metadata.expiresInHours) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + metadata.expiresInHours);
      request.expiresAt = expiresAt;
    }
    
    // Store signing request
    this.signingRequests.set(requestId, request);
    
    return request;
  }

  /**
   * Initiate MPC signing session
   */
  public initiateSigningSession(
    requestId: string,
    participantIds: string[]
  ): MpcSession {
    // Get signing request
    const request = this.signingRequests.get(requestId);
    
    if (!request) {
      throw new Error('Signing request not found');
    }
    
    // Check status
    if (request.status !== 'pending') {
      throw new Error(`Signing request is ${request.status}`);
    }
    
    // Get key info
    const keyInfo = this.keys.get(request.keyId);
    
    if (!keyInfo) {
      throw new Error('Key not found');
    }
    
    // Validate participants
    for (const participantId of participantIds) {
      if (!keyInfo.participants.includes(participantId)) {
        throw new Error(`Participant ${participantId} is not a key holder`);
      }
    }
    
    // Check if we have enough participants
    if (participantIds.length < keyInfo.threshold) {
      throw new Error(`Not enough participants. Need ${keyInfo.threshold}, have ${participantIds.length}`);
    }
    
    // Create session ID
    const sessionId = uuidv4();
    
    // Create session
    const session: MpcSession = {
      id: sessionId,
      type: 'signing',
      status: 'initialized',
      participants: participantIds,
      threshold: keyInfo.threshold,
      startedAt: new Date(),
      keyId: request.keyId,
      metadata: {
        sessionData: {
          requestId,
          message: request.message,
          step: 0,
          participantData: {}
        },
        transactionData: request.metadata.transactionData
      }
    };
    
    // Update request status
    request.status = 'in_progress';
    
    // Store session
    this.sessions.set(sessionId, session);
    
    return session;
  }

  /**
   * Participate in signing session
   * This is a simplified implementation of Threshold ECDSA signing
   */
  public participateInSigning(
    sessionId: string,
    participantId: string,
    data?: any
  ): { success: boolean; nextStep?: number; completed?: boolean; data?: any } {
    // Get session
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      throw new Error('Session not found');
    }
    
    if (session.type !== 'signing') {
      throw new Error('Session is not for signing');
    }
    
    if (!session.participants.includes(participantId)) {
      throw new Error('Participant is not part of this session');
    }
    
    // Update session status
    if (session.status === 'initialized') {
      session.status = 'in_progress';
    }
    
    // Get current step
    const currentStep = session.metadata.sessionData.step;
    
    // Process step
    switch (currentStep) {
      case 0: // Step 1: Generate signature share
        // In a real implementation, this would use proper MPC protocols
        const signatureShare = this.generateSignatureShare(
          participantId,
          session.keyId!,
          session.metadata.sessionData.message
        );
        
        // Store signature share for this participant
        session.metadata.sessionData.participantData[participantId] = {
          signatureShare
        };
        
        // Increment step if all participants have submitted
        if (Object.keys(session.metadata.sessionData.participantData).length === session.participants.length) {
          session.metadata.sessionData.step = 1;
        }
        
        return {
          success: true,
          nextStep: 1,
          data: {
            signatureShare
          }
        };
        
      case 1: // Step 2: Combine signature shares
        // In a real implementation, this would combine the signature shares using MPC
        
        // Check if all participants have submitted signature shares
        if (Object.keys(session.metadata.sessionData.participantData).length < session.threshold) {
          throw new Error('Not enough signature shares');
        }
        
        // Combine signature shares (in a real implementation, this would follow MPC protocols)
        const signature = this.combineSignatureShares(session);
        
        // Update signing request
        const request = this.signingRequests.get(session.metadata.sessionData.requestId);
        
        if (request) {
          request.status = 'completed';
          request.metadata.signature = signature;
        }
        
        // Update session
        session.status = 'completed';
        session.completedAt = new Date();
        session.metadata.sessionData.step = 2;
        
        return {
          success: true,
          nextStep: 2,
          completed: true,
          data: {
            signature
          }
        };
        
      default:
        throw new Error(`Invalid step: ${currentStep}`);
    }
  }

  /**
   * Generate a signature share for a participant
   * In a real MPC implementation, this would use proper ECDSA threshold protocols
   */
  private generateSignatureShare(participantId: string, keyId: string, message: string): string {
    // In a real implementation, this would fetch the participant's key share and use MPC
    
    // Simplified approach for this implementation
    // Get key shares for this participant
    let participantShare: KeyShare | undefined;
    
    this.keyShares.forEach(share => {
      if (share.participantId === participantId && share.keyId === keyId) {
        participantShare = share;
      }
    });
    
    if (!participantShare) {
      // In this simplified implementation, create a dummy share
      const keyPair = ec.genKeyPair();
      const signatureShare = keyPair.sign(message).toDER('hex');
      return signatureShare;
    }
    
    // Decrypt the share (in a real implementation, this would be more secure)
    const privateKey = this.secureKeyService.decryptData(
      participantShare.share,
      `participant_secret_${participantId}`
    );
    
    // Create key pair from private key
    const keyPair = ec.keyFromPrivate(privateKey, 'hex');
    
    // Sign the message
    const signature = keyPair.sign(message);
    
    // Return signature share
    return signature.toDER('hex');
  }

  /**
   * Combine signature shares into a complete signature
   * In a real MPC implementation, this would follow proper protocols
   */
  private combineSignatureShares(session: MpcSession): string {
    // In a real implementation, this would combine the signature shares using MPC
    
    // For this simplified implementation, we'll concatenate the first t shares
    const participants = Object.keys(session.metadata.sessionData.participantData);
    const threshold = session.threshold;
    
    const signatureShares = participants
      .slice(0, threshold)
      .map(pid => session.metadata.sessionData.participantData[pid].signatureShare);
    
    // Concatenate shares (this is not how real MPC works, just a placeholder)
    return signatureShares.join('_');
  }

  /**
   * Get key information
   */
  public getKeyInfo(keyId: string): MpcKeyInfo | undefined {
    return this.keys.get(keyId);
  }

  /**
   * Get all keys
   */
  public getAllKeys(): MpcKeyInfo[] {
    return Array.from(this.keys.values());
  }

  /**
   * Get signing request
   */
  public getSigningRequest(requestId: string): SigningRequest | undefined {
    return this.signingRequests.get(requestId);
  }

  /**
   * Get all signing requests for a key
   */
  public getKeySigningRequests(keyId: string): SigningRequest[] {
    return Array.from(this.signingRequests.values())
      .filter(request => request.keyId === keyId);
  }

  /**
   * Get participant information
   */
  public getParticipant(participantId: string): Participant | undefined {
    return this.participants.get(participantId);
  }

  /**
   * Update participant information
   */
  public updateParticipant(participantId: string, updates: Partial<Participant>): Participant {
    const participant = this.participants.get(participantId);
    
    if (!participant) {
      throw new Error('Participant not found');
    }
    
    // Update fields
    Object.assign(participant, updates);
    
    // Update last connection
    if (participant.deviceInfo) {
      participant.deviceInfo.lastConnection = new Date();
    }
    
    // Store updated participant
    this.participants.set(participantId, participant);
    
    return participant;
  }
}