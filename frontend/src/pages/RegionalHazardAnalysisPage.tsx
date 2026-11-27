import { useCallback, useEffect, useState } from 'react'
import { Activity, AlertTriangle, Mountain, RefreshCw, X } from 'lucide-react'
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
  HazardAnalysisResponse,
  RegionalHazardAnalysis,
  StationDetail,
} from '@/types/sentra'

interface RegionalHazardAnalysisPageProps {
  healthResult: BackendHealthResult
}

export function RegionalHazardAnalysisPage({
  healthResult,
}: RegionalHazardAnalysisPageProps) {
  const [analysis, setAnalysis] = useState<HazardAnalysisResponse | null>(null)
  const [stations, setStations] = useState<StationDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRegion, setSelectedRegion] = useState<RegionalHazardAnalysis | null>(null)

  const loadData = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const [hazardData, stationData] = await Promise.all([
        sentraApi.getHazardAnalysis(),
        sentraApi.getStations(),
      ])
      setAnalysis(hazardData)
      setStations(stationData.stations)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load regional hazard analysis')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadData(false)
  }, [loadData])

  const topRegion = analysis?.regions[0] ?? null
  const selectedStation = selectedRegion
    ? (stations.find((s) => s.stationId === selectedRegion.stationId) ?? null)
    : null

  const chartData =
    analysis?.regions.map((r) => ({
      region: r.region,
      Landslide: Number(r.landslideRisk.toFixed(1)),
      Flood: Number(r.floodRisk.toFixed(1)),
      Overall: Number(r.overallRisk.toFixed(1)),
    })) ?? []

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="OPERATIONS · C++17 HAZARD INDEX ENGINE"
        title="Regional Hazard Analysis"
        subtitle="Ranked RegionalHazard severity, overloaded computeHazardIndex() metrics, and grid-wide accumulation"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void healthResult.refresh()
              void loadData(true)
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loading && !analysis ? <LoadingSkeleton cards={4} rows={3} /> : null}

      {error ? (
        <ErrorState
          title="Hazard Analysis Unavailable"
          message={error}
          onRetry={() => void loadData(true)}
        />
      ) : null}

      {analysis ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Highest-Risk Region"
              value={topRegion ? topRegion.region : '—'}
              subtitle={
                topRegion
                  ? `${topRegion.stationId} · Overall ${topRegion.overallRisk.toFixed(1)}/100`
                  : 'No regions'
              }
              icon={<AlertTriangle className="h-4 w-4" />}
              accent={
                topRegion?.classification === 'CRITICAL' || topRegion?.classification === 'HIGH'
                  ? 'red'
                  : 'cyan'
              }
              badge={topRegion ? <RiskBadge level={topRegion.classification} /> : undefined}
            />
            <MetricCard
              title="Grid Mean Severity"
              value={analysis.gridMeanNormalizedSeverity.toFixed(3)}
              subtitle={`${(analysis.gridMeanNormalizedSeverity * 100).toFixed(1)}/100 via accumulateRegionalRisk()`}
              icon={<Mountain className="h-4 w-4" />}
              accent="indigo"
            />
            <MetricCard
              title="Monitored Districts"
              value={analysis.regions.length}
              subtitle="Ranked by RegionalHazard::operator>"
              icon={<Activity className="h-4 w-4" />}
              accent="cyan"
            />
            <MetricCard
              title="Engine Cycle"
              value={`#${analysis.cycle}`}
              subtitle="All indices computed natively in C++"
              icon={<RefreshCw className="h-4 w-4" />}
              accent="green"
            />
          </div>

          <DataCard
            title="Landslide vs. Flood Risk by Ranked Region"
            description="Independent 0–100 indices from SimulationEngine::calculateLandslideRisk() & calculateFloodRisk()"
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
                  <Bar dataKey="Overall" fill="#6366F1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </DataCard>

          <DataCard
            title="Ranked Regional Hazard Matrix"
            description="Click any region row to inspect contributing sensor readings"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#26364A] text-[11px] uppercase tracking-wider text-[#94A3B8]">
                    <th className="py-3 pr-4">Rank</th>
                    <th className="py-3 pr-4">Region / Station</th>
                    <th className="py-3 pr-4">Classification</th>
                    <th className="py-3 pr-4">Landslide</th>
                    <th className="py-3 pr-4">Flood</th>
                    <th className="py-3 pr-4">Overall</th>
                    <th className="py-3 pr-4">Rain-Slope Idx</th>
                    <th className="py-3 pr-4">Soil-Vib-Tilt Idx</th>
                    <th className="py-3 pr-4">Combined</th>
                    <th className="py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#26364A]/60">
                  {analysis.regions.map((r) => (
                    <tr
                      key={r.stationId}
                      onClick={() => setSelectedRegion(r)}
                      className={`cursor-pointer transition-colors hover:bg-[#19283B]/70 ${
                        r.rank === 1 ? 'bg-[#38BDF8]/5' : ''
                      }`}
                    >
                      <td className="py-3 pr-4 font-telemetry font-bold text-[#38BDF8]">
                        #{r.rank}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-[#F8FAFC]">{r.region}</p>
                        <p className="font-telemetry text-[11px] text-[#94A3B8]">
                          {r.stationId}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <RiskBadge level={r.classification} />
                      </td>
                      <td className="py-3 pr-4 font-telemetry text-[#F8FAFC]">
                        {r.landslideRisk.toFixed(1)}
                      </td>
                      <td className="py-3 pr-4 font-telemetry text-[#F8FAFC]">
                        {r.floodRisk.toFixed(1)}
                      </td>
                      <td className="py-3 pr-4 font-telemetry font-semibold text-[#F8FAFC]">
                        {r.overallRisk.toFixed(1)}
                      </td>
                      <td className="py-3 pr-4 font-telemetry text-[#94A3B8]">
                        {r.rainSlopeIndex.toFixed(3)}
                      </td>
                      <td className="py-3 pr-4 font-telemetry text-[#94A3B8]">
                        {r.soilVibTiltIndex.toFixed(3)}
                      </td>
                      <td className="py-3 pr-4 font-telemetry text-[#94A3B8]">
                        {r.combinedHazard.toFixed(3)}
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedRegion(r)
                          }}
                        >
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DataCard>
        </>
      ) : null}

      {/* Station Contributing Factors Drawer */}
      {selectedRegion ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#0B1220]/75 backdrop-blur-sm"
            onClick={() => setSelectedRegion(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#26364A] bg-[#101B2B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26364A] px-5 py-4">
              <div>
                <p className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                  RANK #{selectedRegion.rank} · {selectedRegion.stationId}
                </p>
                <h3 className="text-base font-semibold text-[#F8FAFC]">
                  {selectedRegion.region} Hazard Breakdown
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRegion(null)}
                aria-label="Close hazard details"
                className="rounded-lg border border-[#26364A] bg-[#141F30] p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex items-center gap-2">
                <RiskBadge
                  level={selectedRegion.classification}
                  score={selectedRegion.overallRisk}
                />
                {selectedStation ? (
                  <StatusBadge
                    tone={selectedStation.connected ? 'online' : 'offline'}
                    label={selectedStation.connected ? 'ONLINE' : 'OFFLINE'}
                  />
                ) : null}
              </div>

              <DataCard title="C++ Overloaded Hazard Indices">
                <dl className="space-y-2 font-telemetry text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Normalized Severity</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRegion.normalizedSeverity.toFixed(4)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Rain-Slope Index</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRegion.rainSlopeIndex.toFixed(4)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Soil-Vib-Tilt Index</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRegion.soilVibTiltIndex.toFixed(4)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Combined Weighted Hazard</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRegion.combinedHazard.toFixed(4)}
                    </dd>
                  </div>
                </dl>
              </DataCard>

              {selectedStation ? (
                <DataCard title="Contributing Station Telemetry">
                  <dl className="grid grid-cols-2 gap-3 font-telemetry text-xs">
                    <div>
                      <dt className="text-[#94A3B8]">Soil Saturation</dt>
                      <dd className="font-semibold text-[#F8FAFC]">
                        {selectedStation.soilSaturation.toFixed(3)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#94A3B8]">Rainfall Rate</dt>
                      <dd className="font-semibold text-[#F8FAFC]">
                        {selectedStation.rainfallRate.toFixed(1)} mm/h
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#94A3B8]">Vibration Freq</dt>
                      <dd className="font-semibold text-[#F8FAFC]">
                        {selectedStation.vibrationFrequency.toFixed(1)} Hz
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#94A3B8]">Slope Tilt</dt>
                      <dd className="font-semibold text-[#F8FAFC]">
                        {selectedStation.tiltAngle.toFixed(1)} deg
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#94A3B8]">River Level</dt>
                      <dd className="font-semibold text-[#F8FAFC]">
                        {selectedStation.riverLevel.toFixed(2)} m
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[#94A3B8]">Battery</dt>
                      <dd className="font-semibold text-[#F8FAFC]">
                        {selectedStation.batteryLevel.toFixed(1)}%
                      </dd>
                    </div>
                  </dl>
                </DataCard>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
