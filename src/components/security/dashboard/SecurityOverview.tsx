// src/components/security/dashboard/SecurityOverview.tsx
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VaultStatus } from '@/services/vault/SecureVault'

interface SecurityOverviewProps {
  status: VaultStatus | null
  auditLog: any[]
  onLock: () => Promise<void>
}

function SecurityOverview({ status, auditLog, onLock }: SecurityOverviewProps) {
  if (!status) return null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard 
          title="Vault Status" 
          value={status.locked ? 'Locked' : 'Unlocked'} 
          variant={status.locked ? 'destructive' : 'success'}
          action={
            !status.locked && (
              <Button variant="outline" size="sm" onClick={onLock}>
                Lock Vault
              </Button>
            )
          }
        />
        
        <StatusCard 
          title="Security Level" 
          value={status.mfaEnabled ? 'Maximum' : 'Standard'} 
          variant={status.mfaEnabled ? 'success' : 'default'}
        />
        
        <StatusCard 
          title="Hardware Protection" 
          value={status.hardwareProtection ? 'Enabled' : 'Not Available'} 
          variant={status.hardwareProtection ? 'success' : 'secondary'}
        />
        
        <StatusCard 
          title="Stored Keys" 
          value={status.keyCount.toString()} 
          variant="default"
        />
      </div>
      
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Recent Activity</h3>
        {auditLog.length > 0 ? (
          <div className="space-y-2">
            {auditLog.slice(0, 5).map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No recent activity</p>
        )}
      </div>
    </div>
  )
}

interface StatusCardProps {
  title: string
  value: string
  variant?: 'default' | 'success' | 'destructive' | 'secondary'
  action?: React.ReactNode
}

function StatusCard({ title, value, variant = 'default', action }: StatusCardProps) {
  const variantClasses = {
    default: 'bg-card',
    success: 'bg-green-500/10',
    destructive: 'bg-destructive/10',
    secondary: 'bg-secondary'
  }
  
  const textClasses = {
    default: 'text-foreground',
    success: 'text-green-700 dark:text-green-300',
    destructive: 'text-destructive',
    secondary: 'text-secondary-foreground'
  }
  
  return (
    <Card className={`p-4 ${variantClasses[variant]}`}>
      <div className="space-y-2">
        <h4 className="text-sm font-medium">{title}</h4>
        <div className="flex items-center justify-between">
          <p className={`text-xl font-semibold ${textClasses[variant]}`}>{value}</p>
          {action}
        </div>
      </div>
    </Card>
  )
}

interface ActivityItemProps {
  entry: {
    id: string
    action: string
    timestamp: string
    successful: boolean
  }
}

function ActivityItem({ entry }: ActivityItemProps) {
  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case 'UNLOCK':
      case 'LOAD_KEY':
        return 'default'
      case 'SIGN':
      case 'EXPORT':
        return 'outline'
      case 'CREATE':
      case 'IMPORT':
        return 'secondary'
      case 'DELETE':
        return 'destructive'
      default:
        return 'outline'
    }
  }
  
  return (
    <div className="flex items-center justify-between p-3 rounded border">
      <div className="flex items-center space-x-3">
        <Badge variant={getActionBadgeVariant(entry.action)}>
          {entry.action}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {new Date(entry.timestamp).toLocaleString()}
        </span>
      </div>
      <Badge variant={entry.successful ? 'success' : 'destructive'}>
        {entry.successful ? 'Success' : 'Failed'}
      </Badge>
    </div>
  )
}

export { SecurityOverview }