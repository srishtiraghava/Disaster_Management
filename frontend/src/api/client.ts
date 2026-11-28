
import type {
  AlertsResponse,
  AuditResponse,
  DiagnosticsResponse,
  EvacuationResponse,
  HazardAnalysisResponse,
  HealthResponse,
  IncidentRecord,
  IncidentsResponse,
  ManualRunResponse,
  ManualTelemetryPayload,
  ScenarioRunResponse,
  SimulationScenarioKey,
  SirensResponse,
  SnapshotResponse,
  StationsResponse,
  StatisticsResponse,
} from '@/types/sentra'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number
  code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 10000)

  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')

  let response: Response

  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: init?.signal ?? controller.signal,
      headers,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(408, 'REQUEST_TIMEOUT', `Request to ${path} timed out`)
    }

    throw err
  } finally {
    window.clearTimeout(timeoutId)
  }

  const text = await response.text()
  let parsed: Record<string, unknown> | null = null

  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = null
    }
  }

  if (!response.ok) {
    const code = typeof parsed?.error === 'string'
      ? parsed.error
      : `HTTP_${response.status}`

    const message = typeof parsed?.message === 'string'
      ? parsed.message
      : `Request to ${path} failed with status ${response.status}`

    throw new ApiError(response.status, code, message)
  }

  if (parsed === null) {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      `Received invalid or empty JSON response from ${path}`,
    )
  }

  return parsed as T
}

export const sentraApi = {
  getHealth: () => requestJson<HealthResponse>('/api/health'),

  getSnapshot: () => requestJson<SnapshotResponse>('/api/snapshot'),

  getStations: () => requestJson<StationsResponse>('/api/stations'),

  getHazardAnalysis: () =>
    requestJson<HazardAnalysisResponse>('/api/hazards/analysis'),

  getAlerts: () => requestJson<AlertsResponse>('/api/alerts'),

  getSirens: () => requestJson<SirensResponse>('/api/sirens'),

  getEvacuation: () => requestJson<EvacuationResponse>('/api/evacuation'),

  getIncidents: () => requestJson<IncidentsResponse>('/api/incidents'),

  getIncidentById: (id: string) =>
    requestJson<IncidentRecord>(
      `/api/incidents/${encodeURIComponent(id)}`,
    ),

  updateIncidentRoute: (id: string, evacuationRoute: string) =>
    requestJson<IncidentRecord>(
      `/api/incidents/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ evacuationRoute }),
      },
    ),

  getAudit: () => requestJson<AuditResponse>('/api/audit'),

  getStatistics: () => requestJson<StatisticsResponse>('/api/statistics'),

  runScenario: (scenario: SimulationScenarioKey, cycles: number) =>
    requestJson<ScenarioRunResponse>('/api/simulate/scenario', {
      method: 'POST',
      body: JSON.stringify({ scenario, cycles }),
    }),

  runManual: (payload: ManualTelemetryPayload) =>
    requestJson<ManualRunResponse>('/api/simulate/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  runDiagnostics: () =>
    requestJson<DiagnosticsResponse>('/api/diagnostics', {
      method: 'POST',
      body: '{}',
    }),
}
