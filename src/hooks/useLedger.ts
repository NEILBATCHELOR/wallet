// src/hooks/useLedger.ts
import { useState, useEffect, useCallback } from 'react';
import { LedgerService, TransportType } from '../services/ledger/LedgerService';
import { LedgerEthereumService, ETHEREUM_DERIVATION_PATHS } from '../services/ledger/LedgerEthereumService';
import { LedgerBitcoinService, BITCOIN_DERIVATION_PATHS } from '../services/ledger/LedgerBitcoinService';
import { LedgerSolanaService, SOLANA_DERIVATION_PATHS } from '../services/ledger/LedgerSolanaService';

export type LedgerAppType = 'ethereum' | 'bitcoin' | 'solana' | 'stellar' | 'ripple' | 'near';

export interface LedgerAddressInfo {
  path: string;
  address: string;
  publicKey?: string;
}

export function useLedger(appType: LedgerAppType = 'ethereum') {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<LedgerAddressInfo[]>([]);
  const [transportType, setTransportType] = useState<TransportType>('webusb');
  const [selectedPath, setSelectedPath] = useState<string>('');

  // Get services
  const ledgerService = LedgerService.getInstance();
  const ethereumService = LedgerEthereumService.getInstance();
  const bitcoinService = LedgerBitcoinService.getInstance();
  const solanaService = LedgerSolanaService.getInstance();

  // Check if browser supports Ledger
  const isBrowserSupported = useCallback(() => {
    return ledgerService.isBrowserSupported();
  }, []);

  // Connect to Ledger
  const connect = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Detect best transport if not set
      if (!transportType) {
        const bestTransport = await ledgerService.detectBestTransport();
        if (bestTransport) {
          setTransportType(bestTransport);
        } else {
          throw new Error('No supported transport found');
        }
      }

      // Set transport type
      ledgerService.setTransportType(transportType);

      // Connect
      const success = await ledgerService.connect();
      setIsConnected(success);

      if (success) {
        // Load addresses for the selected app
        await loadAddresses();
      }

      setIsLoading(false);
      return success;
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Ledger');
      setIsLoading(false);
      return false;
    }
  }, [transportType, appType]);

  // Disconnect from Ledger
  const disconnect = useCallback(async () => {
    try {
      setIsLoading(true);
      await ledgerService.disconnect();
      setIsConnected(false);
      setAddresses([]);
      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect from Ledger');
      setIsLoading(false);
    }
  }, []);

  // Load addresses for selected app
  const loadAddresses = useCallback(async (display: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isConnected) {
        throw new Error('Ledger not connected');
      }

      let derivationPaths: string[] = [];
      let addressList: LedgerAddressInfo[] = [];

      // Use appropriate service based on app type
      switch (appType) {
        case 'ethereum':
          derivationPaths = ETHEREUM_DERIVATION_PATHS;
          const ethAddresses = await ethereumService.getAddresses(derivationPaths, display);
          addressList = ethAddresses.map(item => ({
            path: item.path,
            address: item.address,
            publicKey: item.publicKey
          }));
          break;

        case 'bitcoin':
          derivationPaths = BITCOIN_DERIVATION_PATHS;
          const btcAddresses = await bitcoinService.getAddresses(derivationPaths, display);
          addressList = btcAddresses.map(item => ({
            path: item.path,
            address: item.address,
            publicKey: item.publicKey
          }));
          break;

        case 'solana':
          derivationPaths = SOLANA_DERIVATION_PATHS;
          const solAddresses = await solanaService.getAddresses(derivationPaths, display);
          addressList = solAddresses.map(item => ({
            path: item.path,
            address: item.address,
            publicKey: item.publicKey
          }));
          break;

        // Add other blockchain types as needed

        default:
          throw new Error(`Unsupported app type: ${appType}`);
      }

      setAddresses(addressList);
      
      // Set default selected path
      if (addressList.length > 0 && !selectedPath) {
        setSelectedPath(addressList[0].path);
      }

      setIsLoading(false);
    } catch (err: any) {
      setError(err.message || `Failed to load ${appType} addresses`);
      setIsLoading(false);
    }
  }, [isConnected, appType, selectedPath]);

  // Sign a transaction using Ledger
  const signTransaction = useCallback(async (transaction: any) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isConnected) {
        throw new Error('Ledger not connected');
      }

      if (!selectedPath) {
        throw new Error('No derivation path selected');
      }

      let signature;

      // Use appropriate service based on app type
      switch (appType) {
        case 'ethereum':
          signature = await ethereumService.signTransaction(selectedPath, transaction);
          break;

        case 'bitcoin':
          // For Bitcoin, transaction is { txHex, inputs, associatedKeysets, changePath }
          signature = await bitcoinService.signTransaction(
            selectedPath,
            transaction.txHex,
            transaction.inputs,
            transaction.associatedKeysets,
            transaction.changePath
          );
          break;

        case 'solana':
          signature = await solanaService.signTransaction(selectedPath, transaction);
          break;

        // Add other blockchain types as needed

        default:
          throw new Error(`Unsupported app type: ${appType}`);
      }

      setIsLoading(false);
      return signature;
    } catch (err: any) {
      setError(err.message || 'Failed to sign transaction');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, appType, selectedPath]);

  // Sign a message using Ledger
  const signMessage = useCallback(async (message: string | Uint8Array) => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isConnected) {
        throw new Error('Ledger not connected');
      }

      if (!selectedPath) {
        throw new Error('No derivation path selected');
      }

      let signature;

      // Use appropriate service based on app type
      switch (appType) {
        case 'ethereum':
          signature = await ethereumService.signMessage(selectedPath, message.toString());
          break;

        case 'bitcoin':
          signature = await bitcoinService.signMessage(selectedPath, message.toString());
          break;

        case 'solana':
          signature = await solanaService.signMessage(selectedPath, message);
          break;

        // Add other blockchain types as needed

        default:
          throw new Error(`Unsupported app type: ${appType}`);
      }

      setIsLoading(false);
      return signature;
    } catch (err: any) {
      setError(err.message || 'Failed to sign message');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, appType, selectedPath]);

  // Get the app version
  const getAppVersion = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (!isConnected) {
        throw new Error('Ledger not connected');
      }

      let version;

      // Use appropriate service based on app type
      switch (appType) {
        case 'ethereum':
          const ethConfig = await ethereumService.getAppConfiguration();
          version = ethConfig.version;
          break;

        case 'bitcoin':
          version = await bitcoinService.getAppVersion();
          break;

        case 'solana':
          version = await solanaService.getAppVersion();
          break;

        // Add other blockchain types as needed

        default:
          throw new Error(`Unsupported app type: ${appType}`);
      }

      setIsLoading(false);
      return version;
    } catch (err: any) {
      setError(err.message || 'Failed to get app version');
      setIsLoading(false);
      throw err;
    }
  }, [isConnected, appType]);

  // Subscribe to device connection status
  useEffect(() => {
    const subscription = ledgerService.getDeviceStatus().subscribe(connected => {
      setIsConnected(connected);
      
      // If disconnected, clear addresses
      if (!connected) {
        setAddresses([]);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    isConnected,
    isLoading,
    error,
    addresses,
    selectedPath,
    setSelectedPath,
    isBrowserSupported,
    connect,
    disconnect,
    loadAddresses,
    signTransaction,
    signMessage,
    getAppVersion,
  };
}