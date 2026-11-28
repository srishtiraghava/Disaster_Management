import type { ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type MetricAccent = 'cyan' | 'green' | 'amber' | 'red' | 'indigo' | 'neutral'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  accent?: MetricAccent
  badge?: ReactNode
  className?: string
}

const accentStyles: Record<MetricAccent, string> = {
  cyan: 'border-t-2 border-t-[#38BDF8] hover:border-[#38BDF8]/50',
  green: 'border-t-2 border-t-[#22C55E] hover:border-[#22C55E]/50',
  amber: 'border-t-2 border-t-[#F59E0B] hover:border-[#F59E0B]/50',
  red: 'border-t-2 border-t-[#EF4444] hover:border-[#EF4444]/50',
  indigo: 'border-t-2 border-t-[#6366F1] hover:border-[#6366F1]/50',
  neutral: 'hover:border-[#38BDF8]/40',
}

const iconBgStyles: Record<MetricAccent, string> = {
  cyan: 'bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/25',
  green: 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/25',
  amber: 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/25',
  red: 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/25',
  indigo: 'bg-[#6366F1]/10 text-[#818CF8] border-[#6366F1]/25',
  neutral: 'bg-[#19283B] text-[#94A3B8] border-[#26364A]',
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon,
  accent = 'cyan',
  badge,
  className,
}: MetricCardProps) {
  return (
    <Card className={cn('p-4 transition-all duration-150', accentStyles[accent], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            {title}
          </p>
          <div className="mt-2 flex items-baseline gap-2.5">
            <span className="font-telemetry text-2xl font-semibold tracking-tight text-[#F8FAFC]">
              {value}
            </span>
            {badge}
          </div>
          {subtitle ? (
            <p className="mt-1.5 truncate text-xs text-[#94A3B8]">{subtitle}</p>
          ) : null}
        </div>
        {icon ? (
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border',
              iconBgStyles[accent],
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  )
}
