import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  Battery,
  Cpu,
  Database,
  Radio,
  RefreshCw,
  Siren,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { sentraApi } from '@/api/client'
import { DataCard } from '@/components/common/DataCard'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { MetricCard } from '@/components/common/MetricCard'
import { PageContainer } from '@/components/common/PageContainer'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Button } from '@/components/ui/button'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type { StatisticsResponse } from '@/types/sentra'

interface SystemStatisticsPageProps {
  healthResult: BackendHealthResult
}

export function SystemStatisticsPage({ healthResult }: SystemStatisticsPageProps) {
  const [stats, setStats] = useState<StatisticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadStats = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const resp = await sentraApi.getStatistics()
      setStats(resp)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load system statistics')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadStats(false)
  }, [loadStats])

  const riskChartData = stats
    ? [
        { level: 'LOW', count: stats.riskDistribution.LOW, color: '#22C55E' },
        { level: 'MODERATE', count: stats.riskDistribution.MODERATE, color: '#38BDF8' },
        { level: 'HIGH', count: stats.riskDistribution.HIGH, color: '#F59E0B' },
        { level: 'CRITICAL', count: stats.riskDistribution.CRITICAL, color: '#EF4444' },
      ]
    : []

  const averageChartData = stats
    ? [
        { metric: 'Avg Landslide', value: Number(stats.averageLandslideRisk.toFixed(1)) },
        { metric: 'Avg Flood', value: Number(stats.averageFloodRisk.toFixed(1)) },
        { metric: 'Peak Overall', value: Number(stats.peakOverallRisk.toFixed(1)) },
        { metric: 'Avg Battery %', value: Number(stats.averageBattery.toFixed(1)) },
      ]
    : []

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="SYSTEM · AGGREGATE TELEMETRY & SESSION TOTALS"
        title="System Statistics"
        subtitle="Current grid snapshot aggregates and cumulative session counters from GET /api/statistics"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void healthResult.refresh()
              void loadStats(true)
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loading && !stats ? <LoadingSkeleton cards={4} rows={3} /> : null}

      {error ? (
        <ErrorState
          title="System Statistics Unavailable"
          message={error}
          onRetry={() => void loadStats(true)}
        />
      ) : null}

      {stats ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Cycles Executed"
              value={stats.cyclesExecuted}
              subtitle="Session simulation steps"
              icon={<Cpu className="h-4 w-4" />}
              accent="cyan"
            />
            <MetricCard
              title="Station Connectivity"
              value={`${stats.onlineStations} / ${stats.totalStations}`}
              subtitle={`${stats.offlineStations} offline · activeCount=${stats.sensorStationActiveCount}`}
              icon={<Radio className="h-4 w-4" />}
              accent={stats.offlineStations > 0 ? 'amber' : 'green'}
            />
            <MetricCard
              title="Global Alert / Transitions"
              value={stats.globalAlertLevel}
              subtitle={`${stats.sessionSirenTransitions} session siren transitions`}
              icon={<Siren className="h-4 w-4" />}
              accent={stats.globalAlertLevel > 0 ? 'red' : 'green'}
            />
            <MetricCard
              title="Persisted Incidents"
              value={stats.persistedIncidents}
              subtitle={`${stats.auditBufferSamples} audit buffer samples`}
              icon={<Database className="h-4 w-4" />}
              accent="indigo"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              title="Average Landslide / Flood"
              value={`${stats.averageLandslideRisk.toFixed(1)} / ${stats.averageFloodRisk.toFixed(1)}`}
              subtitle="Current snapshot mean (0–100)"
              icon={<Activity className="h-4 w-4" />}
              accent="amber"
            />
            <MetricCard
              title="Peak Overall Risk"
              value={`${stats.peakOverallRisk.toFixed(1)} / 100`}
              subtitle="Highest current station risk"
              icon={<BarChart3 className="h-4 w-4" />}
              accent={stats.peakOverallRisk >= 50 ? 'red' : 'cyan'}
            />
            <MetricCard
              title="Battery (Min / Avg)"
              value={`${stats.minBattery.toFixed(1)}% / ${stats.averageBattery.toFixed(1)}%`}
              subtitle="Across all configured stations"
              icon={<Battery className="h-4 w-4" />}
              accent={stats.minBattery <= 15 ? 'red' : 'green'}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DataCard
              title="Current Risk Distribution"
              description="Current snapshot station counts by RiskClass (not historical time-series)"
            >
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={riskChartData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#26364A" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="level"
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      axisLine={{ stroke: '#26364A' }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
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
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {riskChartData.map((entry) => (
                        <Cell key={entry.level} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DataCard>

            <DataCard
              title="Current Grid Averages & Peak"
              description="Snapshot hazard averages and battery telemetry"
            >
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={averageChartData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#26364A" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="metric"
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
                    <Bar dataKey="value" fill="#38BDF8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </DataCard>
          </div>
        </>
      ) : null}
    </PageContainer>
  )
}
