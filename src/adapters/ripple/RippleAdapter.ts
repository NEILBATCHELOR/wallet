// src/adapters/ripple/RippleAdapter.ts
import { RippleAPI } from 'ripple-lib';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

export class RippleAdapter implements BlockchainAdapter {
  private api: RippleAPI;
  private networkInfo: NetworkInfo;
  private connected: boolean = false;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    this.api = new RippleAPI({
      server: networkInfo.rpcUrl
    });
  }

  private async ensureConnection(): Promise<void> {
    if (!this.connected) {
      await this.api.connect();
      this.connected = true;
    }
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(signers: string[], threshold: number): Promise<string> {
    try {
      await this.ensureConnection();
      
      // In XRP, a multi-sig is created through a SignerList amendment to an account
      // For this implementation, we'll create a regular account and later set up the signer list
      // This is simplified - in a real implementation, you'd use account generation methods
      
      // Generate a new address and secret
      const account = this.api.generateAddress();
      
      // In a real app, you'd store this secret securely, or better yet, use a funded account
      // For this demo, we're just returning the address
      
      return account.address;
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address for XRP');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      await this.ensureConnection();
      
      if (tokenAddress) {
        // Get balance for a specific token (e.g., issued currency)
        const trustlines = await this.api.getTrustlines(address);
        
        // Find the specific token
        const token = trustlines.find(line => 
          line.specification.counterparty === tokenAddress
        );
        
        return token ? token.state.balance : '0';
      } else {
        // Get XRP balance
        const accountInfo = await this.api.getAccountInfo(address);
        
        // Convert from drops (1 XRP = 1,000,000 drops)
        const xrpBalance = this.api.dropsToXrp(accountInfo.xrpBalance);
        
        return xrpBalance;
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance for XRP account');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      await this.ensureConnection();
      
      let transaction: any;
      
      if (params.tokenAddress) {
        // Token payment (issued currency)
        transaction = {
          TransactionType: 'Payment',
          Account: params.fromAddress,
          Destination: params.toAddress,
          Amount: {
            currency: params.tokenAddress, // In XRP this would be the currency code
            value: params.amount,
            issuer: params.tokenAddress // The issuer address
          }
        };
      } else {
        // XRP payment
        transaction = {
          TransactionType: 'Payment',
          Account: params.fromAddress,
          Destination: params.toAddress,
          Amount: this.api.xrpToDrops(params.amount) // Convert XRP to drops
        };
      }
      
      // Add memo if data is provided
      if (params.data) {
        transaction.Memos = [{
          Memo: {
            MemoData: Buffer.from(params.data, 'utf8').toString('hex')
          }
        }];
      }
      
      // Prepare transaction
      const prepared = await this.api.prepareTransaction(transaction, {
        // Options like maxLedgerVersionOffset
      });
      
      return {
        id: prepared.txJSON, // Using the prepared transaction JSON as ID
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        data: params.data,
        raw: prepared,
        signatures: [],
        status: TransactionStatus.PENDING
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create XRP transaction');
    }
  }
  
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    try {
      await this.ensureConnection();
      
      // In XRP, the privateKey is actually the account "secret"
      const signed = this.api.sign(transaction.raw.txJSON, privateKey);
      
      // Return the signature
      return signed.signedTransaction;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign XRP transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    try {
      // In XRP's multi-signing feature, we don't combine signatures in the same way as Bitcoin
      // Each signer simply signs the same transaction, and then the signed transactions are submitted
      // In this simplified implementation, we just return the transaction with the signatures array
      
      return {
        ...transaction,
        signatures,
        status: signatures.length > 0 ? TransactionStatus.PENDING : transaction.status
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine XRP signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      await this.ensureConnection();
      
      // In a real multi-sig scenario with a SignerList, you'd need to collect all signatures
      // and construct a multi-signed transaction. This is simplified.
      
      // For demo purposes, assuming the first signature is the complete signed transaction
      const signedTx = transaction.signatures[0];
      
      // Submit the signed transaction
      const result = await this.api.submit(signedTx);
      
      if (result.resultCode !== 'tesSUCCESS') {
        throw new Error(`Failed to submit XRP transaction: ${result.resultMessage}`);
      }
      
      return result.tx_json.hash;
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast XRP transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    return this.api.isValidAddress(address);
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      await this.ensureConnection();
      
      // Query the transaction
      const tx = await this.api.getTransaction(txHash);
      
      if (tx.outcome.result === 'tesSUCCESS') {
        return TransactionStatus.CONFIRMED;
      } else if (tx.outcome.result.startsWith('tec')) {
        // "tec" errors are included in ledger, but failed
        return TransactionStatus.FAILED;
      } else {
        return TransactionStatus.REJECTED;
      }
    } catch (error) {
      // If the transaction isn't found yet
      if ((error as any).data?.error === 'txnNotFound') {
        return TransactionStatus.PENDING;
      }
      
      console.error('Error getting transaction status:', error);
      return TransactionStatus.FAILED;
    }
  }
}