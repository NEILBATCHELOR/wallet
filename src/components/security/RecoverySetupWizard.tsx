// src/components/security/RecoverySetupWizard.tsx
import { useState } from 'react'
import { RecoveryMethod } from '../../services/security/KeyRecoveryService'
import { useRecoverySetup, Guardian } from '../../hooks/useRecoverySetup'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { MethodSelection } from './recovery/MethodSelection'
import { SocialRecoveryForm } from './recovery/SocialRecoveryForm'
import { TimelockForm } from './recovery/TimelockForm'
import { DeadmanSwitchForm } from './recovery/DeadmanSwitchForm'
import { BackupPasswordForm } from './recovery/BackupPasswordForm'
import { SuccessView } from './recovery/SuccessView'

interface RecoverySetupWizardProps {
  walletId: string
  keyId: string
  keyName: string
  secretPhrase: string
  blockchain: string
  onComplete: (setup: any) => void
  onCancel: () => void
}

function RecoverySetupWizard({
  walletId,
  keyId,
  keyName,
  secretPhrase,
  blockchain,
  onComplete,
  onCancel
}: RecoverySetupWizardProps) {
  const [step, setStep] = useState(1)
  const [selectedMethod, setSelectedMethod] = useState<RecoveryMethod | null>(null)
  const [guardians, setGuardians] = useState<Guardian[]>([{ name: '', email: '' }])
  const [threshold, setThreshold] = useState(2)
  const [timelockDays, setTimelockDays] = useState(30)
  const [deadmanDays, setDeadmanDays] = useState(90)
  const [backupPassword, setBackupPassword] = useState('')
  const [success, setSuccess] = useState(false)
  
  const { setupRecovery, isLoading, error } = useRecoverySetup({
    walletId,
    secretPhrase,
    blockchain
  })

  function handleMethodSelect(method: RecoveryMethod) {
    setSelectedMethod(method)
    setStep(2)
  }

  async function handleComplete() {
    if (!selectedMethod) return
    
    try {
      const options = {
        method: selectedMethod,
        threshold,
        guardians,
        timelockDays,
        deadmanDays,
        backupPassword
      }
      
      const result = await setupRecovery(options)
      setSuccess(true)
      onComplete(result)
    } catch (err) {
      // Error is handled by the hook and displayed via the error state
    }
  }

  function renderStepContent() {
    if (success) {
      return <SuccessView onFinish={onComplete} />
    }

    if (step === 1) {
      return <MethodSelection onSelect={handleMethodSelect} />
    }

    if (step === 2) {
      switch (selectedMethod) {
        case RecoveryMethod.SOCIAL:
          return (
            <SocialRecoveryForm
              guardians={guardians}
              setGuardians={setGuardians}
              threshold={threshold}
              setThreshold={setThreshold}
              onBack={() => setStep(1)}
              onSubmit={handleComplete}
              isSubmitting={isLoading}
            />
          )
        case RecoveryMethod.TIMELOCK:
          return (
            <TimelockForm
              days={timelockDays}
              setDays={setTimelockDays}
              onBack={() => setStep(1)}
              onSubmit={handleComplete}
              isSubmitting={isLoading}
            />
          )
        case RecoveryMethod.DEADMAN:
          return (
            <DeadmanSwitchForm
              days={deadmanDays}
              setDays={setDeadmanDays}
              guardians={guardians}
              setGuardians={setGuardians}
              onBack={() => setStep(1)}
              onSubmit={handleComplete}
              isSubmitting={isLoading}
            />
          )
        case RecoveryMethod.BACKUP:
          return (
            <BackupPasswordForm
              password={backupPassword}
              setPassword={setBackupPassword}
              onBack={() => setStep(1)}
              onSubmit={handleComplete}
              isSubmitting={isLoading}
            />
          )
        default:
          return null
      }
    }
    
    return null
  }

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Set Up Recovery for {keyName}</CardTitle>
        <CardDescription>
          Configure a recovery method to secure your wallet key
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <div className="p-3 mb-4 text-sm rounded bg-destructive/15 text-destructive">
            {error}
          </div>
        )}
        
        {renderStepContent()}
      </CardContent>
      
      {step === 1 && (
        <CardFooter className="flex justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </CardFooter>
      )}
    </Card>
  )
}

export { RecoverySetupWizard }