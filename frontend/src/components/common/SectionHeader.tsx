import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  eyebrow?: string
  actions?: ReactNode
  className?: string
}

export function SectionHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-[#26364A] pb-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#38BDF8]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#F8FAFC]">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-xs text-[#94A3B8]">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}
