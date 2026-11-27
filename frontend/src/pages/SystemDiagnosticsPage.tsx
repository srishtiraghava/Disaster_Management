import { useState } from 'react'
import { Activity, CheckCircle2, Play, RefreshCw, XCircle } from 'lucide-react'
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
import type { DiagnosticsResponse } from '@/types/sentra'

interface SystemDiagnosticsPageProps {
  healthResult: BackendHealthResult
}

export function SystemDiagnosticsPage({ healthResult }: SystemDiagnosticsPageProps) {
  const [result, setResult] = useState<DiagnosticsResponse | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRunAt, setLastRunAt] = useState<Date | null>(null)

  const executeDiagnostics = async () => {
    setRunning(true)
    setError(null)
    try {
      const resp = await sentraApi.runDiagnostics()
      setResult(resp)
      setLastRunAt(new Date())
      await healthResult.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute C++ diagnostics')
    } finally {
      setRunning(false)
    }
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="SYSTEM · NON-DESTRUCTIVE C++17 SELF-TEST"
        title="System Diagnostics"
        subtitle="Executes POST /api/diagnostics to verify virtual diamond inheritance, polymorphic sweep, deep copy, checksums, binary store, and projections"
        actions={
          <div className="flex items-center gap-3">
            {lastRunAt ? (
              <span className="hidden font-telemetry text-[11px] text-[#94A3B8] sm:inline">
                Last run {lastRunAt.toLocaleTimeString()}
              </span>
            ) : null}
            <Button onClick={() => void executeDiagnostics()} disabled={running}>
              {running ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {running ? 'Running Diagnostics...' : result ? 'Rerun Diagnostics' : 'Run Diagnostics'}
            </Button>
          </div>
        }
      />

      {running ? <LoadingSkeleton cards={3} rows={4} /> : null}

      {error ? (
        <ErrorState
          title="Diagnostics Execution Unavailable"
          message={`${error}. Checks could not be executed against SENTRA_api (status: unavailable).`}
          onRetry={() => void executeDiagnostics()}
        />
      ) : null}

      {!running && !error && !result ? (
        <EmptyState
          title="Diagnostics Not Yet Executed"
          description="Click 'Run Diagnostics' to execute the 6 live C++17 verification checks on SENTRA_api. No results are fabricated prior to execution."
          icon={<Activity className="h-5 w-5" />}
          action={
            <Button onClick={() => void executeDiagnostics()}>
              <Play className="h-4 w-4" />
              Run Diagnostics
            </Button>
          }
        />
      ) : null}

      {!running && result ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MetricCard
              title="Diagnostic Outcome"
              value={result.allPassed ? 'ALL PASSED' : 'FAILURES DETECTED'}
              subtitle={lastRunAt ? `Executed at ${lastRunAt.toLocaleTimeString()}` : undefined}
              icon={<Activity className="h-4 w-4" />}
              accent={result.allPassed ? 'green' : 'red'}
            />
            <MetricCard
              title="Checks Passed"
              value={`${result.passed} / ${result.total}`}
              subtitle="Live verification count"
              icon={<CheckCircle2 className="h-4 w-4" />}
              accent={result.passed === result.total ? 'green' : 'amber'}
            />
            <MetricCard
              title="Checks Failed"
              value={result.total - result.passed}
              subtitle="Returned by POST /api/diagnostics"
              icon={<XCircle className="h-4 w-4" />}
              accent={result.total - result.passed > 0 ? 'red' : 'cyan'}
            />
          </div>

          <DataCard
            title="C++17 Subsystem Verification Checks"
            description="Exact check results and diagnostic details returned by SENTRA_api"
          >
            <div className="space-y-3">
              {result.checks.map((chk) => (
                <div
                  key={chk.name}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3.5 ${
                    chk.passed
                      ? 'border-[#22C55E]/30 bg-[#101B2B]'
                      : 'border-[#EF4444]/45 bg-[#EF4444]/10'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F8FAFC]">{chk.name}</p>
                    <p className="mt-0.5 font-telemetry text-xs text-[#94A3B8]">{chk.detail}</p>
                  </div>
                  <StatusBadge
                    tone={chk.passed ? 'online' : 'offline'}
                    label={chk.passed ? 'PASS' : 'FAIL'}
                  />
                </div>
              ))}
            </div>
          </DataCard>
        </>
      ) : null}
    </PageContainer>
  )
}
