// src/components/ledger/LedgerConnect.tsx
import React, { useState, useEffect } from 'react';
import { useLedger, LedgerAppType } from '../../hooks/useLedger';

interface LedgerConnectProps {
  appType: LedgerAppType;
  onAddressSelect?: (address: string, path: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

const LedgerConnect: React.FC<LedgerConnectProps> = ({
  appType,
  onAddressSelect,
  onConnect,
  onDisconnect
}) => {
  const {
    isConnected,
    isLoading,
    error,
    addresses,
    selectedPath,
    setSelectedPath,
    isBrowserSupported,
    connect,
    disconnect,
    loadAddresses
  } = useLedger(appType);

  const [showAddressOnDevice, setShowAddressOnDevice] = useState(false);

  // Handle address selection
  const handleAddressSelect = (path: string) => {
    setSelectedPath(path);
    
    // Find the address for this path
    const addressInfo = addresses.find(a => a.path === path);
    if (addressInfo && onAddressSelect) {
      onAddressSelect(addressInfo.address, path);
    }
  };

  // Handle connect button click
  const handleConnect = async () => {
    const success = await connect();
    if (success && onConnect) {
      onConnect();
    }
  };

  // Handle disconnect button click
  const handleDisconnect = async () => {
    await disconnect();
    if (onDisconnect) {
      onDisconnect();
    }
  };

  // Handle verify address on device
  const handleVerifyAddress = async () => {
    setShowAddressOnDevice(true);
    await loadAddresses(true); // true = display on device
    setShowAddressOnDevice(false);
  };

  // Check if browser supports Ledger
  const supported = isBrowserSupported();

  return (
    <div className="ledger-connect">
      <h3>Connect to Ledger</h3>
      
      {!supported && (
        <div className="error-message">
          Your browser does not support Ledger devices. Please use Chrome, Brave, or Edge.
        </div>
      )}
      
      {error && <div className="error-message">{error}</div>}
      
      {!isConnected ? (
        <button 
          onClick={handleConnect} 
          disabled={isLoading || !supported}
          className="connect-button"
        >
          {isLoading ? 'Connecting...' : 'Connect Ledger'}
        </button>
      ) : (
        <div className="ledger-connected">
          <div className="success-message">
            Ledger connected successfully!
          </div>
          
          <button 
            onClick={handleDisconnect} 
            disabled={isLoading}
            className="disconnect-button"
          >
            Disconnect
          </button>
          
          {addresses.length > 0 && (
            <div className="address-selection">
              <h4>Select Address</h4>
              <div className="address-list">
                {addresses.map((addressInfo) => (
                  <div 
                    key={addressInfo.path} 
                    className={`address-item ${selectedPath === addressInfo.path ? 'selected' : ''}`}
                    onClick={() => handleAddressSelect(addressInfo.path)}
                  >
                    <div className="path">{addressInfo.path}</div>
                    <div className="address">{addressInfo.address}</div>
                  </div>
                ))}
              </div>
              
              <button 
                onClick={handleVerifyAddress} 
                disabled={isLoading || showAddressOnDevice || !selectedPath}
                className="verify-button"
              >
                {showAddressOnDevice ? 'Displaying on Ledger...' : 'Verify on Device'}
              </button>
            </div>
          )}
        </div>
      )}
      
      {/* App-specific instructions */}
      <div className="ledger-instructions">
        <h4>Instructions</h4>
        {appType === 'ethereum' && (
          <ol>
            <li>Connect your Ledger device to your computer</li>
            <li>Enter your PIN code</li>
            <li>Open the Ethereum app on your Ledger</li>
            <li>Click "Connect Ledger" above</li>
          </ol>
        )}
        {appType === 'bitcoin' && (
          <ol>
            <li>Connect your Ledger device to your computer</li>
            <li>Enter your PIN code</li>
            <li>Open the Bitcoin app on your Ledger</li>
            <li>Click "Connect Ledger" above</li>
          </ol>
        )}
        {appType === 'solana' && (
          <ol>
            <li>Connect your Ledger device to your computer</li>
            <li>Enter your PIN code</li>
            <li>Open the Solana app on your Ledger</li>
            <li>Click "Connect Ledger" above</li>
          </ol>
        )}
      </div>
    </div>
  );
};

// src/components/ledger/LedgerTransactionSigner.tsx
import React, { useState } from 'react';
import { useLedger, LedgerAppType } from '../../hooks/useLedger';

interface LedgerTransactionSignerProps {
  appType: LedgerAppType;
  transaction: any;
  onSignComplete: (signature: string) => void;
  onCancel: () => void;
}

const LedgerTransactionSigner: React.FC<LedgerTransactionSignerProps> = ({
  appType,
  transaction,
  onSignComplete,
  onCancel
}) => {
  const {
    isConnected,
    isLoading,
    error,
    selectedPath,
    signTransaction
  } = useLedger(appType);

  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);

  // Handle sign button click
  const handleSign = async () => {
    if (!isConnected) {
      setSignError('Ledger not connected');
      return;
    }

    try {
      setSigning(true);
      setSignError(null);
      
      const signature = await signTransaction(transaction);
      
      setSigning(false);
      onSignComplete(signature);
    } catch (err: any) {
      setSigning(false);
      setSignError(err.message || 'Failed to sign transaction');
    }
  };

  return (
    <div className="ledger-transaction-signer">
      <h3>Sign Transaction with Ledger</h3>
      
      {(error || signError) && (
        <div className="error-message">
          {error || signError}
        </div>
      )}
      
      {!isConnected ? (
        <div className="error-message">
          Please connect your Ledger device first
        </div>
      ) : (
        <div className="transaction-signing">
          <div className="transaction-info">
            <h4>Transaction Details</h4>
            
            {/* Display transaction details based on app type */}
            {appType === 'ethereum' && (
              <div className="eth-transaction">
                <p><strong>To:</strong> {transaction.to}</p>
                <p><strong>Value:</strong> {transaction.value?.toString() || '0'} ETH</p>
                {transaction.data && transaction.data !== '0x' && (
                  <p><strong>Data:</strong> {transaction.data}</p>
                )}
              </div>
            )}
            
            {appType === 'bitcoin' && (
              <div className="btc-transaction">
                <p><strong>Outputs:</strong> {transaction.outputs?.length || 0}</p>
                <p><strong>Fee:</strong> {transaction.fee || 'N/A'} Satoshis</p>
              </div>
            )}
            
            {appType === 'solana' && (
              <div className="sol-transaction">
                <p><strong>Type:</strong> {transaction.instructions?.[0]?.programId?.toString() || 'Unknown'}</p>
                <p><strong>Recent Blockhash:</strong> {transaction.recentBlockhash?.substring(0, 10)}...</p>
              </div>
            )}
          </div>
          
          <div className="signing-instructions">
            <h4>Instructions</h4>
            <ol>
              <li>Review the transaction details above</li>
              <li>Click "Sign Transaction" button below</li>
              <li>Verify the transaction details on your Ledger device</li>
              <li>Approve the transaction on your Ledger device</li>
            </ol>
          </div>
          
          <div className="actions">
            <button 
              onClick={handleSign} 
              disabled={isLoading || signing}
              className="sign-button"
            >
              {signing ? 'Waiting for Approval...' : 'Sign Transaction'}
            </button>
            
            <button 
              onClick={onCancel} 
              disabled={signing}
              className="cancel-button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export { LedgerConnect, LedgerTransactionSigner };