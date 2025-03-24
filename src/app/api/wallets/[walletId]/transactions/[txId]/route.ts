// src/app/api/wallets/[walletId]/transactions/[txId]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/services/supabaseClient'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'

/**
 * GET /api/wallets/:walletId/transactions/:txId
 * Retrieves details for a specific transaction
 */
export async function GET(
  request: Request,
  { params }: { params: { walletId: string; txId: string } }
) {
  try {
    const { walletId, txId } = params
    
    // In a real application, you would verify the authentication token
    // and ensure the user has access to this wallet
    const userId = 'current-user-id'
    
    // Check if wallet exists and belongs to the user
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('*')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single()
    
    if (walletError) {
      if (walletError.code === 'PGRST116') {
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
      throw walletError
    }
    
    // Query transaction from the database
    const { data: tx, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', txId)
      .eq('wallet_id', walletId)
      .single()
    
    if (txError) {
      if (txError.code === 'PGRST116') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'TRANSACTION_NOT_FOUND',
              message: 'Transaction not found'
            }
          },
          { status: 404 }
        )
      }
      throw txError
    }
    
    // If there's a blockchain transaction hash, check its status
    if (tx.tx_hash) {
      const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
      const currentStatus = await adapter.getTransactionStatus(tx.tx_hash)
      
      // Update status if it has changed
      if (currentStatus !== tx.status) {
        await supabase
          .from('transactions')
          .update({ status: currentStatus })
          .eq('id', txId)
        
        tx.status = currentStatus
      }
    }
    
    return NextResponse.json({
      success: true,
      data: tx
    })
  } catch (error) {
    console.error('Error fetching transaction details:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch transaction details'
        }
      },
      { status: 500 }
    )
  }
}
