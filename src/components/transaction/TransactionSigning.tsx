// src/components/transactions/TransactionSigning.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { HardwareWalletSecurity, SecurityMethod } from "@/services/security/HardwareWalletSecurity"
import { SecureBlockchainAdapter } from "@/adapters/security/SecureBlockchainAdapter"
import { BlockchainAdapterFactory } from "@/core/BlockchainAdapterFactory"
import { LedgerTransactionSigner } from "@/components/ledger/LedgerTransactionSigner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { SecureVaultClient } from "@/services/vault/SecureVaultClient"
import { TransactionStatus } from "@/core/interfaces"

interface TransactionSigningProps {
  transactionId: string
  walletId: string
  proposalData: any
  onComplete: (txHash: string) => void
  onCancel: () => void
}

function TransactionSigning({
  transactionId,
  walletId,
  proposalData,
  onComplete,
  onCancel,
}: TransactionSigningProps) {
  const [securityMethod, setSecurityMethod] = useState<SecurityMethod | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [securityReport, setSecurityReport] = useState<any>(null)
  const [signStep, setSignStep] = useState<"select" | "hardware" | "vault" | "review" | "confirm">("select")
  const [hardwarePath, setHardwarePath] = useState<string>("")
  const [signResult, setSignResult] = useState<any>(null)

  const hwSecurity = HardwareWalletSecurity.getInstance()
  const vaultClient = new SecureVaultClient()

  // Analyze transaction for security issues
  async function analyzeTransaction() {
    try {
      setIsLoading(true)
      setError(null)

      // Get secure adapter for the blockchain
      const adapter = SecureBlockchainAdapter.createSecureAdapter(proposalData.blockchain)
      
      // Analyze transaction based on blockchain
      let report
      if (proposalData.blockchain.startsWith("ethereum") ||
          proposalData.blockchain.startsWith("polygon") ||
          proposalData.blockchain.startsWith("avalanche") ||
          proposalData.blockchain.startsWith("optimism") ||
          proposalData.blockchain.startsWith("arbitrum") ||
          proposalData.blockchain.startsWith("base")) {
        report = await hwSecurity.analyzeEthereumTransaction(proposalData.raw)
      } else if (proposalData.blockchain.startsWith("bitcoin")) {
        report = await hwSecurity.analyzeBitcoinTransaction(proposalData.raw)
      } else if (proposalData.blockchain.startsWith("solana")) {
        report = await hwSecurity.analyzeSolanaTransaction(proposalData.raw)
      }

      setSecurityReport(report)
      setSignStep("review")
    } catch (err: any) {
      setError(err.message || "Failed to analyze transaction")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle hardware wallet signing
  async function handleHardwareSigning(signature: string) {
    try {
      setIsLoading(true)
      setError(null)
      
      // Create transaction with signature
      const adapter = SecureBlockchainAdapter.createSecureAdapter(proposalData.blockchain)
      const signedTx = await adapter.combineSignatures(proposalData.raw, [signature])
      
      // Update transaction in database
      await fetch(`/api/transactions/${transactionId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          signature,
          securityMethod: SecurityMethod.HARDWARE_WALLET,
          hardwarePath
        })
      })
      
      setSignResult({ signature, txStatus: TransactionStatus.PENDING })
      setSignStep("confirm")
    } catch (err: any) {
      setError(err.message || "Failed to sign with hardware wallet")
    } finally {
      setIsLoading(false)
    }
  }

  // Handle vault signing
  async function handleVaultSigning(password: string) {
    try {
      setIsLoading(true)
      setError(null)
      
      // Sign with vault
      const result = await vaultClient.signWithKey(
        proposalData.keyId,
        JSON.stringify(proposalData.raw),
        password,
        { reason: `Sign transaction ${transactionId}` }
      )
      
      // Update transaction in database
      await fetch(`/api/transactions/${transactionId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          signature: result,
          securityMethod: SecurityMethod.LOCAL_PRIVATE_KEY
        })
      })
      
      setSignResult({ signature: result, txStatus: TransactionStatus.PENDING })
      setSignStep("confirm")
    } catch (err: any) {
      setError(err.message || "Failed to sign with vault")
    } finally {
      setIsLoading(false)
    }
  }

  // Execute transaction after signing
  async function executeTransaction() {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch(`/api/transactions/${transactionId}/execute`, {
        method: "POST"
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to execute transaction")
      }
      
      const data = await response.json()
      onComplete(data.txHash)
    } catch (err: any) {
      setError(err.message || "Failed to execute transaction")
    } finally {
      setIsLoading(false)
    }
  }

  // Render method selection
  function renderMethodSelection() {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Select Signing Method</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            className="h-24 flex flex-col items-center justify-center" 
            onClick={() => {
              setSecurityMethod(SecurityMethod.HARDWARE_WALLET)
              setSignStep("hardware")
            }}
          >
            <span className="text-lg mb-2">Hardware Wallet</span>
            <span className="text-sm text-muted-foreground">Sign with Ledger or Trezor</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-24 flex flex-col items-center justify-center"
            onClick={() => {
              setSecurityMethod(SecurityMethod.LOCAL_PRIVATE_KEY)
              setSignStep("vault")
            }}
          >
            <span className="text-lg mb-2">Secure Vault</span>
            <span className="text-sm text-muted-foreground">Sign with local key</span>
          </Button>
        </div>
        
        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={onCancel} className="mr-2">
            Cancel
          </Button>
          <Button onClick={analyzeTransaction}>
            Continue
          </Button>
        </div>
      </div>
    )
  }

  // Render transaction review
  function renderTransactionReview() {
    if (!securityReport) return null
    
    const riskColor = {
      low: "text-green-600",
      medium: "text-yellow-600",
      high: "text-orange-600",
      critical: "text-red-600"
    }
    
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-medium">Review Transaction</h3>
        
        <Alert variant={securityReport.riskLevel === "critical" ? "destructive" : "default"}>
          <AlertTitle>Risk Level: <span className={riskColor[securityReport.riskLevel]}>{securityReport.riskLevel.toUpperCase()}</span></AlertTitle>
          <AlertDescription>
            {securityReport.warnings.length > 0 ? (
              <ul className="list-disc pl-5 mt-2">
                {securityReport.warnings.map((warning, i) => (
                  <li key={i}>{warning}</li>
                ))}
              </ul>
            ) : "No security warnings detected."}
          </AlertDescription>
        </Alert>
        
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="font-medium mb-2">Transaction Details</h4>
          <div className="grid grid-cols-1 gap-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Recipient:</span>
              <span className="font-mono">{proposalData.toAddress}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span>{proposalData.amount} {proposalData.tokenSymbol || proposalData.blockchain}</span>
            </div>
            {proposalData.data && proposalData.data !== "0x" && (
              <div className="flex justify-between">
                <span className="text-gray-600">Data:</span>
                <span className="font-mono truncate max-w-[200px]">{proposalData.data}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Transaction Type:</span>
              <span>{securityReport.transactionType}</span>
            </div>
          </div>
        </div>
        
        {securityReport.recommendations.length > 0 && (
          <div className="bg-blue-50 p-4 rounded-md">
            <h4 className="font-medium mb-2">Recommendations</h4>
            <ul className="list-disc pl-5">
              {securityReport.recommendations.map((rec, i) => (
                <li key={i}>{rec}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="flex justify-end mt-6">
          <Button variant="outline" onClick={() => setSignStep("select")} className="mr-2">
            Back
          </Button>
          <Button 
            onClick={() => setSignStep(securityMethod === SecurityMethod.HARDWARE_WALLET ? "hardware" : "vault")}
            disabled={securityReport.riskLevel === "critical"}
          >
            Proceed to Signing
          </Button>
        </div>
      </div>
    )
  }

  // Based on the selected method and step, render the appropriate component
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign Transaction Proposal</CardTitle>
        <CardDescription>
          Sign transaction proposal for {proposalData.title}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-800 rounded-md border border-red-200">
            {error}
          </div>
        )}
        
        {signStep === "select" && renderMethodSelection()}
        {signStep === "review" && renderTransactionReview()}
        
        {signStep === "hardware" && (
          <LedgerTransactionSigner
            appType={proposalData.blockchain.startsWith("ethereum") ? "ethereum" : 
                    proposalData.blockchain.startsWith("bitcoin") ? "bitcoin" : "solana"}
            transaction={proposalData.raw}
            onSignComplete={handleHardwareSigning}
            onCancel={() => setSignStep("select")}
          />
        )}
        
        {signStep === "vault" && (
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Sign with Secure Vault</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="vault-password" className="block text-sm font-medium">
                  Vault Password
                </label>
                <input
                  id="vault-password"
                  type="password"
                  className="w-full p-2 border rounded-md"
                  placeholder="Enter your vault password"
                />
              </div>
              
              <div className="flex justify-end mt-6">
                <Button variant="outline" onClick={() => setSignStep("select")} className="mr-2">
                  Back
                </Button>
                <Button onClick={() => handleVaultSigning("password-value")}>
                  Sign Transaction
                </Button>
              </div>
            </div>
          </div>
        )}
        
        {signStep === "confirm" && (
          <div className="space-y-4">
            <div className="bg-green-50 p-4 rounded-md text-green-800">
              <h3 className="font-medium mb-2">Transaction Signed Successfully</h3>
              <p>Your signature has been added to the transaction.</p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-md">
              <h4 className="font-medium mb-2">Next Steps</h4>
              <p>
                This transaction requires {proposalData.threshold} signatures. 
                {proposalData.signatures.length + 1 >= proposalData.threshold 
                  ? " All required signatures have been collected." 
                  : ` ${proposalData.threshold - proposalData.signatures.length - 1} more signature(s) needed.`}
              </p>
            </div>
            
            <div className="flex justify-end mt-6">
              <Button variant="outline" onClick={onCancel} className="mr-2">
                Close
              </Button>
              {proposalData.signatures.length + 1 >= proposalData.threshold && (
                <Button onClick={executeTransaction} disabled={isLoading}>
                  {isLoading ? "Executing..." : "Execute Transaction"}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { TransactionSigning }