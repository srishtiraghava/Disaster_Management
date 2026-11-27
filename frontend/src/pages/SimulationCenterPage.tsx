import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Cpu, Play, ShieldAlert, Sliders } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { sentraApi } from '@/api/client'
import { DataCard } from '@/components/common/DataCard'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { PageContainer } from '@/components/common/PageContainer'
import { RiskBadge } from '@/components/common/RiskBadge'
import { SectionHeader } from '@/components/common/SectionHeader'
import { StatusBadge } from '@/components/common/StatusBadge'
import { Button } from '@/components/ui/button'
import type { BackendHealthResult } from '@/hooks/useBackendHealth'
import type {
  ManualTelemetryPayload,
  SimulationResult,
  SimulationScenarioKey,
  StationDetail,
} from '@/types/sentra'

interface SimulationCenterPageProps {
  healthResult: BackendHealthResult
}

interface ScenarioMeta {
  key: SimulationScenarioKey
  label: string
  description: string
  severityHint: string
}

const SCENARIOS: ScenarioMeta[] = [
  {
    key: 'Normal',
    label: 'Normal Conditions',
    description: 'Baseline Himalayan telemetry with standard 4% Gaussian sensor jitter.',
    severityHint: 'Baseline',
  },
  {
    key: 'HeavyRainfall',
    label: 'Heavy Rainfall',
    description: 'Sustained 48–66 mm/h precipitation with elevated soil moisture and river runoff.',
    severityHint: 'Elevated',
  },
  {
    key: 'IncreasingSoilSaturation',
    label: 'Increasing Soil Saturation',
    description: 'Progressive pore-water accumulation (+0.09/cycle up to 0.97) destabilizing slopes.',
    severityHint: 'Landslide',
  },
  {
    key: 'AbnormalSeismicVibrations',
    label: 'Abnormal Seismic Vibrations',
    description: '25–43 Hz ground vibration spikes accompanied by +5° slope tilt.',
    severityHint: 'Seismic',
  },
  {
    key: 'RapidRiverRise',
    label: 'Rapid River Rise',
    description: 'Hydrological surge (+0.75 m/cycle up to 5.9 m) driving flash-flood risk.',
    severityHint: 'Flood',
  },
  {
    key: 'CombinedThreat',
    label: 'Combined Threat',
    description: 'Simultaneous extreme rainfall, saturated soil, seismic shock, and river surge.',
    severityHint: 'Critical',
  },
]

export function SimulationCenterPage({ healthResult }: SimulationCenterPageProps) {
  const [searchParams] = useSearchParams()
  const [mode, setMode] = useState<'scenario' | 'manual'>(
    searchParams.get('station') ? 'manual' : 'scenario',
  )

  const [stations, setStations] = useState<StationDetail[]>([])
  const [selectedScenario, setSelectedScenario] = useState<SimulationScenarioKey>('Normal')
  const [cycles, setCycles] = useState<number>(1)

  const [manualForm, setManualForm] = useState<ManualTelemetryPayload>({
    stationId: 'UK-UTT-01',
    region: 'Uttarkashi',
    soilSaturation: 0.35,
    rainfallRate: 12.0,
    vibrationFrequency: 3.0,
    tiltAngle: 4.0,
    riverLevel: 1.5,
    batteryLevel: 95.0,
    connected: true,
  })

  const [confirmPending, setConfirmPending] = useState<'scenario' | 'manual' | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [results, setResults] = useState<SimulationResult[]>([])
  const [lastRunSummary, setLastRunSummary] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    sentraApi
      .getStations()
      .then((resp) => {
        if (!active) return
        setStations(resp.stations)
        const targetId = searchParams.get('station')
        const match =
          resp.stations.find((s) => s.stationId === targetId) ?? resp.stations[0]
        if (match) {
          setManualForm({
            stationId: match.stationId,
            region: match.region,
            soilSaturation: Number(match.soilSaturation.toFixed(2)),
            rainfallRate: Number(match.rainfallRate.toFixed(1)),
            vibrationFrequency: Number(match.vibrationFrequency.toFixed(1)),
            tiltAngle: Number(match.tiltAngle.toFixed(1)),
            riverLevel: Number(match.riverLevel.toFixed(2)),
            batteryLevel: Number(match.batteryLevel.toFixed(1)),
            connected: match.connected,
          })
        }
      })
      .catch(() => {
        // Handled by TopHeader / explicit error state when running
      })
    return () => {
      active = false
    }
  }, [searchParams])

  const handleStationSelect = (stationId: string) => {
    const found = stations.find((s) => s.stationId === stationId)
    if (!found) return
    setManualForm({
      stationId: found.stationId,
      region: found.region,
      soilSaturation: Number(found.soilSaturation.toFixed(2)),
      rainfallRate: Number(found.rainfallRate.toFixed(1)),
      vibrationFrequency: Number(found.vibrationFrequency.toFixed(1)),
      tiltAngle: Number(found.tiltAngle.toFixed(1)),
      riverLevel: Number(found.riverLevel.toFixed(2)),
      batteryLevel: Number(found.batteryLevel.toFixed(1)),
      connected: found.connected,
    })
  }

  const validateManual = (form: ManualTelemetryPayload): string | null => {
    if (!Number.isFinite(form.soilSaturation) || form.soilSaturation < 0 || form.soilSaturation > 1)
      return 'Soil saturation must be between 0.0 and 1.0.'
    if (!Number.isFinite(form.rainfallRate) || form.rainfallRate < 0 || form.rainfallRate > 300)
      return 'Rainfall rate must be between 0.0 and 300.0 mm/h.'
    if (
      !Number.isFinite(form.vibrationFrequency) ||
      form.vibrationFrequency < 0 ||
      form.vibrationFrequency > 100
    )
      return 'Vibration frequency must be between 0.0 and 100.0 Hz.'
    if (!Number.isFinite(form.tiltAngle) || form.tiltAngle < 0 || form.tiltAngle > 90)
      return 'Tilt angle must be between 0.0 and 90.0 degrees.'
    if (!Number.isFinite(form.riverLevel) || form.riverLevel < 0 || form.riverLevel > 20)
      return 'River level must be between 0.0 and 20.0 metres.'
    if (!Number.isFinite(form.batteryLevel) || form.batteryLevel < 0 || form.batteryLevel > 100)
      return 'Battery level must be between 0.0 and 100.0%.'
    return null
  }

  const executeScenario = async () => {
    setConfirmPending(null)
    setRunning(true)
    setError(null)
    try {
      const resp = await sentraApi.runScenario(selectedScenario, cycles)
      setResults(resp.results)
      setLastRunSummary(
        `Executed '${resp.scenario}' for ${resp.cyclesExecuted} cycle(s) · Engine Cycle #${resp.cycle}`,
      )
      await healthResult.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scenario simulation failed')
    } finally {
      setRunning(false)
    }
  }

  const executeManual = async () => {
    const errMsg = validateManual(manualForm)
    if (errMsg) {
      setValidationError(errMsg)
      setConfirmPending(null)
      return
    }
    setValidationError(null)
    setConfirmPending(null)
    setRunning(true)
    setError(null)
    try {
      const resp = await sentraApi.runManual(manualForm)
      setResults([resp.result])
      setLastRunSummary(
        `Processed manual telemetry for ${resp.result.telemetry.stationId} (${resp.result.telemetry.region}) · Engine Cycle #${resp.cycle}`,
      )
      await healthResult.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Manual telemetry submission failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <PageContainer>
      <SectionHeader
        eyebrow="OPERATIONS · ALF_EWG_core SIMULATION ENGINE"
        title="Simulation Center"
        subtitle="Trigger deterministic multi-cycle threat scenarios or inject validated manual station telemetry"
        actions={
          <div className="flex rounded-lg border border-[#26364A] bg-[#101B2B] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('scenario')
                setConfirmPending(null)
                setValidationError(null)
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'scenario'
                  ? 'bg-[#38BDF8] text-[#0B1220] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              Automatic Scenarios
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('manual')
                setConfirmPending(null)
                setValidationError(null)
              }}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'manual'
                  ? 'bg-[#38BDF8] text-[#0B1220] font-semibold'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              Manual Telemetry
            </button>
          </div>
        }
      />

      {error ? (
        <ErrorState
          title="Simulation Execution Error"
          message={error}
          onRetry={() => setError(null)}
        />
      ) : null}

      {mode === 'scenario' ? (
        <DataCard
          title="Select Threat Scenario"
          description="All hazard math, siren activation (>= 50), and binary persistence run natively in C++17"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {SCENARIOS.map((sc) => {
              const active = selectedScenario === sc.key
              return (
                <button
                  key={sc.key}
                  type="button"
                  onClick={() => {
                    setSelectedScenario(sc.key)
                    setConfirmPending(null)
                  }}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    active
                      ? 'border-[#38BDF8] bg-[#38BDF8]/10 shadow-sentra-glow'
                      : 'border-[#26364A] bg-[#101B2B] hover:border-[#38BDF8]/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#F8FAFC]">{sc.label}</span>
                    <span className="rounded border border-[#26364A] bg-[#141F30] px-2 py-0.5 font-telemetry text-[10px] uppercase text-[#94A3B8]">
                      {sc.severityHint}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-[#94A3B8]">{sc.description}</p>
                </button>
              )
            })}
          </div>

          <div className="mt-5 flex flex-col gap-4 border-t border-[#26364A] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label
                htmlFor="sim-cycles"
                className="text-xs font-medium text-[#94A3B8]"
              >
                Cycles to Simulate (1–10):
              </label>
              <input
                id="sim-cycles"
                type="number"
                min={1}
                max={10}
                value={cycles}
                onChange={(e) => {
                  const v = Number.parseInt(e.target.value, 10)
                  if (Number.isNaN(v)) setCycles(1)
                  else setCycles(Math.max(1, Math.min(10, v)))
                }}
                className="w-20 rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-1.5 font-telemetry text-sm text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <Button
              onClick={() => setConfirmPending('scenario')}
              disabled={running}
            >
              <Play className="h-4 w-4" />
              {running ? 'Running Simulation...' : 'Run Scenario'}
            </Button>
          </div>
        </DataCard>
      ) : (
        <DataCard
          title="Manual Station Telemetry Injection"
          description="Validated against C++ SimulationEngine::validateTelemetry() bounds"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2">
              <label
                htmlFor="manual-station"
                className="block text-xs font-medium text-[#94A3B8]"
              >
                Monitoring Station
              </label>
              <select
                id="manual-station"
                value={manualForm.stationId}
                onChange={(e) => handleStationSelect(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              >
                {(stations.length > 0
                  ? stations
                  : [
                      { stationId: 'UK-UTT-01', region: 'Uttarkashi' },
                      { stationId: 'UK-CHA-02', region: 'Chamoli' },
                      { stationId: 'UK-RUD-03', region: 'Rudraprayag' },
                      { stationId: 'UK-JOS-04', region: 'Joshimath' },
                      { stationId: 'UK-PIT-05', region: 'Pithoragarh' },
                    ]
                ).map((st) => (
                  <option key={st.stationId} value={st.stationId}>
                    {st.stationId} — {st.region}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="m-soil" className="block text-xs font-medium text-[#94A3B8]">
                Soil Saturation [0.0 – 1.0]
              </label>
              <input
                id="m-soil"
                type="number"
                step="0.01"
                min={0}
                max={1}
                value={manualForm.soilSaturation}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, soilSaturation: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="m-rain" className="block text-xs font-medium text-[#94A3B8]">
                Rainfall Rate [0 – 300 mm/h]
              </label>
              <input
                id="m-rain"
                type="number"
                step="0.5"
                min={0}
                max={300}
                value={manualForm.rainfallRate}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, rainfallRate: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="m-vib" className="block text-xs font-medium text-[#94A3B8]">
                Vibration [0 – 100 Hz]
              </label>
              <input
                id="m-vib"
                type="number"
                step="0.5"
                min={0}
                max={100}
                value={manualForm.vibrationFrequency}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, vibrationFrequency: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="m-tilt" className="block text-xs font-medium text-[#94A3B8]">
                Slope Tilt [0 – 90 deg]
              </label>
              <input
                id="m-tilt"
                type="number"
                step="0.5"
                min={0}
                max={90}
                value={manualForm.tiltAngle}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, tiltAngle: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="m-river" className="block text-xs font-medium text-[#94A3B8]">
                River Level [0 – 20 m]
              </label>
              <input
                id="m-river"
                type="number"
                step="0.1"
                min={0}
                max={20}
                value={manualForm.riverLevel}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, riverLevel: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="m-bat" className="block text-xs font-medium text-[#94A3B8]">
                Battery [0 – 100 %]
              </label>
              <input
                id="m-bat"
                type="number"
                step="1"
                min={0}
                max={100}
                value={manualForm.batteryLevel}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, batteryLevel: Number(e.target.value) }))
                }
                className="mt-1.5 w-full rounded-lg border border-[#26364A] bg-[#101B2B] px-3 py-2 font-telemetry text-xs text-[#F8FAFC] focus:border-[#38BDF8] focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-4 border-t border-[#26364A] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs text-[#F8FAFC]">
              <input
                type="checkbox"
                checked={manualForm.connected}
                onChange={(e) =>
                  setManualForm((p) => ({ ...p, connected: e.target.checked }))
                }
                className="h-4 w-4 rounded border-[#26364A] bg-[#101B2B] accent-[#38BDF8]"
              />
              Station Connected
            </label>

            <Button
              onClick={() => {
                const errMsg = validateManual(manualForm)
                if (errMsg) {
                  setValidationError(errMsg)
                  return
                }
                setValidationError(null)
                setConfirmPending('manual')
              }}
              disabled={running}
            >
              <Play className="h-4 w-4" />
              {running ? 'Submitting...' : 'Submit Manual Telemetry'}
            </Button>
          </div>

          {validationError ? (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/10 px-3 py-2 text-xs text-[#EF4444]">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{validationError}</span>
            </div>
          ) : null}
        </DataCard>
      )}

      {/* Confirmation Gate */}
      {confirmPending ? (
        <div className="rounded-xl border border-[#F59E0B]/45 bg-[#F59E0B]/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" />
              <div>
                <p className="text-sm font-semibold text-[#F8FAFC]">
                  Confirm Simulation Execution
                </p>
                <p className="mt-0.5 text-xs text-[#94A3B8]">
                  {confirmPending === 'scenario'
                    ? `Execute '${selectedScenario}' for ${cycles} cycle(s)? High/Critical events will activate regional sirens and persist incidents to disk.`
                    : `Inject manual telemetry for ${manualForm.stationId} (${manualForm.region})? This advances the engine cycle and may trigger sirens or incident persistence.`}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmPending(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() =>
                  void (confirmPending === 'scenario' ? executeScenario() : executeManual())
                }
              >
                Confirm &amp; Execute
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Simulation Results Panel */}
      <DataCard
        title="Simulation Results"
        description={lastRunSummary ?? 'Execute a scenario or manual telemetry injection to inspect C++ engine output'}
        headerAction={
          lastRunSummary ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#22C55E]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed
            </span>
          ) : null
        }
      >
        {results.length === 0 ? (
          <EmptyState
            title="No Simulation Run Yet"
            description="Select a scenario or enter manual telemetry above and confirm execution."
          />
        ) : (
          <div className="space-y-3">
            {results.map((res) => (
              <div
                key={res.telemetry.stationId}
                className="rounded-xl border border-[#26364A] bg-[#101B2B] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="font-telemetry text-sm font-bold text-[#F8FAFC]">
                      {res.telemetry.stationId}
                    </span>
                    <span className="text-xs text-[#94A3B8]">{res.telemetry.region}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <RiskBadge level={res.classification} score={res.overallRisk} />
                    <StatusBadge
                      tone={res.sirenActive ? 'active' : 'standby'}
                      label={res.sirenActive ? 'SIREN ACTIVE' : 'SIREN OFF'}
                      pulse={res.sirenActive}
                    />
                    {res.incidentId ? (
                      <span className="rounded border border-[#6366F1]/40 bg-[#6366F1]/15 px-2 py-0.5 font-telemetry text-[11px] text-[#818CF8]">
                        {res.incidentId}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-3 font-telemetry text-xs sm:grid-cols-4">
                  <div>
                    <span className="text-[#94A3B8]">Landslide: </span>
                    <span className="font-semibold text-[#F8FAFC]">
                      {res.landslideRisk.toFixed(1)}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Flood: </span>
                    <span className="font-semibold text-[#F8FAFC]">
                      {res.floodRisk.toFixed(1)}/100
                    </span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Alert Level: </span>
                    <span className="font-semibold text-[#F8FAFC]">{res.alertLevel}</span>
                  </div>
                  <div>
                    <span className="text-[#94A3B8]">Top Route: </span>
                    <span className="font-semibold text-[#38BDF8]">
                      {res.recommendedRoutes[0]?.routeId ?? 'None safe'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DataCard>
    </PageContainer>
  )
}
