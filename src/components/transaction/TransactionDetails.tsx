// src/components/transactions/TransactionDetails.tsx
import { useState } from 'react'
import { useWallet } from '@/context/WalletContext'
import { useMultiSigWalletLedger } from '@/hooks/useMultiSigWalletLedger'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LedgerTransactionSigner } from '@/components/LedgerTransactionSigner'

interface TransactionDetailsProps {
  proposalId: string
  walletId: string
}

function TransactionDetails({ proposalId, walletId }: TransactionDetailsProps) {
  const [isSignerOpen, setIsSignerOpen] = useState(false)
  const { currentWallet } = useWallet()
  const {
    proposals,
    signProposalWithLedger,
    executeProposal,
    loading
  } = useMultiSigWalletLedger({ walletId })

  // Find the proposal
  const proposal = proposals.find(p => p.id === proposalId)
  
  if (!proposal) return <div>Transaction not found</div>
  if (!currentWallet) return <div>Wallet not found</div>

  const canSign = proposal.status === 'pending' && currentWallet
  const canExecute = proposal.status === 'pending' && 
    currentWallet && 
    proposal.signatures.length >= currentWallet.threshold

  // Get transaction value in appropriate format
  const txValue = proposal.token_address 
    ? `${proposal.value} ${proposal.token_symbol || proposal.token_address.slice(0, 8)}`
    : `${proposal.value} (native)`

  // Handle signature completion
  function handleSignComplete() {
    setIsSignerOpen(false)
  }

  // Handle execution
  async function handleExecute() {
    if (!canExecute) return
    try {
      await executeProposal(proposal.id)
    } catch (error) {
      console.error('Failed to execute transaction:', error)
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{proposal.title}</CardTitle>
        <CardDescription>
          Transaction ID: {proposal.id.slice(0, 10)}... 
          • Status: <span className={`font-medium ${proposal.status === 'executed' ? 'text-green-600' : 'text-amber-600'}`}>
            {proposal.status}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500">Transaction Details</h3>
            <div className="grid grid-cols-3 gap-1 text-sm">
              <div className="font-medium">To:</div>
              <div className="col-span-2 font-mono break-all">{proposal.to_address}</div>
              
              <div className="font-medium">Value:</div>
              <div className="col-span-2">{txValue}</div>
              
              {proposal.data && proposal.data !== '0x' && (
                <>
                  <div className="font-medium">Data:</div>
                  <div className="col-span-2 font-mono break-all truncate">
                    {proposal.data}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-500">Signatures</h3>
            <div className="text-sm mb-2">
              {proposal.signatures.length} of {currentWallet.threshold} required signatures
            </div>
            
            {proposal.signatures.length > 0 ? (
              <ul className="space-y-1 text-sm">
                {proposal.signatures.map((sig, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="w-6 h-6 flex items-center justify-center bg-green-100 text-green-800 rounded-full">
                      ✓
                    </span>
                    <span className="font-mono">{sig.signer.slice(0, 8)}...{sig.signer.slice(-6)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-gray-500 italic">No signatures yet</div>
            )}
          </div>
        </div>
        
        {proposal.description && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-500">Description</h3>
            <p className="mt-1 text-sm">{proposal.description}</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-4">
        {canSign && (
          <Dialog open={isSignerOpen} onOpenChange={setIsSignerOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Sign Transaction</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Sign Transaction</DialogTitle>
              </DialogHeader>
              <LedgerTransactionSigner
                proposalId={proposal.id}
                walletId={walletId}
                onComplete={handleSignComplete}
                onCancel={() => setIsSignerOpen(false)}
              />
            </DialogContent>
          </Dialog>
        )}
        
        {canExecute && (
          <Button 
            onClick={handleExecute} 
            disabled={loading}
          >
            {loading ? 'Executing...' : 'Execute Transaction'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

export { TransactionDetails }