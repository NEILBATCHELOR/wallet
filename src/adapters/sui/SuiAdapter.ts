// src/adapters/sui/SuiAdapter.ts
import { 
  JsonRpcProvider, 
  RawSigner, 
  Ed25519Keypair, 
  TransactionBlock,
  Connection,
  SUI_CLOCK_OBJECT_ID,
  SuiClient,
  Connection as SuiConnection
} from '@mysten/sui.js';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

export class SuiAdapter implements BlockchainAdapter {
  private provider: JsonRpcProvider;
  private networkInfo: NetworkInfo;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    const connection = new Connection({
      fullnode: networkInfo.rpcUrl,
      faucet: networkInfo.isTestnet ? `${networkInfo.rpcUrl}/faucet` : undefined,
    });
    this.provider = new JsonRpcProvider(connection);
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(publicKeys: string[], threshold: number): Promise<string> {
    try {
      // In Sui, multi-sig is implemented using MultiSig type which aggregates signatures
      // and verifies them against a threshold policy
      // This is a simplified implementation - in a real app, you'd create a multi-sig address
      // by initializing a MultiSig object with the public keys and threshold
      
      // Calculate a deterministic multi-sig address (simplified)
      const multiSigAddress = `0x${publicKeys.join('')}${threshold}`.substring(0, 66);
      
      return multiSigAddress;
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address for Sui');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      if (tokenAddress) {
        // Get balance for a specific token
        // In Sui, tokens are objects with specific types
        const objects = await this.provider.getOwnedObjects({
          owner: address,
          filter: {
            StructType: tokenAddress // The token type
          }
        });
        
        // Sum up all tokens of this type
        let balance = 0;
        
        for (const obj of objects.data) {
          // Fetch full object data
          const objData = await this.provider.getObject({
            id: obj.data.objectId,
            options: {
              showContent: true
            }
          });
          
          // Extract balance from object fields (simplified)
          if (objData.data && objData.data.content) {
            const content = objData.data.content;
            if ('fields' in content && 'balance' in content.fields) {
              balance += parseInt(content.fields.balance);
            }
          }
        }
        
        return balance.toString();
      } else {
        // Get native SUI balance
        const balance = await this.provider.getBalance({
          owner: address,
          coinType: '0x2::sui::SUI' // SUI coin type
        });
        
        // Convert from MIST to SUI (1 SUI = 10^9 MIST)
        const suiBalance = parseInt(balance.totalBalance) / 1_000_000_000;
        
        return suiBalance.toString();
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance for Sui account');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      // Create a new transaction block
      const txb = new TransactionBlock();
      
      if (params.tokenAddress) {
        // Token transfer
        // This is simplified - in Sui, tokens are objects that need to be transferred
        // You'd need the actual object IDs to transfer
        
        throw new Error('Token transfers not implemented in this simplified adapter');
      } else {
        // Native SUI transfer
        // Convert to MIST (atomic units, 1 SUI = 10^9 MIST)
        const amount = Math.floor(parseFloat(params.amount) * 1_000_000_000);
        
        // Add a transfer operation to the transaction block
        txb.transferObjects(
          [txb.splitCoins(txb.gas, [amount])], 
          txb.pure(params.toAddress)
        );
      }
      
      // Serialize the transaction for signing
      const bytes = await txb.build({
        provider: this.provider,
        sender: params.fromAddress
      });
      
      return {
        id: Math.random().toString(36).slice(2), // Random ID for now
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        data: params.data,
        raw: {
          txBlock: txb,
          bytes: Array.from(bytes)
        },
        signatures: [],
        status: TransactionStatus.PENDING
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create Sui transaction');
    }
  }
  
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    try {
      // Create keypair from private key
      // Note: This is simplified - in a real app you'd need proper key derivation
      const keypair = Ed25519Keypair.fromSecretKey(
        Uint8Array.from(Buffer.from(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey, 'hex'))
      );
      
      // Create a signer
      const signer = new RawSigner(keypair, this.provider);
      
      // Get the transaction bytes
      const txBytes = new Uint8Array(transaction.raw.bytes);
      
      // Sign the transaction
      const signature = await signer.signTransactionBlock({
        transactionBlock: txBytes
      });
      
      // Convert signature to hex string
      return Buffer.from(signature.signature).toString('hex');
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign Sui transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    try {
      // In Sui, multi-sig works by combining signatures under a multi-sig public key
      // This is a simplified implementation
      
      return {
        ...transaction,
        signatures,
        status: signatures.length > 0 ? TransactionStatus.PENDING : transaction.status
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine Sui signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // In a real multi-sig scenario with Sui, you'd use the MultiSig functions
      // to combine signatures. This is a simplified implementation.
      
      // Get the transaction block
      const txBlock = transaction.raw.txBlock as TransactionBlock;
      const txBytes = new Uint8Array(transaction.raw.bytes);
      
      // For this demo, we're assuming a single signature is available
      const signatureHex = transaction.signatures[0];
      const signature = Buffer.from(signatureHex, 'hex');
      
      // Execute the transaction
      const result = await this.provider.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: {
          signature: Array.from(signature),
          pubKey: Array.from(Buffer.from('dummy-pubkey')), // This would be the actual pubkey in a real app
        },
      });
      
      return result.digest;
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast Sui transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    try {
      // Ensure address has 0x prefix and is 66 chars (0x + 64 hex chars)
      return /^0x[a-fA-F0-9]{64}$/.test(address);
    } catch (error) {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      // Fetch transaction
      const txInfo = await this.provider.getTransactionBlock({
        digest: txHash,
        options: {
          showEffects: true
        }
      });
      
      if (!txInfo) {
        return TransactionStatus.PENDING;
      }
      
      // Check status from effects
      if (txInfo.effects && txInfo.effects.status.status === 'success') {
        return TransactionStatus.CONFIRMED;
      } else {
        return TransactionStatus.FAILED;
      }
    } catch (error) {
      // If transaction not found, it's pending
      if ((error as any).code === -32000) {
        return TransactionStatus.PENDING;
      }
      
      console.error('Error getting transaction status:', error);
      return TransactionStatus.FAILED;
    }
  }
}