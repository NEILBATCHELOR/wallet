// src/components/security/recovery/SocialRecoveryForm.tsx
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Users, 
  X,
  Plus,
  ArrowLeft
} from 'lucide-react'
import { Guardian } from '@/hooks/useRecoverySetup'

interface SocialRecoveryFormProps {
  guardians: Guardian[]
  setGuardians: (guardians: Guardian[]) => void
  threshold: number
  setThreshold: (threshold: number) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}

function SocialRecoveryForm({
  guardians,
  setGuardians,
  threshold,
  setThreshold,
  onBack,
  onSubmit,
  isSubmitting
}: SocialRecoveryFormProps) {
  function updateGuardian(index: number, field: 'name' | 'email', value: string) {
    const updatedGuardians = [...guardians]
    updatedGuardians[index][field] = value
    setGuardians(updatedGuardians)
  }
  
  function addGuardian() {
    setGuardians([...guardians, { name: '', email: '' }])
  }
  
  function removeGuardian(index: number) {
    if (guardians.length <= 1) return
    
    const updatedGuardians = [...guardians]
    updatedGuardians.splice(index, 1)
    setGuardians(updatedGuardians)
    
    // Adjust threshold if needed
    if (threshold > updatedGuardians.length) {
      setThreshold(updatedGuardians.length)
    }
  }
  
  // Calculate valid guardians (ones with both name and email)
  const validGuardians = guardians.filter(g => g.name && g.email)
  const isValid = validGuardians.length >= threshold
  
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">Social Recovery Setup</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Your key will be split into multiple shares. You'll need {threshold} of {guardians.length} shares to recover your wallet.
        </p>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="threshold">Required shares:</Label>
        <div className="flex items-center space-x-2">
          <Select
            value={threshold.toString()}
            onValueChange={(value) => setThreshold(parseInt(value))}
          >
            <SelectTrigger id="threshold" className="w-24">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Array.from({ length: guardians.length }, (_, i) => {
                  // Minimum 2 threshold or length of guardians if less than 2
                  const value = i + 1
                  return value >= 2 || guardians.length < 2 ? (
                    <SelectItem key={value} value={value.toString()}>
                      {value}
                    </SelectItem>
                  ) : null
                }).filter(Boolean)}
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            of {guardians.length} total shares
          </span>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-md font-medium mb-1">Guardian Information</h4>
          <p className="text-sm text-muted-foreground">
            Enter the details of your trusted contacts:
          </p>
        </div>
        
        {guardians.map((guardian, index) => (
          <div key={index} className="grid gap-3 p-4 border rounded-md">
            <div className="grid gap-2">
              <Label htmlFor={`name-${index}`}>Name</Label>
              <Input
                id={`name-${index}`}
                value={guardian.name}
                onChange={(e) => updateGuardian(index, 'name', e.target.value)}
                placeholder="Guardian's name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor={`email-${index}`}>Email</Label>
              <Input
                id={`email-${index}`}
                type="email"
                value={guardian.email}
                onChange={(e) => updateGuardian(index, 'email', e.target.value)}
                placeholder="Guardian's email"
              />
            </div>
            
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeGuardian(index)}
                disabled={guardians.length <= 1}
                className="h-8 px-2 text-destructive"
              >
                <X className="h-4 w-4 mr-1" />
                Remove
              </Button>
            </div>
          </div>
        ))}
        
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGuardian}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Guardian
        </Button>
      </div>
      
      {!isValid && validGuardians.length > 0 && (
        <p className="text-sm text-destructive">
          You need at least {threshold} valid guardians with both name and email.
        </p>
      )}
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting || !isValid}
        >
          {isSubmitting ? 'Setting up...' : 'Complete Setup'}
        </Button>
      </div>
    </div>
  )
}

export { SocialRecoveryForm }