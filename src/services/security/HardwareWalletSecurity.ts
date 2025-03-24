// src/services/security/HardwareWalletSecurity.ts
import { Transaction as EthTransaction } from '@ethereumjs/tx';
import { Transaction as SolanaTransaction } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { LedgerService } from '../ledger/LedgerService';
import { 
  LedgerEthereumService, 
  ETHEREUM_DERIVATION_PATHS 
} from '../ledger/LedgerEthereumService';
import { 
  LedgerBitcoinService, 
  BITCOIN_DERIVATION_PATHS 
} from '../ledger/LedgerBitcoinService';
import { 
  LedgerSolanaService, 
  SOLANA_DERIVATION_PATHS 
} from '../ledger/LedgerSolanaService';

// Transaction type definitions
export enum TransactionType {
  TRANSFER = 'transfer',           // Simple value transfer
  CONTRACT_INTERACTION = 'contract', // Smart contract interaction
  TOKEN_TRANSFER = 'token',         // Token transfer
  NFT_TRANSFER = 'nft',             // NFT transfer
  SWAP = 'swap',                    // DEX swap
  UNKNOWN = 'unknown'               // Unable to determine
}

// Risk assessment result
export enum RiskLevel {
  LOW = 'low',         // Standard transaction
  MEDIUM = 'medium',   // Requires attention
  HIGH = 'high',       // Potentially dangerous
  CRITICAL = 'critical' // Very likely dangerous
}

// Transaction security report
export interface TransactionSecurityReport {
  riskLevel: RiskLevel;
  warnings: string[];
  recommendations: string[];
  transactionType: TransactionType;
  details: {
    destination: string;
    value: string;
    data?: string;
    decodedFunction?: string;
    tokenDetails?: {
      name?: string;
      symbol?: string;
      contractAddress?: string;
    };
    gasDetails?: {
      gasPrice: string;
      gasLimit: string;
      maxFeePerGas?: string;
      maxPriorityFeePerGas?: string;
    };
    [key: string]: any; // Additional blockchain-specific details
  };
}

/**
 * Hardware wallet security service 
 * Focused on transaction verification and security
 */
export class HardwareWalletSecurity {
  private static instance: HardwareWalletSecurity;
  private ledgerService: LedgerService;
  private ethService: LedgerEthereumService;
  private btcService: LedgerBitcoinService;
  private solService: LedgerSolanaService;
  
  // Known dangerous contracts
  private dangerousContracts: Set<string> = new Set([
    // Example Ethereum phishing contracts
    '0x4livec0ntract5arereplacedwithactualsc4mscontract5',
    '0xb4d5599ac4ba7b8e574b9cdc081a765e8f7d1c82',
    // Add more as they're identified
  ]);
  
  // Known safe contracts (e.g., major DEXes, well-known protocols)
  private safeContracts: Map<string, string> = new Map([
    ['0x7a250d5630b4cf539739df2c5dacb4c659f2488d', 'Uniswap V2 Router'],
    ['0xE592427A0AEce92De3Edee1F18E0157C05861564', 'Uniswap V3 Router'],
    ['0x00000000006c3852cbEf3e08E8dF289169EdE581', 'Seaport 1.1'],
    // Add more verified contracts
  ]);
  
  // Verified token contracts
  private verifiedTokens: Map<string, {name: string, symbol: string}> = new Map([
    ['0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', {name: 'USD Coin', symbol: 'USDC'}],
    ['0xdac17f958d2ee523a2206206994597c13d831ec7', {name: 'Tether', symbol: 'USDT'}],
    ['0x2260fac5e5542a773aa44fbcfedf7c193bc2c599', {name: 'Wrapped Bitcoin', symbol: 'WBTC'}],
    // Add more verified tokens
  ]);

  private constructor() {
    this.ledgerService = LedgerService.getInstance();
    this.ethService = LedgerEthereumService.getInstance();
    this.btcService = LedgerBitcoinService.getInstance();
    this.solService = LedgerSolanaService.getInstance();
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): HardwareWalletSecurity {
    if (!HardwareWalletSecurity.instance) {
      HardwareWalletSecurity.instance = new HardwareWalletSecurity();
    }
    return HardwareWalletSecurity.instance;
  }

  /**
   * Analyze an Ethereum transaction for security risks
   */
  public async analyzeEthereumTransaction(
    transaction: any, // Can be ethers.js TransactionRequest or raw tx
    providerUrl?: string // Optional RPC URL for additional verification
  ): Promise<TransactionSecurityReport> {
    // Initialize security report
    const report: TransactionSecurityReport = {
      riskLevel: RiskLevel.LOW,
      warnings: [],
      recommendations: [],
      transactionType: TransactionType.UNKNOWN,
      details: {
        destination: transaction.to || '0x',
        value: transaction.value?.toString() || '0',
        data: transaction.data || '0x',
        gasDetails: {
          gasPrice: transaction.gasPrice?.toString() || '0',
          gasLimit: transaction.gasLimit?.toString() || '0',
          maxFeePerGas: transaction.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: transaction.maxPriorityFeePerGas?.toString()
        }
      }
    };

    // Determine transaction type
    if (!transaction.data || transaction.data === '0x') {
      report.transactionType = TransactionType.TRANSFER;
    } else if (transaction.data.startsWith('0xa9059cbb')) {
      report.transactionType = TransactionType.TOKEN_TRANSFER;
      report.details.decodedFunction = 'transfer(address,uint256)';
      
      // Decode token transfer parameters if possible
      try {
        const to = '0x' + transaction.data.slice(34, 74);
        const value = BigInt('0x' + transaction.data.slice(74));
        report.details.tokenTransferTo = to;
        report.details.tokenTransferValue = value.toString();
      } catch (e) {
        report.warnings.push('Unable to decode token transfer parameters');
      }
    } else if (transaction.data.startsWith('0x42842e0e')) {
      report.transactionType = TransactionType.NFT_TRANSFER;
      report.details.decodedFunction = 'safeTransferFrom(address,address,uint256)';
    } else {
      report.transactionType = TransactionType.CONTRACT_INTERACTION;
      
      // Try to identify common contract interactions
      if (transaction.data.startsWith('0x38ed1739')) {
        report.details.decodedFunction = 'swapExactTokensForTokens (DEX Swap)';
        report.transactionType = TransactionType.SWAP;
      }
    }

    // Check if destination is a known dangerous contract
    if (transaction.to && this.dangerousContracts.has(transaction.to.toLowerCase())) {
      report.riskLevel = RiskLevel.CRITICAL;
      report.warnings.push('⚠️ DANGER: Destination address is a known malicious contract!');
      report.recommendations.push('Do NOT sign this transaction. It is likely attempting to steal your funds.');
    }
    
    // Check if destination is a verified contract
    if (transaction.to && this.safeContracts.has(transaction.to.toLowerCase())) {
      const contractName = this.safeContracts.get(transaction.to.toLowerCase());
      report.details.contractName = contractName;
      report.recommendations.push(`This is a verified interaction with ${contractName}. Still verify all transaction details.`);
    }

    // Analyze token transfers for additional insights
    if (report.transactionType === TransactionType.TOKEN_TRANSFER && transaction.to) {
      // Check if it's a verified token
      if (this.verifiedTokens.has(transaction.to.toLowerCase())) {
        const tokenInfo = this.verifiedTokens.get(transaction.to.toLowerCase());
        report.details.tokenDetails = tokenInfo;
      } else {
        report.warnings.push('Token contract is not in verified list. Be cautious with unknown tokens.');
        report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
      }
    }

    // Check for high-value transfers
    if (
      report.transactionType === TransactionType.TRANSFER && 
      BigInt(transaction.value || 0) > BigInt('1000000000000000000') // > 1 ETH
    ) {
      report.warnings.push('This is a high-value transfer. Double-check the recipient address.');
      report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
    }

    // Check for unusual gas parameters
    if (
      BigInt(transaction.gasPrice || 0) > BigInt('100000000000') || // > 100 Gwei
      (
        transaction.maxFeePerGas && 
        BigInt(transaction.maxFeePerGas) > BigInt('150000000000') // > 150 Gwei
      )
    ) {
      report.warnings.push('Gas price is unusually high. This transaction may be expensive to execute.');
    }

    // Additional contract interaction checks
    if (report.transactionType === TransactionType.CONTRACT_INTERACTION) {
      // Check for approval functions which are high risk
      if (transaction.data.startsWith('0x095ea7b3')) {
        report.warnings.push('This is a token approval. Be careful about giving spending permissions.');
        
        // Check if it's an unlimited approval
        if (transaction.data.includes('ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')) {
          report.warnings.push('⚠️ WARNING: This is an UNLIMITED token approval. Consider setting a specific limit instead.');
          report.riskLevel = Math.max(report.riskLevel, RiskLevel.HIGH);
        }
      }
      
      // Check for setApprovalForAll (common in NFT scams)
      if (transaction.data.startsWith('0xa22cb465')) {
        report.warnings.push('⚠️ WARNING: This transaction grants permission to transfer ALL of your NFTs or tokens of this collection.');
        report.riskLevel = Math.max(report.riskLevel, RiskLevel.HIGH);
      }
    }

    return report;
  }

  /**
   * Analyze a Bitcoin transaction for security risks
   */
  public async analyzeBitcoinTransaction(
    transaction: any, // Bitcoin transaction object
    network: 'mainnet' | 'testnet' = 'mainnet'
  ): Promise<TransactionSecurityReport> {
    // Parse Bitcoin transaction
    const btcNetwork = network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
    let btcTx;
    
    try {
      btcTx = bitcoin.Transaction.fromHex(transaction.txHex);
    } catch (e) {
      throw new Error('Invalid Bitcoin transaction format');
    }

    // Initialize security report
    const report: TransactionSecurityReport = {
      riskLevel: RiskLevel.LOW,
      warnings: [],
      recommendations: [],
      transactionType: TransactionType.TRANSFER,
      details: {
        destination: btcTx.outs.map(out => {
          try {
            return bitcoin.address.fromOutputScript(out.script, btcNetwork);
          } catch (e) {
            return 'Non-standard output';
          }
        }).join(', '),
        value: btcTx.outs.reduce((sum, out) => sum + out.value, 0).toString(),
        inputs: btcTx.ins.length,
        outputs: btcTx.outs.length,
        fees: transaction.fee || 'Unknown'
      }
    };

    // Check for unusual fee 
    if (transaction.fee && parseInt(transaction.fee) > 50000) { // > 50k satoshis
      report.warnings.push('Unusually high transaction fee. Verify this is intentional.');
      report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
    }

    // Check for change address
    if (btcTx.outs.length > 2) {
      report.warnings.push('Multiple output addresses detected. Verify all recipients are intentional.');
    }

    // Check for unusual outputs
    for (let i = 0; i < btcTx.outs.length; i++) {
      const out = btcTx.outs[i];
      
      // Check for non-standard output scripts
      try {
        bitcoin.address.fromOutputScript(out.script, btcNetwork);
      } catch (e) {
        report.warnings.push(`Output #${i+1} uses a non-standard script. Be cautious.`);
        report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
      }
      
      // High-value warning
      if (out.value > 10000000) { // > 0.1 BTC
        report.warnings.push(`High-value transfer of ${out.value / 100000000} BTC detected. Verify address carefully.`);
        report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
      }
    }

    // Check for replacement transactions (potential double-spend)
    if (btcTx.locktime > 0) {
      report.warnings.push('Transaction has a locktime set. This could be a replacement transaction.');
    }

    // Add general security recommendations
    report.recommendations.push('Verify all recipient addresses on your hardware wallet display.');
    report.recommendations.push('Confirm the total amount being sent matches your expectations.');
    
    if (report.riskLevel >= RiskLevel.MEDIUM) {
      report.recommendations.push('Consider using a lower value test transaction first.');
    }

    return report;
  }

  /**
   * Analyze a Solana transaction for security risks
   */
  public async analyzeSolanaTransaction(
    transaction: SolanaTransaction
  ): Promise<TransactionSecurityReport> {
    // Initialize security report
    const report: TransactionSecurityReport = {
      riskLevel: RiskLevel.LOW,
      warnings: [],
      recommendations: [],
      transactionType: TransactionType.UNKNOWN,
      details: {
        destination: 'Multiple programs', // Solana txs can call multiple programs
        value: 'Variable',
        instructions: transaction.instructions.length,
        signers: transaction.signatures.length
      }
    };

    // Analyze each instruction
    for (let i = 0; i < transaction.instructions.length; i++) {
      const ix = transaction.instructions[i];
      const programId = ix.programId.toString();
      
      // Add program info to details
      report.details[`program_${i}`] = programId;
      
      // Check system program transfers (native SOL)
      if (programId === '11111111111111111111111111111111') {
        report.transactionType = TransactionType.TRANSFER;
        
        // Check for transfer instruction
        const dataLayout = ix.data[0];
        if (dataLayout === 2) { // Transfer instruction
          report.details.transferAmount = 'Native SOL transfer';
        }
      }
      
      // Check token program (SPL tokens)
      else if (programId === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') {
        // Token program 
        const instruction = ix.data[0];
        
        if (instruction === 3) { // Transfer
          report.transactionType = TransactionType.TOKEN_TRANSFER;
          report.details.tokenTransfer = 'SPL Token transfer';
        } else if (instruction === 7) { // Approve
          report.warnings.push('This transaction includes a token approval. Be cautious about delegating token authority.');
          report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
        }
      }
      
      // Check for Metaplex token metadata program (NFTs)
      else if (programId === 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s') {
        report.transactionType = TransactionType.NFT_TRANSFER;
        report.details.nftOperation = 'NFT-related operation';
      }
      
      // Unknown program
      else {
        report.warnings.push(`Transaction uses program ${programId} which is not recognized. Exercise caution.`);
        report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
      }
    }

    // Check for risky characteristics
    if (transaction.instructions.length > 5) {
      report.warnings.push('Transaction contains many instructions. Review carefully what operations will be performed.');
      report.riskLevel = Math.max(report.riskLevel, RiskLevel.MEDIUM);
    }

    // Add recommendations
    report.recommendations.push('Verify that all program IDs are legitimate on your hardware wallet.');
    report.recommendations.push('For token transfers, confirm the token and amount on your hardware display.');

    return report;
  }

  /**
   * Verify transaction with hardware wallet and enhance security
   */
  public async verifyTransactionWithHardware(
    blockchain: string,
    transaction: any,
    path: string
  ): Promise<{
    verified: boolean;
    report: TransactionSecurityReport;
    hardwareInfo: any;
  }> {
    if (!this.ledgerService.isConnected()) {
      throw new Error('Hardware wallet not connected');
    }

    let report: TransactionSecurityReport;
    let verified = false;
    let hardwareInfo = null;

    // Analyze transaction based on blockchain
    if (blockchain.startsWith('ethereum') || 
        blockchain.startsWith('polygon') || 
        blockchain.startsWith('optimism') ||
        blockchain.startsWith('avalanche') ||
        blockchain.startsWith('arbitrum') ||
        blockchain.startsWith('base')) {
      
      // Analyze EVM transaction
      report = await this.analyzeEthereumTransaction(transaction);
      
      // Get hardware wallet info
      try {
        const config = await this.ethService.getAppConfiguration();
        hardwareInfo = {
          appName: 'Ethereum',
          version: config.version,
          arbitraryDataEnabled: config.arbitraryDataEnabled === 1
        };
        
        // Check if blind signing is enabled (if needed)
        if (report.transactionType !== TransactionType.TRANSFER && 
            hardwareInfo.arbitraryDataEnabled !== 1) {
          report.warnings.push('Contract data signing is not enabled on your Ledger device. Enable it in the Ethereum app settings.');
          report.riskLevel = Math.max(report.riskLevel, RiskLevel.HIGH);
        }
        
        verified = true;
      } catch (e) {
        throw new Error(`Failed to verify with hardware wallet: ${e.message}`);
      }
    } 
    else if (blockchain.startsWith('bitcoin')) {
      // Analyze Bitcoin transaction
      const network = blockchain.includes('testnet') ? 'testnet' : 'mainnet';
      report = await this.analyzeBitcoinTransaction(transaction, network);
      
      // Get hardware wallet info
      try {
        const version = await this.btcService.getAppVersion();
        hardwareInfo = {
          appName: 'Bitcoin',
          version
        };
        verified = true;
      } catch (e) {
        throw new Error(`Failed to verify with hardware wallet: ${e.message}`);
      }
    }
    else if (blockchain.startsWith('solana')) {
      // Analyze Solana transaction
      report = await this.analyzeSolanaTransaction(transaction);
      
      // Get hardware wallet info
      try {
        const version = await this.solService.getAppVersion();
        hardwareInfo = {
          appName: 'Solana',
          version
        };
        verified = true;
      } catch (e) {
        throw new Error(`Failed to verify with hardware wallet: ${e.message}`);
      }
    }
    else {
      throw new Error(`Unsupported blockchain for hardware wallet verification: ${blockchain}`);
    }

    // Add general hardware wallet recommendations
    report.recommendations.push('Carefully verify all transaction details on your hardware wallet screen before approving.');
    
    if (report.riskLevel >= RiskLevel.HIGH) {
      report.recommendations.push('Consider REJECTING this transaction due to high risk level.');
    }

    return {
      verified,
      report,
      hardwareInfo
    };
  }

  /**
   * Get trusted derivation paths for a blockchain
   */
  public getTrustedDerivationPaths(blockchain: string): string[] {
    if (blockchain.startsWith('ethereum') || 
        blockchain.startsWith('polygon') || 
        blockchain.startsWith('optimism') ||
        blockchain.startsWith('avalanche') ||
        blockchain.startsWith('arbitrum') ||
        blockchain.startsWith('base')) {
      return ETHEREUM_DERIVATION_PATHS;
    } 
    else if (blockchain.startsWith('bitcoin')) {
      return BITCOIN_DERIVATION_PATHS;
    }
    else if (blockchain.startsWith('solana')) {
      return SOLANA_DERIVATION_PATHS;
    }
    
    return [];
  }

  /**
   * Add a dangerous contract to the blocklist
   */
  public addDangerousContract(address: string): void {
    this.dangerousContracts.add(address.toLowerCase());
  }
  
  /**
   * Add a verified safe contract
   */
  public addSafeContract(address: string, name: string): void {
    this.safeContracts.set(address.toLowerCase(), name);
  }
  
  /**
   * Add a verified token
   */
  public addVerifiedToken(address: string, name: string, symbol: string): void {
    this.verifiedTokens.set(address.toLowerCase(), {name, symbol});
  }
}