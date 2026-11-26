# Sensor node class diagram (CIC-211 Unit III)

```mermaid
classDiagram
    class BaseSensorNode {
        <<abstract>>
        -PowerSubsystem power_
        +readTelemetry()*
        +evaluateThreshold()*
        +virtual ~BaseSensorNode()
    }
    class DisasterTelemetryDevice {
        -string id_
        -double measurement_
        -bool thresholdExceeded_
    }
    class SolarPoweredNode
    class WirelessLoRaTransceiver
    class AutonomousHybridProbe {
        +readTelemetry()
        +evaluateThreshold()
    }
    class RainGaugeNode {
        +readTelemetry()
        +evaluateThreshold()
    }
    class PowerSubsystem {
        -double capacity_
        -double charge_
        -double solarRate_
        -double consumption_
        -double health_
    }

    BaseSensorNode <|-- DisasterTelemetryDevice
    DisasterTelemetryDevice <|-- SolarPoweredNode : virtual
    DisasterTelemetryDevice <|-- WirelessLoRaTransceiver : virtual
    SolarPoweredNode <|-- AutonomousHybridProbe
    WirelessLoRaTransceiver <|-- AutonomousHybridProbe
    DisasterTelemetryDevice <|-- RainGaugeNode
    BaseSensorNode *-- PowerSubsystem : HAS-A
```

`SolarPoweredNode` and `WirelessLoRaTransceiver` virtually inherit the common
`DisasterTelemetryDevice`. Therefore the hybrid probe has one shared device
subobject. `BaseSensorNode` is the polymorphic interface and owns a
`PowerSubsystem` by value. A sweep stores non-owning `BaseSensorNode*` observers;
the example and tests keep ownership in `std::unique_ptr` collections.
