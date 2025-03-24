// src/components/security/cold-storage/QrCodeBackup.tsx
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CheckCircle2, Printer, ArrowLeft, CheckCheck } from 'lucide-react'

interface QrCodeBackupProps {
  data: string | null
  walletName?: string
  blockchain?: string
  onPrint: () => void
  onVerify: () => void
  onBack: () => void
  onComplete: () => void
  verified: boolean
  printableRef: React.RefObject<HTMLDivElement>
}

function QrCodeBackup({
  data,
  walletName,
  blockchain,
  onPrint,
  onVerify,
  onBack,
  onComplete,
  verified,
  printableRef
}: QrCodeBackupProps) {
  if (!data) return null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">QR Code Backup</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Scan this QR code with your wallet app to recover your funds:
        </p>
      </div>
      
      <div className="border rounded-lg p-6" ref={printableRef}>
        <div className="flex flex-col items-center">
          <div className="qr-code-container">
            <img 
              src={data} 
              alt="Backup QR Code" 
              className="h-64 w-64 object-contain mx-auto"
            />
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-sm">
              <span className="font-medium">Wallet:</span> {walletName || 'My Wallet'}
            </p>
            <p className="text-sm">
              <span className="font-medium">Blockchain:</span> {blockchain || 'Multiple'}
            </p>
            <p className="text-sm">
              <span className="font-medium">Date:</span> {new Date().toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <div className="mt-6 border-t pt-4">
          <h4 className="text-md font-medium mb-2">Recovery Instructions</h4>
          <ol className="text-sm space-y-1 pl-5 list-decimal">
            <li>Scan this QR code with your wallet app</li>
            <li>Enter your encryption password</li>
            <li>Follow the app's recovery process</li>
          </ol>
          <p className="mt-4 text-sm p-2 border border-destructive/30 bg-destructive/5 rounded text-destructive">
            <strong>Warning:</strong> Keep this backup in a safe place! Anyone with this QR code and 
            your password can access your funds.
          </p>
        </div>
      </div>
      
      <div className="flex items-center justify-center space-x-4">
        <Button 
          variant="outline" 
          onClick={onPrint}
          className="flex items-center gap-2"
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        
        <Button 
          variant={verified ? "outline" : "default"}
          onClick={onVerify}
          disabled={verified}
          className="flex items-center gap-2"
        >
          {verified ? (
            <>
              <CheckCheck className="h-4 w-4" />
              Verified
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              Verify
            </>
          )}
        </Button>
      </div>
      
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        
        <Button 
          onClick={onComplete} 
          disabled={!verified}
        >
          Complete Backup
        </Button>
      </div>
    </div>
  )
}

export { QrCodeBackup }