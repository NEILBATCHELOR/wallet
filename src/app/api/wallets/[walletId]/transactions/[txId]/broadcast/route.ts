// src/app/api/wallets/[walletId]/transactions/[txId]/broadcast/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/services/supabaseClient'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'
import { TransactionData, TransactionStatus } from '@/core/interfaces'

/**
 * POST /api/wallets/:walletId/transactions/:txId/broadcast
 * Broadcasts a signed transaction to the blockchain
 */
export async function POST(
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
    
    // Get transaction from database
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
    
    // Check if transaction has enough signatures based on wallet threshold
    if (!tx.signatures || tx.signatures.length < wallet.threshold) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_SIGNATURES',
            message: `Transaction requires at least ${wallet.threshold} signatures, but only has ${tx.signatures ? tx.signatures.length : 0}`
          }
        },
        { status: 400 }
      )
    }
    
    // Check if transaction is already broadcast
    if (tx.tx_hash) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'ALREADY_BROADCAST',
            message: 'Transaction has already been broadcast'
          }
        },
        { status: 400 }
      )
    }
    
    // Convert database transaction to TransactionData format
    const transactionData: TransactionData = {
      id: tx.id,
      fromAddress: tx.from_address,
      toAddress: tx.to_address,
      amount: tx.amount,
      tokenAddress: tx.token_address,
      data: tx.data,
      raw: tx.raw_data,
      signatures: tx.signatures,
      status: tx.status
    }
    
    // Get blockchain adapter for the wallet's blockchain
    const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
    
    // Broadcast transaction
    const txHash = await adapter.broadcastTransaction(transactionData)
    
    // Update transaction in database
    const { data: updatedTx, error: updateError } = await supabase
      .from('transactions')
      .update({
        tx_hash: txHash,
        status: TransactionStatus.PENDING,
        broadcast_at: new Date().toISOString()
      })
      .eq('id', txId)
      .select()
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      data: {
        txHash,
        transaction: updatedTx
      }
    })
  } catch (error) {
    console.error('Error broadcasting transaction:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to broadcast transaction'
        }
      },
      { status: 500 }
    )
  }
}
