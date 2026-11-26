#include "../../include/core/Simulation.hpp"
#include "../../include/core/SensorNode.hpp"
#include "../../include/sensors/Hazard.hpp"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>
#include <stdexcept>

namespace DisasterCore::Core {
namespace {
double clampRisk(double value) { return std::clamp(value, 0.0, 100.0); }

double jitter(std::mt19937& generator, double value, double fraction) {
    if (fraction == 0.0) return value;
    std::normal_distribution<double> noise(0.0, fraction);
    return value * std::max(0.0, 1.0 + noise(generator));
}

class LandslideStationProbe final : public AutonomousHybridProbe {
public:
    explicit LandslideStationProbe(const StationTelemetry& telemetry)
        : AutonomousHybridProbe(telemetry.stationId,
            PowerSubsystem(100.0, telemetry.batteryLevel, 0.2, 0.0, 1.0)), telemetry_(telemetry) {}
    void readTelemetry() override { setMeasurement(SimulationEngine::calculateLandslideRisk(telemetry_)); }
    void evaluateThreshold() override { setThresholdExceeded(measurement() >= 50.0); }
private:
    const StationTelemetry& telemetry_;
};

class FloodStationProbe final : public RainGaugeNode {
public:
    explicit FloodStationProbe(const StationTelemetry& telemetry)
        : RainGaugeNode(telemetry.stationId,
            PowerSubsystem(100.0, telemetry.batteryLevel, 0.2, 0.0, 1.0)), telemetry_(telemetry) {}
    void readTelemetry() override { setMeasurement(SimulationEngine::calculateFloodRisk(telemetry_)); }
    void evaluateThreshold() override { setThresholdExceeded(measurement() >= 50.0); }
private:
    const StationTelemetry& telemetry_;
};
} // namespace

SimulationEngine::SimulationEngine(IncidentLogger& logger, SimulationConfig config)
    : incidentLogger_(logger), config_(config), random_(config.randomSeed) {
    if (!std::isfinite(config_.sensorNoiseFraction) || config_.sensorNoiseFraction < 0.0 ||
        config_.sensorNoiseFraction > 0.5 || !std::isfinite(config_.criticalBatteryPercent) ||
        config_.criticalBatteryPercent < 0.0 || config_.criticalBatteryPercent > 100.0 ||
        !std::isfinite(config_.heavyRainfallMinMmPerHour) || !std::isfinite(config_.heavyRainfallMaxMmPerHour) ||
        config_.heavyRainfallMinMmPerHour < 0.0 || config_.heavyRainfallMaxMmPerHour < config_.heavyRainfallMinMmPerHour ||
        config_.heavyRainfallMaxMmPerHour > 300.0 || !std::isfinite(config_.increasingSoilStep) ||
        config_.increasingSoilStep < 0.0 || config_.increasingSoilStep > 0.5 ||
        !std::isfinite(config_.abnormalVibrationMinHz) || !std::isfinite(config_.abnormalVibrationMaxHz) ||
        config_.abnormalVibrationMinHz < 0.0 || config_.abnormalVibrationMaxHz < config_.abnormalVibrationMinHz ||
        config_.abnormalVibrationMaxHz > 100.0 || !std::isfinite(config_.riverRisePerCycleMetres) ||
        config_.riverRisePerCycleMetres < 0.0 || config_.riverRisePerCycleMetres > 5.0)
        throw std::invalid_argument("invalid simulation configuration");
    initializeStations();
    initializeRoutes();
    for (const auto& station : stations_) {
        const std::string sirenId = "SIREN-" + station.region;
        regionalSirens_.emplace(station.region,
            EarlyWarningSiren(sirenId, station.latitude, station.longitude));
        telemetryAudits_.emplace(station.stationId, Telemetry{});
    }
    lastResults_ = snapshotCurrentState();
    appendEvent("System initialized with " + std::to_string(stations_.size()) +
                " monitoring stations (seed=" + std::to_string(config_.randomSeed) + ")");
}

SimulationEngine::~SimulationEngine() {
    for (auto& entry : regionalSirens_) entry.second.deactivate();
}

void SimulationEngine::initializeStations() {
    stations_ = {
        {"UK-UTT-01", "Uttarkashi", 30.7268, 78.4354, 0.32, 1.5, 2.5, 2.0, 1.4, 96.0, true},
        {"UK-CHA-02", "Chamoli", 30.4020, 79.3206, 0.39, 2.0, 3.0, 3.0, 1.8, 93.0, true},
        {"UK-RUD-03", "Rudraprayag", 30.2844, 78.9811, 0.36, 1.8, 2.7, 2.5, 1.5, 95.0, true},
        {"UK-JOS-04", "Joshimath", 30.5550, 79.5650, 0.43, 2.4, 3.4, 4.0, 2.1, 91.0, true},
        {"UK-PIT-05", "Pithoragarh", 29.5829, 80.2182, 0.34, 1.7, 2.8, 2.0, 1.6, 94.0, true}
    };
    baselineStations_ = stations_;
}

void SimulationEngine::initializeRoutes() {
    const std::vector<std::string> regions = {"Uttarkashi", "Chamoli", "Rudraprayag", "Joshimath", "Pithoragarh"};
    for (const auto& region : regions) {
        routes_.push_back({"R-" + region + "-A", region, "Regional safe shelter", 12.0,
                           RoadCondition::Good, 12.0, 9.0, true});
        routes_.push_back({"R-" + region + "-B", region, "District relief centre", 7.5,
                           RoadCondition::Slippery, 24.0, 18.0, true});
        routes_.push_back({"R-" + region + "-C", region, "Mountain access road", 5.0,
                           RoadCondition::Blocked, 8.0, 10.0, false});
    }
}

const char* SimulationEngine::scenarioName(SimulationScenario scenario) noexcept {
    switch (scenario) {
        case SimulationScenario::Normal: return "Normal conditions";
        case SimulationScenario::HeavyRainfall: return "Heavy rainfall";
        case SimulationScenario::IncreasingSoilSaturation: return "Increasing soil saturation";
        case SimulationScenario::AbnormalSeismicVibrations: return "Abnormal seismic vibrations";
        case SimulationScenario::RapidRiverRise: return "Rapid river-level increase";
        case SimulationScenario::CombinedThreat: return "Combined landslide and flash-flood threat";
    }
    return "Unknown scenario";
}

const char* SimulationEngine::riskClassName(RiskClass level) noexcept {
    switch (level) {
        case RiskClass::Low: return "LOW";
        case RiskClass::Moderate: return "MODERATE";
        case RiskClass::High: return "HIGH";
        case RiskClass::Critical: return "CRITICAL";
    }
    return "UNKNOWN";
}

const char* SimulationEngine::roadConditionName(RoadCondition condition) noexcept {
    switch (condition) {
        case RoadCondition::Good: return "good";
        case RoadCondition::Slippery: return "slippery";
        case RoadCondition::Damaged: return "damaged";
        case RoadCondition::Blocked: return "blocked";
    }
    return "unknown";
}

double SimulationEngine::calculateLandslideRisk(const StationTelemetry& t) {
    // Soil moisture, rainfall, vibration and slope movement are kept independent
    // from the flood score, and the result is normalized to a 0-100 scale.
    const double soil = Sensors::soilSaturation(t.soilSaturation, 1.0) * 40.0;
    const double rain = Sensors::rainfallSeverity(t.rainfallRate) * 25.0;
    const double vibration = std::clamp(Sensors::vibrationSeverity(t.vibrationFrequency) /
                                        Sensors::vibrationSeverity(40.0), 0.0, 1.0) * 20.0;
    const double tilt = std::clamp(t.tiltAngle / 30.0, 0.0, 1.0) * 15.0;
    return clampRisk(soil + rain + vibration + tilt);
}

double SimulationEngine::calculateFloodRisk(const StationTelemetry& t) {
    const double river = Sensors::floodSeverity(t.riverLevel) * 75.0;
    const double rain = Sensors::rainfallSeverity(t.rainfallRate) * 25.0;
    return clampRisk(river + rain);
}

double SimulationEngine::calculateOverallRisk(double landslide, double flood) noexcept {
    // The maximum prevents a critical hazard in either domain from being averaged away.
    return std::max(landslide, flood);
}

RiskClass SimulationEngine::classifyRisk(double risk) {
    if (!std::isfinite(risk) || risk < 0.0 || risk > 100.0) throw ThresholdOverflowException();
    if (risk < 25.0) return RiskClass::Low;
    if (risk < 50.0) return RiskClass::Moderate;
    if (risk < 75.0) return RiskClass::High;
    return RiskClass::Critical;
}

std::vector<SimulationResult> SimulationEngine::runScenario(SimulationScenario scenario) {
    ++cycle_;
    std::vector<SimulationResult> results;
    results.reserve(stations_.size());
    std::uniform_real_distribution<double> connectionDraw(0.0, 1.0);

    for (std::size_t index = 0; index < stations_.size(); ++index) {
        auto& station = stations_[index];
        const auto& baseline = baselineStations_[index];
        StationTelemetry reading = baseline;
        double soil = baseline.soilSaturation, rainfall = baseline.rainfallRate;
        double vibration = baseline.vibrationFrequency, tilt = baseline.tiltAngle, river = baseline.riverLevel;
        switch (scenario) {
            case SimulationScenario::Normal:
                break;
            case SimulationScenario::HeavyRainfall:
                rainfall = config_.heavyRainfallMinMmPerHour +
                    (config_.heavyRainfallMaxMmPerHour - config_.heavyRainfallMinMmPerHour) * connectionDraw(random_);
                soil = baseline.soilSaturation + 0.18;
                river = baseline.riverLevel + 0.7;
                break;
            case SimulationScenario::IncreasingSoilSaturation:
                risingSoil_ = std::min(0.97, risingSoil_ + config_.increasingSoilStep);
                soil = risingSoil_;
                rainfall = 8.0;
                break;
            case SimulationScenario::AbnormalSeismicVibrations:
                vibration = config_.abnormalVibrationMinHz +
                    (config_.abnormalVibrationMaxHz - config_.abnormalVibrationMinHz) * connectionDraw(random_);
                tilt += 5.0;
                break;
            case SimulationScenario::RapidRiverRise:
                risingRiver_ = std::min(5.9, risingRiver_ + config_.riverRisePerCycleMetres);
                river = risingRiver_;
                rainfall = 18.0;
                break;
            case SimulationScenario::CombinedThreat:
                rainfall = 80.0 + 15.0 * connectionDraw(random_);
                soil = std::min(0.99, baseline.soilSaturation + 0.43);
                vibration = 25.0 + 15.0 * connectionDraw(random_);
                tilt = baseline.tiltAngle + 12.0;
                river = std::min(5.9, baseline.riverLevel + 3.8);
                break;
        }
        reading.soilSaturation = std::clamp(jitter(random_, soil, config_.sensorNoiseFraction), 0.0, 1.0);
        reading.rainfallRate = std::max(0.0, jitter(random_, rainfall, config_.sensorNoiseFraction));
        reading.vibrationFrequency = std::max(0.0, jitter(random_, vibration, config_.sensorNoiseFraction));
        reading.tiltAngle = std::clamp(jitter(random_, tilt, config_.sensorNoiseFraction), 0.0, 90.0);
        reading.riverLevel = std::clamp(jitter(random_, river, config_.sensorNoiseFraction), 0.0, 20.0);
        reading.batteryLevel = std::max(0.0, station.batteryLevel - 0.3);
        reading.connected = connectionDraw(random_) >= 0.015;
        station = reading;
        results.push_back(evaluate(reading, scenarioName(scenario)));
    }
    lastResults_ = results;
    appendEvent("Cycle " + std::to_string(cycle_) + ": Scenario '" +
                std::string(scenarioName(scenario)) + "' completed");
    return results;
}

void SimulationEngine::validateTelemetry(const StationTelemetry& t) const {
    const auto known = std::find_if(stations_.begin(), stations_.end(), [&](const StationTelemetry& station) {
        return station.stationId == t.stationId && station.region == t.region;
    });
    if (known == stations_.end()) throw std::invalid_argument("manual telemetry must identify a configured station and region");
    const double values[] = {t.latitude, t.longitude, t.soilSaturation, t.rainfallRate,
        t.vibrationFrequency, t.tiltAngle, t.riverLevel, t.batteryLevel};
    for (double value : values) if (!std::isfinite(value)) throw std::invalid_argument("telemetry values must be finite");
    if (t.latitude < -90.0 || t.latitude > 90.0 || t.longitude < -180.0 || t.longitude > 180.0 ||
        t.soilSaturation < 0.0 || t.soilSaturation > 1.0 || t.rainfallRate < 0.0 || t.rainfallRate > 300.0 ||
        t.vibrationFrequency < 0.0 || t.vibrationFrequency > 100.0 || t.tiltAngle < 0.0 || t.tiltAngle > 90.0 ||
        t.riverLevel < 0.0 || t.riverLevel > 20.0 || t.batteryLevel < 0.0 || t.batteryLevel > 100.0)
        throw std::invalid_argument("manual telemetry is outside a supported sensor range");
}

SimulationResult SimulationEngine::runManual(const StationTelemetry& telemetry) {
    validateTelemetry(telemetry);
    ++cycle_;
    auto found = std::find_if(stations_.begin(), stations_.end(), [&](const StationTelemetry& station) {
        return station.stationId == telemetry.stationId;
    });
    *found = telemetry;
    SimulationResult result = evaluate(telemetry, "Manual telemetry");
    bool updatedLast = false;
    for (auto& existing : lastResults_) {
        if (existing.telemetry.stationId == telemetry.stationId) {
            existing = result;
            updatedLast = true;
            break;
        }
    }
    if (!updatedLast) lastResults_.push_back(result);
    appendEvent("Cycle " + std::to_string(cycle_) + ": Manual telemetry processed for " +
                telemetry.stationId + " (" + telemetry.region + ")");
    return result;
}

std::vector<EvacuationRouteRecord> SimulationEngine::recommendRoutes(
    const StationTelemetry& telemetry, double landslideRisk, double floodRisk) const {
    struct Ranked { EvacuationRouteRecord route; unsigned int score; };
    std::vector<Ranked> ranked;
    std::vector<EvacuationRoute> priorities;
    for (const auto& route : routes_) {
        if (!route.available || route.startingRegion != telemetry.region || route.roadCondition == RoadCondition::Blocked)
            continue;
        EvacuationRouteRecord adjusted = route;
        adjusted.landslideRisk = std::max(adjusted.landslideRisk, landslideRisk * 0.45);
        adjusted.floodRisk = std::max(adjusted.floodRisk, floodRisk * 0.45);
        if (adjusted.roadCondition == RoadCondition::Damaged) {
            adjusted.landslideRisk = std::min(100.0, adjusted.landslideRisk + 10.0);
            adjusted.floodRisk = std::min(100.0, adjusted.floodRisk + 5.0);
        } else if (adjusted.roadCondition == RoadCondition::Slippery) {
            adjusted.landslideRisk = std::min(100.0, adjusted.landslideRisk + 5.0);
        }
        if (std::max(adjusted.landslideRisk, adjusted.floodRisk) >= 75.0) continue;
        const double routeRisk = std::max(adjusted.landslideRisk, adjusted.floodRisk);
        const double roadPenalty = adjusted.roadCondition == RoadCondition::Good ? 0.0 :
            adjusted.roadCondition == RoadCondition::Slippery ? 5.0 : 15.0;
        const unsigned int score = static_cast<unsigned int>(std::clamp(
            std::lround(1000.0 - routeRisk * 10.0 - roadPenalty * 10.0 - adjusted.distanceKm * 0.1), 0L, 1000L));
        priorities.push_back({adjusted.routeId, score});
        ranked.push_back({adjusted, score});
    }
    sortEvacuationRoutes(priorities); // reuse the Unit IV priority functor
    std::vector<EvacuationRouteRecord> recommendations;
    for (const auto& item : priorities) {
        const auto route = std::find_if(ranked.begin(), ranked.end(), [&](const Ranked& candidate) {
            return candidate.route.routeId == item.name;
        });
        if (route != ranked.end()) recommendations.push_back(route->route);
    }
    return recommendations;
}

void SimulationEngine::updateSiren(const SimulationResult& result) {
    auto& siren = regionalSirens_.at(result.telemetry.region);
    const bool shouldBeActive = result.overallRisk >= 50.0;
    const auto previousLevel = activeAlertLevels_.find(result.telemetry.region);
    if (shouldBeActive != siren.isActive()) {
        if (shouldBeActive) siren.activate(); else siren.deactivate();
        alertHistory_.push_back({result.telemetry.region, siren.id(), cycle_, shouldBeActive,
            result.classification, std::string("SIMULATED: ") +
            (shouldBeActive ? "regional warning activated" : "regional warning cleared")});
        if (shouldBeActive) activeAlertLevels_[result.telemetry.region] = result.classification;
        else activeAlertLevels_.erase(result.telemetry.region);
        appendEvent("Siren " + siren.id() + " " + (shouldBeActive ? "ACTIVATED" : "CLEARED") +
                    " [" + riskClassName(result.classification) + "]");
    } else if (shouldBeActive && previousLevel != activeAlertLevels_.end() &&
               previousLevel->second != result.classification) {
        alertHistory_.push_back({result.telemetry.region, siren.id(), cycle_, true,
            result.classification, "SIMULATED: regional alert level changed"});
        previousLevel->second = result.classification;
        appendEvent("Siren " + siren.id() + " level escalated/changed to " +
                    riskClassName(result.classification));
    }
}

void SimulationEngine::saveImportantIncident(SimulationResult& result, const std::string& incidentType) {
    const bool lowBattery = result.telemetry.batteryLevel <= config_.criticalBatteryPercent;
    if (result.overallRisk < 50.0 && !lowBattery) return;
    std::ostringstream id;
    id << "SIM-" << std::setw(6) << std::setfill('0') << cycle_ << '-' << result.telemetry.stationId;
    result.incidentId = id.str();
    unsigned int duplicate = 1;
    while (incidentLogger_.searchById(result.incidentId)) {
        result.incidentId = id.str() + "-" + std::to_string(duplicate++);
    }
    std::ostringstream timestamp;
    timestamp << "SIM-CYCLE-" << std::setw(6) << std::setfill('0') << cycle_;
    IncidentRecord incident;
    incident.incidentId = result.incidentId;
    incident.timestamp = timestamp.str();
    incident.stationId = result.telemetry.stationId;
    incident.region = result.telemetry.region;
    const std::string storedType = lowBattery && result.overallRisk < 50.0 ? "Low battery telemetry" :
        incidentType == "Combined landslide and flash-flood threat" ? "Combined threat" : incidentType;
    incident.incidentType = "SIMULATED: " + storedType;
    incident.landslideRisk = result.landslideRisk / 100.0;
    incident.floodRisk = result.floodRisk / 100.0;
    incident.overallRisk = result.overallRisk / 100.0;
    incident.sirenActivated = result.sirenActive;
    incident.evacuationRoute = result.recommendedRoutes.empty()
        ? "No safe route available" : result.recommendedRoutes.front().routeId;
    incidentLogger_.save(incident);
    appendEvent("Incident persisted: " + result.incidentId + " (" + incident.region + ")");
}

void SimulationEngine::appendEvent(const std::string& event) {
    if (systemEvents_.size() >= 200) {
        systemEvents_.erase(systemEvents_.begin());
    }
    systemEvents_.push_back(event);
}

std::vector<SimulationResult> SimulationEngine::snapshotCurrentState() const {
    std::vector<SimulationResult> snapshot;
    snapshot.reserve(stations_.size());
    for (const auto& station : stations_) {
        SimulationResult item;
        item.telemetry = station;
        item.landslideRisk = calculateLandslideRisk(station);
        item.floodRisk = calculateFloodRisk(station);
        item.overallRisk = calculateOverallRisk(item.landslideRisk, item.floodRisk);
        item.classification = classifyRisk(item.overallRisk);
        item.recommendedRoutes = recommendRoutes(station, item.landslideRisk, item.floodRisk);
        const auto sirenIt = regionalSirens_.find(station.region);
        item.sirenActive = (sirenIt != regionalSirens_.end()) && sirenIt->second.isActive();
        snapshot.push_back(std::move(item));
    }
    return snapshot;
}

std::vector<EvacuationRouteRecord> SimulationEngine::evaluateRoutesForRegion(const std::string& region) const {
    for (const auto& station : stations_) {
        if (station.region == region) {
            const double landslide = calculateLandslideRisk(station);
            const double flood = calculateFloodRisk(station);
            return recommendRoutes(station, landslide, flood);
        }
    }
    return {};
}

SimulationResult SimulationEngine::evaluate(const StationTelemetry& telemetry, const std::string& incidentType) {
    SimulationResult result;
    result.telemetry = telemetry;
    LandslideStationProbe landslideProbe(telemetry);
    FloodStationProbe floodProbe(telemetry);
    const std::vector<BaseSensorNode*> sensorSweep = {&landslideProbe, &floodProbe};
    executeSensorSweep(sensorSweep); // polymorphic telemetry and threshold sweep per station
    result.landslideRisk = landslideProbe.measurement();
    result.floodRisk = floodProbe.measurement();
    result.overallRisk = calculateOverallRisk(result.landslideRisk, result.floodRisk);
    result.classification = classifyRisk(result.overallRisk);
    double recordedRisk = 0.0;
    telemetryAudits_[telemetry.stationId].updateMeasurement(recordedRisk, result.overallRisk);
    auditBuffer_.push_back(recordedRisk);
    result.recommendedRoutes = recommendRoutes(telemetry, result.landslideRisk, result.floodRisk);
    updateSiren(result);
    result.sirenActive = regionalSirens_.at(telemetry.region).isActive();
    saveImportantIncident(result, incidentType);
    return result;
}

} // namespace DisasterCore::Core
