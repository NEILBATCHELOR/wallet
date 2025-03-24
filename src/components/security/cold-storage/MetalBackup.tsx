// src/components/security/cold-storage/MetalBackup.tsx
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, CheckCircle2, CheckCheck } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface MetalBackupProps {
  data: any
  onPrint: () => void
  onVerify: () => void
  onBack: () => void
  onComplete: () => void
  verified: boolean
  printableRef: React.RefObject<HTMLDivElement>
}

function MetalBackup({
  data,
  onPrint,
  onVerify,
  onBack,
  onComplete,
  verified,
  printableRef
}: MetalBackupProps) {
  if (!data) return null

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Metal Backup</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Engrave these words on metal for maximum durability:
        </p>
      </div>
      
      <div className="border rounded-lg p-6" ref={printableRef}>
        <div className="space-y-6">
          <div>
            <h4 className="text-md font-medium mb-3">Words to Engrave</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Position</TableHead>
                  <TableHead>Word</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.words.map((item: any) => (
                  <TableRow key={item.index}>
                    <TableCell className="font-mono">{item.index}</TableCell>
                    <TableCell className="font-medium">{item.word}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div>
            <h4 className="text-md font-medium mb-3">Checksum Words</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Position</TableHead>
                  <TableHead>Word</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.checksumWords.map((item: any) => (
                  <TableRow key={item.index}>
                    <TableCell className="font-mono">{item.index}</TableCell>
                    <TableCell className="font-medium">{item.word}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          <div>
            <h4 className="text-md font-medium mb-2">Engraving Instructions</h4>
            <ol className="text-sm space-y-1 pl-5 list-decimal">
              <li>Use a metal plate (steel or titanium is recommended)</li>
              <li>Engrave the position number and corresponding word</li>
              <li>Include the checksum words for verification</li>
              <li>Store in a fireproof and waterproof location</li>
            </ol>
            <p className="mt-4 text-sm p-2 border border-destructive/30 bg-destructive/5 rounded text-destructive">
              <strong>Warning:</strong> This backup is not encrypted! Anyone with access to it can 
              potentially access your funds.
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
          Print Instructions
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

export { MetalBackup }