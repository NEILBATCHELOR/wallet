// src/components/security/recovery/TimelockForm.tsx
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { 
  Clock,
  ArrowLeft
} from 'lucide-react'

interface TimelockFormProps {
  days: number
  setDays: (days: number) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}

function TimelockForm({
  days,
  setDays,
  onBack,
  onSubmit,
  isSubmitting
}: TimelockFormProps) {
  const isValid = days >= 1
  
  function handleDaysChange(value: number[]) {
    setDays(value[0])
  }
  
  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = parseInt(e.target.value)
    if (!isNaN(value) && value >= 1) {
      setDays(value)
    }
  }
  
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <Clock className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">Timelock Recovery Setup</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Your key will be recoverable after a waiting period.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="timelockDays">Waiting period (in days):</Label>
          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Slider
                value={[days]}
                min={1}
                max={90}
                step={1}
                onValueChange={handleDaysChange}
              />
            </div>
            <div className="w-16">
              <Input
                id="timelockDays"
                type="number"
                min={1}
                value={days}
                onChange={handleInputChange}
                className="h-8"
              />
            </div>
          </div>
        </div>
        
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm">
            Your key will be recoverable after <strong>{days} {days === 1 ? 'day' : 'days'}</strong> of waiting.
          </p>
          <p className="text-sm mt-2">
            This delay helps protect against unauthorized access attempts.
          </p>
        </div>
        
        {days < 7 && (
          <p className="text-sm text-amber-600">
            <strong>Note:</strong> A short timelock period offers less security. Consider at least 7 days for better protection.
          </p>
        )}
      </div>
      
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

export { TimelockForm }