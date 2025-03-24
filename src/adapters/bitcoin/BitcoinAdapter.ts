// src/adapters/bitcoin/BitcoinAdapter.ts
import * as bitcoin from 'bitcoinjs-lib';
import axios from 'axios';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

// Set network for testnet or mainnet
const getNetwork = (isTestnet: boolean) => 
  isTestnet ? bitcoin.networks.testnet : bitcoin.networks.bitcoin;

export class BitcoinAdapter implements BlockchainAdapter {
  private networkInfo: NetworkInfo;
  private network: bitcoin.Network;
  private apiBaseUrl: string;
  
  constructor(networkInfo: NetworkInfo) {
    this.networkInfo = networkInfo;
    this.network = getNetwork(networkInfo.isTestnet);
    
    // Set API base URL for blockchain queries
    this.apiBaseUrl = networkInfo.isTestnet 
      ? 'https://blockstream.info/testnet/api' 
      : 'https://blockstream.info/api';
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(publicKeys: string[], threshold: number): Promise<string> {
    try {
      // Convert hex public keys to Buffer
      const pubKeysBuffers = publicKeys.map(hex => 
        Buffer.from(hex.startsWith('0x') ? hex.slice(2) : hex, 'hex')
      );
      
      // Create P2MS redeem script
      const { address } = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2ms({ 
          m: threshold, 
          pubkeys: pubKeysBuffers,
          network: this.network
        }),
        network: this.network
      });
      
      if (!address) {
        throw new Error('Failed to generate multisig address');
      }
      
      return address;
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address');
    }
  }
  
  async getBalance(address: string): Promise<string> {
    try {
      // Query balance from API
      const response = await axios.get(`${this.apiBaseUrl}/address/${address}`);
      
      // Extract confirmed and unconfirmed balance
      const { chain_stats, mempool_stats } = response.data;
      const confirmedBalance = chain_stats?.funded_txo_sum - chain_stats?.spent_txo_sum || 0;
      const unconfirmedBalance = mempool_stats?.funded_txo_sum - mempool_stats?.spent_txo_sum || 0;
      
      // Total balance in satoshis
      const totalBalance = confirmedBalance + unconfirmedBalance;
      
      // Convert satoshis to BTC (1 BTC = 100,000,000 satoshis)
      return (totalBalance / 100000000).toString();
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      // Fetch UTXOs for the address
      const utxosResponse = await axios.get(`${this.apiBaseUrl}/address/${params.fromAddress}/utxo`);
      const utxos = utxosResponse.data;
      
      if (!utxos || utxos.length === 0) {
        throw new Error('No UTXOs found');
      }
      
      // Create transaction builder
      const txb = new bitcoin.TransactionBuilder(this.network);
      
      // Calculate total input amount and add inputs
      let totalInput = 0;
      for (const utxo of utxos) {
        const txResponse = await axios.get(`${this.apiBaseUrl}/tx/${utxo.txid}/hex`);
        const txHex = txResponse.data;
        const tx = bitcoin.Transaction.fromHex(txHex);
        
        txb.addInput(utxo.txid, utxo.vout);
        totalInput += utxo.value;
      }
      
      // Convert amount from BTC to satoshis
      const amount = Math.floor(parseFloat(params.amount) * 100000000);
      
      // Calculate fee (simplified)
      const feeRate = 10; // satoshis per byte
      const estimatedSize = 200; // bytes (simplified)
      const fee = feeRate * estimatedSize;
      
      // Ensure enough funds
      if (totalInput < amount + fee) {
        throw new Error('Insufficient funds');
      }
      
      // Add output to recipient
      txb.addOutput(params.toAddress, amount);
      
      // Add change output if needed
      const change = totalInput - amount - fee;
      if (change > 0) {
        txb.addOutput(params.fromAddress, change);
      }
      
      // Create transaction data object
      const rawTx = {
        inputs: utxos,
        outputs: [
          { address: params.toAddress, value: amount },
          ...(change > 0 ? [{ address: params.fromAddress, value: change }] : [])
        ],
        fee
      };
      
      return {
        id: Math.random().toString(36).substr(2, 9), // Temporary ID
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        raw: {
          txBuilder: txb,
          rawTx
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
      const keyPair = bitcoin.ECPair.fromPrivateKey(
        Buffer.from(privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey, 'hex'),
        { network: this.network }
      );
      
      const txb = transaction.raw.txBuilder as bitcoin.TransactionBuilder;
      
      // Get the redeem script (this would come from your database in a real app)
      // This is simplified - you'd need to reconstruct the actual redeem script
      const pubkeys = [keyPair.publicKey]; // In reality, this would be all pubkeys
      const p2ms = bitcoin.payments.p2ms({ m: 1, pubkeys, network: this.network }); // m=1 for simplicity
      const redeem = p2ms.output;
      
      if (!redeem) {
        throw new Error('Failed to create redeem script');
      }
      
      // Sign all inputs
      for (let i = 0; i < transaction.raw.rawTx.inputs.length; i++) {
        txb.sign(i, keyPair, redeem, undefined, transaction.raw.rawTx.inputs[i].value);
      }
      
      // Return the partially signed transaction as a hex string
      const tx = txb.buildIncomplete();
      return tx.toHex();
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    // For Bitcoin, combining signatures is complex and depends on the specific multisig setup
    // This is a simplified example
    
    try {
      // In a real implementation, you'd need to:
      // 1. Parse each signature from hex
      // 2. Apply each signature to the transaction
      // 3. Verify the transaction is valid
      
      return {
        ...transaction,
        signatures,
        status: signatures.length >= 0 ? TransactionStatus.PENDING : transaction.status
      };
    } catch (error) {
      console.error('Error combining signatures:', error);
      throw new Error('Failed to combine signatures');
    }
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // Build the transaction with all signatures
      // This is a simplified example
      
      // In a real application, you would:
      // 1. Finalize the transaction with all signatures
      // 2. Convert it to hex
      const txb = transaction.raw.txBuilder as bitcoin.TransactionBuilder;
      const tx = txb.build();
      const txHex = tx.toHex();
      
      // Broadcast via API
      const response = await axios.post(`${this.apiBaseUrl}/tx`, txHex);
      
      // Return the transaction ID
      return response.data; // Usually returns the txid
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    try {
      bitcoin.address.toOutputScript(address, this.network);
      return true;
    } catch (error) {
      return false;
    }
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const response = await axios.get(`${this.apiBaseUrl}/tx/${txHash}`);
      
      // Check confirmations
      const confirmations = response.data.status.confirmed ? response.data.status.block_height : 0;
      
      if (confirmations === 0) {
        return TransactionStatus.PENDING;
      }
      
      return TransactionStatus.CONFIRMED;
    } catch (error) {
      // If we can't find the transaction, it might not exist
      return TransactionStatus.FAILED;
    }
  }
}