# Multi-Signature Wallet API

A comprehensive API for managing multi-signature wallets and transactions across multiple blockchains.

## Architecture

The wallet API is built with Next.js App Router and follows modern best practices:

- **REST API Routes**: Traditional REST API endpoints for client-server interaction.
- **Server Actions**: Type-safe server-side functions for secure operations.
- **Multi-blockchain Support**: Unified interface for interacting with different blockchains.
- **TypeScript**: Fully type-safe implementation.

## Supported Blockchains

The API supports multiple blockchains through a unified adapter interface:

- **EVM Chains**: Ethereum, Polygon, Avalanche, Optimism, Mantle, Base, ZK Sync Era, Arbitrum
- **Bitcoin**: Using P2SH/P2WSH addresses
- **Alternative Chains**: Solana, Ripple (XRP), Aptos, Sui, Stellar, Hedera, NEAR

Each blockchain has both mainnet and testnet support.

## API Endpoints

### Blockchain Information

- `GET /api/blockchains` - List all supported blockchains
  - Query params: `filter=mainnet|testnet` (optional)

### Wallet Management

- `GET /api/wallets` - List all wallets for the authenticated user
- `POST /api/wallets` - Create a new wallet
- `GET /api/wallets/:walletId` - Get wallet details
- `PATCH /api/wallets/:walletId` - Update wallet details
- `DELETE /api/wallets/:walletId` - Delete a wallet from the user's account
- `GET /api/wallets/:walletId/balance` - Get wallet balance
  - Query params: `tokenAddress` (optional)

### Transaction Management

- `GET /api/wallets/:walletId/transactions` - List transactions for a wallet
- `POST /api/wallets/:walletId/transactions` - Create a new transaction
- `GET /api/wallets/:walletId/transactions/:txId` - Get transaction details
- `POST /api/wallets/:walletId/transactions/:txId/sign` - Sign a transaction
- `POST /api/wallets/:walletId/transactions/:txId/broadcast` - Broadcast a transaction

## Server Actions

The API provides type-safe server actions for use with React components:

- `createWallet` - Create a new wallet
- `createTransaction` - Create a new transaction
- `signTransaction` - Sign a transaction
- `broadcastTransaction` - Broadcast a transaction
- `getWallets` - Get all wallets
- `getWallet` - Get wallet details
- `getWalletBalance` - Get wallet balance
- `getWalletTransactions` - Get wallet transactions
- `getTransaction` - Get transaction details

## Client-Side Utilities

### REST API Client

The `walletApi` client provides functions for interacting with the REST API endpoints:

```typescript
import { walletApi } from '@/lib/api/wallet-api';

// Example: Create a wallet
const response = await walletApi.createWallet({
  name: 'My Wallet',
  blockchain: 'ethereum',
  owners: ['0x1234...', '0x5678...'],
  threshold: 2
});
```

### Server Action Hooks

The `useWalletActions` hook provides React component integration with server actions:

```typescript
import { useWalletActions } from '@/hooks/useWalletActions';

function MyComponent() {
  const { 
    createWallet, 
    createWalletState,
    // Other actions and states...
  } = useWalletActions();

  async function handleCreateWallet() {
    await createWallet({
      name: 'My Wallet',
      blockchain: 'ethereum',
      owners: ['0x1234...', '0x5678...'],
      threshold: 2
    });
  }

  // Access state
  const { data, isLoading, error } = createWalletState;
  
  // Render component...
}
```

## Error Handling

All API endpoints and server actions follow a consistent error handling pattern:

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}
```

## Getting Started

1. Configure RPC URLs in `BlockchainAdapterFactory.ts` with your API keys
2. Set up database credentials in `supabaseClient.ts`
3. Run the development server:

```bash
npm run dev
```

## Database Schema

The API expects the following database tables:

### wallets

- `id`: string (primary key)
- `user_id`: string (foreign key)
- `name`: string
- `blockchain`: string
- `address`: string
- `owners`: string[]
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
- `raw_data`: json
- `signatures`: string[]
- `status`: string
- `tx_hash`: string (optional)
- `created_at`: timestamp
- `broadcast_at`: timestamp (optional)
