# ALF-EWG UML Class Diagrams

## 1. Sensor Node Inheritance, Virtual Diamond & Composition (CIC-211 Unit III)

```mermaid
classDiagram
    class PowerSubsystem {
        -double capacity_
        -double charge_
        -double solarRate_
        -double consumption_
        -double health_
        +PowerSubsystem(capacity, charge, solarRate, consumption, health)
        +chargeFromSolar(hours)
        +consume(amount)
        +batteryCapacity() double
        +currentCharge() double
        +batteryHealth() double
    }

    class BaseSensorNode {
        <<abstract>>
        -PowerSubsystem power_
        +BaseSensorNode(power)
        +virtual ~BaseSensorNode()
        +readTelemetry()*
        +evaluateThreshold()*
        +powerSubsystem() PowerSubsystem
    }

    class DisasterTelemetryDevice {
        -string id_
        -double measurement_
        -bool thresholdExceeded_
        +id() string
        +measurement() double
        +thresholdExceeded() bool
        #setMeasurement(value)
        #setThresholdExceeded(value)
    }

    class SolarPoweredNode {
        +SolarPoweredNode(id, power)
    }

    class WirelessLoRaTransceiver {
        +WirelessLoRaTransceiver(id, power)
    }

    class AutonomousHybridProbe {
        +AutonomousHybridProbe(id, power)
        +readTelemetry()
        +evaluateThreshold()
    }

    class RainGaugeNode {
        +RainGaugeNode(id, power)
        +readTelemetry()
        +evaluateThreshold()
    }

    class LandslideStationProbe {
        -const StationTelemetry& telemetry_
        +readTelemetry()
        +evaluateThreshold()
    }

    class FloodStationProbe {
        -const StationTelemetry& telemetry_
        +readTelemetry()
        +evaluateThreshold()
    }

    BaseSensorNode *-- PowerSubsystem : HAS-A
    BaseSensorNode <|-- DisasterTelemetryDevice
    DisasterTelemetryDevice <|-- SolarPoweredNode : virtual
    DisasterTelemetryDevice <|-- WirelessLoRaTransceiver : virtual
    SolarPoweredNode <|-- AutonomousHybridProbe
    WirelessLoRaTransceiver <|-- AutonomousHybridProbe
    DisasterTelemetryDevice <|-- RainGaugeNode
    AutonomousHybridProbe <|-- LandslideStationProbe
    RainGaugeNode <|-- FloodStationProbe
```

`SolarPoweredNode` and `WirelessLoRaTransceiver` virtually inherit `DisasterTelemetryDevice`, ensuring `AutonomousHybridProbe` (and `LandslideStationProbe`) contains exactly **one** shared `DisasterTelemetryDevice` and `BaseSensorNode` subobject.

---

## 2. Core Simulation, Persistence, Telemetry & Dashboard Architecture

```mermaid
classDiagram
    class SimulationEngine {
        -IncidentLogger& incidentLogger_
        -SimulationConfig config_
        -mt19937 random_
        -vector~StationTelemetry~ stations_
        -vector~EvacuationRouteRecord~ routes_
        -map~string, EarlyWarningSiren~ regionalSirens_
        -map~string, RiskClass~ activeAlertLevels_
        -vector~AlertEvent~ alertHistory_
        -map~string, Telemetry~ telemetryAudits_
        -TelemetryBuffer auditBuffer_
        -uint64_t cycle_
        +runScenario(scenario) vector~SimulationResult~
        +runManual(telemetry) SimulationResult
        +snapshotCurrentState() vector~SimulationResult~
        +evaluateRoutesForRegion(region) vector~EvacuationRouteRecord~
        +calculateLandslideRisk(t)$ double
        +calculateFloodRisk(t)$ double
        +calculateOverallRisk(l, f)$ double
        +classifyRisk(risk)$ RiskClass
    }

    class IncidentLogger {
        -filesystem::path filePath_
        +save(incident)
        +loadAll() vector~IncidentRecord~
        +searchById(id) optional~IncidentRecord~
        +listHistory() vector~IncidentRecord~
        +updateById(id, replacement, afterWrite)
    }

    class EarlyWarningSiren {
        -string id_
        -double latitude_
        -double longitude_
        -bool active_
        -static unsigned int globalAlertLevel_
        +activate()
        +deactivate()
        +isActive() bool
        +globalAlertLevel()$ unsigned int
    }

    class SensorStation {
        -string id_
        -double latitude_
        -double longitude_
        -static unsigned int activeCount_
        +activeCount()$ unsigned int
    }

    class SensorCluster {
        -vector~SensorStation~ stations_
        +add(station)
        +operator+(a, b) SensorCluster
    }

    class RegionalHazard {
        -double severity_
        +severity() double
        +setSeverity(s)
        +operator>(lhs, rhs) bool
    }

    class Telemetry {
        -double rawMeasurement_
        -vector~double~ history_
        +updateMeasurement(target, newValue)
        +current() double&
    }

    class TelemetryAuditor {
        +inspectRaw(t) double
        +inspectHistory(t) vector~double~
    }

    class TelemetryBuffer {
        -double* data_
        -size_t size_
        -size_t capacity_
        +push_back(value)
        +operator[](idx) double&
    }

    class EvacuationPriority {
        +operator()(left, right) bool
    }

    class PriorityQueue~T~ {
        -vector~T~ values_
        +push(value)
        +top() T
        +pop()
    }

    class ControlRoomDashboard {
        -SimulationEngine& engine_
        -istream& in_
        -ostream& out_
        -bool useAnsi_
        -SensorCluster stationCluster_
        +run() int
        +renderLiveDashboard()
        +runFullSystemDiagnostic()
    }

    ControlRoomDashboard --> SimulationEngine : operates
    ControlRoomDashboard *-- SensorCluster : owns
    SensorCluster *-- SensorStation : contains
    SimulationEngine --> IncidentLogger : persists via
    SimulationEngine *-- EarlyWarningSiren : manages
    SimulationEngine *-- Telemetry : audits
    SimulationEngine *-- TelemetryBuffer : buffers
    TelemetryAuditor ..> Telemetry : friend
    IncidentLogger ..> EvacuationPriority : orders routes
```
