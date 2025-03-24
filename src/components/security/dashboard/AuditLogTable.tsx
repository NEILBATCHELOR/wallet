// src/components/security/dashboard/AuditLogTable.tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

interface AuditLogTableProps {
  auditLog: Array<{
    id: string
    timestamp: string
    action: string
    keyId?: string
    successful: boolean
    metadata: {
      reason?: string
    }
  }>
}

function AuditLogTable({ auditLog }: AuditLogTableProps) {
  if (!auditLog.length) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">No audit log entries found</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Time</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {auditLog.map((entry) => (
            <TableRow 
              key={entry.id}
              className={!entry.successful ? "bg-destructive/5" : undefined}
            >
              <TableCell className="font-mono text-xs">
                {new Date(entry.timestamp).toLocaleString()}
              </TableCell>
              <TableCell>
                <ActionBadge action={entry.action} />
              </TableCell>
              <TableCell>{entry.keyId || '-'}</TableCell>
              <TableCell>
                <Badge 
                  variant={entry.successful ? "success" : "destructive"}
                  className="whitespace-nowrap"
                >
                  {entry.successful ? 'Success' : 'Failed'}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {entry.metadata.reason || '-'}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>