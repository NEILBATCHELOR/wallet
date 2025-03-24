// src/app/api/wallets/[walletId]/transactions/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/services/supabaseClient'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'
import { TransactionParams } from '@/core/interfaces'

/**
 * GET /api/wallets/:walletId/transactions
 * Retrieves transactions for a specific wallet
 */
export async function GET(
  request: Request,
  { params }: { params: { walletId: string } }
) {
  try {
    const walletId = params.walletId
    
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
    
    // Query transactions from the database
    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('wallet_id', walletId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      success: true,
      data: transactions
    })
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch transactions'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/wallets/:walletId/transactions
 * Creates a new transaction for a wallet
 */
export async function POST(
  request: Request,
  { params }: { params: { walletId: string } }
) {
  try {
    const walletId = params.walletId
    
    // In a real application, you would verify the authentication token
    // and ensure the user has access to this wallet
    const userId = 'current-user-id'
    
    // Parse request body
    const body = await request.json()
    
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
    
    // Validate required fields
    if (!body.toAddress || !body.amount) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Missing required fields: toAddress, amount'
          }
        },
        { status: 400 }
      )
    }
    
    // Create transaction parameters
    const txParams: TransactionParams = {
      fromAddress: wallet.address,
      toAddress: body.toAddress,
      amount: body.amount,
      tokenAddress: body.tokenAddress,
      data: body.data,
      nonce: body.nonce,
      fee: body.fee
    }
    
    // Get blockchain adapter for the wallet's blockchain
    const adapter = BlockchainAdapterFactory.getAdapter(wallet.blockchain)
    
    // Create transaction
    const transaction = await adapter.createTransaction(txParams)
    
    // Save transaction to database
    const { data: savedTx, error } = await supabase
      .from('transactions')
      .insert({
        id: transaction.id,
        wallet_id: walletId,
        from_address: transaction.fromAddress,
        to_address: transaction.toAddress,
        amount: transaction.amount,
        token_address: transaction.tokenAddress,
        data: transaction.data,
        raw_data: transaction.raw,
        signatures: transaction.signatures,
        status: transaction.status,
        created_at: new Date().toISOString()
      })
      .select()
      .single()
    
    if (error) {
      throw error
    }
    
    return NextResponse.json({
      success: true,
      data: savedTx
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating transaction:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create transaction'
        }
      },
      { status: 500 }
    )
  }
}
