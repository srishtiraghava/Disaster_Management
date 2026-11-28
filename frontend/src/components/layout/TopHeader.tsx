import { Bell, ChevronRight, Menu, ShieldAlert, User } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ConnectionIndicator } from '@/components/common/ConnectionIndicator'
import { NAV_ITEMS } from '@/config/navigation'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import { cn } from '@/lib/utils'

interface TopHeaderProps {
  healthResult: BackendHealthResult
  onOpenMobileMenu: () => void
}

export function TopHeader({ healthResult, onOpenMobileMenu }: TopHeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()

  const activeItem =
    NAV_ITEMS.find((item) =>
      item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path),
    ) ?? NAV_ITEMS[0]

  const { state, health, refresh } = healthResult
  const cycle = health?.cycle ?? null
  const globalAlertLevel = health?.globalAlertLevel ?? null
  const hasActiveAlerts = (globalAlertLevel ?? 0) > 0

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-[#26364A] bg-[#101B2B]/95 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Mobile menu + Breadcrumb & Page Title */}
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="Open navigation menu"
          className="rounded-lg border border-[#26364A] bg-[#141F30] p-2 text-[#94A3B8] hover:text-[#F8FAFC] lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#94A3B8]">
            <span className="uppercase tracking-wider text-[#38BDF8]">SENTRA</span>
            <ChevronRight className="h-3 w-3 opacity-60" />
            <span className="hidden uppercase tracking-wider sm:inline">{activeItem.section}</span>
            <ChevronRight className="hidden h-3 w-3 opacity-60 sm:inline" />
            <span className="truncate text-[#F8FAFC]">{activeItem.label}</span>
          </div>
          <h1 className="truncate text-sm font-semibold tracking-tight text-[#F8FAFC] sm:text-base">
            {activeItem.label}
          </h1>
        </div>
      </div>

      {/* Right: Telemetry Telemetry Strip + Connection + Alerts + Profile */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {/* Simulation Status & Cycle */}
        <div className="hidden items-center gap-3 rounded-lg border border-[#26364A] bg-[#141F30] px-3 py-1.5 xl:flex">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#94A3B8]">Sim:</span>
            <span className="font-telemetry font-medium text-[#F8FAFC]">
              {state === 'connected' ? 'READY' : state === 'checking' ? 'SYNC' : 'OFFLINE'}
            </span>
          </div>
          <div className="h-3.5 w-px bg-[#26364A]" />
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#94A3B8]">Cycle:</span>
            <span className="font-telemetry font-semibold text-[#38BDF8]">
              {cycle !== null ? `#${cycle}` : '—'}
            </span>
          </div>
          <div className="h-3.5 w-px bg-[#26364A]" />
          <div className="flex items-center gap-1.5 text-xs">
            <ShieldAlert
              className={cn(
                'h-3.5 w-3.5',
                hasActiveAlerts ? 'text-[#EF4444]' : 'text-[#22C55E]',
              )}
            />
            <span className="text-[#94A3B8]">Alert Lvl:</span>
            <span
              className={cn(
                'font-telemetry font-semibold',
                hasActiveAlerts ? 'text-[#EF4444]' : 'text-[#22C55E]',
              )}
            >
              {globalAlertLevel !== null ? globalAlertLevel : '—'}
            </span>
          </div>
        </div>

        {/* Live Backend Connection Indicator from GET /api/health */}
        <ConnectionIndicator state={state} onRefresh={() => void refresh()} />

        {/* Notification Icon */}
        <button
          type="button"
          onClick={() => navigate('/alerts')}
          title="View Emergency Alerts"
          aria-label="View Emergency Alerts"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-[#26364A] bg-[#141F30] text-[#94A3B8] transition-colors hover:border-[#38BDF8]/40 hover:text-[#F8FAFC]"
        >
          <Bell className="h-4 w-4" />
          {hasActiveAlerts ? (
            <span className="absolute right-1.5 top-1.5 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EF4444] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#EF4444]" />
            </span>
          ) : null}
        </button>

        {/* Operator Profile Placeholder */}
        <div className="hidden items-center gap-2 rounded-lg border border-[#26364A] bg-[#141F30] px-2.5 py-1.5 sm:flex">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#6366F1]/20 text-[#818CF8]">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="leading-tight">
            <p className="text-[11px] font-medium text-[#F8FAFC]">Command Op</p>
            <p className="text-[10px] text-[#94A3B8]">Himalayan Grid</p>
          </div>
        </div>
      </div>
    </header>
  )
}
