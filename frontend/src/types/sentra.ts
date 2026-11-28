export type RiskClassName = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'UNKNOWN'
export type AlertLevelName = 'INFO' | 'WARNING' | 'CRITICAL' | 'UNKNOWN'
export type RoadConditionName = 'good' | 'slippery' | 'damaged' | 'blocked' | 'unknown'

export type SimulationScenarioKey =
  | 'Normal'
  | 'HeavyRainfall'
  | 'IncreasingSoilSaturation'
  | 'AbnormalSeismicVibrations'
  | 'RapidRiverRise'
  | 'CombinedThreat'

export interface HealthResponse {
  status: string
  service: string
  engine: string
  cycle: number
  seed: number
  stationCount: number
  activeStationCount: number
  globalAlertLevel: number
}

export interface StationTelemetry {
  stationId: string
  region: string
  latitude: number
  longitude: number
  soilSaturation: number
  rainfallRate: number
  vibrationFrequency: number
  tiltAngle: number
  riverLevel: number
  batteryLevel: number
  connected: boolean
}

export interface EvacuationRouteRecord {
  routeId: string
  startingRegion: string
  destination: string
  distanceKm: number
  roadCondition: RoadConditionName
  landslideRisk: number
  floodRisk: number
  available: boolean
}

export interface SimulationResult {
  telemetry: StationTelemetry
  landslideRisk: number
  floodRisk: number
  overallRisk: number
  classification: RiskClassName
  alertLevel: AlertLevelName
  sirenActive: boolean
  recommendedRoutes: EvacuationRouteRecord[]
  incidentId: string
}

export interface IncidentRecord {
  incidentId: string
  timestamp: string
  stationId: string
  region: string
  incidentType: string
  landslideRisk: number
  floodRisk: number
  overallRisk: number
  sirenActivated: boolean
  evacuationRoute: string
}

export interface SnapshotResponse {
  cycle: number
  seed: number
  globalAlertLevel: number
  activeSirens: number
  totalSirens: number
  stations: SimulationResult[]
  summary: {
    activeStations: number
    disconnectedStations: number
    maxLandslideRisk: number
    maxFloodRisk: number
    maxOverallRisk: number
    emergencyLevel: RiskClassName
    latestIncident: IncidentRecord | null
    systemEvents: string[]
  }
}

export interface StationDetail extends StationTelemetry {
  projectedXKm: number
  projectedYKm: number
  landslideRisk: number
  floodRisk: number
  overallRisk: number
  classification: RiskClassName
  lowBattery: boolean
}

export interface StationsResponse {
  cycle: number
  activeCount: number
  criticalBatteryPercent: number
  stations: StationDetail[]
}

export interface RegionalHazardAnalysis {
  rank: number
  stationId: string
  region: string
  normalizedSeverity: number
  landslideRisk: number
  floodRisk: number
  overallRisk: number
  classification: RiskClassName
  rainSlopeIndex: number
  soilVibTiltIndex: number
  combinedHazard: number
}

export interface HazardAnalysisResponse {
  cycle: number
  gridMeanNormalizedSeverity: number
  regions: RegionalHazardAnalysis[]
}

export interface ActiveWarning {
  stationId: string
  region: string
  alertLevel: AlertLevelName
  classification: RiskClassName
  overallRisk: number
  sirenActive: boolean
  disconnected: boolean
  lowBattery: boolean
  batteryLevel: number
}

export interface AlertEvent {
  region: string
  sirenId: string
  cycle: number
  activated: boolean
  level: RiskClassName
  description: string
}

export interface AlertsResponse {
  cycle: number
  activeWarnings: ActiveWarning[]
  alertHistory: AlertEvent[]
}

export interface SirenStatus {
  region: string
  sirenId: string
  latitude: number
  longitude: number
  active: boolean
}

export interface SirensResponse {
  cycle: number
  globalAlertLevel: number
  activationThreshold: number
  sirens: SirenStatus[]
}

export interface RegionEvacuationPlan {
  region: string
  stationId: string
  recommendedRoutes: EvacuationRouteRecord[]
  unavailableRoutes: EvacuationRouteRecord[]
}

export interface EvacuationResponse {
  cycle: number
  maxSafeRouteRisk: number
  regions: RegionEvacuationPlan[]
}

export interface IncidentsResponse {
  total: number
  incidents: IncidentRecord[]
}

export interface AuditResponse {
  cycle: number
  stationAudits: Array<{
    stationId: string
    latestRawRisk: number
    sampleCount: number
    history: number[]
  }>
  buffer: {
    sourceSize: number
    sourceCapacity: number
    snapshotSize: number
    snapshotCapacity: number
    samples: number[]
  }
  checksums: Array<{
    stationId: string
    checksum: string
    verified: boolean
  }>
}

export interface StatisticsResponse {
  cyclesExecuted: number
  totalStations: number
  onlineStations: number
  offlineStations: number
  sensorStationActiveCount: number
  globalAlertLevel: number
  sessionSirenTransitions: number
  persistedIncidents: number
  auditBufferSamples: number
  averageLandslideRisk: number
  averageFloodRisk: number
  peakOverallRisk: number
  minBattery: number
  averageBattery: number
  riskDistribution: {
    LOW: number
    MODERATE: number
    HIGH: number
    CRITICAL: number
  }
}

export interface DiagnosticCheck {
  name: string
  passed: boolean
  detail: string
}

export interface DiagnosticsResponse {
  passed: number
  total: number
  allPassed: boolean
  checks: DiagnosticCheck[]
}

export interface ScenarioRunResponse {
  cycle: number
  scenario: string
  cyclesExecuted: number
  results: SimulationResult[]
}

export interface ManualRunResponse {
  cycle: number
  result: SimulationResult
}

export interface ManualTelemetryPayload {
  stationId: string
  region: string
  soilSaturation: number
  rainfallRate: number
  vibrationFrequency: number
  tiltAngle: number
  riverLevel: number
  batteryLevel: number
  connected: boolean
}
