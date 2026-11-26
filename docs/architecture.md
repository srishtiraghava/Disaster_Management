# ALF-EWG System Architecture

## 1. Architectural Overview

ALF-EWG is organized as a layered, modular **C++17** library (`ALF_EWG_core`) consumed by both the interactive control-room executable (`ALF_EWG`) and the automated test runner (`ALF_EWG_tests`). Separation between pure mathematical hazard primitives, core domain entities, persistence, simulation orchestration, and terminal presentation ensures that every subsystem can be unit-tested deterministically without terminal I/O.

```text
+-----------------------------------------------------------------------+
|                       Presentation / CLI Layer                        |
|   src/main.cpp  --->  ControlRoomDashboard (include/ui/Dashboard.hpp) |
+-----------------------------------+-----------------------------------+
                                    |
                                    v
+-----------------------------------------------------------------------+
|                       Simulation & Orchestration                      |
|      SimulationEngine (include/core/Simulation.hpp / .cpp)            |
|  - 5 Stations (Uttarkashi, Chamoli, Rudraprayag, Joshimath, Pithoragarh)
|  - 6 Scenarios + Manual Telemetry Validation                          |
|  - Polymorphic Sensor Sweep (LandslideStationProbe, FloodStationProbe)|
|  - Regional Sirens + Alert Deduplication + Route Ranking              |
+--------+--------------------------+--------------------------+--------+
         |                          |                          |
         v                          v                          v
+------------------+    +-----------------------+    +------------------+
|  Sensor Math     |    |  Domain & Telemetry   |    |   Persistence    |
| include/sensors/ |    |  include/core/        |    | IncidentLogger   |
| - Hazard.hpp     |    | - SensorNode.hpp      |    | - Fixed 457-byte |
| - HazardIndex.hpp|    | - Telemetry.hpp       |    |   binary records |
+------------------+    | - TelemetryBuffer.hpp |    | - seekg / seekp  |
                        | - SensorStation.hpp   |    | - Rollback hook  |
                        | - SensorCluster.hpp   |    +------------------+
                        | - RegionalHazard.hpp  |
                        | - EarlyWarningSiren   |
                        | - Exceptions.hpp      |
                        +-----------------------+
```

---

## 2. Module Responsibilities

| Layer | Files | Responsibility |
|---|---|---|
| **Sensor Math** | `include/sensors/Hazard.hpp`, `include/sensors/HazardIndex.hpp` | Stateless, inline hazard normalization functions (`soilSaturation`, `rainfallSeverity`, `vibrationSeverity`, `floodSeverity`, `combinedHazard`) and overloaded `computeHazardIndex()`. |
| **Alert Types** | `include/alerts/AlertTypes.hpp` | Maps continuous `[0, 100]` risk scores into `Alerts::Level` (`Info`, `Warning`, `Critical`). |
| **Core Entities & OOP Hierarchy** | `include/core/SensorNode.hpp`, `SensorStation.hpp/.cpp`, `SensorCluster.hpp`, `EarlyWarningSiren.hpp/.cpp`, `RegionalHazard.hpp`, `Telemetry.hpp`, `TelemetryBuffer.hpp`, `Exceptions.hpp` | Encapsulates power composition (`PowerSubsystem`), virtual diamond sensor probes (`AutonomousHybridProbe`), manual heap buffer management (`TelemetryBuffer`), static grid counters (`activeCount_`, `globalAlertLevel_`), friend auditing (`TelemetryAuditor`), operator overloading, and custom exceptions. |
| **Persistence & Ranking** | `include/core/IncidentLogger.hpp`, `src/core/IncidentLogger.cpp` | Serializes `IncidentRecord` structs into fixed-width 433-byte binary slots, supports random-access updates via `seekg()`/`seekp()` with automatic rollback, and provides `EvacuationPriority`, `PriorityQueue<T>`, and `emergencyAlertHeader`. |
| **Simulation Engine** | `include/core/Simulation.hpp`, `src/core/Simulation.cpp` | Maintains deterministic `std::mt19937` state, station telemetry, regional sirens, alert deduplication map, per-station `Telemetry` auditors, `TelemetryBuffer` history, and system event log. |
| **Terminal Control Room** | `include/ui/Dashboard.hpp`, `src/ui/Dashboard.cpp`, `src/main.cpp` | Parses CLI flags (`--no-color`, `--color`, `--seed`, `--log-file`), detects Windows/POSIX ANSI support, and drives the 13-option interactive dashboard using injectable `std::istream`/`std::ostream` streams. |

---

## 3. Data Flow Through a Simulation Cycle

1. **Telemetry Acquisition**:
   - `runScenario()` generates deterministic noise-perturbed readings around baseline or escalating scenario targets (`risingSoil_`, `risingRiver_`).
   - `runManual()` validates station/region identity, finiteness (`std::isfinite`), and physical sensor ranges before modifying state.
2. **Polymorphic Probe Sweep**:
   - Inside `SimulationEngine::evaluate()`, `LandslideStationProbe` (derived from `AutonomousHybridProbe`) and `FloodStationProbe` (derived from `RainGaugeNode`) are placed as `BaseSensorNode*` pointers into a `std::vector<BaseSensorNode*>` and executed via `executeSensorSweep()`.
3. **Risk Aggregation & Classification**:
   - `calculateOverallRisk(landslide, flood)` takes `std::max(landslide, flood)` so severe threats in one domain cannot be masked by averaging.
   - `classifyRisk()` maps scores onto `[0, 25)` Low, `[25, 50)` Moderate, `[50, 75)` High, `[75, 100]` Critical.
4. **Audit Recording**:
   - Each station's `Telemetry` object records the measurement (`updateMeasurement()`), and `auditBuffer_` appends to its dynamically resized heap array.
5. **Siren State Machine & Alert Deduplication**:
   - `updateSiren()` activates the region's `EarlyWarningSiren` at `overallRisk >= 50.0` and clears it below `50.0`.
   - `activeAlertLevels_` suppresses duplicate `AlertEvent` emissions when a region stays at the same `RiskClass`, while still recording `HIGH <-> CRITICAL` escalations.
6. **Evacuation Ranking**:
   - `recommendRoutes()` filters out unavailable/blocked routes and routes whose adjusted hazard reaches `>= 75.0`, then ranks candidates via `sortEvacuationRoutes()` (`EvacuationPriority`).
7. **Binary Persistence**:
   - `saveImportantIncident()` writes any `HIGH`/`CRITICAL` (`>= 50.0`) or low-battery (`<= 15%`) event to `IncidentLogger`, avoiding duplicate IDs across restarts by appending `-1`, `-2`, ... if the cycle ID already exists on disk.

---

## 4. Memory Management & Error-Handling Strategy

- **RAII Everywhere**: `std::vector`, `std::map`, `std::unique_ptr<BaseSensorNode>`, and `std::fstream` manage resources deterministically. `SimulationEngine::~SimulationEngine()` deactivates all owned sirens so `EarlyWarningSiren::globalAlertLevel()` returns cleanly to baseline on shutdown.
- **Rule of Five**: `TelemetryBuffer` manually manages `double* data_` with strong exception safety (copy-and-swap in copy assignment, `noexcept` move constructor/assignment, and `delete[]` in destructor).
- **Non-Owning Polymorphic Observers**: `executeSensorSweep()` accepts `const std::vector<BaseSensorNode*>&` non-owning pointers while callers retain ownership via `std::unique_ptr` or stack locals.
- **Exception Hierarchy**: Domain failures throw `SensorFailureException`, `TelemetryChecksumMismatch`, `ThresholdOverflowException`, `std::invalid_argument`, or `std::out_of_range`. `ControlRoomDashboard::run()` catches and reports exceptions cleanly without terminating the control-room session.

---

## 5. Terminal Portability & ANSI Fallback

`ControlRoomDashboard::detectAnsiSupport()` checks:
1. Explicit CLI overrides (`--no-color` -> plain ASCII; `--color` -> ANSI enabled).
2. The `NO_COLOR` environment variable.
3. Whether the output stream is `std::cout` attached to an interactive TTY (`_isatty(_fileno(stdout))` on Windows, `isatty(fileno(stdout))` on POSIX).
4. On Windows, attempts to enable `ENABLE_VIRTUAL_TERMINAL_PROCESSING` via `SetConsoleMode()`. If unsupported, it falls back cleanly to plain ASCII badges (`[LOW]`, `[HIGH]`, `[CRITICAL]`, `[ACTIVE]`, `[OFF]`) and ASCII borders (`+---+`, `|`).
