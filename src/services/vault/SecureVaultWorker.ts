// src/services/vault/SecureVaultWorker.ts
// This file runs in a separate Web Worker thread for process isolation

import { SecureVault, VaultOperationOptions, VaultSecurityLevel } from './SecureVault';

// Initialize the vault instance
const vault = SecureVault.getInstance();

// Set up message handling for vault operations
self.addEventListener('message', async (event) => {
  try {
    const { id, action, params } = event.data;
    
    // Process the request based on action type
    let result;
    
    switch (action) {
      case 'initialize':
        result = await vault.initialize(
          params.masterPassword,
          params.securityLevel || VaultSecurityLevel.STANDARD
        );
        break;
        
      case 'unlock':
        result = await vault.unlock(
          params.masterPassword,
          params.mfaCode
        );
        break;
        
      case 'lock':
        vault.lock();
        result = true;
        break;
        
      case 'createKey':
        result = await vault.createKey(
          params.name,
          params.keyType,
          params.blockchain,
          params.keyMaterial,
          params.password,
          params.policy,
          params.options
        );
        break;
        
      case 'getKey':
        result = await vault.getKey(
          params.keyId,
          params.password,
          params.options
        );
        break;
        
      case 'signWithKey':
        result = await vault.signWithKey(
          params.keyId,
          params.data,
          params.password,
          params.options
        );
        break;
        
      case 'exportKey':
        result = await vault.exportKey(
          params.keyId,
          params.password,
          params.options
        );
        break;
        
      case 'deleteKey':
        result = await vault.deleteKey(
          params.keyId,
          params.password,
          params.options
        );
        break;
        
      case 'createKeyBackup':
        result = await vault.createKeyBackup(
          params.keyId,
          params.password,
          params.backupOptions,
          params.options
        );
        break;
        
      case 'getKeys':
        result = vault.getKeys();
        break;
        
      case 'getStatus':
        result = vault.getStatus();
        break;
        
      case 'getAuditLog':
        result = vault.getAuditLog(
          params.limit,
          params.keyId
        );
        break;
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
    
    // Send successful response back to main thread
    self.postMessage({
      id,
      success: true,
      result
    });
  } catch (error) {
    // Send error back to main thread
    self.postMessage({
      id: event.data.id,
      success: false,
      error: error.message
    });
  }
});

// Signal that the worker is ready
self.postMessage({
  type: 'ready'
});

// Path: src/services/vault/vaultWorker.js (minified build output of the above)
// This is the file that will be loaded by the Web Worker

// For use in the main thread:
// src/services/vault/VaultClient.ts
import { v4 as uuidv4 } from 'uuid';

/**
 * Client for communicating with the SecureVault in a separate worker thread
 */
export class VaultClient {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private ready: boolean = false;
  private readyPromise: Promise<void>;
  private readyResolve: Function | null = null;
  
  constructor() {
    // Create the readyPromise
    this.readyPromise = new Promise((resolve) => {
      this.readyResolve = resolve;
    });
    
    this.initWorker();
  }
  
  /**
   * Initialize the Web Worker
   */
  private initWorker(): void {
    try {
      // Create a worker from the minified vault worker
      this.worker = new Worker('/js/vaultWorker.js');
      
      // Set up message handling
      this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
      
      // Set up error handling
      this.worker.addEventListener('error', (error) => {
        console.error('Vault worker error:', error);
        
        // Reject all pending requests
        this.pendingRequests.forEach(({ reject }) => {
          reject(new Error('Vault worker error'));
        });
        
        this.pendingRequests.clear();
        
        // Try to restart the worker
        this.worker = null;
        this.ready = false;
        setTimeout(() => this.initWorker(), 1000);
      });
    } catch (error) {
      console.error('Failed to initialize vault worker:', error);
    }
  }
  
  /**
   * Handle messages from the worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { id, type, success, result, error } = event.data;
    
    // Handle ready message
    if (type === 'ready') {
      this.ready = true;
      if (this.readyResolve) {
        this.readyResolve();
        this.readyResolve = null;
      }
      return;
    }
    
    // Handle response to a request
    const pendingRequest = this.pendingRequests.get(id);
    
    if (!pendingRequest) {
      console.warn('Received response for unknown request:', id);
      return;
    }
    
    // Remove from pending requests
    this.pendingRequests.delete(id);
    
    // Resolve or reject the promise
    if (success) {
      pendingRequest.resolve(result);
    } else {
      pendingRequest.reject(new Error(error));
    }
  }
  
  /**
   * Send a request to the worker
   */
  private async sendRequest(action: string, params: any = {}): Promise<any> {
    // Ensure worker is ready
    if (!this.ready) {
      await this.readyPromise;
    }
    
    // Ensure worker exists
    if (!this.worker) {
      throw new Error('Vault worker not available');
    }
    
    // Generate request ID
    const id = uuidv4();
    
    // Create a promise for the response
    const responsePromise = new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      
      // Set timeout to reject the promise after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error('Vault request timed out'));
        }
      }, 30000);
    });
    
    // Send the request to the worker
    this.worker.postMessage({ id, action, params });
    
    // Return the response promise
    return responsePromise;
  }
  
  /**
   * Wait for the vault to be ready
   */
  public async waitForReady(): Promise<void> {
    return this.readyPromise;
  }
  
  /**
   * Initialize the vault
   */
  public async initialize(
    masterPassword: string,
    securityLevel?: VaultSecurityLevel
  ): Promise<boolean> {
    return this.sendRequest('initialize', { masterPassword, securityLevel });
  }
  
  /**
   * Unlock the vault
   */
  public async unlock(
    masterPassword: string,
    mfaCode?: string
  ): Promise<boolean> {
    return this.sendRequest('unlock', { masterPassword, mfaCode });
  }
  
  /**
   * Lock the vault
   */
  public async lock(): Promise<boolean> {
    return this.sendRequest('lock');
  }
  
  /**
   * Create a new key in the vault
   */
  public async createKey(
    name: string,
    keyType: string,
    blockchain: string,
    keyMaterial: string,
    password: string,
    policy?: any,
    options?: any
  ): Promise<any> {
    return this.sendRequest('createKey', {
      name,
      keyType,
      blockchain,
      keyMaterial,
      password,
      policy,
      options
    });
  }
  
  /**
   * Get a key from the vault
   */
  public async getKey(
    keyId: string,
    password: string,
    options?: any
  ): Promise<string> {
    return this.sendRequest('getKey', { keyId, password, options });
  }
  
  /**
   * Sign data with a key in the vault
   */
  public async signWithKey(
    keyId: string,
    data: string | Uint8Array,
    password: string,
    options?: any
  ): Promise<string> {
    return this.sendRequest('signWithKey', { keyId, data, password, options });
  }
  
  /**
   * Export a key from the vault
   */
  public async exportKey(
    keyId: string,
    password: string,
    options?: any
  ): Promise<string> {
    return this.sendRequest('exportKey', { keyId, password, options });
  }
  
  /**
   * Delete a key from the vault
   */
  public async deleteKey(
    keyId: string,
    password: string,
    options?: any
  ): Promise<boolean> {
    return this.sendRequest('deleteKey', { keyId, password, options });
  }
  
  /**
   * Create a backup of a key
   */
  public async createKeyBackup(
    keyId: string,
    password: string,
    backupOptions: any,
    options?: any
  ): Promise<any> {
    return this.sendRequest('createKeyBackup', {
      keyId,
      password,
      backupOptions,
      options
    });
  }
  
  /**
   * Get all keys in the vault
   */
  public async getKeys(): Promise<any[]> {
    return this.sendRequest('getKeys');
  }
  
  /**
   * Get vault status
   */
  public async getStatus(): Promise<any> {
    return this.sendRequest('getStatus');
  }
  
  /**
   * Get audit log
   */
  public async getAuditLog(
    limit?: number,
    keyId?: string
  ): Promise<any[]> {
    return this.sendRequest('getAuditLog', { limit, keyId });
  }
}