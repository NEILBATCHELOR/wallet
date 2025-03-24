// src/services/security/ColdStorageService.ts
import * as bip39 from 'bip39';
import * as qrcode from 'qrcode';
import * as crypto from 'crypto-js';
import * as zxing from '@zxing/browser';
import { SecureKeyService } from './SecureKeyService';

/**
 * Cold storage format
 */
export enum ColdStorageFormat {
  QR_CODE = 'qr',          // QR code encryption
  PAPER_KEY = 'paper',     // Human-readable for paper storage
  METAL_BACKUP = 'metal',  // Format optimized for metal backups
  AIR_GAPPED = 'airgap',   // For air-gapped device (special format)
  SEED_PHRASE = 'seed'     // Standard mnemonic phrase (BIP-39)
}

/**
 * Air gap transaction format
 */
export interface AirGapTransaction {
  blockchain: string;
  type: 'transfer' | 'contract' | 'token';
  from: string;
  to: string;
  value: string;
  data?: string;
  gasLimit?: string;
  nonce?: number;
  chainId?: number;
  metadata?: {
    tokenSymbol?: string;
    tokenDecimals?: number;
    contractMethod?: string;
    description?: string;
    [key: string]: any;
  };
}

/**
 * Backup verification status
 */
export interface BackupVerificationStatus {
  verified: boolean;
  timestamp?: Date;
  method: ColdStorageFormat;
  checksum: string;
}

/**
 * Service for cold storage operations
 */
export class ColdStorageService {
  private static instance: ColdStorageService;
  private secureKeyService: SecureKeyService;
  private qrCodeScanner: zxing.BrowserQRCodeReader;
  
  // Map of key ID to backup verification status
  private verificationStatus: Map<string, BackupVerificationStatus> = new Map();

  private constructor() {
    this.secureKeyService = SecureKeyService.getInstance();
    this.qrCodeScanner = new zxing.BrowserQRCodeReader();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ColdStorageService {
    if (!ColdStorageService.instance) {
      ColdStorageService.instance = new ColdStorageService();
    }
    return ColdStorageService.instance;
  }

  /**
   * Generate BIP-39 mnemonic seed phrase
   */
  public generateSeedPhrase(strength: 128 | 256 = 256): string {
    try {
      return this.secureKeyService.generateMnemonic(strength);
    } catch (error) {
      console.error('Failed to generate seed phrase:', error);
      throw new Error('Failed to generate secure seed phrase');
    }
  }

  /**
   * Generate QR code for cold storage
   */
  public async generateQRCode(
    secret: string,
    password: string,
    options: {
      keyId?: string;
      walletName?: string;
      blockchain?: string;
      format?: 'svg' | 'dataURL';
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
      includeChecksumInQR?: boolean;
    } = {}
  ): Promise<string> {
    try {
      // Generate a checksum of the secret
      const checksum = this.generateChecksum(secret);
      
      // Add metadata
      const qrData = {
        v: 1, // Version
        t: 'cold_storage',
        secret: this.secureKeyService.encryptData(secret, password),
        checksum: checksum,
        id: options.keyId || crypto.lib.WordArray.random(16).toString(),
        wallet: options.walletName,
        blockchain: options.blockchain,
        created: new Date().toISOString()
      };
      
      // Generate QR code
      const format = options.format || 'dataURL';
      const errorCorrectionLevel = options.errorCorrectionLevel || 'H'; // Highest error correction
      
      const qrCodeString = JSON.stringify(qrData);
      const qrCodeOptions = {
        errorCorrectionLevel,
        type: format,
        margin: 1,
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      };
      
      const qrCodeImage = await qrcode.toDataURL(qrCodeString, qrCodeOptions);
      
      // Store verification status
      if (options.keyId) {
        this.verificationStatus.set(options.keyId, {
          verified: false,
          method: ColdStorageFormat.QR_CODE,
          checksum
        });
      }
      
      return qrCodeImage;
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      throw new Error('Failed to generate QR code for cold storage');
    }
  }

  /**
   * Generate paper key format
   */
  public generatePaperKey(
    secret: string,
    options: {
      keyId?: string;
      walletName?: string;
      blockchain?: string;
      includeWordNumbers?: boolean;
    } = {}
  ): string {
    try {
      let paperKeyFormat = '';
      
      // Check if the secret is a BIP-39 mnemonic
      if (bip39.validateMnemonic(secret)) {
        // It's a mnemonic, format it appropriately
        const words = secret.split(' ');
        
        if (options.includeWordNumbers) {
          // Format with word numbers
          paperKeyFormat = words.map((word, index) => 
            `${(index + 1).toString().padStart(2, '0')}: ${word}`
          ).join('\n');
        } else {
          // Format in groups of 4 words per line
          const lines = [];
          for (let i = 0; i < words.length; i += 4) {
            lines.push(words.slice(i, i + 4).join('  '));
          }
          paperKeyFormat = lines.join('\n');
        }
      } else {
        // It's not a mnemonic, format as hex with groups of 4
        const hexSecret = Buffer.from(secret).toString('hex');
        let formattedHex = '';
        
        for (let i = 0; i < hexSecret.length; i += 4) {
          formattedHex += hexSecret.substring(i, i + 4) + ' ';
          
          // Add a newline every 32 characters (8 groups of 4)
          if ((i + 4) % 32 === 0) {
            formattedHex += '\n';
          }
        }
        
        paperKeyFormat = formattedHex.trim();
      }
      
      // Generate a checksum
      const checksum = this.generateChecksum(secret);
      
      // Create the complete paper key document
      const walletInfo = options.walletName ? `Wallet: ${options.walletName}` : '';
      const blockchainInfo = options.blockchain ? `Blockchain: ${options.blockchain}` : '';
      const idInfo = options.keyId ? `ID: ${options.keyId}` : '';
      const dateInfo = `Created: ${new Date().toISOString().split('T')[0]}`;
      
      const paperKey = `
COLD STORAGE BACKUP
=============================
${walletInfo}
${blockchainInfo}
${idInfo}
${dateInfo}
Checksum: ${checksum.substring(0, 8)}

${paperKeyFormat}

=============================
KEEP THIS DOCUMENT SECURE!
This is your PRIVATE KEY.
Anyone with this information can access your funds.
      `.trim();
      
      // Store verification status
      if (options.keyId) {
        this.verificationStatus.set(options.keyId, {
          verified: false,
          method: ColdStorageFormat.PAPER_KEY,
          checksum
        });
      }
      
      return paperKey;
    } catch (error) {
      console.error('Failed to generate paper key:', error);
      throw new Error('Failed to generate paper key backup');
    }
  }

  /**
   * Format metal backup text (optimized for metal storage)
   */
  public generateMetalBackup(
    secret: string,
    options: {
      keyId?: string;
      walletName?: string;
      format?: 'standard' | 'hex' | 'position';
    } = {}
  ): {
    words: Array<{ index: number; word: string; }>;
    checksumWords: Array<{ index: number; word: string; }>;
    format: string;
  } {
    try {
      const format = options.format || 'standard';
      let words: Array<{index: number; word: string}> = [];
      
      // Check if the secret is a BIP-39 mnemonic
      if (bip39.validateMnemonic(secret)) {
        // Get the wordlist
        const wordlist = bip39.wordlists.english;
        
        // Split the mnemonic into words
        const mnemonicWords = secret.split(' ');
        
        // Format based on the selected format
        if (format === 'standard') {
          // Standard format: just the words with their indices
          words = mnemonicWords.map((word, index) => ({
            index: index + 1,
            word
          }));
        } else if (format === 'position') {
          // Position format: word index in BIP-39 wordlist + position
          words = mnemonicWords.map((word, index) => {
            const wordIndex = wordlist.indexOf(word);
            return {
              index: index + 1,
              word: `${wordIndex}`,
              position: `${index + 1}-${wordIndex}`
            };
          });
        }
      } else {
        // It's not a mnemonic, format as hex
        const hexSecret = Buffer.from(secret).toString('hex');
        words = Array.from(hexSecret).map((char, index) => ({
          index: index + 1,
          word: char
        }));
      }
      
      // Generate checksum words
      const checksum = this.generateChecksum(secret);
      const checksumWords = Array.from(checksum.substring(0, 8)).map((char, index) => ({
        index: index + 1,
        word: char
      }));
      
      // Store verification status
      if (options.keyId) {
        this.verificationStatus.set(options.keyId, {
          verified: false,
          method: ColdStorageFormat.METAL_BACKUP,
          checksum
        });
      }
      
      return {
        words,
        checksumWords,
        format
      };
    } catch (error) {
      console.error('Failed to generate metal backup:', error);
      throw new Error('Failed to generate metal backup format');
    }
  }

  /**
   * Generate air-gapped transaction
   */
  public async generateAirGapTransaction(
    transaction: AirGapTransaction,
    options: {
      format?: 'qr' | 'text';
      qrStyle?: 'svg' | 'dataURL';
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    } = {}
  ): Promise<string> {
    try {
      const format = options.format || 'qr';
      
      // Create the transaction data
      const txData = {
        v: 1, // Version
        t: 'air_gap_tx',
        blockchain: transaction.blockchain,
        type: transaction.type,
        from: transaction.from,
        to: transaction.to,
        value: transaction.value,
        data: transaction.data,
        gasLimit: transaction.gasLimit,
        nonce: transaction.nonce,
        chainId: transaction.chainId,
        metadata: transaction.metadata,
        ts: Date.now()
      };
      
      // Generate checksum
      const txString = JSON.stringify(txData);
      const checksum = crypto.SHA256(txString).toString().substring(0, 16);
      
      // Add checksum
      const finalTxData = {
        ...txData,
        checksum
      };
      
      if (format === 'qr') {
        // Generate QR code
        const qrStyle = options.qrStyle || 'dataURL';
        const errorCorrectionLevel = options.errorCorrectionLevel || 'H';
        
        const qrCodeOptions = {
          errorCorrectionLevel,
          type: qrStyle,
          margin: 1,
          width: 300,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        };
        
        return await qrcode.toDataURL(JSON.stringify(finalTxData), qrCodeOptions);
      } else {
        // Return as formatted text
        return JSON.stringify(finalTxData, null, 2);
      }
    } catch (error) {
      console.error('Failed to generate air-gapped transaction:', error);
      throw new Error('Failed to generate air-gapped transaction');
    }
  }

  /**
   * Scan QR code from image
   */
  public async scanQRCode(
    imageElement: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement
  ): Promise<any> {
    try {
      const result = await this.qrCodeScanner.decodeFromElement(imageElement);
      
      if (!result) {
        throw new Error('No QR code found in image');
      }
      
      // Parse the QR code data
      try {
        return JSON.parse(result.getText());
      } catch (parseError) {
        return result.getText(); // Return as string if not JSON
      }
    } catch (error) {
      console.error('Failed to scan QR code:', error);
      throw new Error('Failed to scan QR code: ' + error.message);
    }
  }

  /**
   * Verify and decode cold storage backup
   */
  public async verifyColdStorage(
    encodedData: string,
    password: string,
    options: {
      keyId?: string;
    } = {}
  ): Promise<{
    isValid: boolean;
    secret?: string;
    metadata?: {
      id: string;
      wallet?: string;
      blockchain?: string;
      created?: string;
    };
  }> {
    try {
      // Parse the encoded data
      let parsedData;
      
      try {
        parsedData = JSON.parse(encodedData);
      } catch (parseError) {
        // Check if it's a base64 data URL (QR code image)
        if (encodedData.startsWith('data:image/')) {
          // Create an image element to scan
          const img = new Image();
          img.src = encodedData;
          
          // Wait for image to load
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          
          // Scan the QR code
          const qrResult = await this.scanQRCode(img);
          parsedData = qrResult;
        } else {
          throw new Error('Invalid data format');
        }
      }
      
      // Validate data structure
      if (!parsedData || typeof parsedData !== 'object' || !parsedData.secret || !parsedData.checksum) {
        throw new Error('Invalid cold storage format');
      }
      
      // Decrypt the secret
      const secret = this.secureKeyService.decryptData(parsedData.secret, password);
      
      // Verify checksum
      const calculatedChecksum = this.generateChecksum(secret);
      const isValid = calculatedChecksum === parsedData.checksum;
      
      // Update verification status
      if (options.keyId) {
        this.verificationStatus.set(options.keyId, {
          verified: isValid,
          timestamp: new Date(),
          method: ColdStorageFormat.QR_CODE,
          checksum: calculatedChecksum
        });
      }
      
      return {
        isValid,
        secret: isValid ? secret : undefined,
        metadata: {
          id: parsedData.id,
          wallet: parsedData.wallet,
          blockchain: parsedData.blockchain,
          created: parsedData.created
        }
      };
    } catch (error) {
      console.error('Failed to verify cold storage:', error);
      throw error;
    }
  }

  /**
   * Process air-gapped transaction
   */
  public async processAirGapTransaction(
    encodedData: string
  ): Promise<{
    transaction: AirGapTransaction;
    valid: boolean;
  }> {
    try {
      // Parse the encoded data
      let parsedData;
      
      try {
        parsedData = JSON.parse(encodedData);
      } catch (parseError) {
        // Check if it's a base64 data URL (QR code image)
        if (encodedData.startsWith('data:image/')) {
          // Create an image element to scan
          const img = new Image();
          img.src = encodedData;
          
          // Wait for image to load
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
          });
          
          // Scan the QR code
          const qrResult = await this.scanQRCode(img);
          parsedData = qrResult;
        } else {
          throw new Error('Invalid data format');
        }
      }
      
      // Validate data structure
      if (!parsedData || typeof parsedData !== 'object' || parsedData.t !== 'air_gap_tx') {
        throw new Error('Invalid air-gapped transaction format');
      }
      
      // Extract transaction data
      const transaction: AirGapTransaction = {
        blockchain: parsedData.blockchain,
        type: parsedData.type,
        from: parsedData.from,
        to: parsedData.to,
        value: parsedData.value,
        data: parsedData.data,
        gasLimit: parsedData.gasLimit,
        nonce: parsedData.nonce,
        chainId: parsedData.chainId,
        metadata: parsedData.metadata
      };
      
      // Verify checksum
      const txString = JSON.stringify({
        v: parsedData.v,
        t: parsedData.t,
        blockchain: parsedData.blockchain,
        type: parsedData.type,
        from: parsedData.from,
        to: parsedData.to,
        value: parsedData.value,
        data: parsedData.data,
        gasLimit: parsedData.gasLimit,
        nonce: parsedData.nonce,
        chainId: parsedData.chainId,
        metadata: parsedData.metadata,
        ts: parsedData.ts
      });
      
      const calculatedChecksum = crypto.SHA256(txString).toString().substring(0, 16);
      const valid = calculatedChecksum === parsedData.checksum;
      
      return {
        transaction,
        valid
      };
    } catch (error) {
      console.error('Failed to process air-gapped transaction:', error);
      throw error;
    }
  }

  /**
   * Generate a checksum for verification
   */
  private generateChecksum(data: string): string {
    return crypto.SHA256(data).toString();
  }

  /**
   * Get backup verification status
   */
  public getVerificationStatus(keyId: string): BackupVerificationStatus | null {
    return this.verificationStatus.get(keyId) || null;
  }

  /**
   * Verify a backup by comparing checksums
   */
  public verifyBackupChecksum(
    keyId: string,
    checksum: string
  ): boolean {
    const storedStatus = this.verificationStatus.get(keyId);
    
    if (!storedStatus) {
      return false;
    }
    
    const isValid = storedStatus.checksum === checksum;
    
    if (isValid) {
      // Update verification status
      this.verificationStatus.set(keyId, {
        ...storedStatus,
        verified: true,
        timestamp: new Date()
      });
    }
    
    return isValid;
  }

  /**
   * Generate a set of practice verification cards
   * (For users to test their backup process)
   */
  public generatePracticeVerificationCards(
    secretOrMnemonic: string
  ): Array<{
    index: number;
    question: string;
    answer: string;
  }> {
    try {
      const verificationCards = [];
      
      // Check if it's a BIP-39 mnemonic
      if (bip39.validateMnemonic(secretOrMnemonic)) {
        const words = secretOrMnemonic.split(' ');
        
        // Generate 3 random verification cards
        const indices = new Set<number>();
        while (indices.size < 3) {
          indices.add(Math.floor(Math.random() * words.length));
        }
        
        // Create the verification cards
        Array.from(indices).forEach((index, i) => {
          verificationCards.push({
            index: i + 1,
            question: `What is word #${index + 1} in your seed phrase?`,
            answer: words[index]
          });
        });
      } else {
        // It's a private key or other secret
        const hexSecret = Buffer.from(secretOrMnemonic).toString('hex');
        
        // Generate 3 random verification cards
        const indices = new Set<number>();
        while (indices.size < 3) {
          indices.add(Math.floor(Math.random() * Math.floor(hexSecret.length / 4)) * 4);
        }
        
        // Create the verification cards
        Array.from(indices).forEach((index, i) => {
          const hexChunk = hexSecret.substring(index, index + 4);
          verificationCards.push({
            index: i + 1,
            question: `What are the characters at position ${index + 1}-${index + 4} of your hex key?`,
            answer: hexChunk
          });
        });
      }
      
      return verificationCards;
    } catch (error) {
      console.error('Failed to generate practice verification cards:', error);
      throw new Error('Failed to generate practice verification cards');
    }
  }
}