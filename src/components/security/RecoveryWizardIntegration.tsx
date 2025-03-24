// src/components/security/RecoveryWizardIntegration.tsx

import React, { useState } from 'react'
import { useKeyRecovery } from '../../services/security/KeyRecoveryManager'
import { RecoveryMethod } from '../../services/security/KeyRecoveryService'
import { RecoverySetupWizard } from './RecoverySetupWizard'
import { SecureVault } from '../../services/vault/SecureVault'

interface RecoveryWizardIntegrationProps {
  walletId: string
  keyId: string
  keyName: string
  blockchain: string
  onComplete: () => void
  onCancel: () => void
}

export function RecoveryWizardIntegration({
  walletId,
  keyId,
  keyName,
  blockchain,
  onComplete,
  onCancel
}: RecoveryWizardIntegrationProps) {
  const [step, setStep] = useState(1)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [secretPhrase, setSecretPhrase] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoverySetup, setRecoverySetup] = useState<any | null>(null)
  
  const keyRecovery = useKeyRecovery()
  const vault = SecureVault.getInstance()
  
  // Verify password and get secret phrase
  async function handleVerifyPassword() {
    setError(null)
    setIsLoading(true)
    
    try {
      // Check passwords match
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setIsLoading(false)
        return
      }
      
      // Get key from vault
      const secret = await vault.getKey(keyId, password, { 
        reason: 'Setting up key recovery',
        securityLevel: 'MAXIMUM'
      })
      
      setSecretPhrase(secret)
      setStep(2)
    } catch (error) {
      setError(error.message || 'Failed to verify password')
    }
    
    setIsLoading(false)
  }
  
  // Handle recovery setup completion
  async function handleRecoveryComplete(setup: any) {
    setRecoverySetup(setup)
    setStep(3)
  }
  
  // Handle final completion
  function handleFinishSetup() {
    if (recoverySetup) {
      onComplete()
    }
  }
  
  // Render password verification step
  function renderPasswordStep() {
    return (
      <div className="recovery-password-step">
        <h3>Verify Your Password</h3>
        <p>Enter your wallet password to set up recovery</p>
        
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your wallet password"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password:</label>
          <input
            type="password"
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm password"
          />
        </div>
        
        <div className="action-buttons">
          <button type="button" onClick={onCancel} className="cancel-button">
            Cancel
          </button>
          <button 
            type="button" 
            onClick={handleVerifyPassword} 
            className="next-button"
            disabled={isLoading || !password || !confirmPassword}
          >
            {isLoading ? 'Verifying...' : 'Next'}
          </button>
        </div>
      </div>
    )
  }
  
  // Render recovery wizard step
  function renderRecoveryWizardStep() {
    if (!secretPhrase) {
      setStep(1)
      return null
    }
    
    return (
      <RecoverySetupWizard
        walletId={walletId}
        keyId={keyId}
        keyName={keyName}
        secretPhrase={secretPhrase}
        blockchain={blockchain}
        onComplete={handleRecoveryComplete}
        onCancel={() => setStep(1)}
      />
    )
  }
  
  // Render success screen
  function renderSuccessStep() {
    if (!recoverySetup) {
      setStep(2)
      return null
    }
    
    return (
      <div className="recovery-success-step">
        <h3>Recovery Setup Complete!</h3>
        <div className="success-icon">✓</div>
        <p>Your recovery method has been successfully set up.</p>
        
        {recoverySetup.method === RecoveryMethod.SOCIAL && (
          <div className="recovery-instructions">
            <h4>Next Steps</h4>
            <p>Share recovery information with your trusted contacts.</p>
            <p>Make sure they securely store their recovery shares.</p>
          </div>
        )}
        
        {recoverySetup.method === RecoveryMethod.TIMELOCK && (
          <div className="recovery-instructions">
            <h4>Next Steps</h4>
            <p>Store your recovery details in a secure location.</p>
            <p>Your recovery will be available after the timelock period.</p>
          </div>
        )}
        
        <button type="button" onClick={handleFinishSetup} className="finish-button">
          Finish
        </button>
      </div>
    )
  }
  
  return (
    <div className="recovery-wizard-integration">
      <h2>Set Up Key Recovery</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {step === 1 && renderPasswordStep()}
      {step === 2 && renderRecoveryWizardStep()}
      {step === 3 && renderSuccessStep()}
    </div>
  )
}