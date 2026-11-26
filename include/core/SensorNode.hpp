#pragma once

#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace DisasterCore::Core {

class PowerSubsystem {
public:
    PowerSubsystem(double capacity = 100.0, double charge = 100.0,
                   double solarRate = 0.0, double consumption = 0.0,
                   double health = 1.0)
        : capacity_(capacity), charge_(charge), solarRate_(solarRate),
          consumption_(consumption), health_(health) {
        if (capacity < 0.0 || charge < 0.0 || charge > capacity ||
            solarRate < 0.0 || consumption < 0.0 || health < 0.0 || health > 1.0)
            throw std::invalid_argument("invalid power subsystem values");
    }

    double batteryCapacity() const noexcept { return capacity_; }
    double currentCharge() const noexcept { return charge_; }
    double solarChargingRate() const noexcept { return solarRate_; }
    double powerConsumption() const noexcept { return consumption_; }
    double batteryHealth() const noexcept { return health_; }

    void chargeFromSolar(double hours) {
        if (hours < 0.0) throw std::invalid_argument("hours must be non-negative");
        charge_ = (charge_ + hours * solarRate_ * health_ < capacity_)
                    ? charge_ + hours * solarRate_ * health_ : capacity_;
    }
    void consume(double amount) {
        if (amount < 0.0 || amount > charge_) throw std::invalid_argument("invalid power consumption");
        charge_ -= amount;
    }

private:
    double capacity_, charge_, solarRate_, consumption_, health_;
};

class BaseSensorNode {
public:
    explicit BaseSensorNode(PowerSubsystem power = {}) : power_(power) {}
    virtual ~BaseSensorNode() = default;
    virtual void readTelemetry() = 0;
    virtual void evaluateThreshold() = 0;
    PowerSubsystem& powerSubsystem() noexcept { return power_; }
    const PowerSubsystem& powerSubsystem() const noexcept { return power_; }

private:
    PowerSubsystem power_; // HAS-A: every sensor node owns its power subsystem
};

class DisasterTelemetryDevice : public BaseSensorNode {
public:
    explicit DisasterTelemetryDevice(std::string id = "device", PowerSubsystem power = {})
        : BaseSensorNode(power), id_(std::move(id)) {}
    virtual ~DisasterTelemetryDevice() = default;
    const std::string& id() const noexcept { return id_; }
    double measurement() const noexcept { return measurement_; }
    bool thresholdExceeded() const noexcept { return thresholdExceeded_; }

protected:
    void setMeasurement(double value) noexcept { measurement_ = value; }
    void setThresholdExceeded(bool value) noexcept { thresholdExceeded_ = value; }

private:
    std::string id_;
    double measurement_ = 0.0;
    bool thresholdExceeded_ = false;
};

class SolarPoweredNode : virtual public DisasterTelemetryDevice {
public:
    explicit SolarPoweredNode(std::string id = "solar", PowerSubsystem power = {})
        : DisasterTelemetryDevice(std::move(id), power) {}
};

class WirelessLoRaTransceiver : virtual public DisasterTelemetryDevice {
public:
    explicit WirelessLoRaTransceiver(std::string id = "lora", PowerSubsystem power = {})
        : DisasterTelemetryDevice(std::move(id), power) {}
};

class AutonomousHybridProbe : public SolarPoweredNode, public WirelessLoRaTransceiver {
public:
    explicit AutonomousHybridProbe(std::string id = "hybrid", PowerSubsystem power = {})
        : DisasterTelemetryDevice(id, power), SolarPoweredNode(id, power),
          WirelessLoRaTransceiver(id, power) {}
    void readTelemetry() override { setMeasurement(42.0); }
    void evaluateThreshold() override { setThresholdExceeded(measurement() >= 40.0); }
};

class RainGaugeNode : public DisasterTelemetryDevice {
public:
    explicit RainGaugeNode(std::string id = "rain-gauge", PowerSubsystem power = {})
        : DisasterTelemetryDevice(std::move(id), power) {}
    void readTelemetry() override { setMeasurement(12.5); }
    void evaluateThreshold() override { setThresholdExceeded(measurement() >= 10.0); }
};

inline void executeSensorSweep(const std::vector<BaseSensorNode*>& nodes) {
    for (BaseSensorNode* node : nodes) {
        if (!node) throw std::invalid_argument("sensor sweep contains a null node");
        node->readTelemetry();
        node->evaluateThreshold();
    }
}

} // namespace DisasterCore::Core
