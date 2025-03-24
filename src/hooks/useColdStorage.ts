// src/hooks/useColdStorage.ts
import { useState } from 'react'
import { ColdStorageService, ColdStorageFormat } from '@/services/security/ColdStorageService'

interface UseColdStorageProps {
  secretPhrase: string
  keyId?: string
  walletName?: string
  blockchain?: string
}

interface BackupOptions {
  format: ColdStorageFormat
  password?: string
}

export function useColdStorage({
  secretPhrase,
  keyId,
  walletName,
  blockchain
}: UseColdStorageProps) {
  const [backupData, setBackupData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Cold storage service instance
  const coldStorageService = ColdStorageService.getInstance()
  
  async function generateBackup(options: BackupOptions) {
    try {
      setIsLoading(true)
      setError(null)
      
      // Validate password if using QR code
      if (options.format === ColdStorageFormat.QR_CODE) {
        if (!options.password) {
          throw new Error('Password is required for QR code backup')
        }
        
        if (options.password.length < 8) {
          throw new Error('Password must be at least 8 characters long')
        }
      }
      
      let data
      
      // Generate backup based on format
      switch (options.format) {
        case ColdStorageFormat.QR_CODE:
          data = await coldStorageService.generateQRCode(
            secretPhrase,
            options.password!,
            {
              keyId,
              walletName,
              blockchain,
              format: 'dataURL',
              errorCorrectionLevel: 'H'
            }
          )
          break
          
        case ColdStorageFormat.PAPER_KEY:
          data = coldStorageService.generatePaperKey(
            secretPhrase,
            {
              keyId,
              walletName,
              blockchain,
              includeWordNumbers: true
            }
          )
          break
          
        case ColdStorageFormat.METAL_BACKUP:
          data = coldStorageService.generateMetalBackup(
            secretPhrase,
            {
              keyId,
              walletName
            }
          )
          break
          
        default:
          throw new Error(`Unsupported backup format: ${options.format}`)
      }
      
      setBackupData(data)
      setIsLoading(false)
      return data
    } catch (err: any) {
      setError(err.message)
      setIsLoading(false)
      throw err
    }
  }
  
  return {
    generateBackup,
    backupData,
    isLoading,
    error
  }
}