// src/components/transactions/TransactionList.tsx
"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/context/WalletContext"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { TransactionSigning } from "./TransactionSigning"
import { formatDistanceToNow } from "date-fns"

function TransactionList({ walletId }: { walletId: string }) {
  const { currentWallet } = useWallet()
  const [transactions, setTransactions] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null)
  const [signDialogOpen, setSignDialogOpen] = useState(false)

  useEffect(() => {
    async function loadTransactions() {
      try {
        setIsLoading(true)
        setError(null)
        
        const response = await fetch(`/api/wallets/${walletId}/transactions`)
        
        if (!response.ok) {
          throw new Error("Failed to load transactions")
        }
        
        const data = await response.json()
        setTransactions(data.transactions)
      } catch (err: any) {
        setError(err.message || "Failed to load transactions")
      } finally {
        setIsLoading(false)
      }
    }
    
    if (walletId) {
      loadTransactions()
    }
  }, [walletId])

  function getStatusBadge(status: string) {
    switch (status.toLowerCase()) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-200">Pending</Badge>
      case "executed":
        return <Badge variant="outline" className="bg-green-50 text-green-800 border-green-200">Executed</Badge>
      case "failed":
        return <Badge variant="outline" className="bg-red-50 text-red-800 border-red-200">Failed</Badge>
      case "rejected":
        return <Badge variant="outline" className="bg-gray-50 text-gray-800 border-gray-200">Rejected</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  function handleSignTransaction(transaction: any) {
    setSelectedTransaction(transaction)
    setSignDialogOpen(true)
  }

  function handleTransactionCompleted() {
    setSignDialogOpen(false)
    // Refresh transaction list
    fetch(`/api/wallets/${walletId}/transactions`)
      .then(res => res.json())
      .then(data => setTransactions(data.transactions))
      .catch(err => console.error("Failed to refresh transactions", err))
  }

  if (isLoading) {
    return <div className="py-8 text-center">Loading transactions...</div>
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <div className="text-red-600 mb-4">{error}</div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            No transactions found for this wallet
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-muted-foreground">
            <p>There are no transaction proposals yet.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transactions</CardTitle>
        <CardDescription>
          All transaction proposals for {currentWallet?.name}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Signatures</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => (
              <TableRow key={tx.id}>
                <TableCell className="font-medium">{tx.title}</TableCell>
                <TableCell className="font-mono text-xs">{tx.to_address.substring(0, 8)}...{tx.to_address.substring(tx.to_address.length - 6)}</TableCell>
                <TableCell>{tx.value} {tx.token_symbol || ""}</TableCell>
                <TableCell>{getStatusBadge(tx.status)}</TableCell>
                <TableCell>{tx.signatures?.length || 0}/{currentWallet?.threshold}</TableCell>
                <TableCell>{formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}</TableCell>
                <TableCell>
                  {tx.status === "pending" && (!tx.signatures || !tx.signatures.find(s => s.signer === currentWallet?.address)) && (
                    <Button size="sm" onClick={() => handleSignTransaction(tx)}>
                      Sign
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={signDialogOpen} onOpenChange={setSignDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Sign Transaction</DialogTitle>
            </DialogHeader>
            {selectedTransaction && (
              <TransactionSigning
                transactionId={selectedTransaction.id}
                walletId={walletId}
                proposalData={{
                  ...selectedTransaction,
                  threshold: currentWallet?.threshold,
                  blockchain: currentWallet?.blockchain,
                  raw: selectedTransaction.data ? JSON.parse(selectedTransaction.data) : {}
                }}
                onComplete={handleTransactionCompleted}
                onCancel={() => setSignDialogOpen(false)}
              />
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

export { TransactionList }