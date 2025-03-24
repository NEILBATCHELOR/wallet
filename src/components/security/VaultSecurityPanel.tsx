// src/components/security/VaultSecurityPanel.tsx

import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VaultClient } from '@/services/vault/VaultClient'
import { VaultSecurityLevel } from '@/services/vault/SecureVault'
import { Shield, Key, Lock, Unlock, Eye, EyeOff, User, AlertTriangle } from 'lucide-react'

interface VaultSecurityPanelProps {
  walletId?: string
  onVaultStatusChange?: (status: { initialized: boolean; locked: boolean }) => void
}

function VaultSecurityPanel({ walletId, onVaultStatusChange }: VaultSecurityPanelProps) {
  const [activeTab, setActiveTab] = useState('status')
  const [vaultStatus, setVaultStatus] = useState<any>(null)
  const [vaultKeys, setVaultKeys] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [masterPassword, setMasterPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [securityLevel, setSecurityLevel] = useState<VaultSecurityLevel>(VaultSecurityLevel.STANDARD)
  
  // Initialize vault client
  const vaultClient = new VaultClient()

  // Load vault status on component mount
  useEffect(() => {
    async function loadVaultStatus() {
      try {
        setIsLoading(true)
        setError(null)
        
        // Wait for vault client to be ready
        await vaultClient.waitForReady()
        
        // Get vault status
        const status = await vaultClient.getStatus()
        setVaultStatus(status)
        
        // Notify parent component of vault status change if callback provided
        if (onVaultStatusChange) onVaultStatusChange(status)
        
        // If vault is unlocked, load keys
        if (status && !status.locked) {
          const keys = await vaultClient.getKeys()
          setVaultKeys(keys)
        }
        
        setIsLoading(false)
      } catch (err: any) {
        setError(err.message || 'Failed to load vault status')
        setIsLoading(false)
      }
    }
    
    loadVaultStatus()
  }, [])
  
  // Initialize vault
  async function handleInitializeVault() {
    if (masterPassword.length < 8) {
      setError('Master password must be at least 8 characters')
      return
    }
    
    if (masterPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      const success = await vaultClient.initialize(masterPassword, securityLevel)
      
      if (success) {
        const status = await vaultClient.getStatus()
        setVaultStatus(status)
        if (onVaultStatusChange) onVaultStatusChange(status)
        setMasterPassword('')
        setConfirmPassword('')
      } else {
        setError('Failed to initialize vault')
      }
      
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to initialize vault')
      setIsLoading(false)
    }
  }
  
  // Unlock vault
  async function handleUnlockVault() {
    if (!masterPassword) {
      setError('Master password is required')
      return
    }
    
    try {
      setIsLoading(true)
      setError(null)
      
      const success = await vaultClient.unlock(masterPassword, mfaCode || undefined)
      
      if (success) {
        const status = await vaultClient.getStatus()
        setVaultStatus(status)
        if (onVaultStatusChange) onVaultStatusChange(status)
        
        // Load keys if vault is unlocked
        if (status && !status.locked) {
          const keys = await vaultClient.getKeys()
          setVaultKeys(keys)
        }
        
        setMasterPassword('')
        setMfaCode('')
      } else {
        setError('Failed to unlock vault')
      }
      
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to unlock vault')
      setIsLoading(false)
    }
  }
  
  // Lock vault
  async function handleLockVault() {
    try {
      setIsLoading(true)
      setError(null)
      
      await vaultClient.lock()
      
      const status = await vaultClient.getStatus()
      setVaultStatus(status)
      if (onVaultStatusChange) onVaultStatusChange(status)
      setVaultKeys([])
      
      setIsLoading(false)
    } catch (err: any) {
      setError(err.message || 'Failed to lock vault')
      setIsLoading(false)
    }
  }
  
  // Calculate password strength
  function getPasswordStrength(password: string): number {
    if (!password) return 0
    
    let strength = 0
    
    // Length check
    if (password.length >= 8) strength += 25
    if (password.length >= 12) strength += 15
    
    // Complexity checks
    if (/[a-z]/.test(password)) strength += 10 // lowercase
    if (/[A-Z]/.test(password)) strength += 10 // uppercase
    if (/[0-9]/.test(password)) strength += 10 // numbers
    if (/[^a-zA-Z0-9]/.test(password)) strength += 15 // special chars
    
    // Penalize repetitive patterns
    if (/(..+)\1/.test(password)) strength -= 10
    
    return Math.min(100, Math.max(0, strength))
  }
  
  // Get password strength label
  function getPasswordStrengthLabel(strength: number): { label: string; color: string } {
    if (strength >= 80) return { label: 'Strong', color: 'bg-green-500' }
    if (strength >= 50) return { label: 'Medium', color: 'bg-yellow-500' }
    if (strength >= 25) return { label: 'Weak', color: 'bg-red-500' }
    return { label: 'Very Weak', color: 'bg-red-800' }
  }
  
  // Get security level label
  function getSecurityLevelLabel(level: VaultSecurityLevel): { label: string; color: string } {
    switch (level) {
      case VaultSecurityLevel.MAXIMUM:
        return { label: 'Maximum (with Biometrics)', color: 'text-green-500' }
      case VaultSecurityLevel.HIGH:
        return { label: 'High', color: 'text-yellow-500' }
      default:
        return { label: 'Standard', color: 'text-blue-500' }
    }
  }
  
  // Loading state
  if (isLoading && !vaultStatus) {
    return (
      <Card className="w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center space-y-4 p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            <p className="text-center text-sm text-muted-foreground">
              Loading vault security information...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  
  // Vault not initialized yet
  if (vaultStatus && !vaultStatus.initialized) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5" />
            Initialize Secure Vault
          </CardTitle>
          <CardDescription>
            Set up your secure vault to manage private keys and sensitive data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="masterPassword">Master Password</Label>
              <div className="relative">
                <Input
                  id="masterPassword"
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Create a strong master password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm master password"
              />
            </div>
            
            {masterPassword && (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label>Password Strength</Label>
                  <span className={getPasswordStrengthLabel(getPasswordStrength(masterPassword)).color}>
                    {getPasswordStrengthLabel(getPasswordStrength(masterPassword)).label}
                  </span>
                </div>
                <Progress value={getPasswordStrength(masterPassword)} className="h-2" />
              </div>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="securityLevel">Security Level</Label>
              <select
                id="securityLevel"
                value={securityLevel}
                onChange={(e) => setSecurityLevel(e.target.value as VaultSecurityLevel)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value={VaultSecurityLevel.STANDARD}>Standard</option>
                <option value={VaultSecurityLevel.HIGH}>High</option>
                <option value={VaultSecurityLevel.MAXIMUM}>Maximum (with Biometrics)</option>
              </select>
              <p className="text-xs text-muted-foreground">
                {securityLevel === VaultSecurityLevel.MAXIMUM && 
                  "Highest security with biometric verification and hardware protection if available."}
                {securityLevel === VaultSecurityLevel.HIGH && 
                  "Enhanced security with additional verification steps."}
                {securityLevel === VaultSecurityLevel.STANDARD && 
                  "Basic encryption for general usage."}
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleInitializeVault}
            disabled={isLoading || masterPassword.length < 8 || masterPassword !== confirmPassword}
            className="w-full"
          >
            {isLoading ? 'Initializing...' : 'Initialize Secure Vault'}
          </Button>
        </CardFooter>
      </Card>
    )
  }
  
  // Vault locked, show unlock form
  if (vaultStatus && vaultStatus.locked) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="mr-2 h-5 w-5" />
            Unlock Secure Vault
          </CardTitle>
          <CardDescription>
            Enter your master password to access your secure vault
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unlockPassword">Master Password</Label>
              <div className="relative">
                <Input
                  id="unlockPassword"
                  type={showPassword ? "text" : "password"}
                  value={masterPassword}
                  onChange={(e) => setMasterPassword(e.target.value)}
                  placeholder="Enter your master password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
            
            {vaultStatus.mfaEnabled && (
              <div className="space-y-2">
                <Label htmlFor="mfaCode">MFA Code</Label>
                <Input
                  id="mfaCode"
                  type="text"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  placeholder="6-digit code"
                  maxLength={6}
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button
            onClick={handleUnlockVault}
            disabled={isLoading || !masterPassword}
            className="w-full"
          >
            {isLoading ? 'Unlocking...' : 'Unlock Vault'}
          </Button>
        </CardFooter>
      </Card>
    )
  }
  
  // Vault unlocked, show vault dashboard
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Unlock className="mr-2 h-5 w-5 text-green-500" />
            <CardTitle>Secure Vault</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLockVault}
            disabled={isLoading}
          >
            <Lock className="h-4 w-4 mr-2" />
            Lock Vault
          </Button>
        </div>
        <CardDescription>
          Manage your secure keys and wallet security settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full mb-4">
            <TabsTrigger value="status" className="flex-1">Status</TabsTrigger>
            <TabsTrigger value="keys" className="flex-1">Keys</TabsTrigger>
            <TabsTrigger value="settings" className="flex-1">Settings</TabsTrigger>
          </TabsList>
          
          <TabsContent value="status">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">Security Level</h3>
                <div className="flex items-center">
                  <Shield className="h-5 w-5 mr-2" />
                  <span className={getSecurityLevelLabel(vaultStatus.securityLevel || VaultSecurityLevel.STANDARD).color}>
                    {getSecurityLevelLabel(vaultStatus.securityLevel || VaultSecurityLevel.STANDARD).label}
                  </span>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">Hardware Protection</h3>
                <div className="flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  <span className={vaultStatus.hardwareProtection ? "text-green-500" : "text-yellow-500"}>
                    {vaultStatus.hardwareProtection ? "Enabled" : "Not Available"}
                  </span>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">Biometric Authentication</h3>
                <div className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  <span className={vaultStatus.mfaEnabled ? "text-green-500" : "text-yellow-500"}>
                    {vaultStatus.mfaEnabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
              
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-2">Stored Keys</h3>
                <div className="flex items-center">
                  <Key className="h-5 w-5 mr-2" />
                  <span>{vaultStatus.keyCount || 0} keys</span>
                </div>
              </div>
            </div>
            
            {vaultStatus.lastActivity && (
              <div className="mt-4 text-sm text-muted-foreground">
                Last Activity: {new Date(vaultStatus.lastActivity).toLocaleString()}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="keys">
            {vaultKeys.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm font-medium mb-2">Your Secure Keys</div>
                {vaultKeys.map((key) => (
                  <div key={key.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{key.name}</h3>
                        <div className="text-sm text-muted-foreground">{key.type}</div>
                      </div>
                      <div className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                        {key.blockchain}
                      </div>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Created:</span> {new Date(key.createdAt).toLocaleDateString()}
                      </div>
                      {key.accessedAt && (
                        <div>
                          <span className="text-muted-foreground">Last Used:</span> {new Date(key.accessedAt).toLocaleDateString()}
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Protection:</span>{" "}
                        <span className={key.metadata.hardwareProtected ? "text-green-500" : ""}>
                          {key.metadata.hardwareProtected ? "Hardware" : "Software"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Backup:</span>{" "}
                        <span className={key.metadata.isBackedUp ? "text-green-500" : "text-yellow-500"}>
                          {key.metadata.isBackedUp ? "Yes" : "No"}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex space-x-2">
                      <Button variant="outline" size="sm">Use</Button>
                      {key.policy.allowExport && (
                        <Button variant="outline" size="sm">Export</Button>
                      )}
                      <Button variant="outline" size="sm">Backup</Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Key className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No Keys Found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  You haven't added any keys to your secure vault yet.
                </p>
                <Button>Add New Key</Button>
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="settings">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Change Master Password</Label>
                <div className="space-y-2">
                  <Input type="password" placeholder="Current password" />
                  <Input type="password" placeholder="New password" />
                  <Input type="password" placeholder="Confirm new password" />
                  <Button className="w-full">Change Password</Button>
                </div>
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <Label>Biometric Authentication</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Use biometric authentication when available</span>
                  <div className="relative inline-flex h-6 w-11 items-center rounded-full border-2 border-transparent bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary">
                    <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0 ${vaultStatus.mfaEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  When enabled, you'll need to verify with biometrics to unlock the vault
                </p>
              </div>
              
              <div className="border-t pt-4 space-y-2">
                <Label>Session Timeout</Label>
                <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="5">5 Minutes</option>
                  <option value="15">15 Minutes</option>
                  <option value="30">30 Minutes</option>
                  <option value="60">1 Hour</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  The vault will automatically lock after this period of inactivity
                </p>
              </div>
              
              <div className="border-t pt-4">
                <Button variant="destructive" className="w-full">Reset Vault</Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Warning: This will delete all keys and reset the vault. This action cannot be undone.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}

export { VaultSecurityPanel }

interface VaultSecurityPanelProps {
  walletId?: string
  onVaultStatusChange?: (status: { initialized: boolean; locked: boolean }) => void
}

const securityVaultContent = {
  title: 'Secure Vault',
  description: 'Manage your secure keys and wallet security settings',
  tabs: {
    status: 'Status',
    keys: 'Keys',
    settings: 'Settings'
  }
}