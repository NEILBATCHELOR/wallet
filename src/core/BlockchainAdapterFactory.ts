// src/core/BlockchainAdapterFactory.ts
import { BlockchainAdapter, NetworkInfo } from './interfaces';
import { EvmAdapter } from '../adapters/evm/EvmAdapter';
import { BitcoinAdapter } from '../adapters/bitcoin/BitcoinAdapter';
import { SolanaAdapter } from '../adapters/solana/SolanaAdapter';
import { RippleAdapter } from '../adapters/ripple/RippleAdapter';
import { AptosAdapter } from '../adapters/aptos/AptosAdapter';
import { SuiAdapter } from '../adapters/sui/SuiAdapter';
import { StellarAdapter } from '../adapters/stellar/StellarAdapter';
import { HederaAdapter } from '../adapters/hedera/HederaAdapter';
import { NearAdapter } from '../adapters/near/NearAdapter';

// Network configurations
const NETWORKS: Record<string, NetworkInfo> = {
  // Ethereum
  'ethereum': {
    name: 'Ethereum',
    chainId: 1,
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: false
  },
  'ethereum-sepolia': {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Sepolia Ether',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: true
  },
  
  // Polygon
  'polygon': {
    name: 'Polygon',
    chainId: 137,
    rpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    isTestnet: false
  },
  'polygon-mumbai': {
    name: 'Polygon Mumbai',
    chainId: 80001,
    rpcUrl: 'https://polygon-mumbai.g.alchemy.com/v2/YOUR_ALCHEMY_KEY',
    explorerUrl: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18
    },
    isTestnet: true
  },
  
  // Avalanche
  'avalanche': {
    name: 'Avalanche',
    chainId: 43114,
    rpcUrl: 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    },
    isTestnet: false
  },
  'avalanche-fuji': {
    name: 'Avalanche Fuji',
    chainId: 43113,
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    explorerUrl: 'https://testnet.snowtrace.io',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18
    },
    isTestnet: true
  },
  
  // Optimism
  'optimism': {
    name: 'Optimism',
    chainId: 10,
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: false
  },
  'optimism-goerli': {
    name: 'Optimism Goerli',
    chainId: 420,
    rpcUrl: 'https://goerli.optimism.io',
    explorerUrl: 'https://goerli-optimism.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: true
  },
  
  // Bitcoin
  'bitcoin': {
    name: 'Bitcoin',
    rpcUrl: 'https://blockstream.info/api',
    explorerUrl: 'https://blockstream.info',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8
    },
    isTestnet: false
  },
  'bitcoin-testnet': {
    name: 'Bitcoin Testnet',
    rpcUrl: 'https://blockstream.info/testnet/api',
    explorerUrl: 'https://blockstream.info/testnet',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8
    },
    isTestnet: true
  },
  
  // Solana
  'solana': {
    name: 'Solana',
    rpcUrl: 'https://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9
    },
    isTestnet: false
  },
  'solana-devnet': {
    name: 'Solana Devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com?cluster=devnet',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9
    },
    isTestnet: true
  },
  
  // Ripple (XRP)
  'ripple': {
    name: 'XRP Ledger',
    rpcUrl: 'wss://xrplcluster.com',
    explorerUrl: 'https://xrpscan.com',
    nativeCurrency: {
      name: 'XRP',
      symbol: 'XRP',
      decimals: 6
    },
    isTestnet: false
  },
  'ripple-testnet': {
    name: 'XRP Ledger Testnet',
    rpcUrl: 'wss://s.altnet.rippletest.net:51233',
    explorerUrl: 'https://testnet.xrpscan.com',
    nativeCurrency: {
      name: 'XRP',
      symbol: 'XRP',
      decimals: 6
    },
    isTestnet: true
  },
  
  // Aptos
  'aptos': {
    name: 'Aptos',
    rpcUrl: 'https://fullnode.mainnet.aptoslabs.com/v1',
    explorerUrl: 'https://explorer.aptoslabs.com',
    nativeCurrency: {
      name: 'Aptos',
      symbol: 'APT',
      decimals: 8
    },
    isTestnet: false
  },
  'aptos-testnet': {
    name: 'Aptos Testnet',
    rpcUrl: 'https://fullnode.testnet.aptoslabs.com/v1',
    explorerUrl: 'https://explorer.aptoslabs.com/?network=testnet',
    nativeCurrency: {
      name: 'Aptos',
      symbol: 'APT',
      decimals: 8
    },
    isTestnet: true
  },
  
  // Sui
  'sui': {
    name: 'Sui',
    rpcUrl: 'https://fullnode.mainnet.sui.io:443',
    explorerUrl: 'https://explorer.sui.io',
    nativeCurrency: {
      name: 'Sui',
      symbol: 'SUI',
      decimals: 9
    },
    isTestnet: false
  },
  'sui-testnet': {
    name: 'Sui Testnet',
    rpcUrl: 'https://fullnode.testnet.sui.io:443',
    explorerUrl: 'https://explorer.sui.io/?network=testnet',
    nativeCurrency: {
      name: 'Sui',
      symbol: 'SUI',
      decimals: 9
    },
    isTestnet: true
  },
  
  // Mantle
  'mantle': {
    name: 'Mantle',
    chainId: 5000,
    rpcUrl: 'https://rpc.mantle.xyz',
    explorerUrl: 'https://explorer.mantle.xyz',
    nativeCurrency: {
      name: 'Mantle',
      symbol: 'MNT',
      decimals: 18
    },
    isTestnet: false
  },
  'mantle-testnet': {
    name: 'Mantle Testnet',
    chainId: 5001,
    rpcUrl: 'https://rpc.testnet.mantle.xyz',
    explorerUrl: 'https://explorer.testnet.mantle.xyz',
    nativeCurrency: {
      name: 'Mantle',
      symbol: 'MNT',
      decimals: 18
    },
    isTestnet: true
  },
  
  // Stellar
  'stellar': {
    name: 'Stellar',
    rpcUrl: 'https://horizon.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/public',
    nativeCurrency: {
      name: 'Stellar Lumens',
      symbol: 'XLM',
      decimals: 7
    },
    isTestnet: false
  },
  'stellar-testnet': {
    name: 'Stellar Testnet',
    rpcUrl: 'https://horizon-testnet.stellar.org',
    explorerUrl: 'https://stellar.expert/explorer/testnet',
    nativeCurrency: {
      name: 'Stellar Lumens',
      symbol: 'XLM',
      decimals: 7
    },
    isTestnet: true
  },
  
  // Hedera
  'hedera': {
    name: 'Hedera',
    rpcUrl: 'https://mainnet.hedera.com',
    explorerUrl: 'https://hashscan.io/mainnet',
    nativeCurrency: {
      name: 'HBAR',
      symbol: 'HBAR',
      decimals: 8
    },
    isTestnet: false
  },
  'hedera-testnet': {
    name: 'Hedera Testnet',
    rpcUrl: 'https://testnet.hedera.com',
    explorerUrl: 'https://hashscan.io/testnet',
    nativeCurrency: {
      name: 'HBAR',
      symbol: 'HBAR',
      decimals: 8
    },
    isTestnet: true
  },
  
  // Base
  'base': {
    name: 'Base',
    chainId: 8453,
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: false
  },
  'base-goerli': {
    name: 'Base Goerli',
    chainId: 84531,
    rpcUrl: 'https://goerli.base.org',
    explorerUrl: 'https://goerli.basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: true
  },
  
  // ZK Sync Era
  'zksync': {
    name: 'ZK Sync Era',
    chainId: 324,
    rpcUrl: 'https://mainnet.era.zksync.io',
    explorerUrl: 'https://explorer.zksync.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: false
  },
  'zksync-goerli': {
    name: 'ZK Sync Era Testnet',
    chainId: 280,
    rpcUrl: 'https://testnet.era.zksync.dev',
    explorerUrl: 'https://goerli.explorer.zksync.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: true
  },
  
  // Arbitrum
  'arbitrum': {
    name: 'Arbitrum',
    chainId: 42161,
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: false
  },
  'arbitrum-goerli': {
    name: 'Arbitrum Goerli',
    chainId: 421613,
    rpcUrl: 'https://goerli-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://testnet.arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    isTestnet: true
  },
  
  // NEAR
  'near': {
    name: 'NEAR',
    rpcUrl: 'https://rpc.mainnet.near.org',
    explorerUrl: 'https://explorer.near.org',
    nativeCurrency: {
      name: 'NEAR',
      symbol: 'NEAR',
      decimals: 24
    },
    isTestnet: false
  },
  'near-testnet': {
    name: 'NEAR Testnet',
    rpcUrl: 'https://rpc.testnet.near.org',
    explorerUrl: 'https://explorer.testnet.near.org',
    nativeCurrency: {
      name: 'NEAR',
      symbol: 'NEAR',
      decimals: 24
    },
    isTestnet: true
  }
};

export class BlockchainAdapterFactory {
  // Cache adapters to avoid creating duplicates
  private static adapters: Record<string, BlockchainAdapter> = {};
  
  /**
   * Get an adapter for a specific blockchain
   */
  static getAdapter(blockchainId: string): BlockchainAdapter {
    // Check if adapter exists in cache
    if (this.adapters[blockchainId]) {
      return this.adapters[blockchainId];
    }
    
    // Get network config
    const networkInfo = NETWORKS[blockchainId];
    if (!networkInfo) {
      throw new Error(`Unsupported blockchain: ${blockchainId}`);
    }
    
    // Create appropriate adapter based on blockchain
    let adapter: BlockchainAdapter;
    
    // Extract the base blockchain name (without testnet suffix)
    const baseBlockchain = blockchainId.split('-')[0];
    
    // EVM-compatible chains
    if (['ethereum', 'polygon', 'avalanche', 'optimism', 'mantle', 'base', 'zksync', 'arbitrum'].includes(baseBlockchain)) {
      adapter = new EvmAdapter(networkInfo);
    }
    // Bitcoin
    else if (baseBlockchain === 'bitcoin') {
      adapter = new BitcoinAdapter(networkInfo);
    }
    // Solana
    else if (baseBlockchain === 'solana') {
      adapter = new SolanaAdapter(networkInfo);
    }
    // Ripple (XRP)
    else if (baseBlockchain === 'ripple') {
      adapter = new RippleAdapter(networkInfo);
    }
    // Aptos
    else if (baseBlockchain === 'aptos') {
      adapter = new AptosAdapter(networkInfo);
    }
    // Sui
    else if (baseBlockchain === 'sui') {
      adapter = new SuiAdapter(networkInfo);
    }
    // Stellar
    else if (baseBlockchain === 'stellar') {
      adapter = new StellarAdapter(networkInfo);
    }
    // Hedera
    else if (baseBlockchain === 'hedera') {
      adapter = new HederaAdapter(networkInfo);
    }
    // NEAR
    else if (baseBlockchain === 'near') {
      adapter = new NearAdapter(networkInfo);
    }
    else {
      throw new Error(`Unsupported blockchain: ${blockchainId}`);
    }
    
    // Cache and return the adapter
    this.adapters[blockchainId] = adapter;
    return adapter;
  }
  
  /**
   * Get all supported blockchains
   */
  static getSupportedBlockchains(): string[] {
    return Object.keys(NETWORKS);
  }
  
  /**
   * Get mainnet blockchains only
   */
  static getMainnetBlockchains(): string[] {
    return Object.keys(NETWORKS).filter(id => !NETWORKS[id].isTestnet);
  }
  
  /**
   * Get testnet blockchains only
   */
  static getTestnetBlockchains(): string[] {
    return Object.keys(NETWORKS).filter(id => NETWORKS[id].isTestnet);
  }
  
  /**
   * Get network information for a blockchain
   */
  static getNetworkInfo(blockchainId: string): NetworkInfo {
    const networkInfo = NETWORKS[blockchainId];
    if (!networkInfo) {
      throw new Error(`Unsupported blockchain: ${blockchainId}`);
    }
    return networkInfo;
  }
}