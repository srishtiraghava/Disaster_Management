import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Compass, RefreshCw, RouteOff, X } from 'lucide-react'
import { sentraApi } from '@/api/client'
import { DataCard } from '@/components/common/DataCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton'
import { MetricCard } from '@/components/common/MetricCard'
import { PageContainer } from '@/components/common/PageContainer'
import { SectionHeader } from '@/components/common/SectionHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type {
  EvacuationResponse,
  EvacuationRouteRecord,
  RoadConditionName,
} from '@/types/sentra'

interface EvacuationPlanningPageProps {
  healthResult: BackendHealthResult
}

function roadConditionVariant(
  cond: RoadConditionName,
): 'success' | 'warning' | 'danger' | 'secondary' {
  switch (cond) {
    case 'good':
      return 'success'
    case 'slippery':
      return 'warning'
    case 'damaged':
    case 'blocked':
      return 'danger'
    default:
      return 'secondary'
  }
}

export function EvacuationPlanningPage({ healthResult }: EvacuationPlanningPageProps) {
  const [data, setData] = useState<EvacuationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [regionFilter, setRegionFilter] = useState<string>('ALL')
  const [selectedRoute, setSelectedRoute] = useState<{
    route: EvacuationRouteRecord
    rank: number | null
  } | null>(null)

  const loadEvacuation = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const resp = await sentraApi.getEvacuation()
      setData(resp)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evacuation plans')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadEvacuation(false)
  }, [loadEvacuation])

  const filteredRegions = useMemo(() => {
    if (!data) return []
    if (regionFilter === 'ALL') return data.regions
    return data.regions.filter((r) => r.region === regionFilter)
  }, [data, regionFilter])

  const totalRecommended =
    data?.regions.reduce((acc, r) => acc + r.recommendedRoutes.length, 0) ?? 0
  const totalUnavailable =
    data?.regions.reduce((acc, r) => acc + r.unavailableRoutes.length, 0) ?? 0

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="OPERATIONS · EVACUATION PRIORITY ENGINE"
        title="Evacuation Planning"
        subtitle="Routes ranked by EvacuationPriority (risk & road condition prioritized over distance; blocked or >= 75.0 risk routes excluded)"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void healthResult.refresh()
              void loadEvacuation(true)
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      {loading && !data ? <LoadingSkeleton cards={3} rows={4} /> : null}

      {error ? (
        <ErrorState
          title="Evacuation Planning Unavailable"
          message={error}
          onRetry={() => void loadEvacuation(true)}
        />
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              title="Safe Recommended Routes"
              value={totalRecommended}
              subtitle="Passed road & risk threshold checks"
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent="green"
            />
            <MetricCard
              title="Unavailable / Blocked"
              value={totalUnavailable}
              subtitle="Excluded from evacuation dispatch"
              icon={<RouteOff className="h-4 w-4" />}
              accent="red"
            />
            <MetricCard
              title="Max Safe Route Risk"
              value={`< ${data.maxSafeRouteRisk.toFixed(1)}`}
              subtitle={`Cycle #${data.cycle} · C++ safety cutoff`}
              icon={<Compass className="h-4 w-4" />}
              accent="cyan"
            />
          </div>

          {/* Region Filter */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#26364A] bg-[#141F30] px-4 py-3">
            <span className="text-xs font-medium text-[#94A3B8]">Region:</span>
            <button
              type="button"
              onClick={() => setRegionFilter('ALL')}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                regionFilter === 'ALL'
                  ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                  : 'border-[#26364A] bg-[#101B2B] text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              All Regions
            </button>
            {data.regions.map((r) => (
              <button
                key={r.region}
                type="button"
                onClick={() => setRegionFilter(r.region)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  regionFilter === r.region
                    ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                    : 'border-[#26364A] bg-[#101B2B] text-[#94A3B8] hover:text-[#F8FAFC]'
                }`}
              >
                {r.region}
              </button>
            ))}
          </div>

          {/* Per-Region Route Cards */}
          <div className="space-y-5">
            {filteredRegions.map((reg) => (
              <DataCard
                key={reg.region}
                title={`${reg.region} (${reg.stationId})`}
                description={`${reg.recommendedRoutes.length} recommended route(s) · ${reg.unavailableRoutes.length} unavailable`}
              >
                <div className="space-y-4">
                  {/* Recommended Routes */}
                  {reg.recommendedRoutes.length === 0 ? (
                    <div className="flex items-center gap-3 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-xs text-[#EF4444]">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        No safe available route in the simulation for {reg.region} (all
                        candidate corridors are blocked or exceed the {data.maxSafeRouteRisk}{' '}
                        risk cutoff).
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#22C55E]">
                        Recommended Corridors (Prioritized)
                      </p>
                      {reg.recommendedRoutes.map((route, idx) => (
                        <div
                          key={route.routeId}
                          onClick={() => setSelectedRoute({ route, rank: idx + 1 })}
                          className={`flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors hover:bg-[#19283B]/70 ${
                            idx === 0
                              ? 'border-[#22C55E]/40 bg-[#22C55E]/5'
                              : 'border-[#26364A] bg-[#101B2B]'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-telemetry text-xs font-bold text-[#38BDF8]">
                                #{idx + 1}
                              </span>
                              <span className="font-telemetry text-xs font-semibold text-[#F8FAFC]">
                                {route.routeId}
                              </span>
                              <span className="text-xs text-[#94A3B8]">
                                → {route.destination}
                              </span>
                              {idx === 0 ? (
                                <Badge variant="success">PRIMARY</Badge>
                              ) : null}
                            </div>
                            <p className="mt-1 font-telemetry text-[11px] text-[#94A3B8]">
                              {route.distanceKm.toFixed(1)} km · Adj Landslide{' '}
                              {route.landslideRisk.toFixed(1)} · Adj Flood{' '}
                              {route.floodRisk.toFixed(1)}
                            </p>
                          </div>
                          <Badge variant={roadConditionVariant(route.roadCondition)}>
                            {route.roadCondition.toUpperCase()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Unavailable / Blocked Routes */}
                  {reg.unavailableRoutes.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-[#EF4444]">
                        Unavailable / Excluded Corridors
                      </p>
                      {reg.unavailableRoutes.map((route) => (
                        <div
                          key={route.routeId}
                          onClick={() => setSelectedRoute({ route, rank: null })}
                          className="flex cursor-pointer flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EF4444]/30 bg-[#101B2B] px-4 py-3 opacity-90 transition-colors hover:bg-[#19283B]/70"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-telemetry text-xs font-semibold text-[#F8FAFC]">
                                {route.routeId}
                              </span>
                              <span className="text-xs text-[#94A3B8]">
                                → {route.destination}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-[#94A3B8]">
                              Excluded:{' '}
                              {route.roadCondition === 'blocked'
                                ? 'Road condition is BLOCKED'
                                : 'Marked unavailable by C++ route filter'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={roadConditionVariant(route.roadCondition)}>
                              {route.roadCondition.toUpperCase()}
                            </Badge>
                            <Badge variant="danger">UNAVAILABLE</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </DataCard>
            ))}

            {filteredRegions.length === 0 ? (
              <EmptyState
                title="No Regions Found"
                description="No evacuation route data matched the selected region."
              />
            ) : null}
          </div>
        </>
      ) : null}

      {/* Route Detail Drawer */}
      {selectedRoute ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#0B1220]/75 backdrop-blur-sm"
            onClick={() => setSelectedRoute(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#26364A] bg-[#101B2B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26364A] px-5 py-4">
              <div>
                <p className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                  {selectedRoute.route.routeId}
                </p>
                <h3 className="text-base font-semibold text-[#F8FAFC]">
                  {selectedRoute.route.startingRegion} → {selectedRoute.route.destination}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoute(null)}
                aria-label="Close route drawer"
                className="rounded-lg border border-[#26364A] bg-[#141F30] p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={roadConditionVariant(selectedRoute.route.roadCondition)}>
                  ROAD: {selectedRoute.route.roadCondition.toUpperCase()}
                </Badge>
                {selectedRoute.rank !== null ? (
                  <Badge variant="success">RANK #{selectedRoute.rank} RECOMMENDED</Badge>
                ) : (
                  <Badge variant="danger">UNAVAILABLE</Badge>
                )}
              </div>

              <DataCard title="Route Telemetry & Risk Adjustment">
                <dl className="space-y-2.5 font-telemetry text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Distance</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRoute.route.distanceKm.toFixed(1)} km
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Adjusted Landslide Risk</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRoute.route.landslideRisk.toFixed(1)} / 100
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Adjusted Flood Risk</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRoute.route.floodRisk.toFixed(1)} / 100
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Backend Available Flag</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedRoute.route.available ? 'true' : 'false'}
                    </dd>
                  </div>
                </dl>
              </DataCard>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
