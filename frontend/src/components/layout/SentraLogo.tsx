import { cn } from '@/lib/utils'

interface SentraLogoProps {
  collapsed?: boolean
  showFullForm?: boolean
  className?: string
}

export function SentraLogo({
  collapsed = false,
  showFullForm = false,
  className,
}: SentraLogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#38BDF8]/35 bg-gradient-to-br from-[#38BDF8]/20 via-[#141F30] to-[#6366F1]/25 shadow-sentra-glow">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-5 w-5 text-[#38BDF8]"
          aria-hidden="true"
        >
          <path
            d="M12 2.5L4.5 5.8V11.6C4.5 16.4 7.7 20.6 12 22C16.3 20.6 19.5 16.4 19.5 11.6V5.8L12 2.5Z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="3.4" stroke="#6366F1" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1.3" fill="currentColor" />
        </svg>
      </div>
      {!collapsed ? (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tracking-[0.14em] text-[#F8FAFC]">
              SENTRA
            </span>
            <span className="rounded border border-[#38BDF8]/30 bg-[#38BDF8]/10 px-1.5 py-0.5 font-telemetry text-[9px] font-semibold uppercase tracking-widest text-[#38BDF8]">
              GRID
            </span>
          </div>
          {showFullForm ? (
            <p className="truncate text-[10px] text-[#94A3B8]">
              Smart Environmental Navigation &amp; Threat Response Architecture
            </p>
          ) : (
            <p className="truncate text-[10px] font-medium tracking-wider text-[#94A3B8]">
              Anticipate. Alert. Protect.
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
