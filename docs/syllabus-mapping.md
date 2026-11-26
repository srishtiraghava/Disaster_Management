# CIC-211 Syllabus Mapping (Units I–IV)

This document explicitly maps every Object-Oriented Programming (CIC-211, Units I–IV) requirement to its implementing **class / struct / function**, **source & header file**, and **CTest verification suite** in ALF-EWG.

---

## Unit I — OOP Fundamentals, Functions, Classes & Encapsulation

| Syllabus Concept | Implementing Class / Struct / Function | Source / Header File | CTest Suite |
|---|---|---|---|
| **Namespaces & modular headers** | `DisasterCore::Sensors`, `DisasterCore::Core`, `DisasterCore::Alerts`, `DisasterCore::UI` | `include/sensors/Hazard.hpp`, `include/core/*.hpp`, `include/alerts/AlertTypes.hpp`, `include/ui/Dashboard.hpp` | All suites |
| **Inline functions & mathematical primitives** | `soilSaturation()`, `rainfallSeverity()`, `vibrationSeverity()`, `floodSeverity()`, `combinedHazard()` | `include/sensors/Hazard.hpp` | `HazardCalculations` |
| **Function overloading** | `computeHazardIndex(double rainfallRate, double slopeAngle)` and `computeHazardIndex(double soilSat, double vibrationFreq, double tiltAngle)` | `include/sensors/HazardIndex.hpp` | `FunctionOverloading` |
| **Call-by-reference parameters** | `Telemetry::updateMeasurement(double& target, double newValue)`, `transformCoordinates(double, double, double& xOut, double& yOut)`, `sortEvacuationRoutes(std::vector<EvacuationRoute>&)` | `include/core/Telemetry.hpp`, `include/core/IncidentLogger.hpp` | `ExceptionHandling`, `HazardCalculations`, `EvacuationPrioritization` |
| **Return-by-reference** | `Telemetry::current()` (`double&` and `const double&`), `BaseSensorNode::powerSubsystem()`, `TelemetryBuffer::operator[]` | `include/core/Telemetry.hpp`, `include/core/SensorNode.hpp`, `include/core/TelemetryBuffer.hpp` | `ExceptionHandling`, `DeepCopying` |
| **Default arguments** | `PowerSubsystem(...)`, `BaseSensorNode(...)`, `DisasterTelemetryDevice(...)`, `RegionalHazard(double severity = 0.0)`, `TelemetryBuffer(std::size_t capacity = 0)`, `SimulationEngine(..., SimulationConfig config = {})`, `ControlRoomDashboard(..., ColorMode colorMode = ColorMode::Auto)` | `include/core/SensorNode.hpp`, `include/core/RegionalHazard.hpp`, `include/core/TelemetryBuffer.hpp`, `include/core/Simulation.hpp`, `include/ui/Dashboard.hpp` | `Containership`, `DeepCopying`, `DashboardIntegration` |
| **Encapsulation, access specifiers & `const` member functions** | `SensorStation`, `EarlyWarningSiren`, `RegionalHazard`, `Telemetry`, `SimulationEngine` (`private` state, validated constructors, `const noexcept` getters) | `include/core/SensorStation.hpp`, `include/core/EarlyWarningSiren.hpp`, `include/core/RegionalHazard.hpp`, `include/core/Telemetry.hpp`, `include/core/Simulation.hpp` | `StaticMembers`, `OperatorOverloading`, `InvalidTelemetryRejection` |
| **Enumerated types (`enum class`)** | `SimulationScenario`, `RiskClass`, `RoadCondition`, `Alerts::Level`, `UI::ColorMode` | `include/core/Simulation.hpp`, `include/alerts/AlertTypes.hpp`, `include/ui/Dashboard.hpp` | `RiskClassifications`, `DashboardIntegration` |

---

## Unit II — Dynamic Memory, Deep Copy, Static & Friend Members, Operator Overloading, Containership

| Syllabus Concept | Implementing Class / Struct / Function | Source / Header File | CTest Suite |
|---|---|---|---|
| **Dynamic memory allocation (`new[]` / `delete[]`)** | `TelemetryBuffer::TelemetryBuffer()`, `TelemetryBuffer::push_back()`, `TelemetryBuffer::~TelemetryBuffer()` | `include/core/TelemetryBuffer.hpp` | `DeepCopying` |
| **Copy constructor (deep copy) & copy assignment (`this != &other`)** | `TelemetryBuffer::TelemetryBuffer(const TelemetryBuffer&)`, `TelemetryBuffer::operator=(const TelemetryBuffer&)`, `TelemetryBuffer::swap()` | `include/core/TelemetryBuffer.hpp` | `DeepCopying` |
| **Move semantics (move constructor & move assignment)** | `TelemetryBuffer(TelemetryBuffer&&)`, `TelemetryBuffer::operator=(TelemetryBuffer&&)` | `include/core/TelemetryBuffer.hpp` | `DeepCopying` |
| **Static data members & static member functions** | `SensorStation::activeCount_` & `SensorStation::activeCount()`; `EarlyWarningSiren::globalAlertLevel_` & `EarlyWarningSiren::globalAlertLevel()`; `SimulationEngine::calculateLandslideRisk()`, `calculateFloodRisk()`, `calculateOverallRisk()`, `classifyRisk()` | `include/core/SensorStation.hpp`, `src/core/SensorStation.cpp`, `include/core/EarlyWarningSiren.hpp`, `src/core/EarlyWarningSiren.cpp`, `include/core/Simulation.hpp`, `src/core/Simulation.cpp` | `StaticMembers`, `SirenActivation`, `HazardCalculations` |
| **Friend class (privileged internal audit)** | `friend class TelemetryAuditor` inside `Telemetry`; `TelemetryAuditor::inspectRaw()`, `TelemetryAuditor::inspectHistory()` | `include/core/Telemetry.hpp` | `ExceptionHandling`, `DashboardIntegration` |
| **Friend operator overloading (`<<`, `>>`, `+`)** | `SensorStation::operator<<`, `SensorStation::operator>>`, `SensorCluster::operator+`, `SensorCluster::operator<<` | `include/core/SensorStation.hpp`, `include/core/SensorCluster.hpp` | `OperatorOverloading` |
| **Member & free operator overloading (`>`, `<<`, `[]`, `()`)** | `operator>(const RegionalHazard&, const RegionalHazard&)`, `operator<<(std::ostream&, const RegionalHazard&)`, `TelemetryBuffer::operator[]`, `EvacuationPriority::operator()` | `include/core/RegionalHazard.hpp`, `include/core/TelemetryBuffer.hpp`, `include/core/IncidentLogger.hpp` | `OperatorOverloading`, `EvacuationPrioritization` |
| **Containership / Composition (HAS-A)** | `BaseSensorNode` owns `PowerSubsystem power_` by value; `SensorCluster` owns `std::vector<SensorStation> stations_`; `SimulationEngine` owns `std::map<std::string, EarlyWarningSiren>` & `TelemetryBuffer auditBuffer_` | `include/core/SensorNode.hpp`, `include/core/SensorCluster.hpp`, `include/core/Simulation.hpp` | `Containership`, `OperatorOverloading` |

---

## Unit III — Inheritance, Virtual Base Classes & Runtime Polymorphism

| Syllabus Concept | Implementing Class / Struct / Function | Source / Header File | CTest Suite |
|---|---|---|---|
| **Abstract base class & pure virtual functions** | `BaseSensorNode` (`virtual void readTelemetry() = 0`, `virtual void evaluateThreshold() = 0`) | `include/core/SensorNode.hpp` | `RuntimePolymorphism` |
| **Virtual destructor** | `BaseSensorNode::~BaseSensorNode()`, `DisasterTelemetryDevice::~DisasterTelemetryDevice()` | `include/core/SensorNode.hpp` | `RuntimePolymorphism` |
| **Hierarchical & multi-level inheritance** | `BaseSensorNode` -> `DisasterTelemetryDevice` -> `RainGaugeNode` -> `FloodStationProbe`; `AutonomousHybridProbe` -> `LandslideStationProbe` | `include/core/SensorNode.hpp`, `src/core/Simulation.cpp` | `RuntimePolymorphism`, `HazardCalculations` |
| **Multiple inheritance & virtual base classes (Diamond Problem)** | `SolarPoweredNode : virtual public DisasterTelemetryDevice`, `WirelessLoRaTransceiver : virtual public DisasterTelemetryDevice`, `AutonomousHybridProbe : public SolarPoweredNode, public WirelessLoRaTransceiver` | `include/core/SensorNode.hpp` | `VirtualInheritance` |
| **Runtime polymorphism & base-pointer dispatch** | `executeSensorSweep(const std::vector<BaseSensorNode*>&)` called in `SimulationEngine::evaluate()` with `LandslideStationProbe` & `FloodStationProbe` | `include/core/SensorNode.hpp`, `src/core/Simulation.cpp` | `RuntimePolymorphism`, `SirenActivation` |
| **RTTI (`dynamic_cast`)** | Downcasting `BaseSensorNode*` to `AutonomousHybridProbe*` / `RainGaugeNode*` in diagnostics and tests | `src/ui/Dashboard.cpp`, `tests/main_test.cpp` | `RuntimePolymorphism`, `DashboardIntegration` |

---

## Unit IV — Exception Handling, Binary File I/O, Templates & STL

| Syllabus Concept | Implementing Class / Struct / Function | Source / Header File | CTest Suite |
|---|---|---|---|
| **Custom exception hierarchy (`std::exception`)** | `SensorFailureException`, `TelemetryChecksumMismatch`, `ThresholdOverflowException`, `verifyTelemetryChecksum()` | `include/core/Exceptions.hpp` | `ExceptionHandling`, `RiskClassifications` |
| **Standard exceptions & multi-catch handling** | `std::invalid_argument` (`SimulationEngine::validateTelemetry`, `PowerSubsystem`, `SensorStation`, `EarlyWarningSiren`, `RegionalHazard`, `IncidentLogger::validate`), `std::out_of_range` (`TelemetryBuffer::checkIndex`, `PriorityQueue`, `IncidentLogger::updateById`), `ControlRoomDashboard::run()` catch blocks | `src/core/Simulation.cpp`, `src/core/IncidentLogger.cpp`, `src/ui/Dashboard.cpp`, `src/main.cpp` | `InvalidTelemetryRejection`, `ExceptionHandling`, `DashboardIntegration` |
| **Binary file serialization (`std::fstream`, `ios::binary`)** | `IncidentLogger::save()`, `loadAll()`, `writeText()`, `readText()`, `writeRecord()`, `readRecord()` | `include/core/IncidentLogger.hpp`, `src/core/IncidentLogger.cpp` | `BinarySerialization` |
| **Random-access file positioning (`seekg`, `seekp`, `tellg`)** | `IncidentLogger::save()` (`seekp(0, end)`), `IncidentLogger::loadAll()` (`seekg(0, end)`, `tellg()`, `seekg(0, beg)`), `IncidentLogger::updateById()` (`seekg(position, beg)`, `seekp(position, beg)`) | `src/core/IncidentLogger.cpp` | `SeekpSeekg` |
| **Atomic-style update rollback on exception** | `IncidentLogger::updateById()` (`try/catch` restoring `previous` record at `position`) | `src/core/IncidentLogger.cpp` | `Rollback` |
| **Custom stream manipulator** | `emergencyAlertHeader(std::ostream& out)` | `include/core/IncidentLogger.hpp` | `BinarySerialization`, `DashboardIntegration` |
| **Class template** | `template <typename T> class PriorityQueue` (`push`, `top`, `pop`, `empty`, `size` via `std::push_heap`/`std::pop_heap`) | `include/core/IncidentLogger.hpp` | `EvacuationPrioritization`, `ExceptionHandling` |
| **STL containers, algorithms, functors & lambdas** | `std::vector`, `std::map`, `std::array`, `std::optional`, `std::sort` with `EvacuationPriority` functor, `std::find_if`, `std::for_each`, `std::clamp`, `std::unique_ptr` | `src/core/IncidentLogger.cpp`, `src/core/Simulation.cpp`, `src/ui/Dashboard.cpp` | `EvacuationPrioritization`, `BinarySerialization`, `RuntimePolymorphism` |
