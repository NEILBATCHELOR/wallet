// src/components/layout/Header.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useWallet } from '../../contexts/WalletContext';

export function Header() {
  const { currentWallet } = useWallet();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  
  // Mock user for demo purposes
  const user = {
    name: 'Demo User',
    email: 'demo@example.com',
    avatar: '/assets/avatar.png'
  };

  const toggleProfileMenu = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <Link to="/" className="logo">
          MultiSig Wallet
        </Link>
        {currentWallet && (
          <div className="current-wallet">
            <span className="wallet-indicator">Currently Viewing:</span>
            <span className="wallet-name">{currentWallet.name}</span>
          </div>
        )}
      </div>
      
      <div className="header-right">
        <div className="network-selector">
          <select className="network-select">
            <option value="ethereum-mainnet">Ethereum Mainnet</option>
            <option value="ethereum-sepolia">Ethereum Sepolia</option>
            <option value="polygon-mainnet">Polygon</option>
            <option value="avalanche-mainnet">Avalanche</option>
            <option value="solana-mainnet">Solana</option>
          </select>
        </div>
        
        <div className="user-profile">
          <button 
            className="profile-button" 
            onClick={toggleProfileMenu}
            aria-expanded={isProfileOpen}
          >
            <img src={user.avatar} alt="User avatar" className="avatar" />
            <span className="username">{user.name}</span>
          </button>
          
          {isProfileOpen && (
            <div className="profile-dropdown">
              <div className="profile-header">
                <img src={user.avatar} alt="User avatar" className="avatar" />
                <div className="user-info">
                  <p className="name">{user.name}</p>
                  <p className="email">{user.email}</p>
                </div>
              </div>
              <div className="profile-menu">
                <Link to="/profile" className="menu-item">Profile Settings</Link>
                <Link to="/security" className="menu-item">Security</Link>
                <button className="menu-item logout">Log Out</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}