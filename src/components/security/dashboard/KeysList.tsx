// src/components/security/dashboard/KeysList.tsx
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  ShieldCheck, 
  KeyRound, 
  Clock, 
  FileText, 
  ArrowUpFromLine, 
  Trash2 
} from 'lucide-react'

interface KeysListProps {
  keys: Array<{
    id: string
    name: string
    type: string
    blockchain: string
    createdAt: string
    accessedAt?: string
    policy: {
      allowExport: boolean
    }
    metadata: {
      hardwareProtected: boolean
      isBackedUp: boolean
    }
  }>
}

function KeysList({ keys }: KeysListProps) {
  if (!keys.length) {
    return (
      <div className="text-center p-8">
        <KeyRound className="mx-auto h-12 w-12 text-muted-foreground opacity-50" />
        <h3 className="mt-4 text-lg font-medium">No keys stored in vault</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Add a new key to get started with secure key management
        </p>
        <Button className="mt-4">Add New Key</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        {keys.map((key) => (
          <KeyCard key={key.id} keyData={key} />
        ))}
      </div>
      
      <div className="flex justify-center">
        <Button className="w-full sm:w-auto">
          Add New Key
        </Button>
      </div>
    </div>
  )
}

interface KeyCardProps {
  keyData: {
    id: string
    name: string
    type: string
    blockchain: string
    createdAt: string
    accessedAt?: string
    policy: {
      allowExport: boolean
    }
    metadata: {
      hardwareProtected: boolean
      isBackedUp: boolean
    }
  }
}

function KeyCard({ keyData }: KeyCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg">{keyData.name}</CardTitle>
            <Badge variant="outline" className="mt-1">
              {keyData.type}
            </Badge>
          </div>
          {keyData.metadata.hardwareProtected && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              Hardware Protected
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-muted-foreground">Blockchain:</span>
            <span className="ml-2 font-medium">{keyData.blockchain}</span>
          </div>
          
          <div>
            <span className="text-muted-foreground">Created:</span>
            <span className="ml-2 font-medium">
              {new Date(keyData.createdAt).toLocaleDateString()}
            </span>
          </div>
          
          {keyData.accessedAt && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Last Used:</span>
              <span className="ml-2 font-medium">
                {new Date(keyData.accessedAt).toLocaleDateString()}
              </span>
            </div>
          )}
          
          <div className="col-span-2 mt-1">
            <Badge 
              variant={keyData.metadata.isBackedUp ? "success" : "destructive"} 
              className="flex w-fit items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              {keyData.metadata.isBackedUp ? "Backed Up" : "Not Backed Up"}
            </Badge>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end gap-2 pt-2">
        <Button size="sm" variant="outline">
          Sign
        </Button>
        
        {keyData.policy.allowExport && (
          <Button size="sm" variant="outline" className="flex items-center gap-1">
            <ArrowUpFromLine className="h-4 w-4" />
            Export
          </Button>
        )}
        
        <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardFooter>
    </Card>
  )
}

export { KeysList }