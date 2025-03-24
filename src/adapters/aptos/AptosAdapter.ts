// src/adapters/aptos/AptosAdapter.ts
import { 
  AptosClient, 
  AptosAccount, 
  TokenClient, 
  FaucetClient,
  Types,
  BCS,
  HexString
} from 'aptos';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

export class AptosAdapter implements BlockchainAdapter {
  private client: AptosClient;
  private tokenClient: TokenClient;
  private networkInfo: NetworkInfo;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    this.client = new AptosClient(networkInfo.rpcUrl);
    this.tokenClient = new TokenClient(this.client);
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(signers: string[], threshold: number): Promise<string> {
    try {
      // In Aptos, a multi-sig is created by deploying a multi-agent account module
      // This is a simplified implementation
      
      // Convert public keys to AccountAddress format
      const addresses = signers.map(signer => 
        new HexString(signer.startsWith('0x') ? signer : `0x${signer}`)
      );
      
      // Calculate a deterministic multi-sig address
      // Note: This is a simplified approach. In a real app, you'd use the actual multi-sig
      // account creation approach from Aptos which involves publishing a module
      
      // Concatenate addresses to create a seed
      const seed = addresses.map(addr => addr.toString()).join('');
      
      // Create a hash of the seed (this is simplified)
      const hash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(seed + threshold.toString())
      );
      
      // Convert hash to hex string
      const hashArray = Array.from(new Uint8Array(hash));
      const hashHex = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      
      return hashHex.substring(0, 66); // Take first 32 bytes for address
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address for Aptos');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      // Format address to ensure 0x prefix
      const hexAddress = address.startsWith('0x') ? address : `0x${address}`;
      
      if (tokenAddress) {
        // Get balance for a specific token
        // This is simplified - in Aptos you would need the token type and possibly creator info
        const resources = await this.client.getAccountResources(hexAddress);
        
        // Find the token resource
        const tokenResource = resources.find(r => 
          r.type.includes(tokenAddress) && r.type.includes('CoinStore')
        );
        
        if (!tokenResource) {
          return '0';
        }
        
        // Extract balance
        return (tokenResource.data as any).coin?.value || '0';
      } else {
        // Get native APT balance
        const resources = await this.client.getAccountResources(hexAddress);
        
        // Find the APT coin resource
        const aptResource = resources.find(r => 
          r.type === '0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>'
        );
        
        if (!aptResource) {
          return '0';
        }
        
        // Extract balance and convert from atomic units
        const rawBalance = (aptResource.data as any).coin.value;
        const balance = parseInt(rawBalance) / 100000000; // 8 decimals in APT
        
        return balance.toString();
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance for Aptos account');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      // Format addresses
      const fromAddress = params.fromAddress.startsWith('0x') 
        ? params.fromAddress 
        : `0x${params.fromAddress}`;
        
      const toAddress = params.toAddress.startsWith('0x') 
        ? params.toAddress 
        : `0x${params.toAddress}`;
      
      // Prepare a transaction payload
      let payload;
      
      if (params.tokenAddress) {
        // Token transfer
        payload = {
          type: "entry_function_payload",
          function: "0x1::coin::transfer",
          type_arguments: [params.tokenAddress], // Token type
          arguments: [
            toAddress,
            params.amount
          ]
        };
      } else {
        // Native APT transfer
        // Convert amount to atomic units (1 APT = 10^8 units)
        const atomicAmount = Math.floor(parseFloat(params.amount) * 100000000).toString();
        
        payload = {
          type: "entry_function_payload",
          function: "0x1::coin::transfer",
          type_arguments: ["0x1::aptos_coin::AptosCoin"],
          arguments: [
            toAddress,
            atomicAmount
          ]
        };
      }
      
      // Get account information for the sender
      const senderAccount = await this.client.getAccount(fromAddress);
      
      // Create a raw transaction
      const rawTx = await this.client.generateTransaction(
        fromAddress,
        payload,
        {
          max_gas_amount: "2000",
          gas_unit_price: "100",
          expiration_timestamp_secs: (Math.floor(Date.now() / 1000) + 600).toString(), // 10 minutes expiry
          sequence_number: senderAccount.sequence_number
        }
      );
      
      return {
        id: Math.random().toString(36).slice(2), // Random ID for now
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        data: params.data,
        raw: rawTx,
        signatures: [],
        status: TransactionStatus.PENDING
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create Aptos transaction');
    }
  }
  
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    try {
      // Create account from private key
      const signerAccount = new AptosAccount(
        new HexString(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey).toUint8Array()
      );
      
      // Sign the transaction
      const rawTx = transaction.raw as Types.RawTransaction;
      const signedTx = await this.client.signTransaction(signerAccount, rawTx);
      
      // Convert to hex for signature
      return HexString.fromUint8Array(signedTx.signature).toString();
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign Aptos transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    try {
      // In Aptos, multi-sig works by collecting signatures from multiple accounts
      // and then submitting a transaction with multiple signatures
      // This is a simplified implementation
      
      return {
        ...transaction,
        signatures,
        status: signatures.length > 0 ? TransactionStatus.PENDING : transaction.status
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine Aptos signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // In a real multi-sig scenario with Aptos, you'd need to construct the multi-agent
      // transaction with all collected signatures. This implementation is simplified.
      
      // Get the raw transaction
      const rawTx = transaction.raw as Types.RawTransaction;
      
      // For this demo, we're assuming a single signature is available
      // In a real app, you'd use multi-agent transaction construction
      const signatureHex = transaction.signatures[0];
      const signature = new HexString(signatureHex).toUint8Array();
      
      // Create a signed transaction
      const signedTx = new Types.SignedTransaction(
        rawTx,
        signature
      );
      
      // Submit the transaction
      const pendingTx = await this.client.submitTransaction(signedTx);
      
      // Wait for transaction
      const txResult = await this.client.waitForTransaction(pendingTx.hash);
      
      return txResult.hash;
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast Aptos transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    try {
      // Ensure address has 0x prefix
      const hexAddress = address.startsWith('0x') ? address : `0x${address}`;
      
      // Check if it's a valid hex string of correct length (0x + 64 chars)
      return /^0x[a-fA-F0-9]{64}$/.test(hexAddress);
    } catch (error) {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      // Fetch transaction
      const txInfo = await this.client.getTransactionByHash(txHash);
      
      if (!txInfo) {
        return TransactionStatus.PENDING;
      }
      
      // Check status
      if (txInfo.success) {
        return TransactionStatus.CONFIRMED;
      } else {
        return TransactionStatus.FAILED;
      }
    } catch (error) {
      // If transaction not found, it's pending
      if ((error as any).status === 404) {
        return TransactionStatus.PENDING;
      }
      
      console.error('Error getting transaction status:', error);
      return TransactionStatus.FAILED;
    }
  }
}