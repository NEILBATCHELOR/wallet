// src/services/security/SmartContractVaultService.ts
import { ethers } from 'ethers';
import { BlockchainAdapterFactory } from '../../core/BlockchainAdapterFactory';

// Simplified versions of contract ABIs
const MULTISIG_WALLET_ABI = [
  'function submitTransaction(address destination, uint value, bytes data) public returns (uint)',
  'function confirmTransaction(uint transactionId) public',
  'function executeTransaction(uint transactionId) public',
  'function revokeConfirmation(uint transactionId) public',
  'function getOwners() public view returns (address[])',
  'function isOwner(address) public view returns (bool)',
  'function required() public view returns (uint)',
  'function getTransactionCount(bool pending, bool executed) public view returns (uint)',
  'function transactions(uint) public view returns (address, uint, bytes, bool, uint)',
  'function getConfirmationCount(uint transactionId) public view returns (uint)',
  'function getConfirmations(uint transactionId) public view returns (address[])',
  'event Submission(uint indexed transactionId)',
  'event Confirmation(address indexed sender, uint indexed transactionId)',
  'event Execution(uint indexed transactionId)',
  'event ExecutionFailure(uint indexed transactionId)',
];

const TIMELOCK_VAULT_ABI = [
  'function queueTransaction(address target, uint value, bytes data, uint delay) public returns (bytes32)',
  'function executeTransaction(address target, uint value, bytes data, uint delay) public returns (bytes)',
  'function cancelTransaction(address target, uint value, bytes data, uint delay) public',
  'function admin() public view returns (address)',
  'function pendingAdmin() public view returns (address)',
  'function delay() public view returns (uint)',
  'event QueueTransaction(bytes32 indexed txHash, address indexed target, uint value, bytes data, uint delay)',
  'event ExecuteTransaction(bytes32 indexed txHash, address indexed target, uint value, bytes data, uint delay)',
  'event CancelTransaction(bytes32 indexed txHash, address indexed target, uint value, bytes data, uint delay)',
];

const ACCOUNT_ABSTRACTION_ABI = [
  'function execute(address[] calldata targets, uint256[] calldata values, bytes[] calldata calldatas)',
  'function executeWithPaymaster(address[] calldata targets, uint256[] calldata values, bytes[] calldata calldatas, address paymaster)',
  'function nonce() public view returns (uint256)',
  'function requiredSignatures() public view returns (uint256)',
  'function isValidSignature(bytes32 messageHash, bytes memory signature) public view returns (bytes4)',
  'function state() public view returns (uint8)',
  'event Executed(uint256 indexed nonce, address[] targets, uint256[] values, bytes[] calldatas)',
];

/**
 * Contract deployment parameters
 */
export interface ContractDeploymentParams {
  owners?: string[]; // For multisig
  threshold?: number; // For multisig
  delay?: number; // For timelock, in seconds
  admin?: string; // For timelock & account abstraction
  paymaster?: string; // For account abstraction
  additionalParams?: Record<string, any>; // Contract-specific parameters
}

/**
 * Transaction in a multisig wallet
 */
export interface MultisigTransaction {
  id: number;
  destination: string;
  value: string;
  data: string;
  executed: boolean;
  confirmations: number;
  confirmationAddresses: string[];
  submitter?: string;
  submitTime?: Date;
  executeTime?: Date;
}

/**
 * Queued transaction in a timelock vault
 */
export interface TimelockTransaction {
  txHash: string;
  target: string;
  value: string;
  data: string;
  delay: number;
  eta: Date;
  queueTime: Date;
  status: 'queued' | 'executed' | 'canceled';
}

/**
 * Account abstraction nonce
 */
export interface AccountAbstractionState {
  nonce: number;
  requiredSignatures: number;
  state: 'active' | 'locked' | 'recovery';
}

/**
 * Transaction parameters for executing transactions
 */
export interface BatchedTransaction {
  targets: string[];
  values: string[];
  calldatas: string[];
  paymasterAddress?: string;
}

/**
 * Smart contract types supported by the service
 */
export enum VaultContractType {
  MULTISIG = 'multisig',
  TIMELOCK = 'timelock',
  ACCOUNT_ABSTRACTION = 'account_abstraction',
  RECOVERY_VAULT = 'recovery_vault',
  CUSTOM = 'custom'
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  contractAddress: string;
  txHash: string;
  blockNumber: number;
  deployed: boolean;
  contractType: VaultContractType;
  deployedChain: string;
  deploymentParams: ContractDeploymentParams;
}

/**
 * Service for interacting with smart contract vaults
 */
export class SmartContractVaultService {
  private static instance: SmartContractVaultService;
  private deployedContracts: Map<string, DeploymentResult> = new Map();
  
  // Contract templates by type
  private contractBytecode: Record<VaultContractType, string> = {
    [VaultContractType.MULTISIG]: '0x608060405234801561001057600080fd5b5061271d806100206000396000f3fe608...',
    [VaultContractType.TIMELOCK]: '0x608060405234801561001057600080fd5b5061155a806100206000396000f3fe608...',
    [VaultContractType.ACCOUNT_ABSTRACTION]: '0x608060405234801561001057600080fd5b50610e3d806100206000396000f3fe608...',
    [VaultContractType.RECOVERY_VAULT]: '0x608060405234801561001057600080fd5b5061081a806100206000396000f3fe608...',
    [VaultContractType.CUSTOM]: '' // To be set at runtime
  };
  
  // Contract ABIs by type
  private contractAbis: Record<VaultContractType, any[]> = {
    [VaultContractType.MULTISIG]: MULTISIG_WALLET_ABI,
    [VaultContractType.TIMELOCK]: TIMELOCK_VAULT_ABI,
    [VaultContractType.ACCOUNT_ABSTRACTION]: ACCOUNT_ABSTRACTION_ABI,
    [VaultContractType.RECOVERY_VAULT]: [], // To be set at runtime
    [VaultContractType.CUSTOM]: [] // To be set at runtime
  };

  private constructor() {
    // Private constructor to enforce singleton pattern
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): SmartContractVaultService {
    if (!SmartContractVaultService.instance) {
      SmartContractVaultService.instance = new SmartContractVaultService();
    }
    return SmartContractVaultService.instance;
  }

  /**
   * Deploy a new smart contract vault
   */
  public async deployContract(
    contractType: VaultContractType,
    blockchain: string,
    params: ContractDeploymentParams,
    signer: ethers.Signer | string
  ): Promise<DeploymentResult> {
    // Get blockchain adapter
    const adapter = BlockchainAdapterFactory.getAdapter(blockchain);
    
    // Only EVM chains are supported for smart contract vaults
    if (!blockchain.startsWith('ethereum') && 
        !blockchain.startsWith('polygon') && 
        !blockchain.startsWith('avalanche') && 
        !blockchain.startsWith('optimism') && 
        !blockchain.startsWith('arbitrum') && 
        !blockchain.startsWith('base') && 
        !blockchain.startsWith('zksync') &&
        !blockchain.startsWith('mantle')) {
      throw new Error(`Blockchain ${blockchain} is not supported for smart contract vaults`);
    }
    
    // Get contract bytecode and ABI
    const bytecode = this.contractBytecode[contractType];
    const abi = this.contractAbis[contractType];
    
    if (!bytecode || abi.length === 0) {
      throw new Error(`Contract type ${contractType} not supported`);
    }
    
    try {
      // Create contract factory
      let ethersProvider: ethers.providers.Provider;
      let ethersSigner: ethers.Signer;
      
      // Handle different types of signer
      if (typeof signer === 'string') {
        // It's a private key
        ethersProvider = new ethers.providers.JsonRpcProvider(adapter.getNetworkInfo().rpcUrl);
        ethersSigner = new ethers.Wallet(signer, ethersProvider);
      } else {
        // It's already an ethers.Signer
        ethersSigner = signer;
        ethersProvider = ethersSigner.provider as ethers.providers.Provider;
      }
      
      // Create contract factory with the correct ABI and bytecode
      const factory = new ethers.ContractFactory(abi, bytecode, ethersSigner);
      
      // Prepare constructor arguments based on contract type
      let constructorArgs: any[] = [];
      
      switch (contractType) {
        case VaultContractType.MULTISIG:
          // Validate required parameters
          if (!params.owners || params.owners.length === 0) {
            throw new Error('Owners array is required for multisig wallet');
          }
          
          if (!params.threshold || params.threshold <= 0 || params.threshold > params.owners.length) {
            throw new Error('Invalid threshold for multisig wallet');
          }
          
          constructorArgs = [params.owners, params.threshold];
          break;
          
        case VaultContractType.TIMELOCK:
          // Validate required parameters
          if (!params.admin) {
            throw new Error('Admin address is required for timelock vault');
          }
          
          if (!params.delay || params.delay < 0) {
            throw new Error('Delay must be >= 0 for timelock vault');
          }
          
          constructorArgs = [params.admin, params.delay];
          break;
          
        case VaultContractType.ACCOUNT_ABSTRACTION:
          // Validate required parameters
          if (!params.owners || params.owners.length === 0) {
            throw new Error('Owners array is required for account abstraction contract');
          }
          
          if (!params.threshold || params.threshold <= 0 || params.threshold > params.owners.length) {
            throw new Error('Invalid threshold for account abstraction contract');
          }
          
          constructorArgs = [params.owners, params.threshold];
          
          // Add optional paymaster
          if (params.paymaster) {
            constructorArgs.push(params.paymaster);
          }
          break;
          
        case VaultContractType.RECOVERY_VAULT:
          // Validate required parameters
          if (!params.owners || params.owners.length === 0) {
            throw new Error('Owners array is required for recovery vault');
          }
          
          if (!params.threshold || params.threshold <= 0 || params.threshold > params.owners.length) {
            throw new Error('Invalid threshold for recovery vault');
          }
          
          if (!params.additionalParams?.recoveryPeriod) {
            throw new Error('Recovery period is required for recovery vault');
          }
          
          constructorArgs = [
            params.owners,
            params.threshold,
            params.additionalParams.recoveryPeriod
          ];
          
          // Add optional backup owner
          if (params.additionalParams?.backupOwner) {
            constructorArgs.push(params.additionalParams.backupOwner);
          }
          break;
          
        case VaultContractType.CUSTOM:
          // For custom contracts, use additionalParams as constructor arguments
          if (params.additionalParams?.constructorArgs) {
            constructorArgs = params.additionalParams.constructorArgs;
          }
          break;
      }
      
      // Deploy the contract
      const contract = await factory.deploy(...constructorArgs);
      
      // Wait for deployment to complete
      await contract.deployed();
      
      // Get receipt to confirm deployment
      const receipt = await ethersProvider.getTransactionReceipt(contract.deployTransaction.hash);
      
      // Create deployment result
      const result: DeploymentResult = {
        contractAddress: contract.address,
        txHash: contract.deployTransaction.hash,
        blockNumber: receipt.blockNumber,
        deployed: true,
        contractType,
        deployedChain: blockchain,
        deploymentParams: params
      };
      
      // Store deployment result
      this.deployedContracts.set(contract.address, result);
      
      return result;
    } catch (error) {
      console.error(`Failed to deploy ${contractType} contract:`, error);
      throw new Error(`Failed to deploy contract: ${error.message}`);
    }
  }

  /**
   * Register an existing contract (not deployed through this service)
   */
  public registerContract(
    contractAddress: string,
    contractType: VaultContractType,
    blockchain: string,
    deploymentParams: ContractDeploymentParams = {}
  ): DeploymentResult {
    // Create deployment result
    const result: DeploymentResult = {
      contractAddress,
      txHash: '', // Not available for manually registered contracts
      blockNumber: 0, // Not available for manually registered contracts
      deployed: true, // Assume it's deployed
      contractType,
      deployedChain: blockchain,
      deploymentParams: deploymentParams
    };
    
    // Store deployment result
    this.deployedContracts.set(contractAddress, result);
    
    return result;
  }

  /**
   * Set custom contract bytecode and ABI
   */
  public setCustomContract(bytecode: string, abi: any[]): void {
    this.contractBytecode[VaultContractType.CUSTOM] = bytecode;
    this.contractAbis[VaultContractType.CUSTOM] = abi;
  }

  /**
   * Set contract bytecode and ABI for a contract type
   */
  public setContractTemplate(contractType: VaultContractType, bytecode: string, abi: any[]): void {
    this.contractBytecode[contractType] = bytecode;
    this.contractAbis[contractType] = abi;
  }

  /**
   * Get deployed contracts
   */
  public getDeployedContracts(blockchain?: string): DeploymentResult[] {
    const contracts = Array.from(this.deployedContracts.values());
    
    if (blockchain) {
      return contracts.filter(c => c.deployedChain === blockchain);
    }
    
    return contracts;
  }

  /**
   * Get contract instance
   */
  public getContractInstance(
    contractAddress: string,
    blockchain: string,
    signer?: ethers.Signer
  ): ethers.Contract {
    // Find the contract
    const deploymentResult = this.deployedContracts.get(contractAddress);
    
    if (!deploymentResult) {
      throw new Error(`Contract ${contractAddress} not found`);
    }
    
    // Get blockchain adapter
    const adapter = BlockchainAdapterFactory.getAdapter(blockchain);
    
    // Get contract ABI
    const abi = this.contractAbis[deploymentResult.contractType];
    
    // Create provider
    const provider = new ethers.providers.JsonRpcProvider(adapter.getNetworkInfo().rpcUrl);
    
    // Create contract instance
    if (signer) {
      return new ethers.Contract(contractAddress, abi, signer);
    } else {
      return new ethers.Contract(contractAddress, abi, provider);
    }
  }

  /**
   * Submit a transaction to a multisig wallet
   */
  public async submitMultisigTransaction(
    contractAddress: string,
    blockchain: string,
    destination: string,
    value: string,
    data: string,
    signer: ethers.Signer
  ): Promise<number> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain, signer) as ethers.Contract;
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.MULTISIG) {
        throw new Error(`Contract ${contractAddress} is not a multisig wallet`);
      }
      
      // Submit transaction
      const valueWei = ethers.utils.parseEther(value);
      const tx = await contract.submitTransaction(destination, valueWei, data);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Extract transaction ID from event
      const event = receipt.events?.find(e => e.event === 'Submission');
      
      if (!event) {
        throw new Error('Failed to get transaction ID from event');
      }
      
      const transactionId = event.args?.transactionId.toNumber();
      
      return transactionId;
    } catch (error) {
      console.error('Failed to submit multisig transaction:', error);
      throw new Error(`Failed to submit transaction: ${error.message}`);
    }
  }

  /**
   * Confirm a multisig transaction
   */
  public async confirmMultisigTransaction(
    contractAddress: string,
    blockchain: string,
    transactionId: number,
    signer: ethers.Signer
  ): Promise<boolean> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain, signer) as ethers.Contract;
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.MULTISIG) {
        throw new Error(`Contract ${contractAddress} is not a multisig wallet`);
      }
      
      // Confirm transaction
      const tx = await contract.confirmTransaction(transactionId);
      
      // Wait for transaction to be mined
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Failed to confirm multisig transaction:', error);
      throw new Error(`Failed to confirm transaction: ${error.message}`);
    }
  }

  /**
   * Execute a multisig transaction
   */
  public async executeMultisigTransaction(
    contractAddress: string,
    blockchain: string,
    transactionId: number,
    signer: ethers.Signer
  ): Promise<boolean> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain, signer) as ethers.Contract;
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.MULTISIG) {
        throw new Error(`Contract ${contractAddress} is not a multisig wallet`);
      }
      
      // Execute transaction
      const tx = await contract.executeTransaction(transactionId);
      
      // Wait for transaction to be mined
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Failed to execute multisig transaction:', error);
      throw new Error(`Failed to execute transaction: ${error.message}`);
    }
  }

  /**
   * Get multisig transactions
   */
  public async getMultisigTransactions(
    contractAddress: string,
    blockchain: string,
    count: number = 10
  ): Promise<MultisigTransaction[]> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain);
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.MULTISIG) {
        throw new Error(`Contract ${contractAddress} is not a multisig wallet`);
      }
      
      // Get transaction count
      const transactionCount = await contract.getTransactionCount(true, true);
      
      // Get transactions
      const transactions: MultisigTransaction[] = [];
      
      const startIndex = Math.max(0, transactionCount.toNumber() - count);
      const endIndex = transactionCount.toNumber();
      
      for (let i = startIndex; i < endIndex; i++) {
        try {
          // Get transaction data
          const [destination, value, data, executed, numConfirmations] = await contract.transactions(i);
          
          // Get confirmations
          const confirmationCount = await contract.getConfirmationCount(i);
          const confirmations = await contract.getConfirmations(i);
          
          transactions.push({
            id: i,
            destination,
            value: ethers.utils.formatEther(value),
            data,
            executed,
            confirmations: confirmationCount.toNumber(),
            confirmationAddresses: confirmations
          });
        } catch (error) {
          console.error(`Failed to get transaction ${i}:`, error);
        }
      }
      
      return transactions;
    } catch (error) {
      console.error('Failed to get multisig transactions:', error);
      throw new Error(`Failed to get transactions: ${error.message}`);
    }
  }

  /**
   * Queue a transaction in a timelock vault
   */
  public async queueTimelockTransaction(
    contractAddress: string,
    blockchain: string,
    target: string,
    value: string,
    data: string,
    delay: number,
    signer: ethers.Signer
  ): Promise<string> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain, signer) as ethers.Contract;
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.TIMELOCK) {
        throw new Error(`Contract ${contractAddress} is not a timelock vault`);
      }
      
      // Queue transaction
      const valueWei = ethers.utils.parseEther(value);
      const tx = await contract.queueTransaction(target, valueWei, data, delay);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      // Extract transaction hash from event
      const event = receipt.events?.find(e => e.event === 'QueueTransaction');
      
      if (!event) {
        throw new Error('Failed to get transaction hash from event');
      }
      
      const txHash = event.args?.txHash;
      
      return txHash;
    } catch (error) {
      console.error('Failed to queue timelock transaction:', error);
      throw new Error(`Failed to queue transaction: ${error.message}`);
    }
  }

  /**
   * Execute a transaction in a timelock vault
   */
  public async executeTimelockTransaction(
    contractAddress: string,
    blockchain: string,
    target: string,
    value: string,
    data: string,
    delay: number,
    signer: ethers.Signer
  ): Promise<boolean> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain, signer) as ethers.Contract;
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.TIMELOCK) {
        throw new Error(`Contract ${contractAddress} is not a timelock vault`);
      }
      
      // Execute transaction
      const valueWei = ethers.utils.parseEther(value);
      const tx = await contract.executeTransaction(target, valueWei, data, delay);
      
      // Wait for transaction to be mined
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Failed to execute timelock transaction:', error);
      throw new Error(`Failed to execute transaction: ${error.message}`);
    }
  }

  /**
   * Cancel a transaction in a timelock vault
   */
  public async cancelTimelockTransaction(
    contractAddress: string,
    blockchain: string,
    target: string,
    value: string,
    data: string,
    delay: number,
    signer: ethers.Signer
  ): Promise<boolean> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain, signer) as ethers.Contract;
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.TIMELOCK) {
        throw new Error(`Contract ${contractAddress} is not a timelock vault`);
      }
      
      // Cancel transaction
      const valueWei = ethers.utils.parseEther(value);
      const tx = await contract.cancelTransaction(target, valueWei, data, delay);
      
      // Wait for transaction to be mined
      await tx.wait();
      
      return true;
    } catch (error) {
      console.error('Failed to cancel timelock transaction:', error);
      throw new Error(`Failed to cancel transaction: ${error.message}`);
    }
  }

  /**
   * Execute a transaction batch with account abstraction
   */
  public async executeAccountAbstractionBatch(
    contractAddress: string,
    blockchain: string,
    batch: BatchedTransaction,
    signer: ethers.Signer
  ): Promise<string> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain, signer) as ethers.Contract;
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.ACCOUNT_ABSTRACTION) {
        throw new Error(`Contract ${contractAddress} is not an account abstraction contract`);
      }
      
      // Convert values to wei
      const valuesWei = batch.values.map(v => ethers.utils.parseEther(v));
      
      // Execute transaction batch
      let tx;
      
      if (batch.paymasterAddress) {
        tx = await contract.executeWithPaymaster(
          batch.targets,
          valuesWei,
          batch.calldatas,
          batch.paymasterAddress
        );
      } else {
        tx = await contract.execute(
          batch.targets,
          valuesWei,
          batch.calldatas
        );
      }
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      return receipt.transactionHash;
    } catch (error) {
      console.error('Failed to execute account abstraction batch:', error);
      throw new Error(`Failed to execute batch: ${error.message}`);
    }
  }

  /**
   * Get account abstraction state
   */
  public async getAccountAbstractionState(
    contractAddress: string,
    blockchain: string
  ): Promise<AccountAbstractionState> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain);
      
      // Check contract type
      const deploymentResult = this.deployedContracts.get(contractAddress);
      
      if (!deploymentResult || deploymentResult.contractType !== VaultContractType.ACCOUNT_ABSTRACTION) {
        throw new Error(`Contract ${contractAddress} is not an account abstraction contract`);
      }
      
      // Get contract state
      const nonce = await contract.nonce();
      const requiredSignatures = await contract.requiredSignatures();
      const state = await contract.state();
      
      // Map state number to string
      let stateString: 'active' | 'locked' | 'recovery';
      
      switch (state) {
        case 0:
          stateString = 'active';
          break;
        case 1:
          stateString = 'locked';
          break;
        case 2:
          stateString = 'recovery';
          break;
        default:
          stateString = 'active';
      }
      
      return {
        nonce: nonce.toNumber(),
        requiredSignatures: requiredSignatures.toNumber(),
        state: stateString
      };
    } catch (error) {
      console.error('Failed to get account abstraction state:', error);
      throw new Error(`Failed to get state: ${error.message}`);
    }
  }

  /**
   * Create a recovery contract for a wallet
   */
  public async createRecoveryContract(
    blockchain: string,
    owners: string[],
    threshold: number,
    recoveryPeriod: number, // in seconds
    backupOwner?: string,
    signer: ethers.Signer | string
  ): Promise<DeploymentResult> {
    return this.deployContract(
      VaultContractType.RECOVERY_VAULT,
      blockchain,
      {
        owners,
        threshold,
        additionalParams: {
          recoveryPeriod,
          backupOwner
        }
      },
      signer
    );
  }

  /**
   * Get the ABI for a specific contract type
   */
  public getContractAbi(contractType: VaultContractType): any[] {
    return this.contractAbis[contractType];
  }

  /**
   * Check if an address is an owner of a multisig wallet
   */
  public async isMultisigOwner(
    contractAddress: string,
    blockchain: string,
    ownerAddress: string
  ): Promise<boolean> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain);
      
      // Check if owner
      return await contract.isOwner(ownerAddress);
    } catch (error) {
      console.error('Failed to check if address is owner:', error);
      throw new Error(`Failed to check ownership: ${error.message}`);
    }
  }

  /**
   * Get owners of a multisig wallet
   */
  public async getMultisigOwners(
    contractAddress: string,
    blockchain: string
  ): Promise<string[]> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain);
      
      // Get owners
      return await contract.getOwners();
    } catch (error) {
      console.error('Failed to get multisig owners:', error);
      throw new Error(`Failed to get owners: ${error.message}`);
    }
  }

  /**
   * Get the threshold of a multisig wallet
   */
  public async getMultisigThreshold(
    contractAddress: string,
    blockchain: string
  ): Promise<number> {
    try {
      // Get contract instance
      const contract = this.getContractInstance(contractAddress, blockchain);
      
      // Get threshold
      const threshold = await contract.required();
      return threshold.toNumber();
    } catch (error) {
      console.error('Failed to get multisig threshold:', error);
      throw new Error(`Failed to get threshold: ${error.message}`);
    }
  }
}