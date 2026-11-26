#include <cassert>
#include <iostream>
#include <cassert>
#include <vector>

#include "../include/sensors/Hazard.hpp"
#include "../include/sensors/HazardIndex.hpp"
#include "../include/core/Telemetry.hpp"
#include "../include/core/TelemetryBuffer.hpp"
#include "../include/core/SensorStation.hpp"
#include "../include/core/EarlyWarningSiren.hpp"
#include "../include/core/SensorCluster.hpp"
#include "../include/core/RegionalHazard.hpp"
#include "../include/core/SensorNode.hpp"
#include "../include/core/Exceptions.hpp"
#include "../include/core/IncidentLogger.hpp"
#include "../include/core/Simulation.hpp"
#include <memory>
#include <type_traits>
#include <filesystem>
#include <sstream>
#include <stdexcept>

int main() {
    using namespace DisasterCore::Core;
    bool caught = false;
    try { throw SensorFailureException(); }
    catch (const std::exception& error) { caught = std::string(error.what()).find("sensor") != std::string::npos; }
    assert(caught);
    caught = false;
    try { verifyTelemetryChecksum(10, 11); }
    catch (const TelemetryChecksumMismatch& error) { caught = std::string(error.what()).find("checksum") != std::string::npos; }
    assert(caught);
    caught = false;
    try { throw ThresholdOverflowException(); }
    catch (const ThresholdOverflowException& error) { caught = std::string(error.what()).find("threshold") != std::string::npos; }
    assert(caught);

    const auto incidentFile = std::filesystem::temp_directory_path() / "alf_ewg_unit4_test.bin";
    std::filesystem::remove(incidentFile);

    const auto simulationFile = std::filesystem::temp_directory_path() / "alf_ewg_simulation_test.bin";
    std::filesystem::remove(simulationFile);
    {
        IncidentLogger simulationLogger(simulationFile);
        SimulationConfig config;
        config.randomSeed = 8675309;
        SimulationEngine simulation(simulationLogger, config);
        assert(simulation.stations().size() == 5);
        assert(simulation.stations()[0].region == "Uttarkashi");
        assert(simulation.stations()[1].region == "Chamoli");
        assert(simulation.stations()[2].region == "Rudraprayag");
        assert(simulation.stations()[3].region == "Joshimath");
        assert(simulation.stations()[4].region == "Pithoragarh");

        const auto firstRun = simulation.runScenario(SimulationScenario::CombinedThreat);
        assert(firstRun.size() == 5);
        assert(firstRun[0].overallRisk >= 75.0);
        assert(firstRun[0].classification == RiskClass::Critical);
        assert(firstRun[0].sirenActive && !firstRun[0].incidentId.empty());
        assert(!firstRun[0].recommendedRoutes.empty());
        assert(firstRun[0].recommendedRoutes[0].available);
        assert(firstRun[0].recommendedRoutes[0].startingRegion == "Uttarkashi");
        assert(firstRun[0].recommendedRoutes[0].roadCondition != RoadCondition::Blocked);

        const auto alertCount = simulation.alertHistory().size();
        assert(alertCount == 5);
        simulation.runScenario(SimulationScenario::CombinedThreat);
        assert(simulation.alertHistory().size() == alertCount); // no duplicate activation events
        assert(simulationLogger.listHistory().size() == 10);

        StationTelemetry manual = simulation.stations().front();
        manual.soilSaturation = 0.2;
        manual.rainfallRate = 0.0;
        manual.vibrationFrequency = 1.0;
        manual.tiltAngle = 0.0;
        manual.riverLevel = 0.1;
        manual.batteryLevel = 10.0;
        const auto manualResult = simulation.runManual(manual);
        assert(manualResult.overallRisk < 25.0);
        assert(!manualResult.sirenActive);
        assert(simulation.alertHistory().size() == alertCount + 1); // siren deactivation was recorded
        assert(simulationLogger.listHistory().size() == 11); // low battery is also logged
        bool invalidManualRejected = false;
        manual.rainfallRate = 301.0;
        try { simulation.runManual(manual); }
        catch (const std::invalid_argument&) { invalidManualRejected = true; }
        assert(invalidManualRejected);
    }
    {
        // A new process/session with the same seed must avoid overwriting old incident IDs.
        IncidentLogger persistedLogger(simulationFile);
        SimulationConfig restartedConfig;
        restartedConfig.randomSeed = 8675309;
        SimulationEngine restarted(persistedLogger, restartedConfig);
        const auto restartedRun = restarted.runScenario(SimulationScenario::CombinedThreat);
        assert(restartedRun.front().incidentId == "SIM-000001-UK-UTT-01-1");
    }
    std::filesystem::remove(simulationFile);

    assert(SimulationEngine::classifyRisk(24.99) == RiskClass::Low);
    assert(SimulationEngine::classifyRisk(25.0) == RiskClass::Moderate);
    assert(SimulationEngine::classifyRisk(50.0) == RiskClass::High);
    assert(SimulationEngine::classifyRisk(75.0) == RiskClass::Critical);
    assert(SimulationEngine::calculateOverallRisk(90.0, 10.0) == 90.0);

    const auto scenarioFile = std::filesystem::temp_directory_path() / "alf_ewg_scenario_test.bin";
    std::filesystem::remove(scenarioFile);
    {
        IncidentLogger scenarioLogger(scenarioFile);
        SimulationConfig scenarioConfig;
        scenarioConfig.randomSeed = 12345;
        scenarioConfig.sensorNoiseFraction = 0.0;
        SimulationEngine scenarios(scenarioLogger, scenarioConfig);
        const double normalRain = scenarios.runScenario(SimulationScenario::Normal)[0].telemetry.rainfallRate;
        const auto heavy = scenarios.runScenario(SimulationScenario::HeavyRainfall);
        assert(heavy[0].telemetry.rainfallRate >= scenarioConfig.heavyRainfallMinMmPerHour);
        const auto wet = scenarios.runScenario(SimulationScenario::IncreasingSoilSaturation);
        assert(wet[0].telemetry.soilSaturation > 0.35);
        const auto seismic = scenarios.runScenario(SimulationScenario::AbnormalSeismicVibrations);
        assert(seismic[0].telemetry.vibrationFrequency >= scenarioConfig.abnormalVibrationMinHz);
        const auto river = scenarios.runScenario(SimulationScenario::RapidRiverRise);
        assert(river[0].telemetry.riverLevel > 1.1);
        const auto resetNormal = scenarios.runScenario(SimulationScenario::Normal);
        assert(resetNormal[0].telemetry.rainfallRate == normalRain);
    }
    std::filesystem::remove(scenarioFile);

    const auto reproducibilityFile1 = std::filesystem::temp_directory_path() / "alf_ewg_seed_a.bin";
    const auto reproducibilityFile2 = std::filesystem::temp_directory_path() / "alf_ewg_seed_b.bin";
    std::filesystem::remove(reproducibilityFile1);
    std::filesystem::remove(reproducibilityFile2);

    const auto alertLevelFile = std::filesystem::temp_directory_path() / "alf_ewg_alert_level_test.bin";
    std::filesystem::remove(alertLevelFile);
    {
        IncidentLogger alertLogger(alertLevelFile);
        SimulationEngine alertSimulation(alertLogger);
        StationTelemetry reading = alertSimulation.stations().front();
        reading.soilSaturation = 0.4;
        reading.rainfallRate = 40.0;
        reading.vibrationFrequency = 10.0;
        reading.tiltAngle = 10.0;
        reading.riverLevel = 4.0;
        const auto high = alertSimulation.runManual(reading);
        assert(high.classification == RiskClass::High && high.sirenActive);
        reading.riverLevel = 6.0;
        const auto critical = alertSimulation.runManual(reading);
        assert(critical.classification == RiskClass::Critical);
        assert(alertSimulation.alertHistory().size() == 2); // activation, then a level change
        alertSimulation.runManual(reading);
        assert(alertSimulation.alertHistory().size() == 2); // unchanged critical state is deduplicated
    }
    std::filesystem::remove(alertLevelFile);
    {
        IncidentLogger loggerA(reproducibilityFile1), loggerB(reproducibilityFile2);
        SimulationConfig reproducibleConfig;
        reproducibleConfig.randomSeed = 314159;
        SimulationEngine engineA(loggerA, reproducibleConfig), engineB(loggerB, reproducibleConfig);
        const auto runA = engineA.runScenario(SimulationScenario::HeavyRainfall);
        const auto runB = engineB.runScenario(SimulationScenario::HeavyRainfall);
        assert(runA.size() == runB.size());
        for (std::size_t i = 0; i < runA.size(); ++i) {
            assert(runA[i].telemetry.rainfallRate == runB[i].telemetry.rainfallRate);
            assert(runA[i].telemetry.soilSaturation == runB[i].telemetry.soilSaturation);
        }
    }
    std::filesystem::remove(reproducibilityFile1);
    std::filesystem::remove(reproducibilityFile2);
    IncidentLogger logger(incidentFile);
    IncidentRecord incident{"INC-1", "2026-11-26T12:00:00Z", "ST-4", "North Ridge",
                            "landslide", 0.7, 0.2, 0.6, true, "Route A"};
    logger.save(incident);
    assert(logger.listHistory().size() == 1);
    assert(logger.searchById("INC-1")->region == "North Ridge");
    IncidentRecord updated = incident;
    updated.region = "East Ridge";
    bool injectedFailure = false;
    try {
        logger.updateById("INC-1", updated, [] { throw std::runtime_error("forced validation failure"); });
    } catch (const std::runtime_error&) { injectedFailure = true; }
    assert(injectedFailure);
    assert(logger.searchById("INC-1")->region == "North Ridge"); // failed update rolled back
    logger.updateById("INC-1", updated);
    assert(logger.searchById("INC-1")->region == "East Ridge");
    caught = false;
    try {
        IncidentRecord invalid = updated;
        invalid.overallRisk = 1.5;
        logger.updateById("INC-1", invalid);
    } catch (const ThresholdOverflowException&) { caught = true; }
    assert(caught);
    assert(logger.searchById("INC-1")->region == "East Ridge");

    std::vector<EvacuationRoute> routes{{"Route C", 1}, {"Route B", 3}, {"Route A", 3}};
    sortEvacuationRoutes(routes);
    assert(routes[0].name == "Route A" && routes[1].name == "Route B" && routes[2].name == "Route C");
    std::ostringstream alertOutput;
    alertOutput << emergencyAlertHeader;
    assert(alertOutput.str().find("INCIDENT\tREGION\tTYPE") == 0);
    PriorityQueue<int> priorities;
    priorities.push(3); priorities.push(9); priorities.push(5);
    assert(priorities.top() == 9);
    priorities.pop();
    assert(priorities.top() == 5);
    std::filesystem::remove(incidentFile);

    // CIC-211 Unit III: virtual diamond, runtime polymorphism, and composition.
    using namespace DisasterCore::Core;
    static_assert(std::is_abstract<BaseSensorNode>::value, "sensor base must be abstract");
    AutonomousHybridProbe hybrid("hybrid");
    DisasterTelemetryDevice* throughSolar = static_cast<SolarPoweredNode*>(&hybrid);
    DisasterTelemetryDevice* throughRadio = static_cast<WirelessLoRaTransceiver*>(&hybrid);
    assert(throughSolar == throughRadio); // virtual inheritance gives one shared root
    assert(static_cast<void*>(static_cast<BaseSensorNode*>(&hybrid)) ==
           static_cast<void*>(throughSolar));
    assert(hybrid.powerSubsystem().batteryCapacity() == 100.0); // HAS-A

    int destroyed = 0;
    struct TrackedRainGauge : RainGaugeNode {
        int* destroyed;
        explicit TrackedRainGauge(int* count) : destroyed(count) {}
        ~TrackedRainGauge() override { ++*destroyed; }
    };
    std::vector<std::unique_ptr<BaseSensorNode>> owned;
    owned.push_back(std::make_unique<AutonomousHybridProbe>());
    owned.push_back(std::make_unique<TrackedRainGauge>(&destroyed));
    std::vector<BaseSensorNode*> sweep;
    for (const auto& node : owned) sweep.push_back(node.get());
    executeSensorSweep(sweep);
    auto* sweptHybrid = dynamic_cast<AutonomousHybridProbe*>(owned[0].get());
    auto* sweptRain = dynamic_cast<RainGaugeNode*>(owned[1].get());
    assert(sweptHybrid && sweptHybrid->measurement() == 42.0 && sweptHybrid->thresholdExceeded());
    assert(sweptRain && sweptRain->measurement() == 12.5 && sweptRain->thresholdExceeded());
    owned.clear();
    assert(destroyed == 1); // deleting via BaseSensorNode invokes the concrete destructor

    PowerSubsystem power(50.0, 10.0, 5.0, 2.0, 0.8);
    power.chargeFromSolar(2.0);
    assert(power.currentCharge() == 18.0);
    power.consume(power.powerConsumption());
    assert(power.currentCharge() == 16.0);

    // Soil saturation tests
    assert(std::abs(DisasterCore::Sensors::soilSaturation(0.3, 0.5) - 0.6) < 1e-9);
    assert(DisasterCore::Sensors::soilSaturation(0.0, 1.0) == 0.0);
    // Rainfall severity tests
    assert(DisasterCore::Sensors::rainfallSeverity(0.0) == 0.0);
    double rsev = DisasterCore::Sensors::rainfallSeverity(10.0);
    assert(rsev > 0.5 && rsev < 1.0);
    // Vibration severity tests
    assert(DisasterCore::Sensors::vibrationSeverity(0.0) == 0.0);
    // Flood severity tests
    assert(DisasterCore::Sensors::floodSeverity(0.0) == 0.0);
    // Combined hazard test
    double ch = DisasterCore::Sensors::combinedHazard(rsev, 0.6, 1.0, 0.5);
    assert(ch >= 0.0 && ch <= 1.0);

    // Hazard index overload 1
    double idx1 = DisasterCore::Sensors::computeHazardIndex(20.0, 30.0);
    assert(idx1 >= 0.0 && idx1 <= 1.0);
    // Hazard index overload 2
    double idx2 = DisasterCore::Sensors::computeHazardIndex(0.8, 5.0, 15.0);
    assert(idx2 >= 0.0 && idx2 <= 1.0);

    // Telemetry reference update test
    DisasterCore::Core::Telemetry tel;
    double external = 0.0;
    tel.updateMeasurement(external, 42.0);
    assert(external == 42.0);
    assert(tel.current() == 42.0);
    // Reference return test
    double& ref = tel.current();
    ref = 100.0;
    assert(tel.current() == 100.0);

    // Friend auditor test
    DisasterCore::Core::TelemetryAuditor auditor;
    double raw = auditor.inspectRaw(tel);
    assert(raw == 100.0);
    const auto& hist = auditor.inspectHistory(tel);
    assert(!hist.empty());

    // Coordinate transformation test
    double x, y;
    DisasterCore::Core::transformCoordinates(45.0, 90.0, x, y);
    assert(x != 0.0 && y != 0.0);

    // Regional risk accumulation test
    std::vector<double> hazards = {0.2, 0.4, 0.6};
    double risk = DisasterCore::Core::accumulateRegionalRisk(hazards);
    assert(std::abs(risk - 0.4) < 1e-9);

    std::cout << "All unit tests passed.\n";
    return 0;
}
