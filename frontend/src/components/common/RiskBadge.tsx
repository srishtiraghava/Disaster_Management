import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { RiskClassName } from '@/types/sentra'

interface RiskBadgeProps {
  level: RiskClassName | string
  score?: number
  className?: string
}

export function RiskBadge({ level, score, className }: RiskBadgeProps) {
  const normalized = level.toUpperCase()
  const variant =
    normalized === 'CRITICAL'
      ? 'danger'
      : normalized === 'HIGH'
        ? 'warning'
        : normalized === 'MODERATE'
          ? 'default'
          : normalized === 'LOW'
            ? 'success'
            : 'secondary'

  return (
    <Badge variant={variant} className={cn('font-telemetry', className)}>
      <span>{normalized}</span>
      {typeof score === 'number' ? (
        <span className="opacity-80">· {score.toFixed(1)}</span>
      ) : null}
    </Badge>
  )
}
