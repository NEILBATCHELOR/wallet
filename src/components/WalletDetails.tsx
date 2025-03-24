// src/components/WalletDetails.tsx
import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMultiSigWallet } from '@/hooks/useMultiSigWallet'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TransactionList } from './transactions/TransactionList'
import { TransactionCreator } from './transactions/TransactionCreator'

function WalletDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('overview')
  
  const {
    currentWallet,
    loadWallet,
    loading,
    error
  } = useMultiSigWallet({ walletId: id })
  
  const { balance, loading: balanceLoading } = useWalletBalance(
    currentWallet
      ? {
          address: currentWallet.address,
          blockchain: currentWallet.blockchain
        }
      : { address: '', blockchain: '' }
  )
  
  if (loading && !currentWallet) {
    return <div className="flex justify-center items-center min-h-[200px]">
      Loading wallet details...
    </div>
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="text-red-500">{error}</div>
        <Button 
          onClick={() => navigate('/wallets')}
          variant="outline"
        >
          Back to Wallets
        </Button>
      </div>
    )
  }
  
  if (!currentWallet) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <div>Wallet not found</div>
        <Button 
          onClick={() => navigate('/wallets')}
          variant="outline"
        >
          Back to Wallets
        </Button>
      </div>
    )
  }
  
  function handleRefreshTransactions() {
    if (id) loadWallet(id)
  }
  
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">{currentWallet.name}</h2>
        <Button 
          variant="outline"
          onClick={() => navigate('/wallets')}
        >
          ← Back to Wallets
        </Button>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {balanceLoading ? '...' : balance}
            </div>
            <div className="text-sm text-gray-500">
              {currentWallet.blockchain}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="font-mono text-sm break-all">
              {currentWallet.address}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Security</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              Requires {currentWallet.threshold} of {currentWallet.owners.length} signatures
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Tabs defaultValue="transactions" className="w-full" onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="create">Create Transaction</TabsTrigger>
          <TabsTrigger value="signers">Signers</TabsTrigger>
        </TabsList>
        
        <TabsContent value="transactions" className="py-4">
          <TransactionList walletId={id || ''} />
        </TabsContent>
        
        <TabsContent value="create" className="py-4">
          <TransactionCreator 
            walletId={id || ''} 
            onSuccess={() => setActiveTab('transactions')}
          />
        </TabsContent>
        
        <TabsContent value="signers" className="py-4">
          <Card>
            <CardHeader>
              <CardTitle>Authorized Signers</CardTitle>
              <CardDescription>
                {currentWallet.threshold} of {currentWallet.owners.length} signatures required
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {currentWallet.owners.map((owner: string, index: number) => (
                  <li key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <div className="w-6 h-6 flex items-center justify-center bg-primary-100 text-primary-800 rounded-full">
                      {index + 1}
                    </div>
                    <span className="font-mono text-sm break-all">{owner}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export { WalletDetails }