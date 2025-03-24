// src/app/api/wallets/[walletId]/route.ts
import { NextResponse } from 'next/server'
import { supabase } from '@/services/supabaseClient'

/**
 * GET /api/wallets/:walletId
 * Retrieves details for a specific wallet
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
    
    return NextResponse.json({
      success: true,
      data: wallet
    })
  } catch (error) {
    console.error('Error fetching wallet details:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch wallet details'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/wallets/:walletId
 * Updates a wallet (e.g., changing the name)
 */
export async function PATCH(
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
    const { data: existingWallet, error: fetchError } = await supabase
      .from('wallets')
      .select('id')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single()
    
    if (fetchError || !existingWallet) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WALLET_NOT_FOUND',
            message: 'Wallet not found or access denied'
          }
        },
        { status: 404 }
      )
    }
    
    // Only allow updating the name
    const updates: any = {}
    if (body.name) updates.name = body.name
    
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'No valid fields to update were provided'
          }
        },
        { status: 400 }
      )
    }
    
    // Update wallet in database
    const { data: updatedWallet, error: updateError } = await supabase
      .from('wallets')
      .update(updates)
      .eq('id', walletId)
      .select()
      .single()
    
    if (updateError) {
      throw updateError
    }
    
    return NextResponse.json({
      success: true,
      data: updatedWallet
    })
  } catch (error) {
    console.error('Error updating wallet:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update wallet'
        }
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/wallets/:walletId
 * Deletes a wallet (note: this doesn't affect the blockchain, just removes from the user's account)
 */
export async function DELETE(
  request: Request,
  { params }: { params: { walletId: string } }
) {
  try {
    const walletId = params.walletId
    
    // In a real application, you would verify the authentication token
    // and ensure the user has access to this wallet
    const userId = 'current-user-id'
    
    // Check if wallet exists and belongs to the user
    const { data: existingWallet, error: fetchError } = await supabase
      .from('wallets')
      .select('id')
      .eq('id', walletId)
      .eq('user_id', userId)
      .single()
    
    if (fetchError || !existingWallet) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WALLET_NOT_FOUND',
            message: 'Wallet not found or access denied'
          }
        },
        { status: 404 }
      )
    }
    
    // Delete wallet from database
    const { error: deleteError } = await supabase
      .from('wallets')
      .delete()
      .eq('id', walletId)
    
    if (deleteError) {
      throw deleteError
    }
    
    return NextResponse.json({
      success: true,
      data: { message: 'Wallet deleted successfully' }
    })
  } catch (error) {
    console.error('Error deleting wallet:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete wallet'
        }
      },
      { status: 500 }
    )
  }
}
