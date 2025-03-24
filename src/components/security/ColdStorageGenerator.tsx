// src/components/security/ColdStorageGenerator.tsx
import { useState, useRef } from 'react'
import { useColdStorage } from '@/hooks/useColdStorage'
import { ColdStorageFormat } from '@/services/security/ColdStorageService'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs'

import { FormatSelection } from './cold-storage/FormatSelection'
import { QrCodeBackup } from './cold-storage/QrCodeBackup'
import { PaperKeyBackup } from './cold-storage/PaperKeyBackup'
import { MetalBackup } from './cold-storage/MetalBackup'

interface ColdStorageGeneratorProps {
  secretPhrase: string
  keyId?: string
  walletName?: string
  blockchain?: string
  onComplete: (backupData: any) => void
  onCancel: () => void
}

function ColdStorageGenerator({
  secretPhrase,
  keyId,
  walletName,
  blockchain,
  onComplete,
  onCancel
}: ColdStorageGeneratorProps) {
  const [selectedFormat, setSelectedFormat] = useState<ColdStorageFormat>(ColdStorageFormat.QR_CODE)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [generated, setGenerated] = useState(false)
  const [verified, setVerified] = useState(false)
  
  const { 
    generateBackup,
    backupData,
    isLoading,
    error
  } = useColdStorage({
    secretPhrase,
    keyId,
    walletName,
    blockchain
  })
  
  // Refs for printing
  const printableRef = useRef<HTMLDivElement>(null)
  
  async function handleGenerateBackup() {
    if (selectedFormat === ColdStorageFormat.QR_CODE && password !== confirmPassword) {
      return
    }
    
    const options = {
      format: selectedFormat,
      password: selectedFormat === ColdStorageFormat.QR_CODE ? password : undefined
    }
    
    await generateBackup(options)
    setGenerated(true)
  }
  
  function handleVerify() {
    // In a real app, this would actually verify the backup
    setVerified(true)
  }
  
  function handleComplete() {
    const result = {
      format: selectedFormat,
      verified,
      timestamp: new Date().toISOString()
    }
    
    onComplete(result)
  }
  
  function handlePrint() {
    if (printableRef.current) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Backup ${walletName || 'Wallet'}</title>
              <style>
                body { font-family: system-ui, sans-serif; padding: 20px; }
                .container { max-width: 800px; margin: 0 auto; }
                @media print {
                  body { margin: 0; padding: 0; }
                  button { display: none; }
                }
              </style>
            </head>
            <body>
              <div class="container">
                ${printableRef.current.innerHTML}
              </div>
              <script>
                setTimeout(() => { window.print(); window.close(); }, 500);
              </script>
            </body>
          </html>
        `)
        printWindow.document.close()
      }
    }
  }
  
  function renderBackupContent() {
    if (!generated) {
      return (
        <FormatSelection
          selectedFormat={selectedFormat}
          onSelectFormat={setSelectedFormat}
          password={password}
          setPassword={setPassword}
          confirmPassword={confirmPassword}
          setConfirmPassword={setConfirmPassword}
          onGenerate={handleGenerateBackup}
          onCancel={onCancel}
          isGenerating={isLoading}
          passwordError={
            password !== confirmPassword && !!password && !!confirmPassword
              ? 'Passwords do not match'
              : password.length > 0 && password.length < 8
              ? 'Password must be at least 8 characters'
              : null
          }
        />
      )
    }
    
    // Render appropriate backup content based on format
    switch (selectedFormat) {
      case ColdStorageFormat.QR_CODE:
        return (
          <QrCodeBackup
            data={backupData}
            walletName={walletName}
            blockchain={blockchain}
            onPrint={handlePrint}
            onVerify={handleVerify}
            onBack={() => setGenerated(false)}
            onComplete={handleComplete}
            verified={verified}
            printableRef={printableRef}
          />
        )
      case ColdStorageFormat.PAPER_KEY:
        return (
          <PaperKeyBackup
            data={backupData}
            onPrint={handlePrint}
            onVerify={handleVerify}
            onBack={() => setGenerated(false)}
            onComplete={handleComplete}
            verified={verified}
            printableRef={printableRef}
          />
        )
      case ColdStorageFormat.METAL_BACKUP:
        return (
          <MetalBackup
            data={backupData}
            onPrint={handlePrint}
            onVerify={handleVerify}
            onBack={() => setGenerated(false)}
            onComplete={handleComplete}
            verified={verified}
            printableRef={printableRef}
          />
        )
      default:
        return null
    }
  }

  return (
    <Card className="max-w-xl mx-auto">
      <CardHeader>
        <CardTitle>Create Cold Storage Backup</CardTitle>
        <CardDescription>
          Secure your wallet key with a physical backup
        </CardDescription>
      </CardHeader>
      
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        
        {renderBackupContent()}
      </CardContent>
    </Card>
  )
}

export { ColdStorageGenerator }