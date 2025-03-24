// src/adapters/stellar/StellarAdapter.ts
import * as StellarSdk from 'stellar-sdk';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

export class StellarAdapter implements BlockchainAdapter {
  private server: StellarSdk.Server;
  private networkInfo: NetworkInfo;
  private networkPassphrase: string;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    this.server = new StellarSdk.Server(networkInfo.rpcUrl);
    
    // Set network passphrase based on testnet/mainnet
    this.networkPassphrase = networkInfo.isTestnet 
      ? StellarSdk.Networks.TESTNET 
      : StellarSdk.Networks.PUBLIC;
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(publicKeys: string[], threshold: number): Promise<string> {
    try {
      // In Stellar, multi-sig is implemented at the account level with signers and weights
      // This function creates a new account with multi-sig configuration
      
      // Create a new keypair for the multi-sig account
      const keypair = StellarSdk.Keypair.random();
      const accountAddress = keypair.publicKey();
      
      // In a real application, you would:
      // 1. Fund this account with the minimum balance
      // 2. Set up signers with appropriate weights
      // 3. Set the threshold levels for the account
      
      // This is a simplified implementation 
      // Note: In production, you'd need to securely store the secret key or use other methods
      
      return accountAddress;
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address for Stellar');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      // Fetch the account
      const account = await this.server.loadAccount(address);
      
      if (tokenAddress) {
        // Get balance for a specific token (asset)
        // Parse the token address to issuer and code
        // Format expected: CODE:ISSUER
        const [code, issuer] = tokenAddress.split(':');
        
        if (!code || !issuer) {
          throw new Error('Invalid token format. Expected CODE:ISSUER');
        }
        
        // Find the balance for this asset
        const balance = account.balances.find(balance => 
          balance.asset_type !== 'native' &&
          balance.asset_code === code &&
          balance.asset_issuer === issuer
        );
        
        return balance ? balance.balance : '0';
      } else {
        // Get native XLM balance
        const balance = account.balances.find(balance => 
          balance.asset_type === 'native'
        );
        
        return balance ? balance.balance : '0';
      }
    } catch (error) {
      // If account not found, return 0
      if ((error as any).response && (error as any).response.status === 404) {
        return '0';
      }
      
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance for Stellar account');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      // Load account to get sequence number
      const account = await this.server.loadAccount(params.fromAddress);
      
      // Create a transaction builder
      const transaction = new StellarSdk.TransactionBuilder(account, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: this.networkPassphrase
      });
      
      // Add the payment operation
      if (params.tokenAddress) {
        // Token payment
        const [code, issuer] = params.tokenAddress.split(':');
        
        if (!code || !issuer) {
          throw new Error('Invalid token format. Expected CODE:ISSUER');
        }
        
        const asset = new StellarSdk.Asset(code, issuer);
        
        transaction.addOperation(
          StellarSdk.Operation.payment({
            destination: params.toAddress,
            asset: asset,
            amount: params.amount
          })
        );
      } else {
        // Native XLM payment
        transaction.addOperation(
          StellarSdk.Operation.payment({
            destination: params.toAddress,
            asset: StellarSdk.Asset.native(),
            amount: params.amount
          })
        );
      }
      
      // Add memo if data is provided
      if (params.data) {
        transaction.addMemo(StellarSdk.Memo.text(params.data));
      }
      
      // Build the transaction
      const builtTx = transaction.setTimeout(180).build();
      
      return {
        id: builtTx.hash().toString('hex'),
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        data: params.data,
        raw: builtTx,
        signatures: [],
        status: TransactionStatus.PENDING
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create Stellar transaction');
    }
  }
  
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    try {
      // Create keypair from private key
      const keypair = StellarSdk.Keypair.fromSecret(privateKey);
      
      // Get the transaction
      const tx = transaction.raw as StellarSdk.Transaction;
      
      // Sign the transaction
      tx.sign(keypair);
      
      // Extract and return the signature
      // In Stellar, signatures are added directly to the transaction
      // For our interface, we'll return the XDR representation
      return tx.toXDR();
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign Stellar transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    try {
      // In Stellar, multi-sig works by adding multiple signatures to the same transaction
      // This is a simplified implementation
      
      // Get the original transaction
      const tx = transaction.raw as StellarSdk.Transaction;
      
      // Create a new transaction from each signature XDR
      // (Note: This is simplified - in real apps, you'd need to handle this differently)
      for (const signatureXdr of signatures) {
        const signedTx = new StellarSdk.Transaction(signatureXdr, this.networkPassphrase);
        
        // Add all signatures from this transaction to our original transaction
        // (This is simplified and would need more careful handling in a real app)
        for (const sig of signedTx.signatures) {
          tx.signatures.push(sig);
        }
      }
      
      return {
        ...transaction,
        signatures,
        status: signatures.length > 0 ? TransactionStatus.PENDING : transaction.status,
        raw: tx // Update with combined transaction
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine Stellar signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // Get the fully signed transaction
      const tx = transaction.raw as StellarSdk.Transaction;
      
      // Submit to the network
      const result = await this.server.submitTransaction(tx);
      
      return result.hash;
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast Stellar transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    return StellarSdk.StrKey.isValidEd25519PublicKey(address);
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      // Fetch the transaction
      const txResponse = await this.server.transactions().transaction(txHash).call();
      
      // If we can fetch it, it's confirmed
      return TransactionStatus.CONFIRMED;
    } catch (error) {
      // Check if it's a "transaction not found" error
      if ((error as any).response && (error as any).response.status === 404) {
        // Check horizon-specific fields
        if ((error as any).response.data && (error as any).response.data.status === 404) {
          return TransactionStatus.PENDING;
        }
        // Check if it failed
        if ((error as any).response.data && (error as any).response.data.extras) {
          return TransactionStatus.FAILED;
        }
      }
      
      console.error('Error getting transaction status:', error);
      return TransactionStatus.FAILED;
    }
  }
}