// src/components/wallet/WalletCreator.tsx
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useWallet } from "../../context/WalletContext"
import { useToast } from "../../context/ToastContext"
import { BlockchainAdapterFactory } from "../../core/BlockchainAdapterFactory"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card"
import { Label } from "../ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"

function WalletCreator() {
  const navigate = useNavigate()
  const { createWallet, supportedBlockchains } = useWallet()
  const { addToast } = useToast()
  
  const [name, setName] = useState("")
  const [blockchain, setBlockchain] = useState(supportedBlockchains[0] || "ethereum")
  const [owners, setOwners] = useState([{ address: "" }])
  const [threshold, setThreshold] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  function addOwner() {
    setOwners([...owners, { address: "" }])
  }
  
  function removeOwner(index: number) {
    if (owners.length <= 1) return
    
    const newOwners = [...owners]
    newOwners.splice(index, 1)
    setOwners(newOwners)
    
    // Adjust threshold if needed
    if (threshold > newOwners.length) {
      setThreshold(newOwners.length)
    }
  }
  
  function updateOwnerAddress(index: number, address: string) {
    const newOwners = [...owners]
    newOwners[index] = { address }
    setOwners(newOwners)
  }
  
  function validateForm() {
    const newErrors: Record<string, string> = {}
    
    if (!name.trim()) {
      newErrors.name = "Wallet name is required"
    }
    
    const adapter = BlockchainAdapterFactory.getAdapter(blockchain)
    
    // Validate owner addresses
    let validOwnerCount = 0
    owners.forEach((owner, index) => {
      if (!owner.address.trim()) {
        newErrors[`owner-${index}`] = "Address cannot be empty"
      } else if (!adapter.validateAddress(owner.address)) {
        newErrors[`owner-${index}`] = "Invalid address format"
      } else {
        validOwnerCount++
      }
    })
    
    // Validate threshold
    if (threshold < 1 || threshold > validOwnerCount) {
      newErrors.threshold = `Threshold must be between 1 and ${validOwnerCount}`
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    
    if (!validateForm()) return
    
    try {
      setIsSubmitting(true)
      
      // Filter out empty addresses
      const validOwners = owners
        .filter(owner => owner.address.trim())
        .map(owner => owner.address.trim())
      
      const result = await createWallet({
        name,
        blockchain,
        owners: validOwners,
        threshold
      })
      
      addToast(`Wallet "${name}" created successfully`, "success")
      navigate(`/wallets/${result.id}`)
    } catch (error) {
      console.error("Failed to create wallet:", error)
      addToast(error instanceof Error ? error.message : "Failed to create wallet", "error")
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Multi-Signature Wallet</CardTitle>
          <CardDescription>
            Set up a new multi-signature wallet for secure asset management
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {/* Wallet Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Wallet Name</Label>
              <Input
                id="name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="My Multi-Sig Wallet"
                error={errors.name}
              />
              {errors.name && <p className="text-red-500 text-sm">{errors.name}</p>}
            </div>
            
            {/* Blockchain Selection */}
            <div className="space-y-2">
              <Label htmlFor="blockchain">Blockchain</Label>
              <Select
                value={blockchain}
                onValueChange={setBlockchain}
              >
                <SelectTrigger id="blockchain">
                  <SelectValue placeholder="Select blockchain" />
                </SelectTrigger>
                <SelectContent>
                  {supportedBlockchains.map(chain => (
                    <SelectItem key={chain} value={chain}>
                      {chain.charAt(0).toUpperCase() + chain.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Owners */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label>Wallet Owners</Label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={addOwner}
                >
                  Add Owner
                </Button>
              </div>
              
              <div className="space-y-3">
                {owners.map((owner, index) => (
                  <div key={index} className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={owner.address}
                        onChange={e => updateOwnerAddress(index, e.target.value)}
                        placeholder={`Owner ${index + 1} Address`}
                        error={errors[`owner-${index}`]}
                      />
                      {errors[`owner-${index}`] && 
                        <p className="text-red-500 text-sm">{errors[`owner-${index}`]}</p>
                      }
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      onClick={() => removeOwner(index)}
                      disabled={owners.length <= 1}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Threshold */}
            <div className="space-y-2">
              <Label htmlFor="threshold">Required Signatures</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="threshold"
                  type="number"
                  min={1}
                  max={owners.length}
                  value={threshold}
                  onChange={e => setThreshold(parseInt(e.target.value) || 1)}
                  error={errors.threshold}
                  className="w-20"
                />
                <span>out of {owners.length} owner(s)</span>
              </div>
              {errors.threshold && <p className="text-red-500 text-sm">{errors.threshold}</p>}
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              type="button" 
              variant="outline"
              onClick={() => navigate("/wallets")}
            >
              Cancel
            </Button>
            <Button 
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Wallet"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export { WalletCreator }