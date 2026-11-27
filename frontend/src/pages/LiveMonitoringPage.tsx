import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Battery,
  BatteryWarning,
  CloudRain,
  Compass,
  Droplets,
  MapPin,
  Radio,
  RefreshCw,
  Waves,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { sentraApi } from '@/api/client'
import { DataCard } from '@/components/common/DataCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { PageContainer } from '@/components/common/PageContainer'
import { RiskBadge } from '@/components/common/RiskBadge'
import { SectionHeader } from '@/components/common/SectionHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type { RiskClassName, StationDetail, StationsResponse } from '@/types/sentra'

interface LiveMonitoringPageProps {
  healthResult: BackendHealthResult
}

const RISK_FILTERS: Array<'ALL' | RiskClassName> = [
  'ALL',
  'CRITICAL',
  'HIGH',
  'MODERATE',
  'LOW',
]

function riskBarColor(score: number): string {
  if (score >= 75) return 'bg-[#EF4444]'
  if (score >= 50) return 'bg-[#F59E0B]'
  if (score >= 25) return 'bg-[#38BDF8]'
  return 'bg-[#22C55E]'
}

export function LiveMonitoringPage({ healthResult }: LiveMonitoringPageProps) {
  const [data, setData] = useState<StationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [riskFilter, setRiskFilter] = useState<'ALL' | RiskClassName>('ALL')
  const [selectedStation, setSelectedStation] = useState<StationDetail | null>(null)

  const fetchStations = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const resp = await sentraApi.getStations()
      setData(resp)
      setError(null)
      setLastRefreshed(new Date())
      setSelectedStation((prev) =>
        prev
          ? (resp.stations.find((s) => s.stationId === prev.stationId) ?? prev)
          : null,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to fetch station telemetry')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchStations(false)
  }, [fetchStations])

  useEffect(() => {
    if (!autoRefresh) return
    const timer = window.setInterval(() => {
      void fetchStations(false)
    }, 5000)
    return () => window.clearInterval(timer)
  }, [autoRefresh, fetchStations])

  const filteredStations = useMemo(() => {
    if (!data) return []
    if (riskFilter === 'ALL') return data.stations
    return data.stations.filter((st) => st.classification === riskFilter)
  }, [data, riskFilter])

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="COMMAND CENTER · TELEMETRY SNAPSHOT POLLING"
        title="Live Monitoring"
        subtitle="Real-time sensor telemetry, hazard indices, and connectivity across all 5 Himalayan stations"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {lastRefreshed ? (
              <span className="font-telemetry text-[11px] text-[#94A3B8]">
                Refreshed {lastRefreshed.toLocaleTimeString()}
              </span>
            ) : null}
            <Button
              variant={autoRefresh ? 'default' : 'outline'}
              size="sm"
              onClick={() => setAutoRefresh((prev) => !prev)}
            >
              <Radio className="h-3.5 w-3.5" />
              {autoRefresh ? 'Polling 5s' : 'Polling Paused'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void healthResult.refresh()
                void fetchStations(true)
              }}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh Now
            </Button>
          </div>
        }
      />

      {loading && !data ? <LoadingSkeleton cards={4} rows={3} /> : null}

      {error ? (
        <ErrorState
          title="Station Telemetry Polling Failed"
          message={error}
          onRetry={() => void fetchStations(true)}
        />
      ) : null}

      {data ? (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#26364A] bg-[#141F30] px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-[#94A3B8]">Classification:</span>
              {RISK_FILTERS.map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setRiskFilter(filter)}
                  className={`rounded-md border px-2.5 py-1 font-telemetry text-[11px] font-semibold transition-colors ${
                    riskFilter === filter
                      ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                      : 'border-[#26364A] bg-[#101B2B] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            <div className="font-telemetry text-xs text-[#94A3B8]">
              Cycle <span className="text-[#38BDF8]">#{data.cycle}</span> · Showing{' '}
              <span className="text-[#F8FAFC]">{filteredStations.length}</span> /{' '}
              {data.stations.length} stations
            </div>
          </div>

          {filteredStations.length === 0 ? (
            <EmptyState
              title="No Stations Match Filter"
              description={`No stations currently have classification ${riskFilter}.`}
              action={
                <Button variant="outline" size="sm" onClick={() => setRiskFilter('ALL')}>
                  Show All Stations
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredStations.map((st) => (
                <Card
                  key={st.stationId}
                  className="flex flex-col justify-between p-5 hover:border-[#38BDF8]/50"
                >
                  <div>
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-telemetry text-sm font-bold text-[#F8FAFC]">
                            {st.stationId}
                          </span>
                          <StatusBadge
                            tone={st.connected ? 'online' : 'offline'}
                            label={st.connected ? 'ONLINE' : 'OFFLINE'}
                            pulse={!st.connected}
                          />
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">
                          {st.region} District
                        </p>
                      </div>
                      <RiskBadge level={st.classification} score={st.overallRisk} />
                    </div>

                    {/* Risk Bars */}
                    <div className="mt-4 space-y-2.5 rounded-lg border border-[#26364A] bg-[#101B2B] p-3">
                      <div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#94A3B8]">Landslide Risk</span>
                          <span className="font-telemetry font-semibold text-[#F8FAFC]">
                            {st.landslideRisk.toFixed(1)} / 100
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#19283B]">
                          <div
                            className={`h-full rounded-full ${riskBarColor(st.landslideRisk)}`}
                            style={{ width: `${Math.min(100, st.landslideRisk)}%` }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#94A3B8]">Flood Risk</span>
                          <span className="font-telemetry font-semibold text-[#F8FAFC]">
                            {st.floodRisk.toFixed(1)} / 100
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#19283B]">
                          <div
                            className={`h-full rounded-full ${riskBarColor(st.floodRisk)}`}
                            style={{ width: `${Math.min(100, st.floodRisk)}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Sensor Telemetry Grid */}
                    <div className="mt-4 grid grid-cols-2 gap-2.5 text-xs">
                      <div className="rounded-lg border border-[#26364A]/70 bg-[#101B2B] px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                          <Droplets className="h-3.5 w-3.5 text-[#38BDF8]" />
                          Soil Sat
                        </div>
                        <p className="mt-0.5 font-telemetry font-semibold text-[#F8FAFC]">
                          {(st.soilSaturation * 100).toFixed(0)}% ({st.soilSaturation.toFixed(2)})
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#26364A]/70 bg-[#101B2B] px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                          <CloudRain className="h-3.5 w-3.5 text-[#38BDF8]" />
                          Rainfall
                        </div>
                        <p className="mt-0.5 font-telemetry font-semibold text-[#F8FAFC]">
                          {st.rainfallRate.toFixed(1)} mm/h
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#26364A]/70 bg-[#101B2B] px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                          <Waves className="h-3.5 w-3.5 text-[#6366F1]" />
                          River Level
                        </div>
                        <p className="mt-0.5 font-telemetry font-semibold text-[#F8FAFC]">
                          {st.riverLevel.toFixed(2)} m
                        </p>
                      </div>

                      <div className="rounded-lg border border-[#26364A]/70 bg-[#101B2B] px-3 py-2">
                        <div className="flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
                          {st.lowBattery ? (
                            <BatteryWarning className="h-3.5 w-3.5 text-[#EF4444]" />
                          ) : (
                            <Battery className="h-3.5 w-3.5 text-[#22C55E]" />
                          )}
                          Battery
                        </div>
                        <p
                          className={`mt-0.5 font-telemetry font-semibold ${
                            st.lowBattery ? 'text-[#EF4444]' : 'text-[#F8FAFC]'
                          }`}
                        >
                          {st.batteryLevel.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#26364A] pt-3">
                    <span className="font-telemetry text-[11px] text-[#94A3B8]">
                      Vib {st.vibrationFrequency.toFixed(1)} Hz · Tilt {st.tiltAngle.toFixed(1)}°
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStation(st)}
                    >
                      Inspect
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : null}

      {/* Station Detail Drawer */}
      {selectedStation ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#0B1220]/75 backdrop-blur-sm"
            onClick={() => setSelectedStation(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#26364A] bg-[#101B2B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26364A] px-5 py-4">
              <div>
                <p className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                  {selectedStation.stationId}
                </p>
                <h3 className="text-base font-semibold text-[#F8FAFC]">
                  {selectedStation.region} Monitoring Station
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStation(null)}
                aria-label="Close station drawer"
                className="rounded-lg border border-[#26364A] bg-[#141F30] p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge
                  level={selectedStation.classification}
                  score={selectedStation.overallRisk}
                />
                <StatusBadge
                  tone={selectedStation.connected ? 'online' : 'offline'}
                  label={selectedStation.connected ? 'CONNECTED' : 'DISCONNECTED'}
                />
                {selectedStation.lowBattery ? (
                  <Badge variant="danger">LOW BATTERY</Badge>
                ) : null}
              </div>

              <DataCard
                title="Geographic & Planar Projection"
                description="Equirectangular projection (R = 6371 km) from Telemetry.hpp"
              >
                <div className="space-y-2 font-telemetry text-xs">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-[#94A3B8]">
                      <MapPin className="h-3.5 w-3.5 text-[#38BDF8]" />
                      Coordinates
                    </span>
                    <span className="text-[#F8FAFC]">
                      {selectedStation.latitude.toFixed(4)}° N,{' '}
                      {selectedStation.longitude.toFixed(4)}° E
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-[#94A3B8]">
                      <Compass className="h-3.5 w-3.5 text-[#6366F1]" />
                      Planar XY
                    </span>
                    <span className="text-[#F8FAFC]">
                      ({selectedStation.projectedXKm.toFixed(1)} km,{' '}
                      {selectedStation.projectedYKm.toFixed(1)} km)
                    </span>
                  </div>
                </div>
              </DataCard>

              <DataCard title="Full Sensor Payload">
                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[#94A3B8]">Soil Saturation</dt>
                    <dd className="font-telemetry font-semibold text-[#F8FAFC]">
                      {selectedStation.soilSaturation.toFixed(3)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">Rainfall Rate</dt>
                    <dd className="font-telemetry font-semibold text-[#F8FAFC]">
                      {selectedStation.rainfallRate.toFixed(2)} mm/h
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">Vibration Freq</dt>
                    <dd className="font-telemetry font-semibold text-[#F8FAFC]">
                      {selectedStation.vibrationFrequency.toFixed(2)} Hz
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">Slope Tilt Angle</dt>
                    <dd className="font-telemetry font-semibold text-[#F8FAFC]">
                      {selectedStation.tiltAngle.toFixed(2)} deg
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">River Level</dt>
                    <dd className="font-telemetry font-semibold text-[#F8FAFC]">
                      {selectedStation.riverLevel.toFixed(2)} m
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[#94A3B8]">Battery Level</dt>
                    <dd className="font-telemetry font-semibold text-[#F8FAFC]">
                      {selectedStation.batteryLevel.toFixed(1)}%
                    </dd>
                  </div>
                </dl>
              </DataCard>

              <Link
                to={`/simulation?station=${encodeURIComponent(selectedStation.stationId)}`}
                className="block"
              >
                <Button className="w-full">Inject Manual Telemetry for {selectedStation.stationId}</Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
