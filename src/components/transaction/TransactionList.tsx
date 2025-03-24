// src/components/transactions/TransactionList.tsx
import { useState } from 'react'
import { useMultiSigWallet } from '@/hooks/useMultiSigWallet'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TransactionDetails } from './TransactionDetails'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

interface TransactionListProps {
  walletId: string
}

function TransactionList({ walletId }: TransactionListProps) {
  const { proposals, loading, loadProposals } = useMultiSigWallet({ walletId })
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null)
  
  // Handle refresh
  async function handleRefresh() {
    await loadProposals(walletId)
  }
  
  // If a proposal is selected, show its details
  if (selectedProposal) {
    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => setSelectedProposal(null)}
        >
          ← Back to Transactions
        </Button>
        <TransactionDetails 
          proposalId={selectedProposal} 
          walletId={walletId} 
        />
      </div>
    )
  }
  
  // Filter proposals by status
  const pendingProposals = proposals.filter(p => p.status === 'pending')
  const executedProposals = proposals.filter(p => p.status === 'executed')
  
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            Manage and sign pending transactions
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleRefresh}
          disabled={loading}
        >
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-gray-500">Loading transactions...</div>
        ) : proposals.length === 0 ? (
          <div className="py-8 text-center text-gray-500">No transactions found</div>
        ) : (
          <Tabs defaultValue="pending">
            <TabsList className="mb-4">
              <TabsTrigger value="pending">
                Pending ({pendingProposals.length})
              </TabsTrigger>
              <TabsTrigger value="executed">
                Executed ({executedProposals.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="pending">
              <TransactionItems
                proposals={pendingProposals}
                onSelect={setSelectedProposal}
              />
            </TabsContent>
            
            <TabsContent value="executed">
              <TransactionItems
                proposals={executedProposals}
                onSelect={setSelectedProposal}
              />
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

// Helper component to display transaction items
function TransactionItems({ 
  proposals, 
  onSelect 
}: { 
  proposals: any[], 
  onSelect: (id: string) => void 
}) {
  if (proposals.length === 0) {
    return <div className="py-4 text-center text-gray-500">No transactions</div>
  }
  
  return (
    <div className="space-y-2">
      {proposals.map(proposal => (
        <div 
          key={proposal.id}
          className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg cursor-pointer border"
          onClick={() => onSelect(proposal.id)}
        >
          <div className="flex flex-col">
            <div className="font-medium">{proposal.title}</div>
            <div className="text-sm text-gray-500">
              {proposal.value} {proposal.token_symbol || 'native'} 
              • {formatDate(proposal.created_at)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-500">
              {proposal.signatures.length}/{proposal.threshold} signatures
            </div>
            <Button variant="ghost" size="sm">
              View
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Helper to format date
function formatDate(dateString: string) {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true })
  } catch {
    return 'Invalid date'
  }
}

export { TransactionList }