// src/components/security/RecoverySetupWizard.tsx
import React, { useState } from 'react';
import { KeyRecoveryService, RecoveryMethod } from '../../services/security/KeyRecoveryService';

interface RecoverySetupWizardProps {
  walletId: string;
  keyId: string;
  keyName: string;
  secretPhrase: string; // The mnemonic or key to recover
  blockchain: string;
  onComplete: (setup: any) => void;
  onCancel: () => void;
}

/**
 * A wizard for setting up key recovery options
 */
const RecoverySetupWizard: React.FC<RecoverySetupWizardProps> = ({
  walletId,
  keyId,
  keyName,
  secretPhrase,
  blockchain,
  onComplete,
  onCancel
}) => {
  const [step, setStep] = useState(1);
  const [selectedMethod, setSelectedMethod] = useState<RecoveryMethod | null>(null);
  const [guardians, setGuardians] = useState<Array<{ name: string; email: string }>>([
    { name: '', email: '' }
  ]);
  const [threshold, setThreshold] = useState(2);
  const [timelockDays, setTimelockDays] = useState(30);
  const [deadmanDays, setDeadmanDays] = useState(90);
  const [backupPassword, setBackupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Recovery service instance
  const recoveryService = KeyRecoveryService.getInstance();
  
  // Handle method selection
  const handleMethodSelect = (method: RecoveryMethod) => {
    setSelectedMethod(method);
    setStep(2);
  };
  
  // Add a guardian
  const addGuardian = () => {
    setGuardians([...guardians, { name: '', email: '' }]);
  };
  
  // Update guardian info
  const updateGuardian = (index: number, field: 'name' | 'email', value: string) => {
    const updatedGuardians = [...guardians];
    updatedGuardians[index][field] = value;
    setGuardians(updatedGuardians);
  };
  
  // Remove a guardian
  const removeGuardian = (index: number) => {
    if (guardians.length > 1) {
      const updatedGuardians = [...guardians];
      updatedGuardians.splice(index, 1);
      setGuardians(updatedGuardians);
      
      // Adjust threshold if it's now higher than guardian count
      if (threshold > updatedGuardians.length) {
        setThreshold(updatedGuardians.length);
      }
    }
  };
  
  // Complete setup
  const completeSetup = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Validate inputs based on method
      if (selectedMethod === RecoveryMethod.SOCIAL) {
        // Validate guardians
        const validGuardians = guardians.filter(g => g.name && g.email);
        
        if (validGuardians.length < threshold) {
          throw new Error(`At least ${threshold} valid guardians required`);
        }
        
        // Setup social recovery
        const setup = await recoveryService.setupSocialRecovery(
          walletId,
          secretPhrase,
          validGuardians,
          threshold,
          { blockchain }
        );
        
        setSuccess(true);
        onComplete(setup);
      } else if (selectedMethod === RecoveryMethod.TIMELOCK) {
        // Validate timelock days
        if (timelockDays < 1) {
          throw new Error('Timelock period must be at least 1 day');
        }
        
        // Setup timelock recovery
        const setup = await recoveryService.setupTimelockRecovery(
          walletId,
          secretPhrase,
          timelockDays,
          { blockchain }
        );
        
        setSuccess(true);
        onComplete(setup);
      } else if (selectedMethod === RecoveryMethod.DEADMAN) {
        // Validate deadman switch days
        if (deadmanDays < 30) {
          throw new Error('Dead man switch period must be at least 30 days');
        }
        
        // Validate guardians
        const validGuardians = guardians.filter(g => g.name && g.email);
        
        if (validGuardians.length === 0) {
          throw new Error('At least one guardian required');
        }
        
        // Setup deadman switch
        const setup = await recoveryService.setupDeadmanSwitch(
          walletId,
          secretPhrase,
          deadmanDays,
          validGuardians,
          { blockchain }
        );
        
        setSuccess(true);
        onComplete(setup);
      } else if (selectedMethod === RecoveryMethod.BACKUP) {
        // Validate password
        if (!backupPassword) {
          throw new Error('Password is required');
        }
        
        if (backupPassword !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        // Setup backup recovery
        const setup = await recoveryService.setupBackupRecovery(
          walletId,
          secretPhrase,
          backupPassword,
          { blockchain }
        );
        
        setSuccess(true);
        onComplete(setup);
      } else {
        throw new Error('Please select a recovery method');
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };
  
  // Render method selection step
  const renderMethodSelection = () => (
    <div className="recovery-methods">
      <h3>Select Recovery Method</h3>
      <p>Choose how you want to back up your wallet key:</p>
      
      <div className="method-options">
        <div 
          className={`method-option ${selectedMethod === RecoveryMethod.SOCIAL ? 'selected' : ''}`}
          onClick={() => handleMethodSelect(RecoveryMethod.SOCIAL)}
        >
          <h4>Social Recovery</h4>
          <p>Split your key into shares and distribute to trusted contacts</p>
        </div>
        
        <div 
          className={`method-option ${selectedMethod === RecoveryMethod.TIMELOCK ? 'selected' : ''}`}
          onClick={() => handleMethodSelect(RecoveryMethod.TIMELOCK)}
        >
          <h4>Timelock</h4>
          <p>Recover your key after a waiting period</p>
        </div>
        
        <div 
          className={`method-option ${selectedMethod === RecoveryMethod.DEADMAN ? 'selected' : ''}`}
          onClick={() => handleMethodSelect(RecoveryMethod.DEADMAN)}
        >
          <h4>Dead Man's Switch</h4>
          <p>Automatically transfer access after inactivity</p>
        </div>
        
        <div 
          className={`method-option ${selectedMethod === RecoveryMethod.BACKUP ? 'selected' : ''}`}
          onClick={() => handleMethodSelect(RecoveryMethod.BACKUP)}
        >
          <h4>Password Backup</h4>
          <p>Encrypt your key with a strong password</p>
        </div>
      </div>
    </div>
  );
  
  // Render social recovery setup
  const renderSocialRecovery = () => (
    <div className="social-recovery-setup">
      <h3>Social Recovery Setup</h3>
      <p>Your key will be split into multiple shares. You'll need {threshold} of {guardians.length} shares to recover your wallet.</p>
      
      <div className="form-group">
        <label htmlFor="threshold">Required shares:</label>
        <input
          type="number"
          id="threshold"
          min={2}
          max={guardians.length}
          value={threshold}
          onChange={(e) => setThreshold(Math.min(parseInt(e.target.value), guardians.length))}
        />
        <span className="hint">of {guardians.length} total shares</span>
      </div>
      
      <h4>Guardian Information</h4>
      <p>Enter the details of your trusted contacts:</p>
      
      {guardians.map((guardian, index) => (
        <div key={index} className="guardian-form">
          <div className="form-group">
            <label htmlFor={`name-${index}`}>Name:</label>
            <input
              type="text"
              id={`name-${index}`}
              value={guardian.name}
              onChange={(e) => updateGuardian(index, 'name', e.target.value)}
              placeholder="Guardian's name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor={`email-${index}`}>Email:</label>
            <input
              type="email"
              id={`email-${index}`}
              value={guardian.email}
              onChange={(e) => updateGuardian(index, 'email', e.target.value)}
              placeholder="Guardian's email"
            />
          </div>
          
          <button 
            type="button" 
            className="remove-button"
            onClick={() => removeGuardian(index)}
            disabled={guardians.length <= 1}
          >
            Remove
          </button>
        </div>
      ))}
      
      <button type="button" className="add-button" onClick={addGuardian}>
        Add Guardian
      </button>
      
      <div className="action-buttons">
        <button type="button" onClick={() => setStep(1)} className="back-button">
          Back
        </button>
        <button 
          type="button" 
          onClick={completeSetup} 
          className="complete-button"
          disabled={loading}
        >
          {loading ? 'Setting up...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
  
  // Render timelock setup
  const renderTimelockSetup = () => (
    <div className="timelock-setup">
      <h3>Timelock Recovery Setup</h3>
      <p>Your key will be recoverable after a waiting period.</p>
      
      <div className="form-group">
        <label htmlFor="timelockDays">Waiting period (in days):</label>
        <input
          type="number"
          id="timelockDays"
          min={1}
          value={timelockDays}
          onChange={(e) => setTimelockDays(parseInt(e.target.value))}
        />
        <span className="hint">
          Your key will be recoverable after {timelockDays} days
        </span>
      </div>
      
      <div className="action-buttons">
        <button type="button" onClick={() => setStep(1)} className="back-button">
          Back
        </button>
        <button 
          type="button" 
          onClick={completeSetup} 
          className="complete-button"
          disabled={loading}
        >
          {loading ? 'Setting up...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
  
  // Render deadman switch setup
  const renderDeadmanSwitch = () => (
    <div className="deadman-setup">
      <h3>Dead Man's Switch Setup</h3>
      <p>Your key will be automatically recovered after a period of inactivity.</p>
      
      <div className="form-group">
        <label htmlFor="deadmanDays">Inactivity period (in days):</label>
        <input
          type="number"
          id="deadmanDays"
          min={30}
          value={deadmanDays}
          onChange={(e) => setDeadmanDays(parseInt(e.target.value))}
        />
        <span className="hint">
          Your key will be recoverable after {deadmanDays} days of inactivity
        </span>
      </div>
      
      <h4>Notify These People:</h4>
      <p>These contacts will be notified when the switch activates:</p>
      
      {guardians.map((guardian, index) => (
        <div key={index} className="guardian-form">
          <div className="form-group">
            <label htmlFor={`name-${index}`}>Name:</label>
            <input
              type="text"
              id={`name-${index}`}
              value={guardian.name}
              onChange={(e) => updateGuardian(index, 'name', e.target.value)}
              placeholder="Contact's name"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor={`email-${index}`}>Email:</label>
            <input
              type="email"
              id={`email-${index}`}
              value={guardian.email}
              onChange={(e) => updateGuardian(index, 'email', e.target.value)}
              placeholder="Contact's email"
            />
          </div>
          
          <button 
            type="button" 
            className="remove-button"
            onClick={() => removeGuardian(index)}
            disabled={guardians.length <= 1}
          >
            Remove
          </button>
        </div>
      ))}
      
      <button type="button" className="add-button" onClick={addGuardian}>
        Add Contact
      </button>
      
      <div className="action-buttons">
        <button type="button" onClick={() => setStep(1)} className="back-button">
          Back
        </button>
        <button 
          type="button" 
          onClick={completeSetup} 
          className="complete-button"
          disabled={loading}
        >
          {loading ? 'Setting up...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
  
  // Render backup password setup
  const renderBackupPassword = () => (
    <div className="backup-setup">
      <h3>Password Backup Setup</h3>
      <p>Your key will be encrypted with a strong password.</p>
      
      <div className="form-group">
        <label htmlFor="backupPassword">Password:</label>
        <input
          type="password"
          id="backupPassword"
          value={backupPassword}
          onChange={(e) => setBackupPassword(e.target.value)}
          placeholder="Strong password"
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
      
      <div className="password-strength">
        <p>Password strength:</p>
        <div 
          className={`strength-meter ${
            backupPassword.length === 0 ? '' :
            backupPassword.length < 8 ? 'weak' :
            backupPassword.length < 12 ? 'medium' : 'strong'
          }`}
        ></div>
        <p className="strength-label">
          {backupPassword.length === 0 ? 'Enter a password' :
           backupPassword.length < 8 ? 'Weak' :
           backupPassword.length < 12 ? 'Medium' : 'Strong'}
        </p>
      </div>
      
      <div className="action-buttons">
        <button type="button" onClick={() => setStep(1)} className="back-button">
          Back
        </button>
        <button 
          type="button" 
          onClick={completeSetup} 
          className="complete-button"
          disabled={loading || backupPassword.length < 8 || backupPassword !== confirmPassword}
        >
          {loading ? 'Setting up...' : 'Complete Setup'}
        </button>
      </div>
    </div>
  );
  
  // Render success screen
  const renderSuccess = () => (
    <div className="success-screen">
      <h3>Recovery Setup Complete</h3>
      <div className="success-icon">✓</div>
      <p>Your recovery method has been successfully set up.</p>
      
      <button 
        type="button" 
        onClick={() => onComplete({})} 
        className="finish-button"
      >
        Finish
      </button>
    </div>
  );
  
  return (
    <div className="recovery-setup-wizard">
      <h2>Set Up Recovery for {keyName}</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {success ? (
        renderSuccess()
      ) : (
        <>
          {step === 1 && renderMethodSelection()}
          {step === 2 && selectedMethod === RecoveryMethod.SOCIAL && renderSocialRecovery()}
          {step === 2 && selectedMethod === RecoveryMethod.TIMELOCK && renderTimelockSetup()}
          {step === 2 && selectedMethod === RecoveryMethod.DEADMAN && renderDeadmanSwitch()}
          {step === 2 && selectedMethod === RecoveryMethod.BACKUP && renderBackupPassword()}
          
          {step === 1 && (
            <div className="action-buttons single-button">
              <button type="button" onClick={onCancel} className="cancel-button">
                Cancel
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// src/components/security/ColdStorageGenerator.tsx
import React, { useState, useRef } from 'react';
import { ColdStorageService, ColdStorageFormat } from '../../services/security/ColdStorageService';

interface ColdStorageGeneratorProps {
  secretPhrase: string; // The mnemonic or key to backup
  keyId?: string;
  walletName?: string;
  blockchain?: string;
  onComplete: (backupData: any) => void;
  onCancel: () => void;
}

/**
 * Component for generating cold storage backups
 */
const ColdStorageGenerator: React.FC<ColdStorageGeneratorProps> = ({
  secretPhrase,
  keyId,
  walletName,
  blockchain,
  onComplete,
  onCancel
}) => {
  const [selectedFormat, setSelectedFormat] = useState<ColdStorageFormat>(ColdStorageFormat.QR_CODE);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generated, setGenerated] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [paperKey, setPaperKey] = useState<string | null>(null);
  const [metalBackup, setMetalBackup] = useState<any | null>(null);
  const [verified, setVerified] = useState(false);
  
  // Refs for printing
  const printableRef = useRef<HTMLDivElement>(null);
  
  // Cold storage service instance
  const coldStorageService = ColdStorageService.getInstance();
  
  // Handle format selection
  const handleFormatSelect = (format: ColdStorageFormat) => {
    setSelectedFormat(format);
  };
  
  // Generate backup based on selected format
  const generateBackup = async () => {
    try {
      setError(null);
      setLoading(true);
      
      // Validate password if using QR code
      if (selectedFormat === ColdStorageFormat.QR_CODE) {
        if (!password) {
          throw new Error('Password is required for QR code backup');
        }
        
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }
        
        if (password.length < 8) {
          throw new Error('Password must be at least 8 characters long');
        }
      }
      
      // Generate backup based on format
      switch (selectedFormat) {
        case ColdStorageFormat.QR_CODE:
          const qrCodeData = await coldStorageService.generateQRCode(
            secretPhrase,
            password,
            {
              keyId,
              walletName,
              blockchain,
              format: 'dataURL',
              errorCorrectionLevel: 'H'
            }
          );
          setQrCode(qrCodeData);
          break;
          
        case ColdStorageFormat.PAPER_KEY:
          const paperKeyData = coldStorageService.generatePaperKey(
            secretPhrase,
            {
              keyId,
              walletName,
              blockchain,
              includeWordNumbers: true
            }
          );
          setPaperKey(paperKeyData);
          break;
          
        case ColdStorageFormat.METAL_BACKUP:
          const metalBackupData = coldStorageService.generateMetalBackup(
            secretPhrase,
            {
              keyId,
              walletName
            }
          );
          setMetalBackup(metalBackupData);
          break;
          
        default:
          throw new Error(`Unsupported backup format: ${selectedFormat}`);
      }
      
      setGenerated(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };
  
  // Print the backup
  const printBackup = () => {
    if (printableRef.current) {
      const printContents = printableRef.current.innerHTML;
      const originalContents = document.body.innerHTML;
      
      document.body.innerHTML = printContents;
      window.print();
      document.body.innerHTML = originalContents;
      
      // Reload page to reinitialize React components
      window.location.reload();
    }
  };
  
  // Verify the backup
  const verifyBackup = () => {
    // In a real implementation, this would verify the backup by:
    // 1. For QR code: Scanning it and checking the checksum
    // 2. For paper key: Having the user enter specific words to verify
    // 3. For metal backup: Confirming the word indices
    
    // For this demo, we'll just set verified to true
    setVerified(true);
  };
  
  // Complete the backup process
  const completeBackup = () => {
    const backupData = {
      format: selectedFormat,
      verified,
      timestamp: new Date().toISOString()
    };
    
    onComplete(backupData);
  };
  
  // Render format selection
  const renderFormatSelection = () => (
    <div className="format-selection">
      <h3>Choose Backup Format</h3>
      <p>Select how you want to back up your secret phrase:</p>
      
      <div className="format-options">
        <div 
          className={`format-option ${selectedFormat === ColdStorageFormat.QR_CODE ? 'selected' : ''}`}
          onClick={() => handleFormatSelect(ColdStorageFormat.QR_CODE)}
        >
          <h4>QR Code</h4>
          <p>Encrypted QR code for secure scanning</p>
        </div>
        
        <div 
          className={`format-option ${selectedFormat === ColdStorageFormat.PAPER_KEY ? 'selected' : ''}`}
          onClick={() => handleFormatSelect(ColdStorageFormat.PAPER_KEY)}
        >
          <h4>Paper Backup</h4>
          <p>Printable backup with numbered words</p>
        </div>
        
        <div 
          className={`format-option ${selectedFormat === ColdStorageFormat.METAL_BACKUP ? 'selected' : ''}`}
          onClick={() => handleFormatSelect(ColdStorageFormat.METAL_BACKUP)}
        >
          <h4>Metal Backup</h4>
          <p>Instructions for engraving on metal</p>
        </div>
      </div>
      
      {selectedFormat === ColdStorageFormat.QR_CODE && (
        <div className="password-section">
          <p>Your QR code will be encrypted with a password:</p>
          
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Strong password"
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
        </div>
      )}
      
      <div className="action-buttons">
        <button type="button" onClick={onCancel} className="cancel-button">
          Cancel
        </button>
        <button 
          type="button" 
          onClick={generateBackup} 
          className="generate-button"
          disabled={loading || (selectedFormat === ColdStorageFormat.QR_CODE && (password.length < 8 || password !== confirmPassword))}
        >
          {loading ? 'Generating...' : 'Generate Backup'}
        </button>
      </div>
    </div>
  );
  
  // Render QR code backup
  const renderQrCodeBackup = () => (
    <div className="qr-code-backup">
      <h3>QR Code Backup</h3>
      <p>Scan this QR code to recover your wallet:</p>
      
      <div className="printable-area" ref={printableRef}>
        <div className="qr-code-container">
          {qrCode && <img src={qrCode} alt="Backup QR Code" />}
          <div className="qr-code-info">
            <p><strong>Wallet:</strong> {walletName || 'My Wallet'}</p>
            <p><strong>Blockchain:</strong> {blockchain || 'Multiple'}</p>
            <p><strong>Date:</strong> {new Date().toLocaleDateString()}</p>
          </div>
        </div>
        
        <div className="backup-instructions">
          <h4>Recovery Instructions</h4>
          <ol>
            <li>Scan this QR code with your wallet app</li>
            <li>Enter your encryption password</li>
            <li>Follow the app's recovery process</li>
          </ol>
          <p className="warning">Keep this backup in a safe place! Anyone with this QR code and your password can access your funds.</p>
        </div>
      </div>
      
      <div className="backup-actions">
        <button type="button" onClick={printBackup} className="print-button">
          Print
        </button>
        <button type="button" onClick={verifyBackup} className="verify-button" disabled={verified}>
          {verified ? 'Verified' : 'Verify'}
        </button>
      </div>
      
      <div className="action-buttons">
        <button type="button" onClick={() => setGenerated(false)} className="back-button">
          Back
        </button>
        <button 
          type="button" 
          onClick={completeBackup} 
          className="complete-button"
          disabled={!verified}
        >
          Complete Backup
        </button>
      </div>
    </div>
  );
  
  // Render paper key backup
  const renderPaperKeyBackup = () => (
    <div className="paper-key-backup">
      <h3>Paper Backup</h3>
      <p>Print these recovery words:</p>
      
      <div className="printable-area" ref={printableRef}>
        <div className="paper-key-container">
          <pre className="paper-key">{paperKey}</pre>
        </div>
      </div>
      
      <div className="backup-actions">
        <button type="button" onClick={printBackup} className="print-button">
          Print
        </button>
        <button type="button" onClick={verifyBackup} className="verify-button" disabled={verified}>
          {verified ? 'Verified' : 'Verify'}
        </button>
      </div>
      
      <div className="action-buttons">
        <button type="button" onClick={() => setGenerated(false)} className="back-button">
          Back
        </button>
        <button 
          type="button" 
          onClick={completeBackup} 
          className="complete-button"
          disabled={!verified}
        >
          Complete Backup
        </button>
      </div>
    </div>
  );
  
  // Render metal backup
  const renderMetalBackup = () => (
    <div className="metal-backup">
      <h3>Metal Backup</h3>
      <p>Engrave these words on metal:</p>
      
      <div className="printable-area" ref={printableRef}>
        <div className="metal-backup-container">
          <h4>Words to Engrave</h4>
          <table className="word-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Word</th>
              </tr>
            </thead>
            <tbody>
              {metalBackup && metalBackup.words.map((item: any) => (
                <tr key={item.index}>
                  <td>{item.index}</td>
                  <td>{item.word}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <h4>Checksum Words</h4>
          <table className="checksum-table">
            <thead>
              <tr>
                <th>Position</th>
                <th>Word</th>
              </tr>
            </thead>
            <tbody>
              {metalBackup && metalBackup.checksumWords.map((item: any) => (
                <tr key={item.index}>
                  <td>{item.index}</td>
                  <td>{item.word}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="metal-backup-instructions">
            <h4>Engraving Instructions</h4>
            <ol>
              <li>Use a metal plate (steel or titanium is recommended)</li>
              <li>Engrave the position number and corresponding word</li>
              <li>Include the checksum words for verification</li>
              <li>Store in a fireproof and waterproof location</li>
            </ol>
            <p className="warning">This backup is not encrypted! Anyone with access to it can potentially access your funds.</p>
          </div>
        </div>
      </div>
      
      <div className="backup-actions">
        <button type="button" onClick={printBackup} className="print-button">
          Print Instructions
        </button>
        <button type="button" onClick={verifyBackup} className="verify-button" disabled={verified}>
          {verified ? 'Verified' : 'Verify'}
        </button>
      </div>
      
      <div className="action-buttons">
        <button type="button" onClick={() => setGenerated(false)} className="back-button">
          Back
        </button>
        <button 
          type="button" 
          onClick={completeBackup} 
          className="complete-button"
          disabled={!verified}
        >
          Complete Backup
        </button>
      </div>
    </div>
  );
  
  return (
    <div className="cold-storage-generator">
      <h2>Create Cold Storage Backup</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {!generated ? (
        renderFormatSelection()
      ) : (
        <>
          {selectedFormat === ColdStorageFormat.QR_CODE && renderQrCodeBackup()}
          {selectedFormat === ColdStorageFormat.PAPER_KEY && renderPaperKeyBackup()}
          {selectedFormat === ColdStorageFormat.METAL_BACKUP && renderMetalBackup()}
        </>
      )}
    </div>
  );
};

// src/components/security/SecurityDashboard.tsx
import React, { useState, useEffect } from 'react';
import { SecureVault, VaultStatus, VaultSecurityLevel } from '../../services/vault/SecureVault';
import { VaultClient } from '../../services/vault/VaultClient';

/**
 * Dashboard for security settings and key management
 */
const SecurityDashboard: React.FC = () => {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [keys, setKeys] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masterPassword, setMasterPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [isInitializing, setIsInitializing] = useState(false);
  const [securityLevel, setSecurityLevel] = useState<VaultSecurityLevel>(VaultSecurityLevel.STANDARD);
  
  // Vault client
  const vaultClient = new VaultClient();
  
  // Load dashboard data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Wait for vault client to be ready
        await vaultClient.waitForReady();
        
        // Get vault status
        const vaultStatus = await vaultClient.getStatus();
        setStatus(vaultStatus);
        
        // If vault is unlocked, load keys and audit log
        if (vaultStatus && !vaultStatus.locked) {
          const vaultKeys = await vaultClient.getKeys();
          const vaultAuditLog = await vaultClient.getAuditLog(100);
          
          setKeys(vaultKeys);
          setAuditLog(vaultAuditLog);
        }
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };
    
    loadData();
  }, []);
  
  // Initialize vault
  const initializeVault = async () => {
    try {
      setIsInitializing(true);
      setError(null);
      
      // Validate password
      if (masterPassword.length < 8) {
        throw new Error('Master password must be at least 8 characters long');
      }
      
      // Initialize vault
      const success = await vaultClient.initialize(masterPassword, securityLevel);
      
      if (!success) {
        throw new Error('Failed to initialize vault');
      }
      
      // Update status
      const vaultStatus = await vaultClient.getStatus();
      setStatus(vaultStatus);
      
      setIsInitializing(false);
      setMasterPassword('');
    } catch (err: any) {
      setError(err.message);
      setIsInitializing(false);
    }
  };
  
  // Unlock vault
  const unlockVault = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Unlock vault
      const success = await vaultClient.unlock(masterPassword, mfaCode || undefined);
      
      if (!success) {
        throw new Error('Failed to unlock vault');
      }
      
      // Update status
      const vaultStatus = await vaultClient.getStatus();
      setStatus(vaultStatus);
      
      // Load keys and audit log
      if (vaultStatus && !vaultStatus.locked) {
        const vaultKeys = await vaultClient.getKeys();
        const vaultAuditLog = await vaultClient.getAuditLog(100);
        
        setKeys(vaultKeys);
        setAuditLog(vaultAuditLog);
      }
      
      setLoading(false);
      setMasterPassword('');
      setMfaCode('');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };
  
  // Lock vault
  const lockVault = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Lock vault
      await vaultClient.lock();
      
      // Update status
      const vaultStatus = await vaultClient.getStatus();
      setStatus(vaultStatus);
      
      // Clear keys and audit log
      setKeys([]);
      setAuditLog([]);
      
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };
  
  // Render initialization form
  const renderInitializationForm = () => (
    <div className="initialization-form">
      <h3>Initialize Secure Vault</h3>
      <p>Create a master password to secure your keys:</p>
      
      <div className="form-group">
        <label htmlFor="masterPassword">Master Password:</label>
        <input
          type="password"
          id="masterPassword"
          value={masterPassword}
          onChange={(e) => setMasterPassword(e.target.value)}
          placeholder="Strong master password"
        />
      </div>
      
      <div className="form-group">
        <label htmlFor="securityLevel">Security Level:</label>
        <select
          id="securityLevel"
          value={securityLevel}
          onChange={(e) => setSecurityLevel(e.target.value as VaultSecurityLevel)}
        >
          <option value={VaultSecurityLevel.STANDARD}>Standard</option>
          <option value={VaultSecurityLevel.HIGH}>High</option>
          <option value={VaultSecurityLevel.MAXIMUM}>Maximum (with biometrics)</option>
        </select>
      </div>
      
      <div className="password-strength">
        <p>Password strength:</p>
        <div 
          className={`strength-meter ${
            masterPassword.length === 0 ? '' :
            masterPassword.length < 8 ? 'weak' :
            masterPassword.length < 12 ? 'medium' : 'strong'
          }`}
        ></div>
        <p className="strength-label">
          {masterPassword.length === 0 ? 'Enter a password' :
           masterPassword.length < 8 ? 'Weak' :
           masterPassword.length < 12 ? 'Medium' : 'Strong'}
        </p>
      </div>
      
      <button 
        type="button" 
        onClick={initializeVault} 
        className="initialize-button"
        disabled={isInitializing || masterPassword.length < 8}
      >
        {isInitializing ? 'Initializing...' : 'Initialize Vault'}
      </button>
    </div>
  );
  
  // Render unlock form
  const renderUnlockForm = () => (
    <div className="unlock-form">
      <h3>Unlock Secure Vault</h3>
      <p>Enter your master password to access your keys:</p>
      
      <div className="form-group">
        <label htmlFor="masterPassword">Master Password:</label>
        <input
          type="password"
          id="masterPassword"
          value={masterPassword}
          onChange={(e) => setMasterPassword(e.target.value)}
          placeholder="Master password"
        />
      </div>
      
      {status && status.mfaEnabled && (
        <div className="form-group">
          <label htmlFor="mfaCode">MFA Code:</label>
          <input
            type="text"
            id="mfaCode"
            value={mfaCode}
            onChange={(e) => setMfaCode(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
          />
        </div>
      )}
      
      <button 
        type="button" 
        onClick={unlockVault} 
        className="unlock-button"
        disabled={loading || !masterPassword}
      >
        {loading ? 'Unlocking...' : 'Unlock Vault'}
      </button>
    </div>
  );
  
  // Render overview tab
  const renderOverviewTab = () => (
    <div className="overview-tab">
      <h3>Security Overview</h3>
      
      <div className="status-cards">
        <div className="status-card">
          <h4>Vault Status</h4>
          <p className={`status ${status && !status.locked ? 'active' : 'inactive'}`}>
            {status && !status.locked ? 'Unlocked' : 'Locked'}
          </p>
          {status && !status.locked && (
            <button type="button" onClick={lockVault} className="lock-button">
              Lock Vault
            </button>
          )}
        </div>
        
        <div className="status-card">
          <h4>Security Level</h4>
          <p className={`level ${
            status && status.mfaEnabled ? 'maximum' : 
            'standard'
          }`}>
            {status && status.mfaEnabled ? 'Maximum' : 'Standard'}
          </p>
        </div>
        
        <div className="status-card">
          <h4>Hardware Protection</h4>
          <p className={`status ${status && status.hardwareProtection ? 'active' : 'inactive'}`}>
            {status && status.hardwareProtection ? 'Enabled' : 'Not Available'}
          </p>
        </div>
        
        <div className="status-card">
          <h4>Stored Keys</h4>
          <p className="count">{status ? status.keyCount : 0}</p>
        </div>
      </div>
      
      <div className="activity-section">
        <h4>Recent Activity</h4>
        {auditLog.length > 0 ? (
          <div className="activity-list">
            {auditLog.slice(0, 5).map((entry) => (
              <div key={entry.id} className="activity-item">
                <span className={`activity-type ${entry.action}`}>{entry.action}</span>
                <span className="activity-time">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
                <span className={`activity-status ${entry.successful ? 'success' : 'failed'}`}>
                  {entry.successful ? 'Success' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="no-activity">No recent activity</p>
        )}
      </div>
    </div>
  );
  
  // Render keys tab
  const renderKeysTab = () => (
    <div className="keys-tab">
      <h3>Stored Keys</h3>
      
      {keys.length > 0 ? (
        <div className="keys-list">
          {keys.map((key) => (
            <div key={key.id} className="key-item">
              <div className="key-header">
                <h4>{key.name}</h4>
                <span className="key-type">{key.type}</span>
              </div>
              
              <div className="key-details">
                <p><strong>Blockchain:</strong> {key.blockchain}</p>
                <p><strong>Created:</strong> {new Date(key.createdAt).toLocaleDateString()}</p>
                {key.accessedAt && (
                  <p><strong>Last Used:</strong> {new Date(key.accessedAt).toLocaleDateString()}</p>
                )}
                <p>
                  <strong>Security:</strong> 
                  <span className={`security-level ${key.metadata.hardwareProtected ? 'high' : 'standard'}`}>
                    {key.metadata.hardwareProtected ? 'Hardware Protected' : 'Standard'}
                  </span>
                </p>
                <p>
                  <strong>Backup:</strong> 
                  <span className={`backup-status ${key.metadata.isBackedUp ? 'backed-up' : 'not-backed-up'}`}>
                    {key.metadata.isBackedUp ? 'Backed Up' : 'Not Backed Up'}
                  </span>
                </p>
              </div>
              
              <div className="key-actions">
                <button type="button" className="key-action sign">Sign</button>
                {key.policy.allowExport && (
                  <button type="button" className="key-action export">Export</button>
                )}
                <button type="button" className="key-action delete">Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-keys">No keys stored in vault</p>
      )}
      
      <button type="button" className="add-key-button">
        Add New Key
      </button>
    </div>
  );
  
  // Render audit tab
  const renderAuditTab = () => (
    <div className="audit-tab">
      <h3>Audit Log</h3>
      
      {auditLog.length > 0 ? (
        <table className="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Action</th>
              <th>Key</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {auditLog.map((entry) => (
              <tr key={entry.id} className={entry.successful ? 'success' : 'failed'}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td className={`action-type ${entry.action}`}>{entry.action}</td>
                <td>{entry.keyId || '-'}</td>
                <td>{entry.successful ? 'Success' : 'Failed'}</td>
                <td>{entry.metadata.reason || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="no-audit">No audit log entries</p>
      )}
    </div>
  );
  
  return (
    <div className="security-dashboard">
      <h2>Security Dashboard</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {loading && !status ? (
        <div className="loading">Loading security information...</div>
      ) : (
        <>
          {status && !status.initialized ? (
            renderInitializationForm()
          ) : status && status.locked ? (
            renderUnlockForm()
          ) : (
            <>
              <div className="dashboard-tabs">
                <button 
                  className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
                  onClick={() => setActiveTab('overview')}
                >
                  Overview
                </button>
                <button 
                  className={`tab-button ${activeTab === 'keys' ? 'active' : ''}`}
                  onClick={() => setActiveTab('keys')}
                >
                  Keys
                </button>
                <button 
                  className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
                  onClick={() => setActiveTab('audit')}
                >
                  Audit Log
                </button>
              </div>
              
              <div className="tab-content">
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'keys' && renderKeysTab()}
                {activeTab === 'audit' && renderAuditTab()}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

export { RecoverySetupWizard, ColdStorageGenerator, SecurityDashboard };