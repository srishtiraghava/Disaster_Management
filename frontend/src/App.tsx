import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import {
  clearDemoPassword,
  sentraApi,
} from '@/api/client'
import { DemoAccess } from '@/components/DemoAccess'
import { AppShell } from '@/components/layout/AppShell'
import { NAV_ITEMS } from '@/config/navigation'
import { useBackendHealth } from '@/hooks/useBackendHealth'
import { EmergencyAlertsPage } from '@/pages/EmergencyAlertsPage'
import { EvacuationPlanningPage } from '@/pages/EvacuationPlanningPage'
import { IncidentHistoryPage } from '@/pages/IncidentHistoryPage'
import { LiveMonitoringPage } from '@/pages/LiveMonitoringPage'
import { OverviewDashboardPage } from '@/pages/OverviewDashboardPage'
import { RegionalHazardAnalysisPage } from '@/pages/RegionalHazardAnalysisPage'
import { SimulationCenterPage } from '@/pages/SimulationCenterPage'
import { SirenControlPage } from '@/pages/SirenControlPage'
import { SystemDiagnosticsPage } from '@/pages/SystemDiagnosticsPage'
import { SystemStatisticsPage } from '@/pages/SystemStatisticsPage'
import { TelemetryAuditPage } from '@/pages/TelemetryAuditPage'

function AuthenticatedApp() {
  const healthResult = useBackendHealth(10000)

  const renderPage = (id: string) => {
    switch (id) {
      case 'overview':
        return <OverviewDashboardPage healthResult={healthResult} />
      case 'monitoring':
        return <LiveMonitoringPage healthResult={healthResult} />
      case 'simulation':
        return <SimulationCenterPage healthResult={healthResult} />
      case 'hazards':
        return <RegionalHazardAnalysisPage healthResult={healthResult} />
      case 'alerts':
        return <EmergencyAlertsPage healthResult={healthResult} />
      case 'sirens':
        return <SirenControlPage healthResult={healthResult} />
      case 'evacuation':
        return <EvacuationPlanningPage healthResult={healthResult} />
      case 'incidents':
        return <IncidentHistoryPage healthResult={healthResult} />
      case 'audit':
        return <TelemetryAuditPage healthResult={healthResult} />
      case 'statistics':
        return <SystemStatisticsPage healthResult={healthResult} />
      case 'diagnostics':
        return <SystemDiagnosticsPage healthResult={healthResult} />
      default:
        return <OverviewDashboardPage healthResult={healthResult} />
    }
  }

  return (
    <BrowserRouter>
      <AppShell healthResult={healthResult}>
        <Routes>
          {NAV_ITEMS.map((item) => (
            <Route
              key={item.id}
              path={item.path}
              element={renderPage(item.id)}
            />
          ))}

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}

export function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(() => {
    try {
      return window.sessionStorage.getItem('sentra_demo_password')
        ? null
        : false
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (authenticated !== null) return

    let cancelled = false

    sentraApi.getHealth()
      .then(() => {
        if (!cancelled) {
          setAuthenticated(true)
        }
      })
      .catch(() => {
        clearDemoPassword()

        if (!cancelled) {
          setAuthenticated(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [authenticated])

  if (authenticated === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#0B1220] text-slate-400">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-sky-400/20 border-t-sky-400" />
          <p className="text-sm">Verifying SENTRA access...</p>
        </div>
      </main>
    )
  }

  if (!authenticated) {
    return (
      <DemoAccess
        onAuthenticated={() => setAuthenticated(true)}
      />
    )
  }

  return <AuthenticatedApp />
}

export default App