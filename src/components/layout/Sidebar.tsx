// src/components/layout/Sidebar.tsx
import React from 'react';
import { NavLink } from 'react-router-dom';
import { useWallet } from '../../context/WalletContext';

export function Sidebar() {
  const { wallets } = useWallet();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h3>Multi-Sig Wallet</h3>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <h4>Wallets</h4>
          <NavLink to="/wallets" className={({ isActive }) => 
            isActive ? 'nav-link active' : 'nav-link'
          } end>
            All Wallets
          </NavLink>
          <NavLink to="/wallets/create" className={({ isActive }) => 
            isActive ? 'nav-link active' : 'nav-link'
          }>
            Create Wallet
          </NavLink>
        </div>
        
        <div className="nav-section">
          <h4>Security</h4>
          <NavLink to="/security" className={({ isActive }) => 
            isActive ? 'nav-link active' : 'nav-link'
          }>
            Security Dashboard
          </NavLink>
          <NavLink to="/hardware-connect" className={({ isActive }) => 
            isActive ? 'nav-link active' : 'nav-link'
          }>
            Connect Hardware
          </NavLink>
        </div>
        
        {wallets.length > 0 && (
          <div className="nav-section">
            <h4>My Wallets</h4>
            <div className="wallets-list">
              {wallets.slice(0, 5).map(wallet => (
                <NavLink 
                  key={wallet.id} 
                  to={`/wallets/${wallet.id}`}
                  className={({ isActive }) => 
                    isActive ? 'wallet-link active' : 'wallet-link'
                  }
                >
                  <span className="wallet-name">{wallet.name}</span>
                  <span className="wallet-blockchain">{wallet.blockchain}</span>
                </NavLink>
              ))}
              {wallets.length > 5 && (
                <NavLink to="/wallets" className="wallet-link more">
                  View all ({wallets.length})
                </NavLink>
              )}
            </div>
          </div>
        )}
      </nav>
    </aside>
  );
}