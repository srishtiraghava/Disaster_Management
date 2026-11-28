import { useCallback, useEffect, useMemo, useState } from 'react'
import { Database, Info, RefreshCw, ShieldCheck, X } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
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
import { SectionHeader } from '@/components/common/SectionHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type { AuditResponse } from '@/types/sentra'

interface TelemetryAuditPageProps {
  healthResult: BackendHealthResult
}

export function TelemetryAuditPage({ healthResult }: TelemetryAuditPageProps) {
  const [audit, setAudit] = useState<AuditResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [stationFilter, setStationFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'VERIFIED' | 'REJECTED'>('ALL')
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)

  const loadAudit = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const resp = await sentraApi.getAudit()
      setAudit(resp)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch telemetry audit')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadAudit(false)
  }, [loadAudit])

  const mergedRows = useMemo(() => {
    if (!audit) return []
    return audit.stationAudits
      .map((sa) => {
        const csum = audit.checksums.find((c) => c.stationId === sa.stationId)
        return {
          ...sa,
          checksum: csum?.checksum ?? '—',
          verified: csum?.verified ?? false,
        }
      })
      .filter((row) => {
        if (stationFilter !== 'ALL' && row.stationId !== stationFilter) return false
        if (statusFilter === 'VERIFIED' && !row.verified) return false
        if (statusFilter === 'REJECTED' && row.verified) return false
        return true
      })
  }, [audit, stationFilter, statusFilter])

  const selectedAudit = selectedStationId
    ? (mergedRows.find((r) => r.stationId === selectedStationId) ??
      audit?.stationAudits.find((r) => r.stationId === selectedStationId))
    : null

  const selectedChecksum = selectedStationId
    ? audit?.checksums.find((c) => c.stationId === selectedStationId)
    : null

  const bufferChartData =
    audit?.buffer.samples.map((value, idx) => ({
      sample: `#${idx + 1}`,
      risk: Number(value.toFixed(2)),
    })) ?? []

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="SYSTEM · TELEMETRY AUDITOR & BUFFER DEEP COPY"
        title="Telemetry Audit"
        subtitle="Friend-class TelemetryAuditor history, Rule-of-Five TelemetryBuffer snapshot, and FNV-32 checksum verification"
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              void healthResult.refresh()
              void loadAudit(true)
            }}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        }
      />

      <div className="flex items-start gap-3 rounded-xl border border-[#38BDF8]/35 bg-[#38BDF8]/10 px-4 py-3 text-xs">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-[#38BDF8]" />
        <p className="text-[#F8FAFC]">
          <span className="font-semibold">Validation &amp; Integrity Policy:</span> Invalid
          manual telemetry (non-finite values, unknown station/region, or out-of-range inputs) is
          rejected immediately by <span className="font-telemetry">SimulationEngine::validateTelemetry()</span>{' '}
          before entering the audit buffer. Payload integrity is verified via FNV-32 checksums
          in <span className="font-telemetry">verifyTelemetryChecksum()</span>.
        </p>
      </div>

      {loading && !audit ? <LoadingSkeleton cards={4} rows={3} /> : null}

      {error ? (
        <ErrorState
          title="Telemetry Audit Unavailable"
          message={error}
          onRetry={() => void loadAudit(true)}
        />
      ) : null}

      {audit ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Buffer Source Size"
              value={`${audit.buffer.sourceSize} / ${audit.buffer.sourceCapacity}`}
              subtitle="Live TelemetryBuffer heap allocation"
              icon={<Database className="h-4 w-4" />}
              accent="cyan"
            />
            <MetricCard
              title="Deep-Copy Snapshot"
              value={`${audit.buffer.snapshotSize} / ${audit.buffer.snapshotCapacity}`}
              subtitle="Isolated copy via copy constructor"
              icon={<ShieldCheck className="h-4 w-4" />}
              accent="indigo"
            />
            <MetricCard
              title="Verified Checksums"
              value={`${audit.checksums.filter((c) => c.verified).length} / ${audit.checksums.length}`}
              subtitle="FNV-32 payload integrity"
              icon={<ShieldCheck className="h-4 w-4" />}
              accent="green"
            />
            <MetricCard
              title="Engine Cycle"
              value={`#${audit.cycle}`}
              subtitle="From GET /api/audit"
              icon={<RefreshCw className="h-4 w-4" />}
              accent="cyan"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#26364A] bg-[#141F30] px-4 py-3">
            <div className="flex items-center gap-2">
              <label htmlFor="audit-station" className="text-xs text-[#94A3B8]">
                Station:
              </label>
              <select
                id="audit-station"
                value={stationFilter}
                onChange={(e) => setStationFilter(e.target.value)}
                className="rounded-lg border border-[#26364A] bg-[#101B2B] px-2.5 py-1 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              >
                <option value="ALL">All Stations</option>
                {audit.stationAudits.map((s) => (
                  <option key={s.stationId} value={s.stationId}>
                    {s.stationId}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#94A3B8]">Checksum Status:</span>
              {(['ALL', 'VERIFIED', 'REJECTED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-md border px-2.5 py-1 font-telemetry text-[11px] font-semibold transition-colors ${
                    statusFilter === status
                      ? 'border-[#38BDF8] bg-[#38BDF8]/15 text-[#38BDF8]'
                      : 'border-[#26364A] bg-[#101B2B] text-[#94A3B8] hover:text-[#F8FAFC]'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          {/* Station Audit Table */}
          <DataCard
            title="Station TelemetryAuditor & Checksum Records"
            description="Click any station row to inspect its recorded risk sample history"
          >
            {mergedRows.length === 0 ? (
              <EmptyState
                title="No Matching Audit Records"
                description="Adjust station or checksum status filters."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#26364A] text-[11px] uppercase tracking-wider text-[#94A3B8]">
                      <th className="py-3 pr-4">Station ID</th>
                      <th className="py-3 pr-4">Latest Raw Risk</th>
                      <th className="py-3 pr-4">Samples Recorded</th>
                      <th className="py-3 pr-4">FNV-32 Checksum</th>
                      <th className="py-3 pr-4">Integrity</th>
                      <th className="py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#26364A]/60">
                    {mergedRows.map((row) => (
                      <tr
                        key={row.stationId}
                        onClick={() => setSelectedStationId(row.stationId)}
                        className="cursor-pointer transition-colors hover:bg-[#19283B]/70"
                      >
                        <td className="py-3 pr-4 font-telemetry font-semibold text-[#38BDF8]">
                          {row.stationId}
                        </td>
                        <td className="py-3 pr-4 font-telemetry text-[#F8FAFC]">
                          {row.latestRawRisk.toFixed(2)}
                        </td>
                        <td className="py-3 pr-4 font-telemetry text-[#F8FAFC]">
                          {row.sampleCount}
                        </td>
                        <td className="py-3 pr-4 font-telemetry text-[#94A3B8]">
                          {row.checksum}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge
                            tone={row.verified ? 'online' : 'offline'}
                            label={row.verified ? 'VERIFIED' : 'REJECTED'}
                          />
                        </td>
                        <td className="py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedStationId(row.stationId)
                            }}
                          >
                            Inspect
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </DataCard>

          {/* TelemetryBuffer Samples Chart */}
          <DataCard
            title="TelemetryBuffer Sample Sequence"
            description="Sequential overall risk measurements stored in TelemetryBuffer"
          >
            {bufferChartData.length === 0 ? (
              <EmptyState
                title="Audit Buffer Empty"
                description="Run a simulation cycle or manual telemetry injection to record samples into TelemetryBuffer."
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={bufferChartData}
                    margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                  >
                    <CartesianGrid stroke="#26364A" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="sample"
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
                    <Line
                      type="monotone"
                      dataKey="risk"
                      stroke="#38BDF8"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#38BDF8' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </DataCard>
        </>
      ) : null}

      {/* Station Audit Detail Drawer */}
      {selectedAudit ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#0B1220]/75 backdrop-blur-sm"
            onClick={() => setSelectedStationId(null)}
          />
          <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-[#26364A] bg-[#101B2B] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#26364A] px-5 py-4">
              <div>
                <p className="font-telemetry text-xs font-semibold text-[#38BDF8]">
                  {selectedAudit.stationId}
                </p>
                <h3 className="text-base font-semibold text-[#F8FAFC]">
                  TelemetryAuditor Inspection
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStationId(null)}
                aria-label="Close audit drawer"
                className="rounded-lg border border-[#26364A] bg-[#141F30] p-1.5 text-[#94A3B8] hover:text-[#F8FAFC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <DataCard title="Audit Summary">
                <dl className="space-y-2.5 font-telemetry text-xs">
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Latest Raw Risk</dt>
                    <dd className="text-[#F8FAFC]">{selectedAudit.latestRawRisk.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Samples Recorded</dt>
                    <dd className="text-[#F8FAFC]">{selectedAudit.sampleCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">FNV-32 Checksum</dt>
                    <dd className="text-[#F8FAFC]">{selectedChecksum?.checksum ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[#94A3B8]">Verification</dt>
                    <dd>
                      <StatusBadge
                        tone={selectedChecksum?.verified ? 'online' : 'offline'}
                        label={selectedChecksum?.verified ? 'VERIFIED' : 'REJECTED'}
                      />
                    </dd>
                  </div>
                </dl>
              </DataCard>

              <DataCard title="Recorded History Samples">
                {selectedAudit.history.length === 0 ? (
                  <p className="text-xs text-[#94A3B8]">No samples recorded for this station yet.</p>
                ) : (
                  <ul className="space-y-1.5 font-telemetry text-xs">
                    {selectedAudit.history.map((val, idx) => (
                      <li
                        key={idx}
                        className="flex justify-between rounded-md border border-[#26364A]/60 bg-[#141F30] px-3 py-1.5"
                      >
                        <span className="text-[#94A3B8]">Sample #{idx + 1}</span>
                        <span className="font-semibold text-[#F8FAFC]">{val.toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </DataCard>
            </div>
          </div>
        </div>
      ) : null}
    </PageContainer>
  )
}
