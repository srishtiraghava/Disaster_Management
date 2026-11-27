import { useCallback, useEffect, useState } from 'react'
import { Info, MapPin, RefreshCw, ShieldAlert, Siren } from 'lucide-react'
import { sentraApi } from '@/api/client'
import { DataCard } from '@/components/common/DataCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { MetricCard } from '@/components/common/MetricCard'
import { PageContainer } from '@/components/common/PageContainer'
import { RiskBadge } from '@/components/common/RiskBadge'
import { SectionHeader } from '@/components/common/SectionHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type {
  AlertsResponse,
  SirensResponse,
  SnapshotResponse,
} from '@/types/sentra'

interface SirenControlPageProps {
  healthResult: BackendHealthResult
}

export function SirenControlPage({ healthResult }: SirenControlPageProps) {
  const [sirens, setSirens] = useState<SirensResponse | null>(null)
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null)
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSirens = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [sirenData, snapData, alertData] = await Promise.all([
        sentraApi.getSirens(),
        sentraApi.getSnapshot(),
        sentraApi.getAlerts(),
      ])
      setSirens(sirenData)
      setSnapshot(snapData)
      setAlerts(alertData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load siren status')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadSirens(false)
  }, [loadSirens])

  const activeCount = sirens?.sirens.filter((s) => s.active).length ?? 0

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="OPERATIONS · AUTOMATED SIREN MONITORING"
        title="Siren Control"
        subtitle="Real-time status of regional EarlyWarningSiren units (automatically governed by C++ risk thresholds)"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void healthResult.refresh()
              void loadSirens(true)
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {/* Explicit Policy Notice: Monitoring Only */}
      <div className="flex items-start gap-3 rounded-xl border border-[#38BDF8]/35 bg-[#38BDF8]/10 px-4 py-3 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
        <p className="text-[#F8FAFC]">
          <span className="font-semibold">Automated Threshold Governance:</span> Regional sirens
          are controlled exclusively by <span className="font-telemetry">SimulationEngine::updateSiren()</span>.
          A siren activates automatically when regional overall risk reaches{' '}
          <span className="font-telemetry font-semibold text-[#38BDF8]">
            &ge; {sirens?.activationThreshold ?? 50}
          </span>{' '}
          (HIGH / CRITICAL) and clears when risk falls below{' '}
          <span className="font-telemetry font-semibold text-[#38BDF8]">50.0</span>. Manual siren
          override is not supported by the C++ engine.
        </p>
      </div>

      {loading && !sirens ? <LoadingSkeleton cards={3} rows={3} /> : null}

      {error ? (
        <ErrorState
          title="Siren Telemetry Unavailable"
          message={error}
          onRetry={() => void loadSirens(true)}
        />
      ) : null}

      {sirens ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              title="Global Alert Level"
              value={sirens.globalAlertLevel}
              subtitle="EarlyWarningSiren::globalAlertLevel()"
              icon={<ShieldAlert className="h-4 w-4" />}
              accent={sirens.globalAlertLevel > 0 ? 'red' : 'green'}
            />
            <MetricCard
              title="Active Sirens"
              value={`${activeCount} / ${sirens.sirens.length}`}
              subtitle={`Threshold >= ${sirens.activationThreshold.toFixed(1)}`}
              icon={<Siren className="h-4 w-4" />}
              accent={activeCount > 0 ? 'red' : 'cyan'}
            />
            <MetricCard
              title="Engine Cycle"
              value={`#${sirens.cycle}`}
              subtitle="Synchronized with GET /api/sirens"
              icon={<RefreshCw className="h-4 w-4" />}
              accent="indigo"
            />
          </div>

          {/* Regional Siren Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sirens.sirens.map((siren) => {
              const stationMatch = snapshot?.stations.find(
                (st) => st.telemetry.region === siren.region,
              )
              const latestTransition = alerts
                ? [...alerts.alertHistory]
                    .reverse()
                    .find((ev) => ev.sirenId === siren.sirenId)
                : undefined

              return (
                <Card
                  key={siren.sirenId}
                  className={`p-5 ${
                    siren.active
                      ? 'border-[#EF4444]/50 shadow-sentra-danger'
                      : 'hover:border-[#38BDF8]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-telemetry text-sm font-bold text-[#F8FAFC]">
                        {siren.sirenId}
                      </p>
                      <p className="text-xs text-[#94A3B8]">
                        {siren.region} District
                        {stationMatch ? ` · ${stationMatch.telemetry.stationId}` : ''}
                      </p>
                    </div>
                    <StatusBadge
                      tone={siren.active ? 'active' : 'standby'}
                      label={siren.active ? 'ACTIVE' : 'INACTIVE'}
                      pulse={siren.active}
                    />
                  </div>

                  <div className="mt-4 space-y-2 rounded-lg border border-[#26364A] bg-[#101B2B] p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[#94A3B8]">
                        <MapPin className="h-3.5 w-3.5 text-[#38BDF8]" />
                        Coordinates
                      </span>
                      <span className="font-telemetry text-[#F8FAFC]">
                        {siren.latitude.toFixed(4)}° N, {siren.longitude.toFixed(4)}° E
                      </span>
                    </div>

                    {stationMatch ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[#94A3B8]">Current Region Risk</span>
                        <RiskBadge
                          level={stationMatch.classification}
                          score={stationMatch.overallRisk}
                        />
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <span className="text-[#94A3B8]">Last Transition</span>
                      <span className="font-telemetry text-[11px] text-[#F8FAFC]">
                        {latestTransition
                          ? `Cycle #${latestTransition.cycle} (${latestTransition.activated ? 'ON' : 'OFF'})`
                          : 'No transitions yet'}
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>

          {/* Station-wise Transition History */}
          <DataCard
            title="Siren Activation & Clearance History"
            description="Chronological transitions recorded by SimulationEngine"
          >
            {!alerts || alerts.alertHistory.length === 0 ? (
              <EmptyState
                title="No Siren Transitions Recorded"
                description="Sirens remain INACTIVE until a simulation cycle produces overall risk >= 50.0."
              />
            ) : (
              <div className="space-y-2">
                {[...alerts.alertHistory].reverse().map((ev, idx) => (
                  <div
                    key={`${ev.sirenId}-${ev.cycle}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#26364A] bg-[#101B2B] px-3.5 py-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="font-telemetry font-semibold text-[#38BDF8]">
                        Cycle #{ev.cycle}
                      </span>
                      <span className="font-telemetry font-medium text-[#F8FAFC]">
                        {ev.sirenId}
                      </span>
                      <span className="text-[#94A3B8]">{ev.description}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiskBadge level={ev.level} />
                      <StatusBadge
                        tone={ev.activated ? 'active' : 'standby'}
                        label={ev.activated ? 'ACTIVE' : 'CLEARED'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DataCard>
        </>
      ) : null}
    </PageContainer>
  )
}
