// src/components/security/recovery/SuccessView.tsx
import { Button } from '@/components/ui/button'
import { CheckCircle2 } from 'lucide-react'

interface SuccessViewProps {
  onFinish: (data?: any) => void
}

function SuccessView({ onFinish }: SuccessViewProps) {
  return (
    <div className="flex flex-col items-center text-center py-6">
      <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
        <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-300" />
      </div>
      
      <h3 className="text-xl font-medium mt-6 mb-2">
        Recovery Setup Complete
      </h3>
      
      <p className="text-muted-foreground mb-6">
        Your recovery method has been successfully set up.
      </p>
      
      <Button 
        onClick={() => onFinish({})} 
        className="px-8"
      >
        Finish
      </Button>
    </div>
  )
}

export { SuccessView }