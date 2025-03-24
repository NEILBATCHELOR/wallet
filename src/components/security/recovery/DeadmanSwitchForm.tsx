// src/components/security/recovery/DeadmanSwitchForm.tsx
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Guardian } from '@/hooks/useRecoverySetup'
import { 
  SkullIcon,
  ArrowLeft,
  X,
  Plus
} from 'lucide-react'

interface DeadmanSwitchFormProps {
  days: number
  setDays: (days: number) => void
  guardians: Guardian[]
  setGuardians: (guardians: Guardian[]) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}

function DeadmanSwitchForm({
  days,
  setDays,
  guardians,
  setGuardians,
  onBack,
  onSubmit,
  isSubmitting
}: DeadmanSwitchFormProps) {
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
  }
  
  function handleDaysChange(value: number[]) {
    setDays(value[0])
  }
  
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value >= 30) {
      setDays(value)
    }
  }
  
  // Calculate valid guardians (ones with both name and email)
  const validGuardians = guardians.filter(g => g.name && g.email)
  const isValid = days >= 30 && validGuardians.length > 0
  
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <SkullIcon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">Dead Man's Switch Setup</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Your key will be automatically recovered after a period of inactivity.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="deadmanDays">Inactivity period (in days):</Label>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Slider
                value={[days]}
                min={30}
                max={365}
                step={1}
                onValueChange={handleDaysChange}
              />
            </div>
            <div className="w-16">
              <Input
                id="deadmanDays"
                type="number"
                min={30}
                value={days}
                onChange={handleInputChange}
                className="h-8"
              />
            </div>
          </div>
        </div>
        
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm">
            Your key will be recoverable after <strong>{days} days</strong> of inactivity.
          </p>
          <p className="text-sm mt-2">
            Make sure to log in to your wallet at least once within this period to reset the timer.
          </p>
        </div>
      </div>
      
      <div className="space-y-4">
        <div>
          <h4 className="text-md font-medium mb-1">Notify These People:</h4>
          <p className="text-sm text-muted-foreground">
            These contacts will be notified when the switch activates:
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
                placeholder="Contact's name"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor={`email-${index}`}>Email</Label>
              <Input
                id={`email-${index}`}
                type="email"
                value={guardian.email}
                onChange={(e) => updateGuardian(index, 'email', e.target.value)}
                placeholder="Contact's email"
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
          Add Contact
        </Button>
      </div>
      
      {validGuardians.length === 0 && (
        <p className="text-sm text-destructive">
          You need at least one valid contact with both name and email.
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

export { DeadmanSwitchForm }