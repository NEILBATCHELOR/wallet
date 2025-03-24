// src/components/WalletCreator.tsx
import React, { useState } from 'react';
import { useMultiSigWallet } from '../hooks/useMultiSigWallet';
import { BlockchainAdapterFactory } from '../core/BlockchainAdapterFactory';

const WalletCreator: React.FC = () => {
  const { createWallet, loading } = useMultiSigWallet();
  const [name, setName] = useState('');
  const [blockchain, setBlockchain] = useState('ethereum');
  const [owners, setOwners] = useState(['']);
  const [threshold, setThreshold] = useState(1);
  const [error, setError] = useState<string | null>(null);
  
  // Get supported blockchains
  const supportedBlockchains = BlockchainAdapterFactory.getSupportedBlockchains();
  
  // Handle owner address changes
  const handleOwnerChange = (index: number, value: string) => {
    const newOwners = [...owners];
    newOwners[index] = value;
    setOwners(newOwners);
  };
  
  // Add a new owner field
  const addOwner = () => {
    setOwners([...owners, '']);
  };
  
  // Remove an owner field
  const removeOwner = (index: number) => {
    if (owners.length > 1) {
      const newOwners = [...owners];
      newOwners.splice(index, 1);
      setOwners(newOwners);
      
      // Adjust threshold if needed
      if (threshold > newOwners.length) {
        setThreshold(newOwners.length);
      }
    }
  };
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Validate inputs
      if (!name.trim()) {
        throw new Error('Wallet name is required');
      }
      
      // Filter out empty owner addresses
      const filteredOwners = owners.filter(owner => owner.trim());
      
      if (filteredOwners.length === 0) {
        throw new Error('At least one owner is required');
      }
      
      if (threshold < 1 || threshold > filteredOwners.length) {
        throw new Error(`Threshold must be between 1 and ${filteredOwners.length}`);
      }
      
      // Validate owner addresses
      const adapter = BlockchainAdapterFactory.getAdapter(blockchain);
      
      for (const owner of filteredOwners) {
        if (!adapter.validateAddress(owner)) {
          throw new Error(`Invalid address: ${owner}`);
        }
      }
      
      // Create wallet
      await createWallet(name, blockchain, filteredOwners, threshold);
      
      // Reset form
      setName('');
      setOwners(['']);
      setThreshold(1);
    } catch (err: any) {
      console.error('Error creating wallet:', err);
      setError(err.message);
    }
  };
  
  return (
    <div className="wallet-creator">
      <h2>Create Multi-Signature Wallet</h2>
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="name">Wallet Name</label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="blockchain">Blockchain</label>
          <select
            id="blockchain"
            value={blockchain}
            onChange={(e) => setBlockchain(e.target.value)}
            disabled={loading}
            required
          >
            {supportedBlockchains.map((chain) => (
              <option key={chain} value={chain}>
                {chain.charAt(0).toUpperCase() + chain.slice(1)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="form-group">
          <label>Owners</label>
          {owners.map((owner, index) => (
            <div key={index} className="owner-input">
              <input
                type="text"
                value={owner}
                onChange={(e) => handleOwnerChange(index, e.target.value)}
                placeholder={`Owner ${index + 1} Address`}
                disabled={loading}
                required
              />
              
              <button
                type="button"
                onClick={() => removeOwner(index)}
                disabled={loading || owners.length <= 1}
                className="remove-button"
              >
                Remove
              </button>
            </div>
          ))}
          
          <button
            type="button"
            onClick={addOwner}
            disabled={loading}
            className="add-button"
          >
            Add Owner
          </button>
        </div>
        
        <div className="form-group">
          <label htmlFor="threshold">Required Signatures</label>
          <input
            type="number"
            id="threshold"
            min={1}
            max={owners.length}
            value={threshold}
            onChange={(e) => setThreshold(parseInt(e.target.value))}
            disabled={loading}
            required
          />
          <span className="threshold-info">
            out of {owners.filter(o => o.trim()).length} owner(s)
          </span>
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="submit-button"
        >
          {loading ? 'Creating...' : 'Create Wallet'}
        </button>
      </form>
    </div>
  );
};

// src/components/WalletList.tsx
import React, { useEffect } from 'react';
import { useMultiSigWallet } from '../hooks/useMultiSigWallet';
import { useWalletBalance } from '../hooks/useWalletBalance';
import { Link } from 'react-router-dom';

const WalletList: React.FC = () => {
  const { wallets, loadWallets, loading, error } = useMultiSigWallet();
  
  useEffect(() => {
    loadWallets();
  }, [loadWallets]);
  
  if (loading && wallets.length === 0) {
    return <div className="loading">Loading wallets...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  if (wallets.length === 0) {
    return (
      <div className="no-wallets">
        <p>You don't have any multi-signature wallets yet.</p>
        <Link to="/wallets/create" className="create-button">
          Create Wallet
        </Link>
      </div>
    );
  }
  
  return (
    <div className="wallet-list">
      <h2>Your Multi-Signature Wallets</h2>
      
      <div className="wallets">
        {wallets.map((wallet) => (
          <WalletItem key={wallet.id} wallet={wallet} />
        ))}
      </div>
      
      <div className="actions">
        <Link to="/wallets/create" className="create-button">
          Create Wallet
        </Link>
      </div>
    </div>
  );
};

interface WalletItemProps {
  wallet: {
    id: string;
    name: string;
    blockchain: string;
    address: string;
    owners: string[];
    threshold: number;
  };
}

const WalletItem: React.FC<WalletItemProps> = ({ wallet }) => {
  const { balance, loading: balanceLoading } = useWalletBalance({
    address: wallet.address,
    blockchain: wallet.blockchain
  });
  
  return (
    <div className="wallet-item">
      <div className="wallet-header">
        <h3>{wallet.name}</h3>
        <span className="blockchain-badge">{wallet.blockchain}</span>
      </div>
      
      <div className="wallet-address">
        <strong>Address:</strong> {wallet.address}
      </div>
      
      <div className="wallet-balance">
        <strong>Balance:</strong> {balanceLoading ? 'Loading...' : balance}
      </div>
      
      <div className="wallet-details">
        <p>
          <strong>Owners:</strong> {wallet.owners.length}
        </p>
        <p>
          <strong>Required Signatures:</strong> {wallet.threshold}
        </p>
      </div>
      
      <div className="wallet-actions">
        <Link to={`/wallets/${wallet.id}`} className="view-button">
          View Wallet
        </Link>
      </div>
    </div>
  );
};

// src/components/TransactionCreator.tsx
import React, { useState } from 'react';
import { useMultiSigWallet } from '../hooks/useMultiSigWallet';
import { BlockchainAdapterFactory } from '../core/BlockchainAdapterFactory';

interface TransactionCreatorProps {
  walletId: string;
}

const TransactionCreator: React.FC<TransactionCreatorProps> = ({ walletId }) => {
  const { createProposal, loading, error: hookError } = useMultiSigWallet({ walletId });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [tokenAddress, setTokenAddress] = useState('');
  const [data, setData] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    try {
      // Validate inputs
      if (!title.trim()) {
        throw new Error('Transaction title is required');
      }
      
      if (!toAddress.trim()) {
        throw new Error('Recipient address is required');
      }
      
      if (!amount.trim() || parseFloat(amount) <= 0) {
        throw new Error('Amount must be greater than 0');
      }
      
      // Create proposal
      await createProposal(
        walletId,
        title,
        description,
        toAddress,
        amount,
        tokenAddress || undefined,
        data || undefined
      );
      
      // Reset form
      setTitle('');
      setDescription('');
      setToAddress('');
      setAmount('');
      setTokenAddress('');
      setData('');
    } catch (err: any) {
      console.error('Error creating transaction:', err);
      setError(err.message);
    }
  };
  
  return (
    <div className="transaction-creator">
      <h3>Propose Transaction</h3>
      
      {(error || hookError) && (
        <div className="error-message">{error || hookError}</div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description (Optional)</label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={loading}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="toAddress">Recipient Address</label>
          <input
            type="text"
            id="toAddress"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            disabled={loading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="amount">Amount</label>
          <input
            type="number"
            id="amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            step="any"
            min="0"
            disabled={loading}
            required
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="tokenAddress">Token Address (Optional)</label>
          <input
            type="text"
            id="tokenAddress"
            value={tokenAddress}
            onChange={(e) => setTokenAddress(e.target.value)}
            disabled={loading}
            placeholder="Leave empty for native token"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="data">Contract Data (Optional)</label>
          <textarea
            id="data"
            value={data}
            onChange={(e) => setData(e.target.value)}
            disabled={loading}
            placeholder="0x"
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="submit-button"
        >
          {loading ? 'Creating...' : 'Create Proposal'}
        </button>
      </form>
    </div>
  );
};

// src/components/TransactionList.tsx
import React, { useEffect } from 'react';
import { useMultiSigWallet } from '../hooks/useMultiSigWallet';

interface TransactionListProps {
  walletId: string;
}

const TransactionList: React.FC<TransactionListProps> = ({ walletId }) => {
  const { proposals, loadProposals, loading, error } = useMultiSigWallet({ walletId });
  
  useEffect(() => {
    loadProposals(walletId);
  }, [walletId, loadProposals]);
  
  if (loading && proposals.length === 0) {
    return <div className="loading">Loading transactions...</div>;
  }
  
  if (error) {
    return <div className="error-message">{error}</div>;
  }
  
  if (proposals.length === 0) {
    return (
      <div className="no-transactions">
        <p>No transaction proposals found.</p>
      </div>
    );
  }
  
  return (
    <div className="transaction-list">
      <h3>Transaction Proposals</h3>
      
      <div className="transactions">
        {proposals.map((proposal) => (
          <TransactionItem key={proposal.id} proposal={proposal} />
        ))}
      </div>
    </div>
  );
};

interface TransactionItemProps {
  proposal: {
    id: string;
    title: string;
    description: string | null;
    to_address: string;
    value: string;
    status: string;
    token_address: string | null;
    token_symbol: string | null;
    signatures: { signer: string; signature: string }[];
  };
}

const TransactionItem: React.FC<TransactionItemProps> = ({ proposal }) => {
  const { currentWallet, signProposal, executeProposal, loading } = useMultiSigWallet();
  const [privateKey, setPrivateKey] = useState('');
  const [showSignForm, setShowSignForm] = useState(false);
  
  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await signProposal(proposal.id, privateKey);
      setPrivateKey('');
      setShowSignForm(false);
    } catch (err) {
      console.error('Error signing transaction:', err);
    }
  };
  
  const handleExecute = async () => {
    try {
      await executeProposal(proposal.id);
    } catch (err) {
      console.error('Error executing transaction:', err);
    }
  };
  
  // Determine if user can sign or execute
  const canSign = proposal.status === 'pending' && currentWallet;
  const canExecute = proposal.status === 'pending' && 
    currentWallet && 
    proposal.signatures.length >= currentWallet.threshold;
  
  return (
    <div className={`transaction-item status-${proposal.status}`}>
      <div className="transaction-header">
        <h4>{proposal.title}</h4>
        <span className={`status-badge status-${proposal.status}`}>
          {proposal.status}
        </span>
      </div>
      
      {proposal.description && (
        <div className="transaction-description">
          {proposal.description}
        </div>
      )}
      
      <div className="transaction-details">
        <p>
          <strong>To:</strong> {proposal.to_address}
        </p>
        <p>
          <strong>Amount:</strong> {proposal.value} {proposal.token_symbol || 'native'}
        </p>
        {proposal.token_address && (
          <p>
            <strong>Token:</strong> {proposal.token_address}
          </p>
        )}
      </div>
      
      <div className="transaction-signatures">
        <p>
          <strong>Signatures:</strong> {proposal.signatures.length} 
          {currentWallet && ` of ${currentWallet.threshold} required`}
        </p>
        
        {proposal.signatures.length > 0 && (
          <ul className="signature-list">
            {proposal.signatures.map((sig, index) => (
              <li key={index}>
                <strong>Signer:</strong> {sig.signer.slice(0, 8)}...{sig.signer.slice(-6)}
              </li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="transaction-actions">
        {canSign && (
          <>
            <button
              type="button"
              onClick={() => setShowSignForm(!showSignForm)}
              disabled={loading}
              className="sign-button"
            >
              Sign
            </button>
            
            {showSignForm && (
              <form onSubmit={handleSign} className="sign-form">
                <div className="form-group">
                  <label htmlFor="privateKey">Private Key</label>
                  <input
                    type="password"
                    id="privateKey"
                    value={privateKey}
                    onChange={(e) => setPrivateKey(e.target.value)}
                    disabled={loading}
                    required
                  />
                  <p className="warning">
                    Never enter your private key on a website you don't trust completely.
                  </p>
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !privateKey}
                  className="submit-button"
                >
                  {loading ? 'Signing...' : 'Sign Transaction'}
                </button>
              </form>
            )}
          </>
        )}
        
        {canExecute && (
          <button
            type="button"
            onClick={handleExecute}
            disabled={loading}
            className="execute-button"
          >
            {loading ? 'Executing...' : 'Execute'}
          </button>
        )}
      </div>
    </div>
  );
};

export { WalletCreator, WalletList, TransactionCreator, TransactionList };