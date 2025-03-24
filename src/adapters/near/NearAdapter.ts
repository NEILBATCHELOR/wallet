// src/adapters/near/NearAdapter.ts
import * as nearAPI from 'near-api-js';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

export class NearAdapter implements BlockchainAdapter {
  private near: nearAPI.Near;
  private networkInfo: NetworkInfo;
  private keyStore: nearAPI.keyStores.InMemoryKeyStore;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    this.keyStore = new nearAPI.keyStores.InMemoryKeyStore();
    
    // Initialize NEAR connection
    this.near = new nearAPI.Near({
      networkId: networkInfo.isTestnet ? 'testnet' : 'mainnet',
      keyStore: this.keyStore,
      nodeUrl: networkInfo.rpcUrl,
      walletUrl: networkInfo.isTestnet 
        ? 'https://wallet.testnet.near.org' 
        : 'https://wallet.near.org',
      helperUrl: networkInfo.isTestnet 
        ? 'https://helper.testnet.near.org' 
        : 'https://helper.near.org',
    });
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(signers: string[], threshold: number): Promise<string> {
    try {
      // In NEAR, multi-sig is implemented using a smart contract
      // This is a simplified implementation - in a real app, you would:
      // 1. Deploy a multi-sig contract or use an existing one
      // 2. Initialize it with the signers and threshold
      
      // For this example, we'll use a naming convention to represent the multi-sig
      // In reality, you'd deploy a contract with appropriate configuration
      
      // Create a multi-sig account ID based on signers (simplified)
      const multiSigId = `multisig-${signers.join('-')}-${threshold}.${
        this.networkInfo.isTestnet ? 'testnet' : 'near'
      }`;
      
      return multiSigId;
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address for NEAR');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      // Connect to NEAR account
      const account = await this.near.account(address);
      
      if (tokenAddress) {
        // Get token balance (FT balance)
        // In NEAR, this is done by calling view method on the token contract
        const result = await account.viewFunction({
          contractId: tokenAddress,
          methodName: 'ft_balance_of',
          args: { account_id: address }
        });
        
        // Convert from atomic units based on decimals (usually 18 or 24)
        // This is simplified - in a real app, you'd query the token's metadata for decimals
        const decimals = 18; // Assume 18 decimals as default
        return (parseInt(result) / Math.pow(10, decimals)).toString();
      } else {
        // Get NEAR balance
        const balance = await account.getAccountBalance();
        
        // Convert from yoctoNEAR to NEAR (1 NEAR = 10^24 yoctoNEAR)
        const nearBalance = parseFloat(balance.available) / Math.pow(10, 24);
        
        return nearBalance.toString();
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance for NEAR account');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      // Connect to account
      const account = await this.near.account(params.fromAddress);
      
      // Create actions based on transaction type
      let actions: nearAPI.transactions.Action[];
      
      if (params.tokenAddress) {
        // Token transfer (FT transfer)
        // Convert to atomic units (assuming 18 decimals, adjust as needed)
        const decimals = 18; // Default assumption
        const amount = (parseFloat(params.amount) * Math.pow(10, decimals)).toString();
        
        actions = [
          nearAPI.transactions.functionCall(
            'ft_transfer',
            { receiver_id: params.toAddress, amount },
            30_000_000_000_000, // Gas (30 TGas)
            '1' // Deposit (1 yoctoNEAR required for ft_transfer)
          )
        ];
      } else {
        // NEAR transfer
        // Convert to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
        const amount = (parseFloat(params.amount) * Math.pow(10, 24)).toString();
        
        actions = [
          nearAPI.transactions.transfer(amount)
        ];
      }
      
      // Create a transaction
      const publicKey = await account.connection.signer.getPublicKey(
        params.fromAddress,
        this.near.connection.networkId
      );
      
      // Get access key and nonce
      const accessKey = await account.connection.provider.query({
        request_type: 'view_access_key',
        finality: 'optimistic',
        account_id: params.fromAddress,
        public_key: publicKey.toString()
      });
      
      // Create a transaction object
      const transaction = nearAPI.transactions.createTransaction(
        params.fromAddress,
        publicKey,
        params.tokenAddress || params.toAddress, // Contract ID or recipient
        (accessKey as any).nonce + 1,
        actions,
        nearAPI.utils.serialize.base_decode(
          (await account.connection.provider.block({ finality: 'final' })).header.hash
        )
      );
      
      return {
        id: Math.random().toString(36).substring(2), // Random ID for now
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
      throw new Error('Failed to create NEAR transaction');
    }
  }
  
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    try {
      // Create a key pair from the private key
      const keyPair = nearAPI.utils.KeyPair.fromString(privateKey);
      
      // Add key to key store (needed for signing)
      await this.keyStore.setKey(
        this.near.config.networkId,
        transaction.fromAddress,
        keyPair
      );
      
      // Get a connection to the network with this key
      const connection = new nearAPI.Connection(
        this.near.config.networkId,
        this.near.config.provider,
        new nearAPI.InMemorySigner(this.keyStore)
      );
      
      // Get transaction object
      const tx = transaction.raw as nearAPI.transactions.Transaction;
      
      // Sign the transaction
      const [, signedTx] = await nearAPI.transactions.signTransaction(
        tx,
        connection.signer,
        transaction.fromAddress,
        this.near.config.networkId
      );
      
      // Convert to base64 string for storage
      const serialized = nearAPI.utils.serialize.base_encode(signedTx.encode());
      
      return serialized;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign NEAR transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    try {
      // In NEAR, multi-sig is typically implemented via a smart contract
      // This is a simplified implementation - in reality, you'd use the contract's methods
      
      return {
        ...transaction,
        signatures,
        status: signatures.length > 0 ? TransactionStatus.PENDING : transaction.status
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine NEAR signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // In a real multi-sig implementation with NEAR, you would:
      // 1. Call the multi-sig contract's confirm_transaction method with each signature
      // 2. The contract would execute the transaction when enough signatures are collected
      
      // For this simplified example, we'll just submit the signed transaction
      
      // Get the signed transaction
      const signedTxBase64 = transaction.signatures[0];
      const signedTxBytes = nearAPI.utils.serialize.base_decode(signedTxBase64);
      
      // Parse the signed transaction
      const signedTx = nearAPI.transactions.SignedTransaction.decode(Buffer.from(signedTxBytes));
      
      // Send the transaction
      const provider = this.near.connection.provider;
      
      const result = await provider.sendTransaction(signedTx);
      
      // Get the transaction hash
      const txHash = result.transaction.hash;
      
      return nearAPI.utils.serialize.base_encode(txHash);
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast NEAR transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    // NEAR account IDs have specific rules:
    // - Consist of a namespace and human-readable ID separated by '.'
    // - Can't be empty
    // - Can't be too long (max 64 chars)
    // - Can only contain lowercase alphanumeric chars, '_' and '-'
    // - Must contain at least one '.' (except system accounts)
    
    // Simple validation (could be more robust)
    if (!address || address.length > 64) {
      return false;
    }
    
    // Check characters
    if (!/^[a-z0-9_-]+(\.[a-z0-9_-]+)*$/.test(address)) {
      return false;
    }
    
    return true;
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      // Decode the base64 hash
      const hash = nearAPI.utils.serialize.base_decode(txHash);
      
      // Query the transaction status
      const status = await this.near.connection.provider.txStatus(
        Buffer.from(hash),
        'unnused' // Placeholder value, not used in the API call
      );
      
      // Check status
      if (status.status) {
        if (status.status.SuccessValue !== undefined) {
          return TransactionStatus.CONFIRMED;
        }
        if (status.status.Failure !== undefined) {
          return TransactionStatus.FAILED;
        }
      }
      
      // If we don't have a clear status, it's pending
      return TransactionStatus.PENDING;
    } catch (error) {
      // If we get a specific error about transaction not found, it's pending
      if ((error as any).type === 'unknown_transaction') {
        return TransactionStatus.PENDING;
      }
      
      console.error('Error getting transaction status:', error);
      return TransactionStatus.FAILED;
    }
  }
}