#pragma once

#include "EarlyWarningSiren.hpp"
#include "IncidentLogger.hpp"
#include <cstdint>
#include <map>
#include <random>
#include <string>
#include <vector>

namespace DisasterCore::Core {

enum class SimulationScenario {
    Normal, HeavyRainfall, IncreasingSoilSaturation, AbnormalSeismicVibrations,
    RapidRiverRise, CombinedThreat
};

enum class RiskClass { Low, Moderate, High, Critical };
enum class RoadCondition { Good, Slippery, Damaged, Blocked };

struct StationTelemetry {
    std::string stationId;
    std::string region;
    double latitude = 0.0;
    double longitude = 0.0;
    double soilSaturation = 0.0;       // fraction [0,1]
    double rainfallRate = 0.0;         // mm/hour
    double vibrationFrequency = 0.0;   // Hz
    double tiltAngle = 0.0;            // degrees
    double riverLevel = 0.0;           // metres
    double batteryLevel = 100.0;       // percent
    bool connected = true;
};

struct EvacuationRouteRecord {
    std::string routeId;
    std::string startingRegion;
    std::string destination;
    double distanceKm = 0.0;
    RoadCondition roadCondition = RoadCondition::Good;
    double landslideRisk = 0.0;        // 0-100
    double floodRisk = 0.0;            // 0-100
    bool available = true;
};

struct SimulationResult {
    StationTelemetry telemetry;
    double landslideRisk = 0.0;
    double floodRisk = 0.0;
    double overallRisk = 0.0;
    RiskClass classification = RiskClass::Low;
    bool sirenActive = false;
    std::vector<EvacuationRouteRecord> recommendedRoutes;
    std::string incidentId;
};

struct AlertEvent {
    std::string region;
    std::string sirenId;
    std::uint64_t cycle = 0;
    bool activated = false;
    RiskClass level = RiskClass::Low;
    std::string description;
};

struct SimulationConfig {
    std::uint32_t randomSeed = 211;
    double sensorNoiseFraction = 0.04;
    double criticalBatteryPercent = 15.0;
    double heavyRainfallMinMmPerHour = 48.0;
    double heavyRainfallMaxMmPerHour = 66.0;
    double increasingSoilStep = 0.09;
    double abnormalVibrationMinHz = 25.0;
    double abnormalVibrationMaxHz = 43.0;
    double riverRisePerCycleMetres = 0.75;
};

class SimulationEngine {
public:
    explicit SimulationEngine(IncidentLogger& incidentLogger, SimulationConfig config = {});
    ~SimulationEngine();
    SimulationEngine(const SimulationEngine&) = delete;
    SimulationEngine& operator=(const SimulationEngine&) = delete;

    const std::vector<StationTelemetry>& stations() const noexcept { return stations_; }
    const std::vector<EvacuationRouteRecord>& routes() const noexcept { return routes_; }
    const std::vector<AlertEvent>& alertHistory() const noexcept { return alertHistory_; }
    std::vector<SimulationResult> runScenario(SimulationScenario scenario);
    SimulationResult runManual(const StationTelemetry& telemetry);

    static double calculateLandslideRisk(const StationTelemetry& telemetry);
    static double calculateFloodRisk(const StationTelemetry& telemetry);
    static double calculateOverallRisk(double landslideRisk, double floodRisk) noexcept;
    static RiskClass classifyRisk(double risk);
    static const char* riskClassName(RiskClass level) noexcept;
    static const char* scenarioName(SimulationScenario scenario) noexcept;
    static const char* roadConditionName(RoadCondition condition) noexcept;

private:
    void initializeStations();
    void initializeRoutes();
    void validateTelemetry(const StationTelemetry& telemetry) const;
    std::vector<EvacuationRouteRecord> recommendRoutes(const StationTelemetry& telemetry,
                                                        double landslideRisk, double floodRisk) const;
    SimulationResult evaluate(const StationTelemetry& telemetry, const std::string& incidentType);
    void updateSiren(const SimulationResult& result);
    void saveImportantIncident(SimulationResult& result, const std::string& incidentType);

    IncidentLogger& incidentLogger_;
    SimulationConfig config_;
    std::mt19937 random_;
    std::vector<StationTelemetry> baselineStations_;
    std::vector<StationTelemetry> stations_;
    std::vector<EvacuationRouteRecord> routes_;
    std::map<std::string, EarlyWarningSiren> regionalSirens_;
    std::map<std::string, RiskClass> activeAlertLevels_;
    std::vector<AlertEvent> alertHistory_;
    std::uint64_t cycle_ = 0;
    double risingSoil_ = 0.35;
    double risingRiver_ = 1.1;
};

} // namespace DisasterCore::Core
