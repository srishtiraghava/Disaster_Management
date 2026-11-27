import { Activity, Cpu, Radio, ShieldAlert } from 'lucide-react'
import { DataCard } from '@/components/common/DataCard'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { MetricCard } from '@/components/common/MetricCard'
import { PageContainer } from '@/components/common/PageContainer'
import { RiskBadge } from '@/components/common/RiskBadge'
import { SectionHeader } from '@/components/common/SectionHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { SentraLogo } from '@/components/layout/SentraLogo'
import type { NavItem } from '@/config/navigation'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'

interface ModuleFoundationPageProps {
  navItem: NavItem
  healthResult: BackendHealthResult
}

export function ModuleFoundationPage({ navItem, healthResult }: ModuleFoundationPageProps) {
  const { state, health, error, refresh } = healthResult

  return (
    <PageContainer>
      <SectionHeader
        eyebrow={`${navItem.section} · MODULE READY`}
        title={navItem.label}
        subtitle={navItem.description}
        actions={
          <StatusBadge
            tone={state === 'connected' ? 'online' : state === 'checking' ? 'info' : 'offline'}
            label={state === 'connected' ? 'API LIVE' : state === 'checking' ? 'CHECKING' : 'API OFFLINE'}
            pulse={state === 'connected'}
          />
        }
      />

      {state === 'checking' && !health ? <LoadingSkeleton cards={4} rows={2} /> : null}

      {state === 'disconnected' && error ? (
        <ErrorState
          title="SENTRA_api Connection Offline"
          message={`${error}. Start SENTRA_api on port 8080 to stream live C++17 simulation telemetry.`}
          onRetry={() => void refresh()}
        />
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Simulation Cycle"
          value={health ? `#${health.cycle}` : '—'}
          subtitle="Deterministic engine step"
          icon={<Cpu className="h-4 w-4" />}
          accent="cyan"
        />
        <MetricCard
          title="Monitoring Stations"
          value={health ? `${health.stationCount}` : '—'}
          subtitle="5 Himalayan districts"
          icon={<Radio className="h-4 w-4" />}
          accent="green"
        />
        <MetricCard
          title="Global Alert Level"
          value={health ? health.globalAlertLevel : '—'}
          subtitle="Active regional sirens"
          icon={<ShieldAlert className="h-4 w-4" />}
          accent={health && health.globalAlertLevel > 0 ? 'red' : 'green'}
        />
        <MetricCard
          title="Engine Seed"
          value={health ? health.seed : '—'}
          subtitle={health ? health.engine : 'ALF_EWG_core'}
          icon={<Activity className="h-4 w-4" />}
          accent="indigo"
        />
      </div>

      <DataCard
        title="SENTRA Design System & Command Shell"
        description="Phase 3 foundation active — awaiting Phase 4 module implementation"
        headerAction={<RiskBadge level={health && health.globalAlertLevel > 0 ? 'HIGH' : 'LOW'} />}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <SentraLogo showFullForm />
          <p className="font-telemetry text-xs text-[#94A3B8]">
            Route: <span className="text-[#38BDF8]">{navItem.path}</span>
          </p>
        </div>
      </DataCard>
    </PageContainer>
  )
}
