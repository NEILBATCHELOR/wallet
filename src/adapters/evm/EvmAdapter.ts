// src/adapters/evm/EvmAdapter.ts
import { ethers } from 'ethers';
import Safe, { EthersAdapter } from '@safe-global/protocol-kit';
import { SafeFactory } from '@safe-global/protocol-kit';
import { SafeAccountConfig } from '@safe-global/protocol-kit';
import { 
  BlockchainAdapter, 
  NetworkInfo, 
  TransactionParams, 
  TransactionData,
  TransactionStatus
} from '../../core/interfaces';

// Simplified ERC20 ABI for token transfers
const ERC20_ABI = [
  'function transfer(address to, uint amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)'
];

export class EvmAdapter implements BlockchainAdapter {
  private provider: ethers.providers.Provider;
  private networkInfo: NetworkInfo;
  private safeService: string;
  
  constructor(networkInfo: NetworkInfo, provider?: ethers.providers.Provider) {
    this.networkInfo = networkInfo;
    
    // Use provided provider or create a new one
    this.provider = provider || new ethers.providers.JsonRpcProvider(networkInfo.rpcUrl);
    
    // Set Safe service URL based on network
    this.safeService = this.getSafeServiceUrl(networkInfo);
  }
  
  private getSafeServiceUrl(networkInfo: NetworkInfo): string {
    // Map network to Safe transaction service URL
    const safeServiceMap: Record<string, string> = {
      'ethereum': 'https://safe-transaction-mainnet.safe.global/',
      'polygon': 'https://safe-transaction-polygon.safe.global/',
      'avalanche': 'https://safe-transaction-avalanche.safe.global/',
      'optimism': 'https://safe-transaction-optimism.safe.global/',
      'arbitrum': 'https://safe-transaction-arbitrum.safe.global/',
      'base': 'https://safe-transaction-base.safe.global/',
      // Add more networks as needed
    };
    
    return safeServiceMap[networkInfo.name.toLowerCase()] || '';
  }

  getNetworkInfo(): NetworkInfo {
    return this.networkInfo;
  }
  
  async generateMultiSigAddress(owners: string[], threshold: number): Promise<string> {
    try {
      // We need a signer to deploy the Safe
      // In a real application, you would get this from the user's wallet
      const signer = new ethers.Wallet('0x' + '0'.repeat(64), this.provider);
      const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: signer
      });

      const safeFactory = await SafeFactory.create({ ethAdapter });
      const safeAccountConfig: SafeAccountConfig = {
        owners,
        threshold,
      };
      
      // This would normally deploy the Safe, but we're just predicting the address
      const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });
      return await safeSdk.getAddress();
    } catch (error) {
      console.error('Error generating multisig address:', error);
      throw new Error('Failed to generate multisig address');
    }
  }
  
  async getBalance(address: string, tokenAddress?: string): Promise<string> {
    try {
      if (tokenAddress) {
        // Get ERC20 token balance
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
        const balance = await tokenContract.balanceOf(address);
        return balance.toString();
      } else {
        // Get native token balance
        const balance = await this.provider.getBalance(address);
        return ethers.utils.formatEther(balance);
      }
    } catch (error) {
      console.error('Error getting balance:', error);
      throw new Error('Failed to get balance');
    }
  }
  
  async createTransaction(params: TransactionParams): Promise<TransactionData> {
    try {
      let data = params.data || '0x';
      let value = '0';
      
      // Handle token transfers
      if (params.tokenAddress) {
        // Create ERC20 transfer data
        const tokenContract = new ethers.Contract(params.tokenAddress, ERC20_ABI, this.provider);
        const amount = ethers.utils.parseUnits(params.amount, 18); // Assuming 18 decimals
        data = tokenContract.interface.encodeFunctionData('transfer', [params.toAddress, amount]);
        params.toAddress = params.tokenAddress; // We're calling the token contract
      } else {
        // Native token transfer
        value = ethers.utils.parseEther(params.amount).toString();
      }
      
      // Get nonce if not provided
      const nonce = params.nonce || await this.provider.getTransactionCount(params.fromAddress);
      
      // Create transaction object
      const txData = {
        to: params.toAddress,
        value,
        data,
        nonce
      };
      
      return {
        id: ethers.utils.id(JSON.stringify(txData) + Date.now()).slice(2),
        fromAddress: params.fromAddress,
        toAddress: params.toAddress,
        amount: params.amount,
        tokenAddress: params.tokenAddress,
        data,
        raw: txData,
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
      const wallet = new ethers.Wallet(privateKey, this.provider);
      const signer = wallet.connect(this.provider);
      
      // For Safe multisig, we need to sign the transaction hash
      const messageHash = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ['address', 'uint256', 'bytes', 'uint8', 'uint256', 'uint256', 'uint256', 'address', 'address', 'uint256'],
          [
            transaction.toAddress,
            transaction.raw.value,
            transaction.raw.data,
            1, // Operation type (CALL)
            0, // safeTxGas
            0, // baseGas
            0, // gasPrice
            ethers.constants.AddressZero, // gasToken
            ethers.constants.AddressZero, // refundReceiver
            transaction.raw.nonce
          ]
        )
      );
      
      const signature = await signer.signMessage(ethers.utils.arrayify(messageHash));
      return signature;
    } catch (error) {
      console.error('Error signing transaction:', error);
      throw new Error('Failed to sign transaction');
    }
  }
  
  async combineSignatures(transaction: TransactionData, signatures: string[]): Promise<TransactionData> {
    // Simply add signatures to the transaction
    return {
      ...transaction,
      signatures,
      status: signatures.length >= 0 ? TransactionStatus.PENDING : transaction.status
    };
  }
  
  async broadcastTransaction(transaction: TransactionData): Promise<string> {
    try {
      // In a real application, you would use the Safe SDK to execute the transaction
      // This is a simplified example
      const signer = new ethers.Wallet('0x' + '0'.repeat(64), this.provider);
      const ethAdapter = new EthersAdapter({
        ethers,
        signerOrProvider: signer
      });
      
      // Initialize Safe with the multisig address
      const safeSdk = await Safe.create({
        ethAdapter,
        safeAddress: transaction.fromAddress
      });
      
      // Build a Safe transaction
      const safeTransaction = await safeSdk.createTransaction({
        safeTransactionData: {
          to: transaction.toAddress,
          value: transaction.raw.value,
          data: transaction.raw.data,
        }
      });
      
      // Add each signature
      for (const signature of transaction.signatures) {
        // In a real app, you'd need to parse the signature and add it properly
        // This is simplified
        safeTransaction.addSignature({
          signer: '0x0000000000000000000000000000000000000000', // Replace with actual signer
          data: signature,
          staticPart: () => '0x',
          dynamicPart: () => '0x',
        });
      }
      
      // Execute the transaction
      const txResponse = await safeSdk.executeTransaction(safeTransaction);
      const receipt = await txResponse.transactionResponse?.wait();
      
      return receipt?.transactionHash || '';
    } catch (error) {
      console.error('Error broadcasting transaction:', error);
      throw new Error('Failed to broadcast transaction');
    }
  }
  
  validateAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }
  
  async getTransactionStatus(txHash: string): Promise<TransactionStatus> {
    try {
      const receipt = await this.provider.getTransactionReceipt(txHash);
      
      if (!receipt) {
        return TransactionStatus.PENDING;
      }
      
      return receipt.status ? TransactionStatus.CONFIRMED : TransactionStatus.FAILED;
    } catch (error) {
      console.error('Error getting transaction status:', error);
      throw new Error('Failed to get transaction status');
    }
  }
}