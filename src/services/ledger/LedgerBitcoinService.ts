// src/services/ledger/LedgerBitcoinService.ts
import Btc from "@ledgerhq/hw-app-btc";
import { createTransportReplayer, RecordStore } from "@ledgerhq/hw-transport-mocker";
import * as bitcoin from "bitcoinjs-lib";
import { LedgerService } from "./LedgerService";

export interface BitcoinDerivationPath {
  path: string;
  address: string;
  publicKey: string;
}

// Default derivation paths used in Bitcoin
export const BITCOIN_DERIVATION_PATHS = [
  "m/84'/0'/0'/0/0", // Native Segwit (bech32)
  "m/49'/0'/0'/0/0", // Segwit (P2SH)
  "m/44'/0'/0'/0/0", // Legacy
  "m/84'/1'/0'/0/0", // Testnet Native Segwit
  "m/49'/1'/0'/0/0", // Testnet Segwit
  "m/44'/1'/0'/0/0", // Testnet Legacy
];

/**
 * Service for interacting with Ledger for Bitcoin
 */
export class LedgerBitcoinService {
  private static instance: LedgerBitcoinService;
  private ledgerService: LedgerService;
  private btc: Btc | null = null;
  private network: bitcoin.Network;

  private constructor() {
    this.ledgerService = LedgerService.getInstance();
    this.network = bitcoin.networks.bitcoin; // Default to mainnet
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LedgerBitcoinService {
    if (!LedgerBitcoinService.instance) {
      LedgerBitcoinService.instance = new LedgerBitcoinService();
    }
    return LedgerBitcoinService.instance;
  }

  /**
   * Set the Bitcoin network
   */
  public setNetwork(isTestnet: boolean): void {
    this.network = isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;
  }

  /**
   * Initialize the Bitcoin app
   */
  private async initApp(): Promise<Btc> {
    if (!this.ledgerService.isConnected()) {
      await this.ledgerService.connect();
    }

    if (!this.btc) {
      const transport = this.ledgerService.getTransport();
      if (!transport) {
        throw new Error("Transport not available");
      }
      this.btc = new Btc({ transport, currency: "bitcoin" });
    }

    return this.btc;
  }

  /**
   * Get Bitcoin address for the given derivation path
   */
  public async getAddress(
    path: string = "m/84'/0'/0'/0/0",
    display: boolean = false,
    format: "legacy" | "p2sh" | "bech32" = "bech32"
  ): Promise<string> {
    try {
      const btc = await this.initApp();
      
      let addressFormat;
      
      // Determine address format
      if (format === "legacy") {
        addressFormat = "legacy";
      } else if (format === "p2sh") {
        addressFormat = "p2sh";
      } else {
        addressFormat = "bech32";
      }
      
      const result = await btc.getWalletPublicKey(path, {
        format: addressFormat,
        verify: display
      });
      
      return result.bitcoinAddress;
    } catch (error) {
      console.error("Failed to get Bitcoin address:", error);
      throw new Error(`Failed to get Bitcoin address: ${error}`);
    }
  }

  /**
   * Get multiple Bitcoin addresses
   */
  public async getAddresses(
    paths: string[] = BITCOIN_DERIVATION_PATHS,
    display: boolean = false
  ): Promise<BitcoinDerivationPath[]> {
    try {
      const btc = await this.initApp();
      
      const addresses = await Promise.all(
        paths.map(async (path) => {
          // Determine format based on path prefix
          let format: "legacy" | "p2sh" | "bech32" = "bech32";
          
          if (path.startsWith("m/44'")) {
            format = "legacy";
          } else if (path.startsWith("m/49'")) {
            format = "p2sh";
          }
          
          const result = await btc.getWalletPublicKey(path, {
            format,
            verify: display
          });
          
          return {
            path,
            address: result.bitcoinAddress,
            publicKey: result.publicKey
          };
        })
      );

      return addresses;
    } catch (error) {
      console.error("Failed to get Bitcoin addresses:", error);
      throw new Error(`Failed to get Bitcoin addresses: ${error}`);
    }
  }

  /**
   * Sign a Bitcoin transaction
   * This is a simplified implementation - real implementation would require more parameters
   */
  public async signTransaction(
    path: string,
    txHex: string,
    inputs: any[],
    associatedKeysets: string[],
    changePath?: string
  ): Promise<string> {
    try {
      const btc = await this.initApp();
      
      // Create Bitcoin transaction
      const tx = bitcoin.Transaction.fromHex(txHex);
      
      // Sign the transaction with Ledger
      // This is simplified - in a real app, you'd need to provide
      // all the input/output details for the transaction
      const signature = await btc.createPaymentTransaction({
        inputs,
        associatedKeysets,
        changePath,
        outputScriptHex: tx.outs[0].script.toString('hex')
      });
      
      return signature;
    } catch (error) {
      console.error("Failed to sign Bitcoin transaction:", error);
      throw new Error(`Failed to sign Bitcoin transaction: ${error}`);
    }
  }

  /**
   * Get the app version
   */
  public async getAppVersion(): Promise<string> {
    try {
      const btc = await this.initApp();
      const appInfo = await btc.getAppConfiguration();
      return `${appInfo.major}.${appInfo.minor}.${appInfo.patch}`;
    } catch (error) {
      console.error("Failed to get Bitcoin app version:", error);
      throw new Error(`Failed to get Bitcoin app version: ${error}`);
    }
  }
  
  /**
   * Sign a Bitcoin message
   */
  public async signMessage(
    path: string,
    message: string
  ): Promise<string> {
    try {
      const btc = await this.initApp();
      
      // Format message for signing
      const messageBuffer = Buffer.from(message);
      
      // Sign the message
      const result = await btc.signMessageNew(path, messageBuffer.toString('hex'));
      
      // Format the signature
      const v = result.v + 27 + 4; // Bitcoin specific signature format
      const signature = Buffer.concat([
        Buffer.from(result.r, 'hex'),
        Buffer.from(result.s, 'hex'),
        Buffer.from([v])
      ]).toString('base64');
      
      return signature;
    } catch (error) {
      console.error("Failed to sign Bitcoin message:", error);
      throw new Error(`Failed to sign Bitcoin message: ${error}`);
    }
  }
}