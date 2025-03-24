// src/components/security/cold-storage/FormatSelection.tsx
import { ColdStorageFormat } from '@/services/security/ColdStorageService'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QrCode, FileText, Hammer } from 'lucide-react'

interface FormatSelectionProps {
  selectedFormat: ColdStorageFormat
  onSelectFormat: (format: ColdStorageFormat) => void
  password: string
  setPassword: (password: string) => void
  confirmPassword: string
  setConfirmPassword: (password: string) => void
  onGenerate: () => void
  onCancel: () => void
  isGenerating: boolean
  passwordError: string | null
}

function FormatSelection({
  selectedFormat,
  onSelectFormat,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  onGenerate,
  onCancel,
  isGenerating,
  passwordError
}: FormatSelectionProps) {
  const isPasswordValid = 
    selectedFormat !== ColdStorageFormat.QR_CODE || 
    (password.length >= 8 && password === confirmPassword)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-2">Choose Backup Format</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Select how you want to back up your secret phrase:
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormatOption
            title="QR Code"
            description="Encrypted QR code for secure scanning"
            icon={<QrCode className="h-10 w-10" />}
            selected={selectedFormat === ColdStorageFormat.QR_CODE}
            onClick={() => onSelectFormat(ColdStorageFormat.QR_CODE)}
          />
          
          <FormatOption
            title="Paper Backup"
            description="Printable backup with numbered words"
            icon={<FileText className="h-10 w-10" />}
            selected={selectedFormat === ColdStorageFormat.PAPER_KEY}
            onClick={() => onSelectFormat(ColdStorageFormat.PAPER_KEY)}
          />
          
          <FormatOption
            title="Metal Backup"
            description="Instructions for engraving on metal"
            icon={<Hammer className="h-10 w-10" />}
            selected={selectedFormat === ColdStorageFormat.METAL_BACKUP}
            onClick={() => onSelectFormat(ColdStorageFormat.METAL_BACKUP)}
          />
        </div>
      </div>
      
      {selectedFormat === ColdStorageFormat.QR_CODE && (
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium mb-2">Encryption Password</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Your QR code will be encrypted with a password for added security:
            </p>
          </div>
          
          <div className="grid gap-3">
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Strong password"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
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
                <span>
                  {password.length === 0 ? 'Enter a password' :
                   password.length < 8 ? 'Weak' :
                   password.length < 12 ? 'Medium' : 'Strong'}
                </span>
              </div>
              <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all ${
                    password.length === 0 ? '' :
                    password.length < 8 ? 'bg-destructive/70' :
                    password.length < 12 ? 'bg-amber-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${password.length ? Math.min(100, password.length * 8.33) : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={onGenerate} 
          disabled={isGenerating || !isPasswordValid}
        >
          {isGenerating ? 'Generating...' : 'Generate Backup'}
        </Button>
      </div>
    </div>
  )
}

interface FormatOptionProps {
  title: string
  description: string
  icon: React.ReactNode
  selected: boolean
  onClick: () => void
}

function FormatOption({ title, description, icon, selected, onClick }: FormatOptionProps) {
  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 cursor-pointer transition-all
        hover:border-primary/50 
        ${selected 
          ? 'border-primary bg-primary/5' 
          : 'border-muted-foreground/20'
        }
      `}
      onClick={onClick}
    >
      <div className="flex flex-col items-center text-center space-y-2">
        <div className={`${selected ? 'text-primary' : 'text-muted-foreground'}`}>
          {icon}
        </div>
        <h4 className="font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      
      {selected && (
        <div className="absolute top-2 right-2 h-3 w-3 rounded-full bg-primary" />
      )}
    </div>
  )
}

export { FormatSelection }