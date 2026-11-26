# ALF-EWG Operator User Guide

## 1. Launching the Control Room

From the project root after building with CMake:

```powershell
./build/ALF_EWG.exe
```

### Command-Line Flags

| Flag | Default | Purpose |
|---|---|---|
| `--no-color` | Auto-detected | Disables ANSI escape sequences for plain terminals or log capture. |
| `--color` | Auto-detected | Forces ANSI color output even when stdout is not a console. |
| `--seed <number>` | `211` | Sets the deterministic `std::mt19937` seed for reproducible simulations. |
| `--log-file <path>` | `alf_ewg_incidents.bin` | Sets the binary incident persistence file path. |
| `-h`, `--help` | — | Prints CLI usage and exits. |

Setting the standard `NO_COLOR` environment variable also disables ANSI color output automatically.

---

## 2. Main Menu Walkthrough (Options 1–13)

1. **Live Monitoring Dashboard**: Displays the grid summary panel (active stations, disconnected stations, current emergency level + `EarlyWarningSiren::globalAlertLevel()`, active sirens, highest landslide risk, highest flood risk, latest persisted incident, latest system events) followed by a per-station risk table.
2. **View Sensor Stations**: Lists all five stations (`UK-UTT-01` through `UK-PIT-05`) with geographic coordinates, equirectangular planar XY coordinates (km), soil saturation, rainfall, vibration, tilt, river level, battery percentage, connectivity, and `SensorStation::activeCount()`.
3. **Automatic Simulation**: Lets you select one of six scenarios (`Normal`, `HeavyRainfall`, `IncreasingSoilSaturation`, `AbnormalSeismicVibrations`, `RapidRiverRise`, `CombinedThreat`) and choose `1–10` consecutive cycles. High/Critical events activate regional sirens and persist incidents to disk.
4. **Manual Telemetry Input**: Prompts for a station and physically valid sensor values:
   - Soil saturation: `[0.0, 1.0]`
   - Rainfall rate: `[0.0, 300.0]` mm/h
   - Vibration frequency: `[0.0, 100.0]` Hz
   - Tilt angle: `[0.0, 90.0]` degrees
   - River level: `[0.0, 20.0]` m
   - Battery level: `[0.0, 100.0]` %
   - Connection status: `1` (connected) or `0` (disconnected)
   Invalid entries are rejected cleanly with guidance and never corrupt grid state.
5. **Regional Hazard Analysis**: Computes overloaded `computeHazardIndex()` metrics, `combinedHazard()`, and `accumulateRegionalRisk()`, then ranks regions from highest to lowest `RegionalHazard` severity using `operator>`.
6. **Active Emergency Alerts**: Lists currently active regional warnings, offline stations, critical battery warnings (`<= 15%`), and the session siren transition log.
7. **Siren Status**: Displays every regional `EarlyWarningSiren` (`SIREN-Uttarkashi`, etc.), coordinates, individual active/standby status, and cumulative `globalAlertLevel()`.
8. **Evacuation Recommendations**: Ranks available non-blocked routes below critical route risk (`< 75.0`) per region using `EvacuationPriority`, and also shows blocked/unavailable corridors.
9. **Incident History**: Reads all persisted binary `IncidentRecord` entries from disk (surviving across application restarts), allows searching by `Incident ID`, and supports in-place route updates via `updateById()` (`seekg`/`seekp` with rollback).
10. **Telemetry Audit**: Uses friend-class `TelemetryAuditor` to inspect raw measurements and history per station, copies the session `TelemetryBuffer` snapshot via deep copy, and verifies FNV-32 telemetry payload checksums via `verifyTelemetryChecksum()`.
11. **System Statistics**: Summarizes cycles executed, online/offline counts, `SensorStation::activeCount()`, `EarlyWarningSiren::globalAlertLevel()`, average/peak risk metrics, battery min/avg, and risk histogram (`LOW`/`MODERATE`/`HIGH`/`CRITICAL`).
12. **Full System Diagnostic**: Runs 6 non-destructive live verification checks (virtual diamond + `PowerSubsystem`, polymorphic `executeSensorSweep`, `TelemetryBuffer` deep copy, checksum positive/negative checks, binary store integrity, and coordinate projections).
13. **Exit**: Cleanly terminates the control room and deactivates session sirens via `~SimulationEngine()`.

---

## 3. Persistence Across Restarts

- Any station reading reaching `HIGH` (`>= 50.0`), `CRITICAL` (`>= 75.0`), or critical battery (`<= 15.0%`) is automatically saved to `alf_ewg_incidents.bin` (or the `--log-file` path).
- When restarting the application with the same seed, `SimulationEngine::saveImportantIncident()` checks `IncidentLogger::searchById()` and appends `-1`, `-2`, etc. to prevent ID collisions with earlier sessions.
- Open **Option 9 (Incident History)** immediately after restarting to inspect records saved in prior runs.
