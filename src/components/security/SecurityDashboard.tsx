// src/components/security/SecurityDashboard.tsx
import { useState, useEffect } from 'react'
import { useVault } from '@/hooks/useVault'
import { VaultSecurityLevel } from '@/services/vault/SecureVault'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

import { SecurityOverview } from './dashboard/SecurityOverview'
import { KeysList } from './dashboard/KeysList'
import { AuditLogTable } from './dashboard/AuditLogTable'

function SecurityDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [masterPassword, setMasterPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [securityLevel, setSecurityLevel] = useState<VaultSecurityLevel>(VaultSecurityLevel.STANDARD)
  
  const {
    status,
    keys,
    auditLog,
    isLoading,
    error,
    initialize,
    unlock,
    lock,
    isInitializing
  } = useVault()

  function renderInitializationForm() {
    const isWeakPassword = masterPassword.length > 0 && masterPassword.length < 8
    const isMediumPassword = masterPassword.length >= 8 && masterPassword.length < 12
    const isStrongPassword = masterPassword.length >= 12
    
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
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Initialize Secure Vault</CardTitle>
          <CardDescription>Create a master password to secure your keys</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="masterPassword" className="block text-sm font-medium">
              Master Password
            </label>
            <Input
              id="masterPassword"
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Strong master password"
            />
          </div>
          
          <div className="space-y-2">
            <label htmlFor="securityLevel" className="block text-sm font-medium">
              Security Level
            </label>
            <Select
              value={securityLevel}
              onValueChange={(value) => setSecurityLevel(value as VaultSecurityLevel)}
            >
              <SelectTrigger id="securityLevel">
                <SelectValue placeholder="Select security level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={VaultSecurityLevel.STANDARD}>Standard</SelectItem>
                <SelectItem value={VaultSecurityLevel.HIGH}>High</SelectItem>
                <SelectItem value={VaultSecurityLevel.MAXIMUM}>Maximum (with biometrics)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>Password strength:</span>
              <span>{strengthLabel}</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${strengthClass}`}
                style={{ width: `${masterPassword.length ? Math.min(100, masterPassword.length * 8.33) : 0}%` }}
              />
            </div>
          </div>
        </CardContent>
        
        <CardFooter>
          <Button 
            className="w-full"
            onClick={() => initialize(masterPassword, securityLevel)}
            disabled={isInitializing || masterPassword.length < 8}
          >
            {isInitializing ? 'Initializing...' : 'Initialize Vault'}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  function renderUnlockForm() {
    return (
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Unlock Secure Vault</CardTitle>
          <CardDescription>Enter your master password to access your keys</CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="masterPassword" className="block text-sm font-medium">
              Master Password
            </label>
            <Input
              id="masterPassword"
              type="password"
              value={masterPassword}
              onChange={(e) => setMasterPassword(e.target.value)}
              placeholder="Master password"
            />
          </div>
          
          {status?.mfaEnabled && (
            <div className="space-y-2">
              <label htmlFor="mfaCode" className="block text-sm font-medium">
                MFA Code
              </label>
              <Input
                id="mfaCode"
                type="text"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                placeholder="6-digit code"
                maxLength={6}
              />
            </div>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            className="w-full"
            onClick={() => unlock(masterPassword, mfaCode)}
            disabled={isLoading || !masterPassword}
          >
            {isLoading ? 'Unlocking...' : 'Unlock Vault'}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  function renderDashboard() {
    return (
      <>
        <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="keys">Keys</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-4">
            <SecurityOverview status={status} auditLog={auditLog} onLock={lock} />
          </TabsContent>
          
          <TabsContent value="keys" className="mt-4">
            <KeysList keys={keys} />
          </TabsContent>
          
          <TabsContent value="audit" className="mt-4">
            <AuditLogTable auditLog={auditLog} />
          </TabsContent>
        </Tabs>
      </>
    )
  }

  if (isLoading && !status) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Security Dashboard</h2>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Security Dashboard</h2>
      
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {status && !status.initialized ? (
        renderInitializationForm()
      ) : status && status.locked ? (
        renderUnlockForm()
      ) : (
        renderDashboard()
      )}
    </div>
  )
}

export { SecurityDashboard }