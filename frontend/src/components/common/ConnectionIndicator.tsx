import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import type { BackendConnectionState } from '@/hooks/useBackendHealth'
import { cn } from '@/lib/utils'

interface ConnectionIndicatorProps {
  state: BackendConnectionState
  onRefresh?: () => void
  className?: string
}

export function ConnectionIndicator({ state, onRefresh, className }: ConnectionIndicatorProps) {
  const isConnected = state === 'connected'
  const isChecking = state === 'checking'

  return (
    <button
      type="button"
      onClick={onRefresh}
      title={
        isConnected
          ? 'Connected to SENTRA_api (/api/health) — click to refresh'
          : isChecking
            ? 'Checking SENTRA_api (/api/health)...'
            : 'SENTRA_api offline — click to retry'
      }
      className={cn(
        'inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
        isConnected
          ? 'border-[#22C55E]/30 bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/15'
          : isChecking
            ? 'border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#38BDF8]'
            : 'border-[#EF4444]/35 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/15',
        className,
      )}
    >
      {isChecking ? (
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
      ) : isConnected ? (
        <Wifi className="h-3.5 w-3.5" />
      ) : (
        <WifiOff className="h-3.5 w-3.5" />
      )}
      <span className="font-telemetry uppercase tracking-wider text-[11px]">
        {isChecking ? 'SYNCING' : isConnected ? 'ENGINE ONLINE' : 'ENGINE OFFLINE'}
      </span>
    </button>
  )
}
