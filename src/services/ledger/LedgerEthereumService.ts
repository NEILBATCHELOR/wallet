// src/services/ledger/LedgerEthereumService.ts
import Eth from "@ledgerhq/hw-app-eth";
import { ethers } from "ethers";
import { LedgerService } from "./LedgerService";

export interface EthereumDerivationPath {
  path: string;
  address: string;
  publicKey: string;
}

// Default derivation paths used in Ethereum
export const ETHEREUM_DERIVATION_PATHS = [
  "m/44'/60'/0'/0/0", // Standard Ethereum path
  "m/44'/60'/0'/0/1",
  "m/44'/60'/0'/0/2",
  "m/44'/60'/0'/0/3",
  "m/44'/60'/0'/0/4",
  "m/44'/1'/0'/0/0", // Ethereum Testnet
  "m/44'/137'/0'/0/0", // Polygon
  "m/44'/43114'/0'/0/0", // Avalanche
];

/**
 * Service for interacting with Ledger for Ethereum and EVM-compatible chains
 */
export class LedgerEthereumService {
  private static instance: LedgerEthereumService;
  private ledgerService: LedgerService;
  private eth: Eth | null = null;

  private constructor() {
    this.ledgerService = LedgerService.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): LedgerEthereumService {
    if (!LedgerEthereumService.instance) {
      LedgerEthereumService.instance = new LedgerEthereumService();
    }
    return LedgerEthereumService.instance;
  }

  /**
   * Initialize the Ethereum app
   */
  private async initApp(): Promise<Eth> {
    if (!this.ledgerService.isConnected()) {
      await this.ledgerService.connect();
    }

    if (!this.eth) {
      const transport = this.ledgerService.getTransport();
      if (!transport) {
        throw new Error("Transport not available");
      }
      this.eth = new Eth(transport);
    }

    return this.eth;
  }

  /**
   * Get Ethereum address for the given derivation path
   */
  public async getAddress(
    path: string = "m/44'/60'/0'/0/0",
    display: boolean = false
  ): Promise<string> {
    try {
      const eth = await this.initApp();
      const result = await eth.getAddress(path, display);
      return result.address;
    } catch (error) {
      console.error("Failed to get Ethereum address:", error);
      throw new Error(`Failed to get Ethereum address: ${error}`);
    }
  }

  /**
   * Get multiple Ethereum addresses
   */
  public async getAddresses(
    paths: string[] = ETHEREUM_DERIVATION_PATHS,
    display: boolean = false
  ): Promise<EthereumDerivationPath[]> {
    try {
      const eth = await this.initApp();
      const addresses = await Promise.all(
        paths.map(async (path) => {
          const result = await eth.getAddress(path, display);
          return {
            path,
            address: result.address,
            publicKey: result.publicKey,
          };
        })
      );

      return addresses;
    } catch (error) {
      console.error("Failed to get Ethereum addresses:", error);
      throw new Error(`Failed to get Ethereum addresses: ${error}`);
    }
  }

  /**
   * Sign an Ethereum transaction
   */
  public async signTransaction(
    path: string,
    transaction: ethers.Transaction
  ): Promise<string> {
    try {
      const eth = await this.initApp();
      
      // Prepare the transaction for signing
      const { chainId, nonce, gasLimit, gasPrice, to, value, data } = transaction;
      
      // Convert values to hex strings
      const txParams = {
        chainId: chainId ? ethers.utils.hexValue(chainId) : undefined,
        nonce: nonce ? ethers.utils.hexValue(nonce) : "0x00",
        gasLimit: gasLimit ? ethers.utils.hexValue(gasLimit) : "0x5208", // 21000
        gasPrice: gasPrice ? ethers.utils.hexValue(gasPrice) : "0x04a817c800", // 20 Gwei
        to: to || "0x",
        value: value ? ethers.utils.hexValue(value) : "0x00",
        data: data || "0x",
      };

      // Sign the transaction with Ledger
      const signature = await eth.signTransaction(
        path,
        ethers.utils.serializeTransaction(txParams).substring(2)
      );

      // Create final signed transaction
      const signedTx = ethers.utils.serializeTransaction(txParams, {
        v: parseInt(signature.v, 16),
        r: '0x' + signature.r,
        s: '0x' + signature.s,
      });

      return signedTx;
    } catch (error) {
      console.error("Failed to sign Ethereum transaction:", error);
      throw new Error(`Failed to sign Ethereum transaction: ${error}`);
    }
  }

  /**
   * Sign an Ethereum message
   */
  public async signMessage(
    path: string,
    message: string
  ): Promise<string> {
    try {
      const eth = await this.initApp();
      
      // Convert message to hex
      const messageHex = Buffer.from(message).toString("hex");
      
      // Sign the message
      const signature = await eth.signPersonalMessage(path, messageHex);
      
      // Format the signature
      const v = parseInt(signature.v, 16);
      const sig = ethers.utils.joinSignature({
        r: '0x' + signature.r,
        s: '0x' + signature.s,
        v,
      });
      
      return sig;
    } catch (error) {
      console.error("Failed to sign Ethereum message:", error);
      throw new Error(`Failed to sign Ethereum message: ${error}`);
    }
  }

  /**
   * Get the app configuration from the Ledger
   */
  public async getAppConfiguration(): Promise<{ arbitraryDataEnabled: number; version: string }> {
    try {
      const eth = await this.initApp();
      return await eth.getAppConfiguration();
    } catch (error) {
      console.error("Failed to get app configuration:", error);
      throw new Error(`Failed to get app configuration: ${error}`);
    }
  }
}