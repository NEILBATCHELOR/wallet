# Wallet API Documentation

This document outlines the API services implemented for the multi-signature wallet application compatible with Vite React TypeScript.

## Architecture

The API is designed as a client-side service that interfaces with:
- Blockchain adapters for multi-chain support
- Supabase for data persistence
- React components through custom hooks

## Core Components

### API Types

Located in `src/types/api.ts`, this file defines the standard response format:

```typescript
interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
}
```

### Wallet Service

Located in `src/services/wallet-service.ts`, this service handles all wallet operations:

- **Blockchain Management**
  - `getSupportedBlockchains`: Lists all supported blockchains
  
- **Wallet Management**
  - `createWallet`: Creates a new multi-signature wallet
  - `getWallets`: Lists all wallets for a user
  - `getWallet`: Gets details for a specific wallet
  - `updateWallet`: Updates wallet details
  - `deleteWallet`: Deletes a wallet
  - `getWalletBalance`: Gets the balance for a wallet

- **Transaction Management**
  - `createTransaction`: Creates a new transaction
  - `getWalletTransactions`: Lists transactions for a wallet
  - `getTransaction`: Gets details for a specific transaction
  - `signTransaction`: Signs a transaction
  - `broadcastTransaction`: Broadcasts a transaction to the blockchain

### Wallet API Client

Located in `src/lib/api/wallet-api.ts`, this client provides a simplified interface to the wallet service. It has the same methods as the service but abstracts implementation details.

### React Hooks

Located in `src/hooks/useWalletApi.ts`, this hook integrates the wallet API with React state management:

```typescript
const {
  // States
  blockchainsState,
  walletsState,
  walletState,
  // etc...
  
  // Actions
  getBlockchains,
  getWallets,
  createWallet,
  // etc...
} = useWalletApi(userId)
```

### Validation

Located in `src/lib/validation.ts`, this file provides Zod schemas and validation utilities for wallet operations.

## Example Usage

### Listing Wallets

```typescript
import { useEffect } from 'react'
import { useWalletApi } from '@/hooks/useWalletApi'

function WalletList() {
  const userId = 'current-user-id' // Replace with your auth system
  const { walletsState, getWallets } = useWalletApi(userId)
  
  useEffect(() => {
    getWallets()
  }, [getWallets])
  
  if (walletsState.isLoading) return <div>Loading...</div>
  if (walletsState.error) return <div>Error: {walletsState.error}</div>
  
  return (
    <div>
      <h1>My Wallets</h1>
      {walletsState.data?.map(wallet => (
        <div key={wallet.id}>
          <h2>{wallet.name}</h2>
          <p>{wallet.address}</p>
        </div>
      ))}
    </div>
  )
}
```

### Creating a Wallet

```typescript
import { useState } from 'react'
import { useWalletApi } from '@/hooks/useWalletApi'

function CreateWallet() {
  const userId = 'current-user-id' // Replace with your auth system
  const { createWalletState, createWallet } = useWalletApi(userId)
  const [name, setName] = useState('')
  const [blockchain, setBlockchain] = useState('ethereum')
  const [owners, setOwners] = useState<string[]>([])
  const [threshold, setThreshold] = useState(2)
  
  const handleSubmit = async (e) => {
    e.preventDefault()
    await createWallet({
      name,
      blockchain,
      owners,
      threshold
    })
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button 
        type="submit" 
        disabled={createWalletState.isLoading}
      >
        {createWalletState.isLoading ? 'Creating...' : 'Create Wallet'}
      </button>
      {createWalletState.error && (
        <div className="error">{createWalletState.error}</div>
      )}
    </form>
  )
}
```

## Database Schema

The API expects the following tables in Supabase:

### wallets

- `id`: string (primary key)
- `user_id`: string (foreign key)
- `name`: string
- `blockchain`: string
- `address`: string
- `owners`: string[] (JSON array)
- `threshold`: number
- `created_at`: timestamp

### transactions

- `id`: string (primary key)
- `wallet_id`: string (foreign key)
- `from_address`: string
- `to_address`: string
- `amount`: string
- `token_address`: string (optional)
- `data`: string (optional)
- `raw_data`: jsonb
- `signatures`: string[] (JSON array)
- `status`: string
- `tx_hash`: string (optional)
- `created_at`: timestamp
- `broadcast_at`: timestamp (optional)

## Environment Variables

Add these to your `.env` file:

```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```
