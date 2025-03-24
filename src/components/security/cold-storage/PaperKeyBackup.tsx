// src/components/security/cold-storage/PaperKeyBackup.tsx
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, CheckCircle2, CheckCheck } from 'lucide-react'

interface PaperKeyBackupProps {
  data: string | null
  onPrint: () => void
  onVerify: () => void
  onBack: () => void
  onComplete: () => void
  verified: boolean
  printableRef: React.RefObject<HTMLDivElement>
}

function PaperKeyBackup({
  data,
  onPrint,
  onVerify,
  onBack,
  onComplete,
  verified,
  printableRef
}: PaperKeyBackupProps) {
  if (!data) return null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Paper Backup</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Print these recovery words and store them securely:
        </p>
      </div>
      
      <div className="border rounded-lg p-6" ref={printableRef}>
        <div className="flex flex-col items-center">
          <h4 className="text-md font-medium mb-4">Recovery Words</h4>
          
          <div className="p-4 bg-muted rounded-md w-full font-mono text-sm whitespace-pre overflow-x-auto">
            {data}
          </div>
          
          <div className="mt-6 w-full">
            <h4 className="text-md font-medium mb-2">Recovery Instructions</h4>
            <ol className="text-sm space-y-1 pl-5 list-decimal">
              <li>Store this paper in a secure, dry place</li>
              <li>Do not share these words with anyone</li>
              <li>To recover your wallet, enter these words in the correct order</li>
              <li>Consider making a secondary backup (like metal engraving) for long-term storage</li>
            </ol>
            <p className="mt-4 text-sm p-2 border border-destructive/30 bg-destructive/5 rounded text-destructive">
              <strong>Warning:</strong> Anyone with access to these recovery words can access your funds.
              Keep them private and secure!
            </p>
          </div>
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

export { PaperKeyBackup }