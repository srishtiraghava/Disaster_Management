import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Database,
  Edit3,
  History,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { ApiError, sentraApi } from '@/api/client'
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
import type { IncidentRecord, IncidentsResponse, RiskClassName } from '@/types/sentra'

interface IncidentHistoryPageProps {
  healthResult: BackendHealthResult
}

function riskFromNormalized(normalized: number): RiskClassName {
  const score = normalized * 100
  if (score >= 75) return 'CRITICAL'
  if (score >= 50) return 'HIGH'
  if (score >= 25) return 'MODERATE'
  return 'LOW'
}

export function IncidentHistoryPage({ healthResult }: IncidentHistoryPageProps) {
  const [data, setData] = useState<IncidentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [regionFilter, setRegionFilter] = useState('ALL')
  const [sirenFilter, setSirenFilter] = useState<'ALL' | 'YES' | 'NO'>('ALL')

  const [exactIdInput, setExactIdInput] = useState('')
  const [exactSearchError, setExactSearchError] = useState<string | null>(null)
  const [searchingExact, setSearchingExact] = useState(false)

  const [selectedIncident, setSelectedIncident] = useState<IncidentRecord | null>(null)
  const [routeDraft, setRouteDraft] = useState('')
  const [confirmPatch, setConfirmPatch] = useState(false)
  const [patching, setPatching] = useState(false)
  const [patchError, setPatchError] = useState<string | null>(null)
  const [patchSuccess, setPatchSuccess] = useState<string | null>(null)

  const loadIncidents = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const resp = await sentraApi.getIncidents()
      setData(resp)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load persisted incidents')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadIncidents(false)
  }, [loadIncidents])

  const openIncident = (inc: IncidentRecord) => {
    setSelectedIncident(inc)
    setRouteDraft(inc.evacuationRoute)
    setConfirmPatch(false)
    setPatchError(null)
    setPatchSuccess(null)
  }

  const handleExactIdLookup = async (e: React.FormEvent) => {
    e.preventDefault()
    const id = exactIdInput.trim()
    if (!id) return
    setSearchingExact(true)
    setExactSearchError(null)
    try {
      const found = await sentraApi.getIncidentById(id)
      openIncident(found)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setExactSearchError(`Incident ID '${id}' was not found in the binary log.`)
      } else {
        setExactSearchError(err instanceof Error ? err.message : 'Lookup failed')
      }
    } finally {
      setSearchingExact(false)
    }
  }

  const handleConfirmUpdate = async () => {
    if (!selectedIncident) return
    const trimmed = routeDraft.trim()
    if (!trimmed || trimmed.length >= 160) {
      setPatchError('Evacuation route must be between 1 and 159 characters.')
      setConfirmPatch(false)
      return
    }
    setPatching(true)
    setPatchError(null)
    setPatchSuccess(null)
    try {
      const updated = await sentraApi.updateIncidentRoute(selectedIncident.incidentId, trimmed)
      setSelectedIncident(updated)
      setRouteDraft(updated.evacuationRoute)
      setConfirmPatch(false)
      setPatchSuccess('Incident updated in-place in binary store via seekp().')
      setData((prev) =>
        prev
          ? {
              ...prev,
              incidents: prev.incidents.map((item) =>
                item.incidentId === updated.incidentId ? updated : item,
              ),
            }
          : prev,
      )
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : 'Failed to update incident')
      setConfirmPatch(false)
    } finally {
      setPatching(false)
    }
  }

  const availableRegions = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.incidents.map((i) => i.region))).sort()
  }, [data])

  const filteredIncidents = useMemo(() => {
    if (!data) return []
    const q = searchQuery.trim().toLowerCase()
    return [...data.incidents].reverse().filter((inc) => {
      if (regionFilter !== 'ALL' && inc.region !== regionFilter) return false
      if (sirenFilter === 'YES' && !inc.sirenActivated) return false
      if (sirenFilter === 'NO' && inc.sirenActivated) return false
      if (q) {
        const match =
          inc.incidentId.toLowerCase().includes(q) ||
          inc.stationId.toLowerCase().includes(q) ||
          inc.region.toLowerCase().includes(q) ||
          inc.incidentType.toLowerCase().includes(q) ||
          inc.evacuationRoute.toLowerCase().includes(q)
        if (!match) return false
      }
      return true
    })
  }, [data, searchQuery, regionFilter, sirenFilter])

  const sirenTriggeredCount = data?.incidents.filter((i) => i.sirenActivated).length ?? 0

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="SYSTEM · PERSISTENT BINARY INCIDENT LOG"
        title="Incident History"
        subtitle="Fixed-width 433-byte binary records persisted across restarts by IncidentLogger (distinct from live session alerts)"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void healthResult.refresh()
              void loadIncidents(true)
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
          title="Incident Log Unavailable"
          message={error}
          onRetry={() => void loadIncidents(true)}
        />
      ) : null}

      {data ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              title="Persisted Incidents"
              value={data.total}
              subtitle="Stored in binary IncidentLogger"
              icon={<Database className="h-4 w-4" />}
              accent="cyan"
            />
            <MetricCard
              title="Siren-Triggered Records"
              value={sirenTriggeredCount}
              subtitle="Incidents recorded with active siren"
              icon={<ShieldAlert className="h-4 w-4" />}
              accent={sirenTriggeredCount > 0 ? 'red' : 'green'}
            />
            <MetricCard
              title="Filtered Results"
              value={filteredIncidents.length}
              subtitle="Matching current search & filters"
              icon={<History className="h-4 w-4" />}
              accent="indigo"
            />
          </div>

          {/* Direct ID Lookup + Filters */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <form
              onSubmit={(e) => void handleExactIdLookup(e)}
              className="flex flex-col gap-2 rounded-xl border border-[#26364A] bg-[#141F30] p-4 lg:col-span-5"
            >
              <label htmlFor="exact-incident-id" className="text-xs font-semibold text-[#F8FAFC]">
                Direct Binary Lookup (GET /api/incidents/:id)
              </label>
              <div className="flex gap-2">
                <input
                  id="exact-incident-id"
                  type="text"
                  placeholder="e.g. SIM-000001-UK-UTT-01"
                  value={exactIdInput}
                  onChange={(e) => setExactIdInput(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-1.5 font-telemetry text-xs text-[#F8FAFC] placeholder:text-[#94A3B8]/60 focus:border-[#38BDF8] focus:outline-none"
                />
                <Button type="submit" size="sm" disabled={searchingExact || !exactIdInput.trim()}>
                  <Search className="h-3.5 w-3.5" />
                  {searchingExact ? 'Searching...' : 'Find ID'}
                </Button>
              </div>
              {exactSearchError ? (
                <p className="text-xs text-[#EF4444]">{exactSearchError}</p>
              ) : null}
            </form>

            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#26364A] bg-[#141F30] p-4 lg:col-span-7">
              <div className="min-w-[180px] flex-1">
                <label htmlFor="inc-filter-q" className="block text-[11px] text-[#94A3B8]">
                  Filter Loaded Records
                </label>
                <input
                  id="inc-filter-q"
                  type="text"
                  placeholder="Search ID, station, region, type, route..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-1.5 text-xs text-[#F8FAFC] placeholder:text-[#94A3B8]/60 focus:border-[#38BDF8] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="inc-region" className="block text-[11px] text-[#94A3B8]">
                  Region
                </label>
                <select
                  id="inc-region"
                  value={regionFilter}
                  onChange={(e) => setRegionFilter(e.target.value)}
                  className="mt-1 rounded-lg border border-[#26364A] bg-[#101B2B] px-2.5 py-1.5 text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                >
                  <option value="ALL">All Regions</option>
                  {availableRegions.map((reg) => (
                    <option key={reg} value={reg}>
                      {reg}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="inc-siren" className="block text-[11px] text-[#94A3B8]">
                  Siren
                </label>
                <select
                  id="inc-siren"
                  value={sirenFilter}
                  onChange={(e) => setSirenFilter(e.target.value as 'ALL' | 'YES' | 'NO')}
                  className="mt-1 rounded-lg border border-[#26364A] bg-[#101B2B] px-2.5 py-1.5 text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                >
                  <option value="ALL">All</option>
                  <option value="YES">Activated</option>
                  <option value="NO">Not Activated</option>
                </select>
              </div>
            </div>
          </div>

          <DataCard
            title="Persisted Incident Records"
            description="Click any incident to inspect full details or update its evacuation route in-place"
          >
            {filteredIncidents.length === 0 ? (
              <EmptyState
                title="No Persisted Incidents Found"
                description={
                  data.total === 0
                    ? 'No HIGH/CRITICAL (>= 50) or critical-battery (<= 15%) incidents have been persisted yet.'
                    : 'No records matched your current search or filter criteria.'
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#26364A] text-[11px] uppercase tracking-wider text-[#94A3B8]">
                      <th className="py-3 pr-4">Incident ID</th>
                      <th className="py-3 pr-4">Timestamp</th>
                      <th className="py-3 pr-4">Region / Station</th>
                      <th className="py-3 pr-4">Type</th>
                      <th className="py-3 pr-4">Overall Risk</th>
                      <th className="py-3 pr-4">Siren</th>
                      <th className="py-3 pr-4">Evacuation Route</th>
                      <th className="py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#26364A]/60">
                    {filteredIncidents.map((inc) => {
                      const cls = riskFromNormalized(inc.overallRisk)
                      return (
                        <tr
                          key={inc.incidentId}
                          onClick={() => openIncident(inc)}
                          className="cursor-pointer transition-colors hover:bg-[#19283B]/70"
                        >
                          <td className="py-3 pr-4 font-telemetry font-semibold text-[#38BDF8]">
                            {inc.incidentId}
                          </td>
                          <td className="py-3 pr-4 font-telemetry text-[#94A3B8]">
                            {inc.timestamp}
                          </td>
                          <td className="py-3 pr-4">
                            <p className="font-medium text-[#F8FAFC]">{inc.region}</p>
                            <p className="font-telemetry text-[11px] text-[#94A3B8]">
                              {inc.stationId}
                            </p>
                          </td>
                          <td className="py-3 pr-4 text-[#F8FAFC]">{inc.incidentType}</td>
                          <td className="py-3 pr-4">
                            <RiskBadge level={cls} score={inc.overallRisk * 100} />
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge
                              tone={inc.sirenActivated ? 'active' : 'standby'}
                              label={inc.sirenActivated ? 'YES' : 'NO'}
                            />
                          </td>
                          <td className="py-3 pr-4 font-telemetry text-[#F8FAFC]">
                            {inc.evacuationRoute}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                openIncident(inc)
                              }}
                            >
                              Inspect
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>
        </>
      ) : null}

      {/* Incident Detail & In-Place Update Drawer */}
      {selectedIncident ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#0B1220]/75 backdrop-blur-sm"
            onClick={() => setSelectedIncident(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#26364A] bg-[#101B2B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26364A] px-5 py-4">
              <div>
                <p className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                  {selectedIncident.incidentId}
                </p>
                <h3 className="text-base font-semibold text-[#F8FAFC]">
                  Persisted Incident Record
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIncident(null)}
                aria-label="Close incident drawer"
                className="rounded-lg border border-[#26364A] bg-[#141F30] p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <DataCard title="Serialized Binary Fields">
                <dl className="space-y-2.5 font-telemetry text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Timestamp</dt>
                    <dd className="text-[#F8FAFC]">{selectedIncident.timestamp}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Station / Region</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedIncident.stationId} ({selectedIncident.region})
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Incident Type</dt>
                    <dd className="text-[#F8FAFC]">{selectedIncident.incidentType}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Landslide Risk</dt>
                    <dd className="text-[#F8FAFC]">
                      {(selectedIncident.landslideRisk * 100).toFixed(1)} / 100
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Flood Risk</dt>
                    <dd className="text-[#F8FAFC]">
                      {(selectedIncident.floodRisk * 100).toFixed(1)} / 100
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Overall Risk</dt>
                    <dd>
                      <RiskBadge
                        level={riskFromNormalized(selectedIncident.overallRisk)}
                        score={selectedIncident.overallRisk * 100}
                      />
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Siren Activated</dt>
                    <dd className="text-[#F8FAFC]">
                      {selectedIncident.sirenActivated ? 'YES' : 'NO'}
                    </dd>
                  </div>
                </dl>
              </DataCard>

              <DataCard
                title="Update Evacuation Route (PATCH)"
                description="Modifies only evacuationRoute in-place via IncidentLogger::updateById() with rollback protection"
              >
                <div className="space-y-3">
                  <div>
                    <label htmlFor="patch-route" className="block text-xs text-[#94A3B8]">
                      Evacuation Route (1–159 chars)
                    </label>
                    <input
                      id="patch-route"
                      type="text"
                      maxLength={159}
                      value={routeDraft}
                      onChange={(e) => {
                        setRouteDraft(e.target.value)
                        setConfirmPatch(false)
                        setPatchError(null)
                      }}
                      className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
                    />
                  </div>

                  {!confirmPatch ? (
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={
                        patching ||
                        !routeDraft.trim() ||
                        routeDraft.trim() === selectedIncident.evacuationRoute
                      }
                      onClick={() => setConfirmPatch(true)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Update Evacuation Route
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-lg border border-[#F59E0B]/40 bg-[#F59E0B]/10 p-3">
                      <p className="text-xs text-[#F8FAFC]">
                        Confirm in-place binary update of{' '}
                        <span className="font-telemetry font-semibold">
                          {selectedIncident.incidentId}
                        </span>{' '}
                        to route{' '}
                        <span className="font-telemetry font-semibold">{routeDraft.trim()}</span>?
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => setConfirmPatch(false)}
                          disabled={patching}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => void handleConfirmUpdate()}
                          disabled={patching}
                        >
                          {patching ? 'Saving...' : 'Confirm'}
                        </Button>
                      </div>
                    </div>
                  )}

                  {patchError ? (
                    <div className="flex items-center gap-2 text-xs text-[#EF4444]">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{patchError}</span>
                    </div>
                  ) : null}

                  {patchSuccess ? (
                    <div className="flex items-center gap-2 text-xs text-[#22C55E]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span>{patchSuccess}</span>
                    </div>
                  ) : null}
                </div>
              </DataCard>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
