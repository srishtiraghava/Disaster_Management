import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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

export function App() {
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
            <Route key={item.id} path={item.path} element={renderPage(item.id)} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
