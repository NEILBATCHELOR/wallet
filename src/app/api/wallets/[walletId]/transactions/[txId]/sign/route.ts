// src/app/api/wallets/[walletId]/transactions/[txId]/sign/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/services/supabaseClient'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'
import { TransactionData } from '@/core/interfaces'

/**
 * POST /api/wallets/:walletId/transactions/:txId/sign
 * Signs a transaction
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
    
    // Parse request body
    const body = await request.json()
    
    // Validate required fields
    if (!body.privateKey) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required field: privateKey'
          }
        },
        { status: 400 }
      )
    }
    
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
    
    // Convert database transaction to TransactionData format
    const transactionData: TransactionData = {
      id: tx.id,
      fromAddress: tx.from_address,
      toAddress: tx.to_address,
      amount: tx.amount,
      tokenAddress: tx.token_address,
      data: tx.data,
      raw: tx.raw_data,
      signatures: tx.signatures || [],
      status: tx.status
    }
    
    // Get blockchain adapter for the wallet's blockchain
    const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
    
    // Sign the transaction
    const signature = await adapter.signTransaction(transactionData, body.privateKey)
    
    // Update transaction signatures
    let signatures = [...transactionData.signatures]
    if (!signatures.includes(signature)) {
      signatures.push(signature)
    }
    
    // Update database
    const { data: updatedTx, error: updateError } = await supabase
      .from('transactions')
      .update({ signatures })
      .eq('id', txId)
      .select()
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      data: {
        signature,
        transaction: updatedTx
      }
    })
  } catch (error) {
    console.error('Error signing transaction:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to sign transaction'
        }
      },
      { status: 500 }
    )
  }
}
