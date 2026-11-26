# Implementation Plan for ALF‑EWG

## Overview
ALF‑EWG (Autonomous Landslide & Flash‑Flood Early Warning Grid) is a modular C++17 simulation framework that models sensor networks, hazard propagation, alert generation, and routing of warnings. The architecture follows a clean layered approach, making it approachable for second‑year CSE students while remaining extensible for future features.

## High‑Level Modules
| Layer | Namespace | Purpose |
|-------|-----------|---------|
| **Core** | `core` | Common utilities, types, configuration handling, and the simulation driver. |
| **Sensors** | `sensors` | Abstract sensor interface, concrete implementations (e.g., `RainGauge`, `SoilMoisture`). |
| **Routing** | `routing` | Graph representation of the grid and algorithms for propagating warnings. |
| **Alerts** | `alerts` | Alert objects, severity levels, and formatting of warning messages. |
| **Persistence** | `persistence` | Load/save of configuration, sensor data, and results (JSON/CSV placeholders). |
| **Exceptions** | `exceptions` | Custom exception hierarchy to provide clear error reporting. |
| **Simulation** | `simulation` | Orchestrates the time‑step loop, interacts with sensors, routing, and alerts. |
| **UI** | `ui` | Simple console UI (future: GUI) for interacting with the simulation. |

## Directory Layout
```
ALF-EWG/
├─ include/          # Public headers, mirroring the module namespaces
│   ├─ core/
│   ├─ sensors/
│   ├─ routing/
│   ├─ alerts/
│   ├─ persistence/
│   ├─ exceptions/
│   ├─ simulation/
│   └─ ui/
├─ src/              # Implementation files
│   ├─ core/
│   ├─ sensors/
│   ├─ routing/
│   ├─ alerts/
│   ├─ persistence/
│   ├─ simulation/
│   └─ ui/
├─ tests/            # Unit tests (GoogleTest will be added later)
├─ docs/             # Design docs, implementation plan, API docs
├─ data/             # Sample terrain and sensor datasets
├─ CMakeLists.txt    # Build configuration
├─ README.md
└─ .gitignore
```

## Development Phases
1. **Foundation (Current)** – Create directory skeleton, CMake configuration, and a placeholder `main.cpp` that builds an executable.
2. **Core & Configuration** – Implement configuration parsing, logger, and basic utilities.
3. **Sensor Layer** – Define `ISensor` interface, concrete sensor classes, and a simple data generator.
4. **Routing Layer** – Build a grid graph, implement Dijkstra/BFS for warning propagation.
5. **Alert Layer** – Create alert objects, severity hierarchy, and message formatting.
6. **Simulation Engine** – Tie together sensors, routing, and alerts in a discrete‑time loop.
7. **Persistence** – Add JSON/CSV I/O for loading terrain, sensor placements, and saving results.
8. **UI & Visualization** – Provide a console UI; later optional Qt/ImGui front‑end.
9. **Testing** – Unit tests for each module using GoogleTest.
10. **Documentation & Packaging** – Doxygen docs, CI pipelines, and release artifacts.

## Conventions
- Header files end with `.hpp`, source files with `.cpp`.
- Namespace mirrors directory structure (e.g., `alf_ewg::core`).
- Class names use PascalCase, functions and variables use camelCase.
- Public symbols are declared in `include/`; implementation stays in `src/`.
- All external dependencies are managed via CMake `FetchContent` (future).

## Next Steps
- Verify that the placeholder executable builds.
- Add minimal unit‑test scaffolding.
- Begin fleshing out `core` utilities.
