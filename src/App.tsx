// src/App.tsx
import { Suspense, useEffect, useState } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { WalletProvider } from "./context/WalletContext"
import { SecureVaultProvider } from "./context/SecureVaultContext"
import { Header } from "./components/layout/Header" 
import { Sidebar } from "./components/layout/Sidebar"
import { WalletList } from "./components/wallet/WalletList"
import { WalletCreator } from "./components/wallet/WalletCreator"
import { WalletDetails } from "./components/wallet/WalletDetails"
import { SecurityDashboard } from "./components/security/SecurityDashboard"
import { RecoverySetupWizard } from "./components/security/RecoverySetupWizard"
import { ColdStorageGenerator } from "./components/security/ColdStorageGenerator"
import { HardwareWalletConnect } from "./components/hardware/HardwareWalletConnect"
import { TransactionCreator } from "./components/transaction/TransactionCreator"
import { TransactionDetails } from "./components/transaction/TransactionDetails"
import { ErrorBoundary } from "./components/common/ErrorBoundary"
import { LoadingSpinner } from "./components/common/LoadingSpinner"
import { ToastProvider } from "./context/ToastContext"
import { VaultClient } from "./services/vault/VaultClient"
import "./styles/main.css"

function App() {
  const [initialized, setInitialized] = useState(false)
  const [loading, setLoading] = useState(true)

  // Initialize vault worker and other services
  useEffect(() => {
    async function initializeServices() {
      try {
        setLoading(true)
        
        // Initialize secure vault worker
        const vaultClient = new VaultClient()
        await vaultClient.waitForReady()
        
        // Check authentication status
        const isAuthenticated = localStorage.getItem("auth_token") !== null
        
        if (!isAuthenticated) {
          // Would redirect to login in a real app
          console.log("Not authenticated, redirecting to login")
        }
        
        setInitialized(true)
        setLoading(false)
      } catch (error) {
        console.error("Failed to initialize services:", error)
        setLoading(false)
      }
    }
    
    initializeServices()
  }, [])

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
        <span className="ml-3 text-lg">Initializing Application...</span>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <SecureVaultProvider>
            <WalletProvider>
              <div className="min-h-screen flex flex-col">
                <Header />
                <div className="flex flex-1 overflow-hidden">
                  <Sidebar />
                  <main className="flex-1 overflow-y-auto p-6">
                    <ErrorBoundary>
                      <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                          <Route path="/" element={<Navigate to="/wallets" replace />} />
                          <Route path="/wallets" element={<WalletList />} />
                          <Route path="/wallets/create" element={<WalletCreator />} />
                          <Route path="/wallets/:id" element={<WalletDetails />} />
                          <Route path="/wallets/:id/transactions/create" element={<TransactionCreator />} />
                          <Route path="/wallets/:id/transactions/:txId" element={<TransactionDetails />} />
                          <Route path="/security" element={<SecurityDashboard />} />
                          <Route path="/security/recovery/:walletId" element={<RecoverySetupWizard />} />
                          <Route path="/security/cold-storage/:keyId" element={<ColdStorageGenerator />} />
                          <Route path="/hardware" element={<HardwareWalletConnect />} />
                          <Route path="*" element={<div>Page Not Found</div>} />
                        </Routes>
                      </Suspense>
                    </ErrorBoundary>
                  </main>
                </div>
              </div>
            </WalletProvider>
          </SecureVaultProvider>
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App