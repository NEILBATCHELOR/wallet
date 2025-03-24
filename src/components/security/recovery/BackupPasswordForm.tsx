// src/components/security/recovery/BackupPasswordForm.tsx
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { 
  KeyRound,
  ArrowLeft,
  EyeIcon,
  EyeOffIcon
} from 'lucide-react'

interface BackupPasswordFormProps {
  password: string
  setPassword: (password: string) => void
  onBack: () => void
  onSubmit: () => void
  isSubmitting: boolean
}

function BackupPasswordForm({
  password,
  setPassword,
  onBack,
  onSubmit,
  isSubmitting
}: BackupPasswordFormProps) {
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  
  const isWeakPassword = password.length > 0 && password.length < 8
  const isMediumPassword = password.length >= 8 && password.length < 12
  const isStrongPassword = password.length >= 12
  
  const passwordsMatch = password === confirmPassword
  const passwordError = password && confirmPassword && !passwordsMatch 
    ? 'Passwords do not match' 
    : isWeakPassword 
    ? 'Password is too weak'
    : null
  
  const isValid = password.length >= 8 && passwordsMatch
  
  let strengthClass = ''
  let strengthLabel = 'Enter a password'
  
  if (isWeakPassword) {
    strengthClass = 'bg-destructive/70'
    strengthLabel = 'Weak'
  } else if (isMediumPassword) {
    strengthClass = 'bg-amber-500'
    strengthLabel = 'Medium'
  } else if (isStrongPassword) {
    strengthClass = 'bg-green-500'
    strengthLabel = 'Strong'
  }
  
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center space-x-2">
          <KeyRound className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-medium">Password Backup Setup</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Your key will be encrypted with a strong password.
        </p>
      </div>
      
      <div className="space-y-4">
        <div className="grid gap-2">
          <Label htmlFor="backupPassword">Password</Label>
          <div className="relative">
            <Input
              id="backupPassword"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Strong password"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOffIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <EyeIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />
        </div>
        
        {passwordError && (
          <p className="text-sm text-destructive">{passwordError}</p>
        )}
        
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>Password strength:</span>
            <span>{strengthLabel}</span>
          </div>
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all ${strengthClass}`}
              style={{ width: `${password.length ? Math.min(100, password.length * 8.33) : 0}%` }}
            />
          </div>
        </div>
        
        <div className="rounded-md bg-muted p-3 space-y-2">
          <p className="text-sm">Password requirements:</p>
          <ul className="text-sm space-y-1 list-disc pl-5">
            <li className={password.length >= 8 ? "text-green-500" : "text-muted-foreground"}>
              At least 8 characters
            </li>
            <li className={/[A-Z]/.test(password) ? "text-green-500" : "text-muted-foreground"}>
              At least one uppercase letter
            </li>
            <li className={/[0-9]/.test(password) ? "text-green-500" : "text-muted-foreground"}>
              At least one number
            </li>
            <li className={/[^A-Za-z0-9]/.test(password) ? "text-green-500" : "text-muted-foreground"}>
              At least one special character
            </li>
          </ul>
        </div>
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

export { BackupPasswordForm }