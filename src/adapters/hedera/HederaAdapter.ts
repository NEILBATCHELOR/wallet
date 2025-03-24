// src/adapters/hedera/HederaAdapter.ts
import { 
  Client, 
  PrivateKey, 
  AccountId, 
  TransferTransaction,
  TokenAssociateTransaction,
  TokenId,
  Transaction,
  TransactionId,
  KeyList,
  Hbar,
  Status
} from '@hashgraph/sdk';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

export class HederaAdapter implements BlockchainAdapter {
  private client: Client;
  private networkInfo: NetworkInfo;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    
    // Create a client for testnet or mainnet
    if (networkInfo.isTestnet) {
      this.client = Client.forTestnet();
    } else {
      this.client = Client.forMainnet();
    }
    
    // For a real app, you would set up operators to pay for transactions
    // and provide proper account IDs
    // this.client.setOperator(operatorId, operatorKey);
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(publicKeys: string[], threshold: number): Promise<string> {
    try {
      // In Hedera, multi-sig is implemented by creating a key list with a threshold
      // This is a simplified implementation - in a real app you'd create the account
      
      // Create key list
      const keyList = new KeyList();
      
      // Add all keys to the list
      for (const publicKeyStr of publicKeys) {
        const publicKey = PrivateKey.fromString(publicKeyStr).publicKey;
        keyList.add(publicKey);
      }
      
      // Set the threshold
      keyList.setThreshold(threshold);
      
      // In a real application, you would:
      // 1. Create a new account with the key list
      // 2. Fund the account with initial HBAR
      
      // For this simplified implementation, just return a dummy account ID
      return `0.0.${Math.floor(Math.random() * 1000000)}`;
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address for Hedera');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      // Parse the account ID
      const accountId = AccountId.fromString(address);
      
      if (tokenAddress) {
        // Get token balance
        const tokenId = TokenId.fromString(tokenAddress);
        
        // Query balance for the token
        const balance = await this.client.getTokenBalance(tokenId, accountId);
        
        return balance.toString();
      } else {
        // Get HBAR balance
        const balance = await this.client.getAccountBalance(accountId);
        
        // Convert from tinybars to HBAR
        return balance.hbars.toString();
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance for Hedera account');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      // Parse account IDs
      const fromAccount = AccountId.fromString(params.fromAddress);
      const toAccount = AccountId.fromString(params.toAddress);
      
      // Create a transaction
      let transaction;
      
      if (params.tokenAddress) {
        // Token transfer
        const tokenId = TokenId.fromString(params.tokenAddress);
        
        transaction = new TransferTransaction()
          .addTokenTransfer(tokenId, fromAccount, -parseFloat(params.amount))
          .addTokenTransfer(tokenId, toAccount, parseFloat(params.amount))
          .freezeWith(this.client);
      } else {
        // HBAR transfer
        const amount = Hbar.fromString(params.amount);
        
        transaction = new TransferTransaction()
          .addHbarTransfer(fromAccount, amount.negated())
          .addHbarTransfer(toAccount, amount)
          .freezeWith(this.client);
      }
      
      // Add memo if data is provided
      if (params.data) {
        transaction.setTransactionMemo(params.data);
      }
      
      return {
        id: transaction.transactionId.toString(),
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        data: params.data,
        raw: transaction,
        signatures: [],
        status: TransactionStatus.PENDING
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create Hedera transaction');
    }
  }
  
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    try {
      // Create private key instance
      const key = PrivateKey.fromString(privateKey);
      
      // Get the transaction
      const tx = transaction.raw as Transaction<any>;
      
      // Sign the transaction
      const signedTx = await tx.sign(key);
      
      // Serialize to bytes and convert to base64
      const txBytes = signedTx.toBytes();
      const signature = Buffer.from(txBytes).toString('base64');
      
      return signature;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign Hedera transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    try {
      // In Hedera, multi-sig works by collecting multiple signed transactions
      // This is a simplified implementation
      
      // For real multi-sig with Hedera, you would:
      // 1. Have each signer sign the same transaction
      // 2. Combine all signatures before executing
      
      // Just update the transaction with the signatures for now
      return {
        ...transaction,
        signatures,
        status: signatures.length > 0 ? TransactionStatus.PENDING : transaction.status
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine Hedera signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // Get the transaction
      const tx = transaction.raw as Transaction<any>;
      
      // For a real multi-sig implementation, you would:
      // 1. Combine all signatures from the signers
      // 2. Submit the fully signed transaction
      
      // For now, just execute the transaction
      const response = await tx.execute(this.client);
      
      // Get receipt to confirm status
      const receipt = await response.getReceipt(this.client);
      
      if (receipt.status !== Status.Success) {
        throw new Error(`Transaction failed with status: ${receipt.status.toString()}`);
      }
      
      return response.transactionId.toString();
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast Hedera transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    try {
      // Try to parse the account ID
      AccountId.fromString(address);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      // Parse the transaction ID
      const transactionId = TransactionId.fromString(txHash);
      
      // Query the receipt
      const receipt = await this.client.getTransactionReceipt(transactionId);
      
      // Check status
      if (receipt.status === Status.Success) {
        return TransactionStatus.CONFIRMED;
      } else if (receipt.status === Status.Unknown || receipt.status === Status.Busy) {
        return TransactionStatus.PENDING;
      } else {
        return TransactionStatus.FAILED;
      }
    } catch (error) {
      // Handle "not found" case
      if ((error as any).status && (error as any).status === Status.InvalidTransactionId) {
        return TransactionStatus.PENDING;
      }
      
      console.error('Error getting transaction status:', error);
      return TransactionStatus.FAILED;
    }
  }
}