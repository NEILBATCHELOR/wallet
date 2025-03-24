// src/context/ToastContext.tsx
import { createContext, useContext, useState, ReactNode } from "react"

type ToastType = "success" | "error" | "warning" | "info"

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type: ToastType) => void
  removeToast: (id: string) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  function addToast(message: string, type: ToastType = "info") {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast = { id, type, message }
    setToasts(current => [...current, newToast])
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id)
    }, 5000)
  }

  function removeToast(id: string) {
    setToasts(current => current.filter(toast => toast.id !== id))
  }

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
          {toasts.map(toast => (
            <div 
              key={toast.id}
              className={`p-4 rounded shadow-lg max-w-md flex justify-between items-center animate-fade-in ${
                toast.type === "success" ? "bg-green-500 text-white" :
                toast.type === "error" ? "bg-red-500 text-white" :
                toast.type === "warning" ? "bg-yellow-500 text-black" :
                "bg-blue-500 text-white"
              }`}
            >
              <p>{toast.message}</p>
              <button 
                onClick={() => removeToast(toast.id)}
                className="ml-4 text-sm opacity-70 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error("useToast must be used within a ToastProvider")
  }
  return context
}