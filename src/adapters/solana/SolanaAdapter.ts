// src/adapters/solana/SolanaAdapter.ts
import * as web3 from '@solana/web3.js';
import * as splToken from '@solana/spl-token';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

export class SolanaAdapter implements BlockchainAdapter {
  private connection: web3.Connection;
  private networkInfo: NetworkInfo;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    this.connection = new web3.Connection(networkInfo.rpcUrl, 'confirmed');
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(publicKeys: string[], threshold: number): Promise<string> {
    try {
      // Convert public key strings to PublicKey objects
      const keys = publicKeys.map(key => new web3.PublicKey(key));
      
      // Generate a multisig account address
      // In Solana, multisig accounts are program-derived addresses
      const seed = Buffer.from(
        Array.from(new Uint8Array(8)).map(() => Math.floor(Math.random() * 256))
      );
      
      // Create a multisig address with program ID
      // Note: This is a simplified version. In a real app, you'd use the actual multisig program
      const programId = new web3.PublicKey('Multisig11111111111111111111111111111111111');
      
      // Generate PDA (Program Derived Address)
      const [multisigAddress] = await web3.PublicKey.findProgramAddress(
        [Buffer.from('multisig'), seed],
        programId
      );
      
      return multisigAddress.toString();
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      const pubkey = new web3.PublicKey(address);
      
      if (tokenAddress) {
        // SPL token balance
        const tokenPubkey = new web3.PublicKey(tokenAddress);
        const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          pubkey,
          { mint: tokenPubkey }
        );
        
        // Find the token account with the specified mint
        const tokenAccount = tokenAccounts.value.find(
          account => account.account.data.parsed.info.mint === tokenAddress
        );
        
        if (!tokenAccount) {
          return '0';
        }
        
        // Get token balance and decimals
        const balance = tokenAccount.account.data.parsed.info.tokenAmount.amount;
        const decimals = tokenAccount.account.data.parsed.info.tokenAmount.decimals;
        
        // Convert to decimal amount
        return (parseInt(balance) / Math.pow(10, decimals)).toString();
      } else {
        // SOL balance
        const balance = await this.connection.getBalance(pubkey);
        return (balance / web3.LAMPORTS_PER_SOL).toString();
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      const fromPubkey = new web3.PublicKey(params.fromAddress);
      const toPubkey = new web3.PublicKey(params.toAddress);
      
      // Create a new transaction
      const transaction = new web3.Transaction();
      
      // Get latest blockhash for transaction expiry
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;
      
      if (params.tokenAddress) {
        // SPL token transfer
        const tokenPubkey = new web3.PublicKey(params.tokenAddress);
        
        // Find the token account of sender for this token
        const fromTokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
          fromPubkey,
          { mint: tokenPubkey }
        );
        
        // Get the sender's token account
        const fromTokenAccount = fromTokenAccounts.value[0]?.pubkey;
        
        if (!fromTokenAccount) {
          throw new Error('Token account not found for sender');
        }
        
        // Find or create token account for recipient
        let toTokenAccount: web3.PublicKey;
        try {
          const toTokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
            toPubkey,
            { mint: tokenPubkey }
          );
          
          if (toTokenAccounts.value.length > 0) {
            toTokenAccount = toTokenAccounts.value[0].pubkey;
          } else {
            // In a real app, you'd create the account
            throw new Error('Recipient does not have a token account for this token');
          }
        } catch (error) {
          throw new Error('Failed to find or create token account for recipient');
        }
        
        // Create token transfer instruction
        // Convert amount to token units
        const amount = Math.floor(parseFloat(params.amount) * Math.pow(10, 9)); // Assuming 9 decimals
        
        const transferInstruction = splToken.createTransferInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromPubkey,
          BigInt(amount)
        );
        
        transaction.add(transferInstruction);
      } else {
        // SOL transfer
        const amount = Math.floor(parseFloat(params.amount) * web3.LAMPORTS_PER_SOL);
        
        const transferInstruction = web3.SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: amount
        });
        
        transaction.add(transferInstruction);
      }
      
      // Serialize the transaction
      const serializedTx = transaction.serialize({ requireAllSignatures: false });
      
      return {
        id: Math.random().toString(36).substr(2, 9), // Temporary ID
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        raw: {
          transaction,
          serializedTx
        },
        signatures: [],
        status: TransactionStatus.PENDING
      };
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw new Error('Failed to create transaction');
    }
  }
  
  async signTransaction(transaction: TransactionData, privateKey: string): Promise<string> {
    try {
      // Create a keypair from the private key
      // Note: In a real app, you'd handle this more securely
      const keypair = web3.Keypair.fromSecretKey(
        Buffer.from(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey, 'hex')
      );
      
      // Get the transaction object
      const tx = transaction.raw.transaction as web3.Transaction;
      
      // Sign the transaction
      tx.partialSign(keypair);
      
      // Return the signature
      const signature = tx.signatures.find(
        sig => sig.publicKey.equals(keypair.publicKey)
      );
      
      if (!signature || !signature.signature) {
        throw new Error('Failed to sign transaction');
      }
      
      return Buffer.from(signature.signature).toString('base64');
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    try {
      // Get the transaction object
      const tx = transaction.raw.transaction as web3.Transaction;
      
      // Add each signature to the transaction
      // In a real app, you'd need to match signatures to public keys
      for (let i = 0; i < signatures.length; i++) {
        // This is simplified - in reality, you'd need to carefully match
        // each signature to the correct public key and position
        const signatureBuffer = Buffer.from(signatures[i], 'base64');
        tx.signatures[i].signature = signatureBuffer;
      }
      
      return {
        ...transaction,
        signatures,
        status: signatures.length > 0 ? TransactionStatus.PENDING : transaction.status
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // Get the transaction object
      const tx = transaction.raw.transaction as web3.Transaction;
      
      // Verify that the transaction has enough signatures
      if (!tx.signatures.every(sig => sig.signature)) {
        throw new Error('Transaction is missing required signatures');
      }
      
      // Serialize the transaction
      const serializedTx = tx.serialize();
      
      // Send the transaction
      const signature = await this.connection.sendRawTransaction(serializedTx);
      
      // Wait for confirmation
      await this.connection.confirmTransaction(signature);
      
      return signature;
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    try {
      new web3.PublicKey(address);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const signature = new web3.TransactionSignature(txHash);
      const status = await this.connection.getSignatureStatus(signature);
      
      if (!status || !status.value) {
        return TransactionStatus.PENDING;
      }
      
      if (status.value.err) {
        return TransactionStatus.FAILED;
      }
      
      if (status.value.confirmations === null) {
        return TransactionStatus.CONFIRMED; // Max confirmations reached
      }
      
      return status.value.confirmations > 0 
        ? TransactionStatus.CONFIRMED 
        : TransactionStatus.PENDING;
    } catch (error) {
      console.error('Error getting transaction status:', error);
      return TransactionStatus.FAILED;
    }
  }
}