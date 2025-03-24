// src/lib/api-utils.ts
import { z } from 'zod'
import { createSafeAction } from 'next-safe-action'
import { ActionResponse } from '@/types/actions'

export const action = createSafeAction({
  handleReturnedServerError: (error) => {
    // Log the error on the server side but return a user-friendly message
    console.error('Server error:', error)
    
    // Return a structured error response
    return {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    }
  },
  
  handleServerErrorLog: (error) => {
    // Additional server-side error logging if needed
    console.error('Server Action Error:', error)
  }
})

/**
 * Helper to create a successful response
 */
export function createSuccessResponse<T>(data: T): ActionResponse<T> {
  return {
    success: true,
    data
  }
}

/**
 * Helper to create an error response
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any
): ActionResponse {
  return {
    success: false,
    error: {
      code,
      message,
      details
    }
  }
}

/**
 * Validate a blockchain ID
 */
export function validateBlockchainId(blockchainId: string): boolean {
  // Basic validation to ensure the blockchain ID is one of the supported ones
  const supportedBlockchains = [
    'ethereum', 'ethereum-sepolia',
    'polygon', 'polygon-mumbai',
    'avalanche', 'avalanche-fuji',
    'optimism', 'optimism-goerli',
    'bitcoin', 'bitcoin-testnet',
    'solana', 'solana-devnet',
    'ripple', 'ripple-testnet',
    'aptos', 'aptos-testnet',
    'sui', 'sui-testnet',
    'mantle', 'mantle-testnet',
    'stellar', 'stellar-testnet',
    'hedera', 'hedera-testnet',
    'base', 'base-goerli',
    'zksync', 'zksync-goerli',
    'arbitrum', 'arbitrum-goerli',
    'near', 'near-testnet'
  ]
  
  return supportedBlockchains.includes(blockchainId)
}

/**
 * Parse a hex address to ensure it's valid
 */
export function parseHexAddress(address: string): string {
  // Ensure the address starts with 0x
  if (!address.startsWith('0x')) {
    address = `0x${address}`
  }
  
  // Validate the address format (basic check)
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    throw new Error('Invalid Ethereum address format')
  }
  
  return address.toLowerCase()
}
