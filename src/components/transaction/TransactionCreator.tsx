// src/components/transaction/TransactionCreator.tsx
import { useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useWallet } from "../../context/WalletContext"
import { useToast } from "../../context/ToastContext"
import { BlockchainAdapterFactory } from "../../core/BlockchainAdapterFactory"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Textarea } from "../ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Label } from "../ui/label"
import { Switch } from "../ui/switch"

function TransactionCreator() {
  const { id: walletId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentWallet, createProposal } = useWallet()
  const { addToast } = useToast()
  
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [toAddress, setToAddress] = useState("")
  const [amount, setAmount] = useState("")
  const [isToken, setIsToken] = useState(false)
  const [tokenAddress, setTokenAddress] = useState("")
  const [data, setData] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  if (!walletId || !currentWallet) {
    navigate("/wallets")
    return null
  }
  
  function validateForm() {
    const newErrors: Record<string, string> = {}
    
    if (!title.trim()) {
      newErrors.title = "Title is required"
    }
    
    if (!toAddress.trim()) {
      newErrors.toAddress = "Recipient address is required"
    } else {
      const adapter = BlockchainAdapterFactory.getAdapter(currentWallet.blockchain)
      if (!adapter.validateAddress(toAddress)) {
        newErrors.toAddress = "Invalid address format"
      }
    }
    
    if (!amount.trim()) {
      newErrors.amount = "Amount is required"
    } else {
      const amountValue = parseFloat(amount)
      if (isNaN(amountValue) || amountValue <= 0) {
        newErrors.amount = "Amount must be a positive number"
      }
    }
    
    if (isToken && !tokenAddress.trim()) {
      newErrors.tokenAddress = "Token address is required when sending tokens"
    } else if (isToken) {
      const adapter = BlockchainAdapterFactory.getAdapter(currentWallet.blockchain)
      if (!adapter.validateAddress(tokenAddress)) {
        newErrors.tokenAddress = "Invalid token address format"
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!validateForm()) return
    
    try {
      setIsSubmitting(true)
      
      const result = await createProposal({
        walletId,
        title,
        description,
        toAddress,
        amount,
        tokenAddress: isToken ? tokenAddress : undefined,
        data: data.trim() || undefined
      })
      
      addToast(`Transaction proposal "${title}" created successfully`, "success")
      navigate(`/wallets/${walletId}/transactions/${result.id}`)
    } catch (error) {
      console.error("Failed to create transaction proposal:", error)
      addToast(
        error instanceof Error ? error.message : "Failed to create transaction proposal", 
        "error"
      )
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Transaction Proposal</CardTitle>
          <CardDescription>
            Propose a new transaction for wallet: {currentWallet.name}
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Send funds to treasury"
                error={errors.title}
              />
              {errors.title && <p className="text-red-500 text-sm">{errors.title}</p>}
            </div>
            
            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Explain the purpose of this transaction"
                rows={3}
              />
            </div>
            
            {/* Recipient Address */}
            <div className="space-y-2">
              <Label htmlFor="toAddress">Recipient Address</Label>
              <Input
                id="toAddress"
                value={toAddress}
                onChange={e => setToAddress(e.target.value)}
                placeholder="0x..."
                error={errors.toAddress}
              />
              {errors.toAddress && <p className="text-red-500 text-sm">{errors.toAddress}</p>}
            </div>
            
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="amount"
                  type="text"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="0.0"
                  error={errors.amount}
                />
                <span>
                  {isToken ? "Tokens" : currentWallet.blockchain.toUpperCase()}
                </span>
              </div>
              {errors.amount && <p className="text-red-500 text-sm">{errors.amount}</p>}
            </div>
            
            {/* Token Toggle */}
            <div className="flex items-center space-x-2">
              <Switch
                id="isToken"
                checked={isToken}
                onCheckedChange={setIsToken}
              />
              <Label htmlFor="isToken">Send Token</Label>
            </div>
            
            {/* Token Address (conditional) */}
            {isToken && (
              <div className="space-y-2">
                <Label htmlFor="tokenAddress">Token Address</Label>
                <Input
                  id="tokenAddress"
                  value={tokenAddress}
                  onChange={e => setTokenAddress(e.target.value)}
                  placeholder="0x..."
                  error={errors.tokenAddress}
                />
                {errors.tokenAddress && <p className="text-red-500 text-sm">{errors.tokenAddress}</p>}
              </div>
            )}
            
            {/* Custom Data (for advanced users) */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="data">Custom Data (Optional)</Label>
                <span className="text-xs text-gray-500">For advanced users</span>
              </div>
              <Textarea
                id="data"
                value={data}
                onChange={e => setData(e.target.value)}
                placeholder="0x..."
                rows={3}
              />
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate(`/wallets/${walletId}`)}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Proposal"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export { TransactionCreator }