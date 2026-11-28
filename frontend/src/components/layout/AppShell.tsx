import { useState, type ReactNode } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { TopHeader } from '@/components/layout/TopHeader'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'

interface AppShellProps {
  healthResult: BackendHealthResult
  children: ReactNode
}

export function AppShell({ healthResult, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0B1220] text-[#F8FAFC]">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((prev) => !prev)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopHeader
          healthResult={healthResult}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />
        <main className="sentra-grid-bg flex-1 overflow-y-auto scroll-smooth">
          {children}
        </main>
      </div>
    </div>
  )
}
