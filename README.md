# ALF-EWG — Autonomous Landslide & Flash-Flood Early Warning Grid
live:https://expert-journey-jjwrpxvgr7rv35g6x-7681.app.github.dev/
A modular **C++17** disaster-monitoring control-room simulator and object-oriented programming (CIC-211) reference project. ALF-EWG models regional telemetry stations across five Himalayan districts (Uttarkashi, Chamoli, Rudraprayag, Joshimath, and Pithoragarh), computes independent landslide and flash-flood hazard indices, manages regional warning sirens, prioritizes evacuation routes, persists critical incidents to a random-access binary store with rollback protection, and exposes a 13-option interactive terminal control room.

> **Simulation Disclaimer:** All telemetry readings, risk scores, siren states, evacuation route recommendations, and incident logs produced by ALF-EWG are simulated for educational and demonstration purposes and are not connected to field sensors or emergency services.

---

## Key Features

- **13-Option Terminal Control-Room Dashboard** (`ControlRoomDashboard`):
  - Live monitoring overview (active/disconnected stations, emergency level, active sirens, peak landslide/flood risks, latest persisted incident, and recent system events).
  - Automatic multi-cycle simulation across 6 threat scenarios (`Normal`, `HeavyRainfall`, `IncreasingSoilSaturation`, `AbnormalSeismicVibrations`, `RapidRiverRise`, `CombinedThreat`).
  - Validated manual telemetry entry with finite/bounds checks and stream-safe input recovery.
  - Regional hazard analysis, active emergency alert log, siren status console, evacuation route ranking, persistent binary incident history (view, search by ID, in-place update), friend-class telemetry audit, grid statistics, and full self-diagnostics.
  - Automatic terminal capability detection with `--no-color`, `--color`, and `NO_COLOR` support for non-ANSI consoles.
- **Persistent Random-Access Binary Incident Log** (`IncidentLogger`):
  - Fixed-width 433-byte binary records using `std::fstream` with explicit `seekg()` / `seekp()` positioning.
  - Atomic-style `updateById()` with automatic rollback on post-write hook failure.
- **Automated CTest Suite** (`ALF_EWG_tests`):
  - 17 registered CTest verification suites covering hazard math, risk classification, function overloading, deep copying, operator overloading, static members, virtual inheritance, runtime polymorphism, containership, custom exceptions, binary serialization, `seekp()`/`seekg()`, rollback, evacuation prioritization, siren activation, invalid telemetry rejection, and dashboard integration.

---

## Project Structure

```text
Disaster_Management/
├── CMakeLists.txt
├── LICENSE
├── README.md
├── .gitignore
├── include/
│   ├── alerts/
│   │   └── AlertTypes.hpp          # Alert severity enum & risk-mapping helpers
│   ├── core/
│   │   ├── EarlyWarningSiren.hpp   # Siren entity & static globalAlertLevel_
│   │   ├── Exceptions.hpp          # Custom exception hierarchy & checksum validator
│   │   ├── IncidentLogger.hpp      # Binary persistence, EvacuationPriority, PriorityQueue<T>
│   │   ├── RegionalHazard.hpp      # Normalized regional severity with > and << operators
│   │   ├── SensorCluster.hpp       # Station collection with + and << operators
│   │   ├── SensorNode.hpp          # PowerSubsystem (HAS-A), virtual diamond & polymorphic probes
│   │   ├── SensorStation.hpp       # Station entity, static activeCount_, << and >> operators
│   │   ├── Simulation.hpp          # SimulationEngine, scenarios, configs, and telemetry structs
│   │   ├── Telemetry.hpp           # Telemetry, friend TelemetryAuditor, coordinate projection
│   │   └── TelemetryBuffer.hpp     # Rule-of-Five dynamic array with deep copy
│   ├── sensors/
│   │   ├── Hazard.hpp              # Soil, rainfall, vibration, flood & combined hazard functions
│   │   └── HazardIndex.hpp         # Overloaded computeHazardIndex() functions
│   └── ui/
│       └── Dashboard.hpp           # ControlRoomDashboard interface & ColorMode enum
├── src/
│   ├── main.cpp                    # CLI parser & control-room entry point
│   ├── core/
│   │   ├── EarlyWarningSiren.cpp   # Static globalAlertLevel_ definition
│   │   ├── IncidentLogger.cpp      # Fixed-record binary I/O, seekg/seekp, rollback
│   │   ├── SensorStation.cpp       # Static activeCount_ & constructor validation
│   │   └── Simulation.cpp          # Hazard evaluation, scenarios, sirens, route ranking
│   └── ui/
│       └── Dashboard.cpp           # 13-option interactive terminal dashboard
├── tests/
│   └── main_test.cpp               # 17 modular CTest suites
└── docs/
    ├── algorithms.md               # Mathematical formulas, thresholds & complexity
    ├── architecture.md             # Layered architecture & data-flow design
    ├── class-diagram.md            # Mermaid UML class diagrams
    ├── implementation-plan.md      # Original staged roadmap
    ├── simulation.md               # Simulation engine overview
    ├── syllabus-mapping.md         # Explicit CIC-211 Units I-IV mapping
    ├── user-guide.md               # Operator manual & CLI reference
    └── viva-preparation.md         # 40+ viva Q&As & 10 code-tracing/numerical problems
```

---

## Build Instructions (Windows MinGW & Cross-Platform CMake)

### Prerequisites

- **C++17 compiler**: MinGW-w64 `g++` (tested with MSYS2 UCRT64 GCC 16.2.0), Clang, or MSVC
- **CMake**: 3.15 or newer
- **Make / Build tool**: `mingw32-make` (MinGW) or Ninja / Make

### Configure and Build (MinGW Makefiles on Windows)

```powershell
cmake -S . -B build -G "MinGW Makefiles"
cmake --build build
```

> **Note:** On Windows systems where CMake is bundled inside Visual Studio Build Tools rather than on `PATH`, invoke `cmake.exe` and `ctest.exe` using their full path or add the CMake `bin` folder to `PATH`.

---

## Run Instructions

### Launch the Control Room

```powershell
./build/ALF_EWG.exe
```

Useful CLI options:

```powershell
./build/ALF_EWG.exe --no-color
./build/ALF_EWG.exe --seed 211 --log-file alf_ewg_incidents.bin
./build/ALF_EWG.exe --help
```

### Run Automated Tests with CTest

```powershell
ctest --test-dir build --output-on-failure
```

Or run the test executable directly to execute all 17 suites (or pass a suite name such as `DeepCopying` or `Rollback`):

```powershell
./build/ALF_EWG_tests.exe
./build/ALF_EWG_tests.exe Rollback
```

---

## Documentation Index

- [Architecture Overview](docs/architecture.md)
- [UML Class Diagrams](docs/class-diagram.md)
- [Algorithms & Mathematical Models](docs/algorithms.md)
- [CIC-211 Syllabus Mapping (Units I–IV)](docs/syllabus-mapping.md)
- [Operator User Guide](docs/user-guide.md)
- [Viva Preparation (40+ Q&As & 10 Tracing/Numerical Problems)](docs/viva-preparation.md)
- [Simulation Engine Notes](docs/simulation.md)

## License

MIT — see [LICENSE](LICENSE).
