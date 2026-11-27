import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({
  title = 'Backend Telemetry Unavailable',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <Card className="border-[#EF4444]/40 bg-[#141F30] p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#EF4444]/35 bg-[#EF4444]/15 text-[#EF4444]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#F8FAFC]">{title}</h3>
            <p className="mt-1 text-xs text-[#94A3B8]">{message}</p>
          </div>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Connection
          </Button>
        ) : null}
      </div>
    </Card>
  )
}
