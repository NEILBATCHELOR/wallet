// src/services/ledger/LedgerSolanaService.ts
import SolanaApp from "@ledgerhq/hw-app-solana";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { LedgerService } from "./LedgerService";

export interface SolanaDerivationPath {
  path: string;
  address: string;
  publicKey: string;
}

// Default derivation paths used in Solana
export const SOLANA_DERIVATION_PATHS = [
  "44'/501'/0'/0'",  // Default Solana path
  "44'/501'/0'",     // Alternative format
  "44'/501'/0'/0/0", // Another alternative format
];

/**
 * Service for interacting with Ledger for Solana
 */
export class LedgerSolanaService {
  private static instance: LedgerSolanaService;
  private ledgerService: LedgerService;
  private solana: SolanaApp | null = null;
  private connection: Connection | null = null;

  private constructor() {
    this.ledgerService = LedgerService.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LedgerSolanaService {
    if (!LedgerSolanaService.instance) {
      LedgerSolanaService.instance = new LedgerSolanaService();
    }
    return LedgerSolanaService.instance;
  }

  /**
   * Set Solana connection
   */
  public setConnection(endpoint: string): void {
    this.connection = new Connection(endpoint);
  }

  /**
   * Initialize the Solana app
   */
  private async initApp(): Promise<SolanaApp> {
    if (!this.ledgerService.isConnected()) {
      await this.ledgerService.connect();
    }

    if (!this.solana) {
      const transport = this.ledgerService.getTransport();
      if (!transport) {
        throw new Error("Transport not available");
      }
      this.solana = new SolanaApp(transport);
    }

    return this.solana;
  }

  /**
   * Get Solana address for the given derivation path
   */
  public async getAddress(
    path: string = "44'/501'/0'/0'",
    display: boolean = false
  ): Promise<string> {
    try {
      const solana = await this.initApp();
      
      // Format path if needed (some libraries expect a different format)
      const formattedPath = path.startsWith("m/") ? path.substring(2) : path;
      
      const { address, publicKey } = await solana.getAddress(formattedPath, display);
      
      return address;
    } catch (error) {
      console.error("Failed to get Solana address:", error);
      throw new Error(`Failed to get Solana address: ${error}`);
    }
  }

  /**
   * Get public key for the given derivation path
   */
  public async getPublicKey(
    path: string = "44'/501'/0'/0'"
  ): Promise<PublicKey> {
    try {
      const solana = await this.initApp();
      
      // Format path if needed
      const formattedPath = path.startsWith("m/") ? path.substring(2) : path;
      
      const { publicKey } = await solana.getAddress(formattedPath);
      
      return new PublicKey(publicKey);
    } catch (error) {
      console.error("Failed to get Solana public key:", error);
      throw new Error(`Failed to get Solana public key: ${error}`);
    }
  }

  /**
   * Get multiple Solana addresses
   */
  public async getAddresses(
    paths: string[] = SOLANA_DERIVATION_PATHS,
    display: boolean = false
  ): Promise<SolanaDerivationPath[]> {
    try {
      const solana = await this.initApp();
      
      const addresses = await Promise.all(
        paths.map(async (path) => {
          // Format path if needed
          const formattedPath = path.startsWith("m/") ? path.substring(2) : path;
          
          const { address, publicKey } = await solana.getAddress(formattedPath, display);
          
          return {
            path,
            address,
            publicKey,
          };
        })
      );

      return addresses;
    } catch (error) {
      console.error("Failed to get Solana addresses:", error);
      throw new Error(`Failed to get Solana addresses: ${error}`);
    }
  }

  /**
   * Sign a Solana transaction
   */
  public async signTransaction(
    path: string,
    transaction: Transaction
  ): Promise<Transaction> {
    try {
      const solana = await this.initApp();
      
      if (!this.connection) {
        throw new Error("Solana connection not set");
      }
      
      // Format path if needed
      const formattedPath = path.startsWith("m/") ? path.substring(2) : path;
      
      // Get the public key for this path
      const { publicKey } = await solana.getAddress(formattedPath);
      const pubkey = new PublicKey(publicKey);
      
      // Set the fee payer if not already set
      if (!transaction.feePayer) {
        transaction.feePayer = pubkey;
      }
      
      // Set a recent blockhash if not already set
      if (!transaction.recentBlockhash) {
        const { blockhash } = await this.connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
      }
      
      // Serialize the transaction for signing
      const message = transaction.serializeMessage();
      
      // Sign the transaction
      const { signature } = await solana.signTransaction(formattedPath, message);
      
      // Add the signature to the transaction
      transaction.addSignature(pubkey, Buffer.from(signature));
      
      return transaction;
    } catch (error) {
      console.error("Failed to sign Solana transaction:", error);
      throw new Error(`Failed to sign Solana transaction: ${error}`);
    }
  }

  /**
   * Sign a Solana message
   */
  public async signMessage(
    path: string,
    message: Uint8Array | Buffer | string
  ): Promise<{ signature: Buffer; publicKey: PublicKey }> {
    try {
      const solana = await this.initApp();
      
      // Format path if needed
      const formattedPath = path.startsWith("m/") ? path.substring(2) : path;
      
      // Convert message to Buffer if it's a string
      let messageBuffer: Buffer;
      if (typeof message === "string") {
        messageBuffer = Buffer.from(message);
      } else if (message instanceof Uint8Array) {
        messageBuffer = Buffer.from(message);
      } else {
        messageBuffer = message;
      }
      
      // Sign the message
      const { signature, publicKey } = await solana.signMessage(
        formattedPath,
        messageBuffer
      );
      
      return {
        signature: Buffer.from(signature),
        publicKey: new PublicKey(publicKey),
      };
    } catch (error) {
      console.error("Failed to sign Solana message:", error);
      throw new Error(`Failed to sign Solana message: ${error}`);
    }
  }

  /**
   * Get the app version
   */
  public async getAppVersion(): Promise<string> {
    try {
      const solana = await this.initApp();
      const { major, minor, patch } = await solana.getAppConfiguration();
      return `${major}.${minor}.${patch}`;
    } catch (error) {
      console.error("Failed to get Solana app version:", error);
      throw new Error(`Failed to get Solana app version: ${error}`);
    }
  }
}