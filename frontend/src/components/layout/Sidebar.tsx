import { NavLink } from 'react-router-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { NAV_ITEMS, NAV_SECTIONS } from '@/config/navigation'
import { SentraLogo } from '@/components/layout/SentraLogo'
import { cn } from '@/lib/utils'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const renderNavContent = (isMobileDrawer: boolean) => {
    const isCollapsed = !isMobileDrawer && collapsed

    return (
      <div className="flex h-full flex-col bg-[#101B2B] border-r border-[#26364A]">
        {/* Brand Header */}
        <div
          className={cn(
            'flex h-16 shrink-0 items-center border-b border-[#26364A] px-4',
            isCollapsed ? 'justify-center px-2' : 'justify-between',
          )}
        >
          <SentraLogo collapsed={isCollapsed} />
          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
              className="rounded-lg p-1.5 text-[#94A3B8] hover:bg-[#19283B] hover:text-[#F8FAFC]"
            >
              <X className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onToggleCollapse}
              title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={cn(
                'rounded-lg border border-[#26364A] bg-[#141F30] p-1.5 text-[#94A3B8] transition-colors hover:border-[#38BDF8]/50 hover:text-[#F8FAFC]',
                isCollapsed && 'mt-0 hidden',
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV_SECTIONS.map((section) => {
            const items = NAV_ITEMS.filter((item) => item.section === section)
            return (
              <div key={section}>
                {!isCollapsed ? (
                  <p className="mb-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]/80">
                    {section}
                  </p>
                ) : (
                  <div className="mx-auto mb-2 h-px w-6 bg-[#26364A]" />
                )}
                <ul className="space-y-1">
                  {items.map((item) => {
                    const Icon = item.icon
                    return (
                      <li key={item.id}>
                        <NavLink
                          to={item.path}
                          end={item.path === '/'}
                          onClick={isMobileDrawer ? onCloseMobile : undefined}
                          title={isCollapsed ? item.label : undefined}
                          className={({ isActive }) =>
                            cn(
                              'group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-xs font-medium transition-all duration-150',
                              isCollapsed && 'justify-center px-2',
                              isActive
                                ? 'bg-[#38BDF8]/12 text-[#38BDF8] border border-[#38BDF8]/30 shadow-sm'
                                : 'text-[#94A3B8] border border-transparent hover:bg-[#19283B] hover:text-[#F8FAFC]',
                            )
                          }
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          {!isCollapsed ? (
                            <span className="truncate">{item.label}</span>
                          ) : (
                            <span className="pointer-events-none fixed left-16 z-50 hidden whitespace-nowrap rounded-md border border-[#26364A] bg-[#19283B] px-2.5 py-1 text-xs font-medium text-[#F8FAFC] shadow-lg group-hover:block">
                              {item.label}
                            </span>
                          )}
                        </NavLink>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        {/* Bottom Expand Button (when collapsed) + Engine Attribution */}
        <div className="shrink-0 border-t border-[#26364A] p-3">
          {isCollapsed && !isMobileDrawer ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Expand sidebar"
              aria-label="Expand sidebar"
              className="flex w-full items-center justify-center rounded-lg border border-[#26364A] bg-[#141F30] p-2 text-[#94A3B8] transition-colors hover:border-[#38BDF8]/50 hover:text-[#F8FAFC]"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="rounded-lg border border-[#26364A] bg-[#141F30] px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[#38BDF8]">
                ALF-EWG Core Engine
              </p>
              <p className="mt-0.5 text-[11px] text-[#94A3B8]">
                C++17 Simulation · 5 Regions
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          'hidden shrink-0 transition-all duration-200 ease-in-out lg:block',
          collapsed ? 'w-[72px]' : 'w-64',
        )}
      >
        {renderNavContent(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-[#0B1220]/80 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <aside className="relative z-10 w-72 max-w-[85vw]">
            {renderNavContent(true)}
          </aside>
        </div>
      ) : null}
    </>
  )
}
