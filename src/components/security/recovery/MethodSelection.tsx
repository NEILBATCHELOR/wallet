// src/components/security/recovery/MethodSelection.tsx
import { RecoveryMethod } from '@/services/security/KeyRecoveryService'
import { Button } from '@/components/ui/button'
import { 
  Users, 
  Clock, 
  SkullIcon, 
  KeyRound 
} from 'lucide-react'

interface MethodSelectionProps {
  onSelect: (method: RecoveryMethod) => void
}

function MethodSelection({ onSelect }: MethodSelectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Select Recovery Method</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Choose how you want to back up your wallet key:
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MethodCard
          title="Social Recovery"
          description="Split your key into shares and distribute to trusted contacts"
          icon={<Users className="h-8 w-8" />}
          onClick={() => onSelect(RecoveryMethod.SOCIAL)}
        />
        
        <MethodCard
          title="Timelock"
          description="Recover your key after a waiting period"
          icon={<Clock className="h-8 w-8" />}
          onClick={() => onSelect(RecoveryMethod.TIMELOCK)}
        />
        
        <MethodCard
          title="Dead Man's Switch"
          description="Automatically transfer access after inactivity"
          icon={<SkullIcon className="h-8 w-8" />}
          onClick={() => onSelect(RecoveryMethod.DEADMAN)}
        />
        
        <MethodCard
          title="Password Backup"
          description="Encrypt your key with a strong password"
          icon={<KeyRound className="h-8 w-8" />}
          onClick={() => onSelect(RecoveryMethod.BACKUP)}
        />
      </div>
    </div>
  )
}

interface MethodCardProps {
  title: string
  description: string
  icon: React.ReactNode
  onClick: () => void
}

function MethodCard({ title, description, icon, onClick }: MethodCardProps) {
  return (
    <div 
      className="border rounded-lg p-6 hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
      onClick={onClick}
    >
      <div className="flex flex-col h-full">
        <div className="text-primary mb-4">
          {icon}
        </div>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export { MethodSelection }