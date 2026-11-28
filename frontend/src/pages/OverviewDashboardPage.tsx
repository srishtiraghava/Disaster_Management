import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  Compass,
  Cpu,
  History,
  Radio,
  RefreshCw,
  Siren,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
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
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type {
  AlertsResponse,
  EvacuationResponse,
  IncidentsResponse,
  SnapshotResponse,
} from '@/types/sentra'

interface OverviewDashboardPageProps {
  healthResult: BackendHealthResult
}

export function OverviewDashboardPage({ healthResult }: OverviewDashboardPageProps) {
  const [snapshot, setSnapshot] = useState<SnapshotResponse | null>(null)
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null)
  const [evacuation, setEvacuation] = useState<EvacuationResponse | null>(null)
  const [incidents, setIncidents] = useState<IncidentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const hasLoadedRef = useRef(false)

  const loadDashboard = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true)
    else if (!hasLoadedRef.current) setLoading(true)

    try {
      const [snapData, alertsData, evacData, incData] = await Promise.all([
        sentraApi.getSnapshot(),
        sentraApi.getAlerts(),
        sentraApi.getEvacuation(),
        sentraApi.getIncidents(),
      ])
      setSnapshot(snapData)
      setAlerts(alertsData)
      setEvacuation(evacData)
      setIncidents(incData)
      hasLoadedRef.current = true
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load command overview')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard(false)
    const timer = window.setInterval(() => {
      void loadDashboard(false)
    }, 10000)
    return () => window.clearInterval(timer)
  }, [loadDashboard])

  const criticalOrHighCount =
    snapshot?.stations.filter(
      (s) => s.classification === 'CRITICAL' || s.classification === 'HIGH',
    ).length ?? 0

  const chartData =
    snapshot?.stations.map((s) => ({
      region: s.telemetry.region,
      Landslide: Number(s.landslideRisk.toFixed(1)),
      Flood: Number(s.floodRisk.toFixed(1)),
      Overall: Number(s.overallRisk.toFixed(1)),
    })) ?? []

  const recentAlerts = alerts ? [...alerts.alertHistory].reverse().slice(0, 6) : []
  const recentIncidents = incidents ? [...incidents.incidents].reverse().slice(0, 5) : []
  const recentEvents = snapshot ? [...snapshot.summary.systemEvents].reverse().slice(0, 6) : []

  const totalRecommendedRoutes =
    evacuation?.regions.reduce((acc, r) => acc + r.recommendedRoutes.length, 0) ?? 0
  const totalUnavailableRoutes =
    evacuation?.regions.reduce((acc, r) => acc + r.unavailableRoutes.length, 0) ?? 0

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="COMMAND CENTER · HIMALAYAN EARLY WARNING GRID"
        title="Overview Dashboard"
        subtitle="Real-time posture across Uttarkashi, Chamoli, Rudraprayag, Joshimath, and Pithoragarh"
        actions={
          <div className="flex items-center gap-2.5">
            {lastUpdated ? (
              <span className="hidden font-telemetry text-[11px] text-[#94A3B8] sm:inline">
                Synced {lastUpdated.toLocaleTimeString()}
              </span>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void healthResult.refresh()
                void loadDashboard(true)
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {loading && !snapshot ? <LoadingSkeleton cards={5} rows={4} /> : null}

      {error ? (
        <ErrorState
          title="Command Telemetry Unavailable"
          message={`${error}. Ensure SENTRA_api is running on port 8080.`}
          onRetry={() => {
            void healthResult.refresh()
            void loadDashboard(true)
          }}
        />
      ) : null}

      {snapshot ? (
        <>
          {/* Primary KPI Row */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard
              title="Monitored Stations"
              value={`${snapshot.summary.activeStations}/${snapshot.stations.length}`}
              subtitle={`${snapshot.summary.disconnectedStations} disconnected`}
              icon={<Radio className="h-4 w-4" />}
              accent={snapshot.summary.disconnectedStations > 0 ? 'amber' : 'green'}
            />
            <MetricCard
              title="Active Alerts"
              value={alerts?.activeWarnings.length ?? 0}
              subtitle={`${alerts?.alertHistory.length ?? 0} session transitions`}
              icon={<BellRing className="h-4 w-4" />}
              accent={(alerts?.activeWarnings.length ?? 0) > 0 ? 'red' : 'cyan'}
            />
            <MetricCard
              title="High / Critical Regions"
              value={criticalOrHighCount}
              subtitle={`Peak risk ${snapshot.summary.maxOverallRisk.toFixed(1)}/100`}
              icon={<AlertTriangle className="h-4 w-4" />}
              accent={criticalOrHighCount > 0 ? 'red' : 'green'}
              badge={<RiskBadge level={snapshot.summary.emergencyLevel} />}
            />
            <MetricCard
              title="Active Sirens"
              value={`${snapshot.activeSirens}/${snapshot.totalSirens}`}
              subtitle={`Global Alert Level ${snapshot.globalAlertLevel}`}
              icon={<Siren className="h-4 w-4" />}
              accent={snapshot.activeSirens > 0 ? 'red' : 'cyan'}
            />
            <MetricCard
              title="Simulation Cycle"
              value={`#${snapshot.cycle}`}
              subtitle={`Seed ${snapshot.seed} · ${healthResult.state === 'connected' ? 'Engine Online' : 'Engine Offline'}`}
              icon={<Cpu className="h-4 w-4" />}
              accent="indigo"
            />
          </div>

          {/* Regional Risk Chart + Station Risk Matrix */}
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <DataCard
              title="Regional Hazard Comparison"
              description="Independent Landslide vs. Flood risk scores (0–100) computed by ALF_EWG_core"
              className="xl:col-span-7"
            >
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="#26364A" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="region"
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      axisLine={{ stroke: '#26364A' }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      axisLine={{ stroke: '#26364A' }}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#19283B',
                        borderColor: '#26364A',
                        borderRadius: '0.5rem',
                        color: '#F8FAFC',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px', color: '#94A3B8' }} />
                    <Bar dataKey="Landslide" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Flood" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DataCard>

            <DataCard
              title="Regional Risk Matrix"
              description="Current station status, overall risk, and siren state"
              headerAction={
                <Link
                  to="/monitoring"
                  className="text-xs font-medium text-[#38BDF8] hover:underline"
                >
                  Inspect Stations →
                </Link>
              }
              className="xl:col-span-5"
            >
              <div className="space-y-2.5">
                {snapshot.stations.map((item) => (
                  <div
                    key={item.telemetry.stationId}
                    className="flex items-center justify-between gap-3 rounded-lg border border-[#26364A] bg-[#101B2B] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-telemetry text-xs font-semibold text-[#F8FAFC]">
                          {item.telemetry.stationId}
                        </span>
                        <span className="text-xs text-[#94A3B8]">{item.telemetry.region}</span>
                      </div>
                      <p className="mt-0.5 font-telemetry text-[11px] text-[#94A3B8]">
                        Land {item.landslideRisk.toFixed(1)} · Flood {item.floodRisk.toFixed(1)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <RiskBadge level={item.classification} score={item.overallRisk} />
                      <StatusBadge
                        tone={item.sirenActive ? 'active' : 'standby'}
                        label={item.sirenActive ? 'SIREN' : 'QUIET'}
                        pulse={item.sirenActive}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </DataCard>
          </div>

          {/* Evacuation Availability + Alert History + Recent Incidents */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Evacuation Route Availability */}
            <DataCard
              title="Evacuation Route Availability"
              description={`${totalRecommendedRoutes} safe corridors · ${totalUnavailableRoutes} blocked/unavailable`}
              headerAction={<Compass className="h-4 w-4 text-[#38BDF8]" />}
            >
              {evacuation && evacuation.regions.length > 0 ? (
                <div className="space-y-2.5">
                  {evacuation.regions.map((reg) => {
                    const topRoute = reg.recommendedRoutes[0]
                    return (
                      <div
                        key={reg.region}
                        className="rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#F8FAFC]">{reg.region}</span>
                          <span className="font-telemetry text-[11px] text-[#22C55E]">
                            {reg.recommendedRoutes.length} safe
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-[#94A3B8]">
                          {topRoute
                            ? `Top: ${topRoute.routeId} → ${topRoute.destination} (${topRoute.roadCondition})`
                            : 'No safe route available'}
                        </p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState
                  title="No Evacuation Data"
                  description="Evacuation corridor metrics will appear once the engine responds."
                />
              )}
            </DataCard>

            {/* Recent Alert History */}
            <DataCard
              title="Recent Alert Transitions"
              description="Siren activations, clearances, and escalations"
              headerAction={<BellRing className="h-4 w-4 text-[#F59E0B]" />}
            >
              {recentAlerts.length > 0 ? (
                <div className="space-y-2.5">
                  {recentAlerts.map((ev, idx) => (
                    <div
                      key={`${ev.sirenId}-${ev.cycle}-${idx}`}
                      className="rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#F8FAFC]">{ev.region}</span>
                        <div className="flex items-center gap-1.5">
                          <RiskBadge level={ev.level} />
                          <StatusBadge
                            tone={ev.activated ? 'active' : 'standby'}
                            label={ev.activated ? 'ON' : 'OFF'}
                          />
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-[#94A3B8]">
                        Cycle #{ev.cycle} · {ev.description}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No Alert Transitions"
                  description="Run a threat scenario or manual high-risk reading to trigger regional siren transitions."
                />
              )}
            </DataCard>

            {/* Recent Persisted Incidents */}
            <DataCard
              title="Recent Persisted Incidents"
              description="Stored in 433-byte binary IncidentLogger"
              headerAction={<History className="h-4 w-4 text-[#6366F1]" />}
            >
              {recentIncidents.length > 0 ? (
                <div className="space-y-2.5">
                  {recentIncidents.map((inc) => (
                    <div
                      key={inc.incidentId}
                      className="rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                          {inc.incidentId}
                        </span>
                        <span className="font-telemetry text-xs font-semibold text-[#F8FAFC]">
                          {(inc.overallRisk * 100).toFixed(1)}/100
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-[#94A3B8]">
                        {inc.region} · {inc.incidentType} · {inc.evacuationRoute}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No Persisted Incidents"
                  description="Incidents reaching HIGH/CRITICAL (>= 50) or critical battery (<= 15%) are persisted automatically."
                />
              )}
            </DataCard>
          </div>

          {/* System Event Log */}
          <DataCard
            title="Recent Engine Events"
            description="Chronological audit trail from SimulationEngine::systemEvents()"
          >
            {recentEvents.length > 0 ? (
              <ul className="space-y-1.5 font-telemetry text-xs text-[#94A3B8]">
                {recentEvents.map((ev, idx) => (
                  <li
                    key={idx}
                    className="rounded-md border border-[#26364A]/60 bg-[#101B2B] px-3 py-1.5 text-[#F8FAFC]"
                  >
                    {ev}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No System Events"
                description="Engine events will appear as simulations execute."
              />
            )}
          </DataCard>
        </>
      ) : null}
    </PageContainer>
  )
}
