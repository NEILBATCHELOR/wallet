// src/app/api/wallets/[walletId]/balance/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/services/supabaseClient'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'

/**
 * GET /api/wallets/:walletId/balance
 * Retrieves the balance for a specific wallet
 */
export async function GET(
  request: Request,
  { params }: { params: { walletId: string } }
) {
  try {
    const walletId = params.walletId
    const url = new URL(request.url)
    const tokenAddress = url.searchParams.get('tokenAddress') || undefined
    
    // In a real application, you would verify the authentication token
    // and ensure the user has access to this wallet
    const userId = 'current-user-id'
    
    // Query wallet from the database
    const { data: wallet, error } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single()
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'WALLET_NOT_FOUND',
              message: 'Wallet not found'
            }
          },
          { status: 404 }
        )
      }
      throw error
    }
    
    // Get blockchain adapter for the wallet's blockchain
    const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
    
    // Get wallet balance
    const balance = await adapter.getBalance(wallet.address, tokenAddress)
    
    // Get network info for currency details
    const networkInfo = adapter.getNetworkInfo()
    
    return NextResponse.json({
      success: true,
      data: {
        balance,
        address: wallet.address,
        blockchain: wallet.blockchain,
        tokenAddress,
        currency: tokenAddress 
          ? { symbol: 'TOKEN', decimals: 18 } // In a real app, you'd fetch token details
          : networkInfo.nativeCurrency
      }
    })
  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch wallet balance'
        }
      },
      { status: 500 }
    )
  }
}
