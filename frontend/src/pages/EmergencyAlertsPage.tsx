import { useCallback, useEffect, useMemo, useState } from 'react'
import { BellRing, RefreshCw, ShieldAlert, X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type {
  ActiveWarning,
  AlertEvent,
  AlertsResponse,
  RiskClassName,
} from '@/types/sentra'

interface EmergencyAlertsPageProps {
  healthResult: BackendHealthResult
}

type SelectedAlertItem =
  | { kind: 'warning'; data: ActiveWarning }
  | { kind: 'transition'; data: AlertEvent }

const LEVEL_FILTERS: Array<'ALL' | RiskClassName> = [
  'ALL',
  'CRITICAL',
  'HIGH',
  'MODERATE',
  'LOW',
]

export function EmergencyAlertsPage({ healthResult }: EmergencyAlertsPageProps) {
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [levelFilter, setLevelFilter] = useState<'ALL' | RiskClassName>('ALL')
  const [regionFilter, setRegionFilter] = useState<string>('ALL')
  const [selectedAlert, setSelectedAlert] = useState<SelectedAlertItem | null>(null)

  const loadAlerts = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const data = await sentraApi.getAlerts()
      setAlerts(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch emergency alerts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadAlerts(false)
  }, [loadAlerts])

  const availableRegions = useMemo(() => {
    if (!alerts) return []
    const set = new Set<string>()
    alerts.activeWarnings.forEach((w) => set.add(w.region))
    alerts.alertHistory.forEach((h) => set.add(h.region))
    return Array.from(set).sort()
  }, [alerts])

  const filteredWarnings = useMemo(() => {
    if (!alerts) return []
    return alerts.activeWarnings.filter((w) => {
      if (levelFilter !== 'ALL' && w.classification !== levelFilter) return false
      if (regionFilter !== 'ALL' && w.region !== regionFilter) return false
      return true
    })
  }, [alerts, levelFilter, regionFilter])

  const filteredHistory = useMemo(() => {
    if (!alerts) return []
    return [...alerts.alertHistory]
      .reverse()
      .filter((ev) => {
        if (levelFilter !== 'ALL' && ev.level !== levelFilter) return false
        if (regionFilter !== 'ALL' && ev.region !== regionFilter) return false
        return true
      })
  }, [alerts, levelFilter, regionFilter])

  const criticalCount =
    alerts?.activeWarnings.filter((w) => w.classification === 'CRITICAL').length ?? 0

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="OPERATIONS · ALERT & ESCALATION MONITOR"
        title="Emergency Alerts"
        subtitle="Active regional warnings, offline/low-battery station flags, and session siren transition log"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void healthResult.refresh()
              void loadAlerts(true)
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loading && !alerts ? <LoadingSkeleton cards={3} rows={3} /> : null}

      {error ? (
        <ErrorState
          title="Emergency Alerts Unavailable"
          message={error}
          onRetry={() => void loadAlerts(true)}
        />
      ) : null}

      {alerts ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              title="Active Regional Warnings"
              value={alerts.activeWarnings.length}
              subtitle={`${criticalCount} CRITICAL severity`}
              icon={<ShieldAlert className="h-4 w-4" />}
              accent={alerts.activeWarnings.length > 0 ? 'red' : 'green'}
            />
            <MetricCard
              title="Session Alert Transitions"
              value={alerts.alertHistory.length}
              subtitle="Deduplicated state & escalation events"
              icon={<BellRing className="h-4 w-4" />}
              accent="amber"
            />
            <MetricCard
              title="Engine Cycle"
              value={`#${alerts.cycle}`}
              subtitle="From GET /api/alerts"
              icon={<RefreshCw className="h-4 w-4" />}
              accent="cyan"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#26364A] bg-[#141F30] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#94A3B8]">Severity:</span>
              {LEVEL_FILTERS.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`rounded-md border px-2.5 py-1 font-telemetry text-[11px] font-semibold transition-colors ${
                    levelFilter === lvl
                      ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                      : 'border-[#26364A] bg-[#101B2B] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="alert-region-filter" className="text-xs text-[#94A3B8]">
                Region:
              </label>
              <select
                id="alert-region-filter"
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="rounded-lg border border-[#26364A] bg-[#101B2B] px-2.5 py-1 text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              >
                <option value="ALL">All Regions</option>
                {availableRegions.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Warnings */}
          <DataCard
            title="Current Active Regional Warnings"
            description="Stations with active sirens, disconnected links, or battery <= critical threshold"
          >
            {filteredWarnings.length === 0 ? (
              <EmptyState
                title="No Active Emergency Warnings"
                description="All monitored regions are within normal parameters for the selected filters."
              />
            ) : (
              <div className="space-y-2.5">
                {filteredWarnings.map((w) => {
                  const isHighOrCrit =
                    w.classification === 'HIGH' || w.classification === 'CRITICAL'
                  return (
                    <div
                      key={w.stationId}
                      onClick={() => setSelectedAlert({ kind: 'warning', data: w })}
                      className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors hover:bg-[#19283B]/70 ${
                        isHighOrCrit
                          ? 'border-[#EF4444]/45 bg-[#EF4444]/10'
                          : 'border-[#26364A] bg-[#101B2B]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <span className="font-telemetry text-sm font-bold text-[#F8FAFC]">
                            {w.region}
                          </span>
                          <span className="font-telemetry text-xs text-[#94A3B8]">
                            {w.stationId}
                          </span>
                          {w.disconnected ? <Badge variant="danger">DISCONNECTED</Badge> : null}
                          {w.lowBattery ? (
                            <Badge variant="warning">
                              LOW BATTERY {w.batteryLevel.toFixed(1)}%
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <RiskBadge level={w.classification} score={w.overallRisk} />
                          <StatusBadge
                            tone={w.sirenActive ? 'active' : 'standby'}
                            label={w.sirenActive ? 'SIREN ON' : 'SIREN OFF'}
                            pulse={w.sirenActive}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </DataCard>

          {/* Session Transition History */}
          <DataCard
            title="Session Alert Transition & Escalation Log"
            description="Recorded by SimulationEngine::updateSiren() when regional siren state or severity changes"
          >
            {filteredHistory.length === 0 ? (
              <EmptyState
                title="No Alert Transitions Recorded"
                description="Run a threat scenario or manual telemetry injection in the Simulation Center to observe state transitions."
              />
            ) : (
              <div className="space-y-2.5">
                {filteredHistory.map((ev, idx) => {
                  const isHighOrCrit = ev.level === 'HIGH' || ev.level === 'CRITICAL'
                  return (
                    <div
                      key={`${ev.sirenId}-${ev.cycle}-${idx}`}
                      onClick={() => setSelectedAlert({ kind: 'transition', data: ev })}
                      className={`cursor-pointer rounded-xl border px-4 py-3 transition-colors hover:bg-[#19283B]/70 ${
                        isHighOrCrit
                          ? 'border-[#F59E0B]/40 bg-[#101B2B]'
                          : 'border-[#26364A] bg-[#101B2B]'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                            Cycle #{ev.cycle}
                          </span>
                          <span className="text-xs font-semibold text-[#F8FAFC]">
                            {ev.region}
                          </span>
                          <span className="font-telemetry text-xs text-[#94A3B8]">
                            {ev.sirenId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RiskBadge level={ev.level} />
                          <StatusBadge
                            tone={ev.activated ? 'active' : 'standby'}
                            label={ev.activated ? 'ACTIVATED' : 'CLEARED'}
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-[#94A3B8]">{ev.description}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </DataCard>
        </>
      ) : null}

      {/* Alert Detail Drawer */}
      {selectedAlert ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#0B1220]/75 backdrop-blur-sm"
            onClick={() => setSelectedAlert(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#26364A] bg-[#101B2B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26364A] px-5 py-4">
              <div>
                <p className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                  {selectedAlert.kind === 'warning'
                    ? selectedAlert.data.stationId
                    : selectedAlert.data.sirenId}
                </p>
                <h3 className="text-base font-semibold text-[#F8FAFC]">
                  {selectedAlert.data.region} Alert Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                aria-label="Close alert drawer"
                className="rounded-lg border border-[#26364A] bg-[#141F30] p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {selectedAlert.kind === 'warning' ? (
                <DataCard title="Active Station Warning">
                  <dl className="space-y-2.5 font-telemetry text-xs">
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Alert Level</dt>
                      <dd className="text-[#F8FAFC]">{selectedAlert.data.alertLevel}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Classification</dt>
                      <dd>
                        <RiskBadge level={selectedAlert.data.classification} />
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Overall Risk</dt>
                      <dd className="text-[#F8FAFC]">
                        {selectedAlert.data.overallRisk.toFixed(1)} / 100
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Siren Active</dt>
                      <dd className="text-[#F8FAFC]">
                        {selectedAlert.data.sirenActive ? 'YES' : 'NO'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Disconnected</dt>
                      <dd className="text-[#F8FAFC]">
                        {selectedAlert.data.disconnected ? 'YES' : 'NO'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Battery</dt>
                      <dd className="text-[#F8FAFC]">
                        {selectedAlert.data.batteryLevel.toFixed(1)}%
                      </dd>
                    </div>
                  </dl>
                </DataCard>
              ) : (
                <DataCard title="Alert Transition Event">
                  <dl className="space-y-2.5 font-telemetry text-xs">
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Cycle</dt>
                      <dd className="text-[#F8FAFC]">#{selectedAlert.data.cycle}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Siren ID</dt>
                      <dd className="text-[#F8FAFC]">{selectedAlert.data.sirenId}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">Risk Class</dt>
                      <dd>
                        <RiskBadge level={selectedAlert.data.level} />
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-[#94A3B8]">State</dt>
                      <dd className="text-[#F8FAFC]">
                        {selectedAlert.data.activated ? 'ACTIVATED' : 'CLEARED'}
                      </dd>
                    </div>
                    <div className="pt-2">
                      <dt className="text-[#94A3B8]">Description</dt>
                      <dd className="mt-1 text-[#F8FAFC]">{selectedAlert.data.description}</dd>
                    </div>
                  </dl>
                </DataCard>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
