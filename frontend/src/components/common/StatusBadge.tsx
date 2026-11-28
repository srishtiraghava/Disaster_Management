import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusTone = 'online' | 'offline' | 'active' | 'standby' | 'warning' | 'info'

interface StatusBadgeProps {
  tone: StatusTone
  label: string
  pulse?: boolean
  className?: string
}

const toneToVariant: Record<StatusTone, 'success' | 'danger' | 'warning' | 'default' | 'secondary'> = {
  online: 'success',
  active: 'danger',
  offline: 'danger',
  warning: 'warning',
  info: 'default',
  standby: 'secondary',
}

const dotColor: Record<StatusTone, string> = {
  online: 'bg-[#22C55E]',
  active: 'bg-[#EF4444]',
  offline: 'bg-[#EF4444]',
  warning: 'bg-[#F59E0B]',
  info: 'bg-[#38BDF8]',
  standby: 'bg-[#94A3B8]',
}

export function StatusBadge({ tone, label, pulse = false, className }: StatusBadgeProps) {
  return (
    <Badge variant={toneToVariant[tone]} className={cn('font-telemetry', className)}>
      <span className="relative flex h-2 w-2">
        {pulse ? (
          <span
            className={cn(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-75',
              dotColor[tone],
            )}
          />
        ) : null}
        <span className={cn('relative inline-flex h-2 w-2 rounded-full', dotColor[tone])} />
      </span>
      {label}
    </Badge>
  )
}
