# SENTRA C++ REST API Reference (`SENTRA_api`)

The `SENTRA_api` executable ([src/api/ServerMain.cpp](../src/api/ServerMain.cpp)) wraps a single persistent `DisasterCore::Core::SimulationEngine` and `IncidentLogger` instance (protected by `std::mutex`) using `cpp-httplib` and `nlohmann/json`.

- **Default Bind**: `http://127.0.0.1:8080` (configurable via `--host`, `--port`, `SENTRA_HOST`, `SENTRA_PORT`)
- **CORS**: Enabled with `Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS` (`--cors-origin` or `SENTRA_CORS_ORIGIN`, default `*`)
- **Error Format**: All `4xx`/`5xx` responses return JSON `{ "error": "<CODE>", "message": "<details>" }`.

---

## Endpoints Summary

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Engine status, cycle, seed, station count, and `globalAlertLevel` |
| `GET` | `/api/snapshot` | Full grid snapshot (`SimulationResult[]`), active sirens, and summary events |
| `GET` | `/api/stations` | Station telemetry, equirectangular XY projections, risks, and battery flags |
| `GET` | `/api/hazards/analysis` | Ranked `RegionalHazard` severity, overloaded indices, and grid mean |
| `GET` | `/api/alerts` | Active warnings (siren/offline/low-battery) and session `alertHistory` |
| `GET` | `/api/sirens` | Regional `EarlyWarningSiren` states, coordinates, and `activationThreshold` (`50.0`) |
| `GET` | `/api/evacuation` | Prioritized `recommendedRoutes` and `unavailableRoutes` per region |
| `GET` | `/api/incidents` | All persisted 433-byte binary `IncidentRecord` entries |
| `GET` | `/api/incidents/:id` | Lookup a single persisted incident by `incidentId` (`404` if missing) |
| `PATCH` | `/api/incidents/:id` | In-place `seekp()` update of `evacuationRoute` (`1–159` chars) with rollback |
| `GET` | `/api/audit` | `TelemetryAuditor` history, `TelemetryBuffer` snapshot, FNV-32 checksums |
| `GET` | `/api/statistics` | Current snapshot aggregates, risk histogram, and session counters |
| `POST` | `/api/simulate/scenario` | Execute `1–10` cycles of one of the 6 C++ simulation scenarios |
| `POST` | `/api/simulate/manual` | Validate and evaluate manual `StationTelemetry` input |
| `POST` | `/api/diagnostics` | Execute the 6 non-destructive C++17 OOP & persistence self-checks |

---

## Request Contracts for `POST` & `PATCH`

### `POST /api/simulate/scenario`
```json
{
  "scenario": "CombinedThreat",
  "cycles": 1
}
```
- `scenario`: `"Normal"`, `"HeavyRainfall"`, `"IncreasingSoilSaturation"`, `"AbnormalSeismicVibrations"`, `"RapidRiverRise"`, `"CombinedThreat"` (or integer `0–5`).
- `cycles`: integer `1–10` (defaults to `1`).

### `POST /api/simulate/manual`
```json
{
  "stationId": "UK-UTT-01",
  "region": "Uttarkashi",
  "soilSaturation": 0.45,
  "rainfallRate": 25.0,
  "vibrationFrequency": 5.0,
  "tiltAngle": 6.0,
  "riverLevel": 2.1,
  "batteryLevel": 85.0,
  "connected": true
}
```
Validated against `SimulationEngine::validateTelemetry()` bounds:
- `soilSaturation`: `[0.0, 1.0]`
- `rainfallRate`: `[0.0, 300.0]` mm/h
- `vibrationFrequency`: `[0.0, 100.0]` Hz
- `tiltAngle`: `[0.0, 90.0]` degrees
- `riverLevel`: `[0.0, 20.0]` metres
- `batteryLevel`: `[0.0, 100.0]` %

### `PATCH /api/incidents/:id`
```json
{
  "evacuationRoute": "R-Uttarkashi-ALT"
}
```
- `evacuationRoute`: non-empty string (`1–159` characters). Updates the binary record in-place via `IncidentLogger::updateById()`.

### `POST /api/diagnostics`
Accepts `{}` and returns `{ "passed": 6, "total": 6, "allPassed": true, "checks": [...] }`.
