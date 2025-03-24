// src/app/api/blockchains/route.ts
import { NextResponse } from 'next/server'
import { BlockchainAdapterFactory } from '@/core/BlockchainAdapterFactory'

/**
 * GET /api/blockchains
 * Returns a list of supported blockchains
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const params = new URLSearchParams(url.search)
    const filter = params.get('filter')
    
    let blockchains
    
    if (filter === 'mainnet') {
      blockchains = BlockchainAdapterFactory.getMainnetBlockchains()
    } else if (filter === 'testnet') {
      blockchains = BlockchainAdapterFactory.getTestnetBlockchains()
    } else {
      blockchains = BlockchainAdapterFactory.getSupportedBlockchains()
    }
    
    // Map blockchains to include network information
    const result = blockchains.map(id => {
      const networkInfo = BlockchainAdapterFactory.getNetworkInfo(id)
      return {
        id,
        name: networkInfo.name,
        isTestnet: networkInfo.isTestnet,
        nativeCurrency: networkInfo.nativeCurrency
      }
    })
    
    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('Error fetching blockchains:', error)
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch supported blockchains'
        }
      },
      { status: 500 }
    )
  }
}
