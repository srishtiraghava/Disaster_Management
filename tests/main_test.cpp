#include "../include/alerts/AlertTypes.hpp"
#include "../include/core/EarlyWarningSiren.hpp"
#include "../include/core/Exceptions.hpp"
#include "../include/core/IncidentLogger.hpp"
#include "../include/core/RegionalHazard.hpp"
#include "../include/core/SensorCluster.hpp"
#include "../include/core/SensorNode.hpp"
#include "../include/core/SensorStation.hpp"
#include "../include/core/Simulation.hpp"
#include "../include/core/Telemetry.hpp"
#include "../include/core/TelemetryBuffer.hpp"
#include "../include/sensors/Hazard.hpp"
#include "../include/sensors/HazardIndex.hpp"
#include "../include/ui/Dashboard.hpp"

#include <cmath>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <limits>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <vector>

namespace {

using namespace DisasterCore::Core;
using namespace DisasterCore::Sensors;
using namespace DisasterCore::Alerts;
using namespace DisasterCore::UI;

void check(bool condition, const char* expr, int line) {
    if (!condition) {
        std::ostringstream oss;
        oss << "Test assertion failed at line " << line << ": " << expr;
        throw std::runtime_error(oss.str());
    }
}

#define CHECK(expr) check(static_cast<bool>(expr), #expr, __LINE__)

std::filesystem::path tempFile(const std::string& name) {
    return std::filesystem::temp_directory_path() / name;
}

void testHazardCalculations() {
    CHECK(std::abs(soilSaturation(0.3, 0.5) - 0.6) < 1e-9);
    CHECK(soilSaturation(0.0, 1.0) == 0.0);
    CHECK(soilSaturation(1.5, 1.0) == 1.0);

    CHECK(rainfallSeverity(0.0) == 0.0);
    const double rsev = rainfallSeverity(10.0);
    CHECK(rsev > 0.6 && rsev < 0.65);

    CHECK(vibrationSeverity(0.0) == 0.0);
    CHECK(std::abs(vibrationSeverity(10.0) - std::log1p(10.0)) < 1e-9);

    CHECK(floodSeverity(0.0) == 0.0);
    CHECK(std::abs(floodSeverity(5.0) - std::tanh(1.0)) < 1e-9);

    const double ch = combinedHazard(rsev, 0.6, 1.0, 0.5);
    CHECK(ch >= 0.0 && ch <= 1.0);

    double x = 0.0, y = 0.0;
    transformCoordinates(45.0, 90.0, x, y);
    CHECK(x != 0.0 && y != 0.0);

    const std::vector<double> hazards = {0.2, 0.4, 0.6};
    CHECK(std::abs(accumulateRegionalRisk(hazards) - 0.4) < 1e-9);
    CHECK(accumulateRegionalRisk({}) == 0.0);

    StationTelemetry lowReading{"ST-1", "Uttarkashi", 30.7, 78.4, 0.0, 0.0, 0.0, 0.0, 0.0, 100.0, true};
    CHECK(SimulationEngine::calculateLandslideRisk(lowReading) == 0.0);
    CHECK(SimulationEngine::calculateFloodRisk(lowReading) == 0.0);

    StationTelemetry extreme{"ST-1", "Uttarkashi", 30.7, 78.4, 1.0, 200.0, 50.0, 45.0, 15.0, 100.0, true};
    CHECK(SimulationEngine::calculateLandslideRisk(extreme) > 95.0);
    CHECK(SimulationEngine::calculateFloodRisk(extreme) > 95.0);
    CHECK(SimulationEngine::calculateOverallRisk(90.0, 10.0) == 90.0);
    CHECK(SimulationEngine::calculateOverallRisk(15.0, 82.5) == 82.5);

    // Scenario progressions & deterministic reproducibility
    const auto scenarioFile = tempFile("alf_ewg_test_scenarios.bin");
    std::filesystem::remove(scenarioFile);
    {
        IncidentLogger scenarioLogger(scenarioFile);
        SimulationConfig scenarioConfig;
        scenarioConfig.randomSeed = 12345;
        scenarioConfig.sensorNoiseFraction = 0.0;
        SimulationEngine scenarios(scenarioLogger, scenarioConfig);

        const double normalRain = scenarios.runScenario(SimulationScenario::Normal)[0].telemetry.rainfallRate;
        const auto heavy = scenarios.runScenario(SimulationScenario::HeavyRainfall);
        CHECK(heavy[0].telemetry.rainfallRate >= scenarioConfig.heavyRainfallMinMmPerHour);
        const auto wet = scenarios.runScenario(SimulationScenario::IncreasingSoilSaturation);
        CHECK(wet[0].telemetry.soilSaturation > 0.35);
        const auto seismic = scenarios.runScenario(SimulationScenario::AbnormalSeismicVibrations);
        CHECK(seismic[0].telemetry.vibrationFrequency >= scenarioConfig.abnormalVibrationMinHz);
        const auto river = scenarios.runScenario(SimulationScenario::RapidRiverRise);
        CHECK(river[0].telemetry.riverLevel > 1.1);
        const auto resetNormal = scenarios.runScenario(SimulationScenario::Normal);
        CHECK(resetNormal[0].telemetry.rainfallRate == normalRain);
    }
    std::filesystem::remove(scenarioFile);

    const auto fileA = tempFile("alf_ewg_test_seed_a.bin");
    const auto fileB = tempFile("alf_ewg_test_seed_b.bin");
    std::filesystem::remove(fileA);
    std::filesystem::remove(fileB);
    {
        IncidentLogger loggerA(fileA), loggerB(fileB);
        SimulationConfig cfg;
        cfg.randomSeed = 314159;
        SimulationEngine engineA(loggerA, cfg), engineB(loggerB, cfg);
        const auto runA = engineA.runScenario(SimulationScenario::HeavyRainfall);
        const auto runB = engineB.runScenario(SimulationScenario::HeavyRainfall);
        CHECK(runA.size() == runB.size());
        for (std::size_t i = 0; i < runA.size(); ++i) {
            CHECK(runA[i].telemetry.rainfallRate == runB[i].telemetry.rainfallRate);
            CHECK(runA[i].telemetry.soilSaturation == runB[i].telemetry.soilSaturation);
        }
    }
    std::filesystem::remove(fileA);
    std::filesystem::remove(fileB);
}

void testRiskClassifications() {
    CHECK(SimulationEngine::classifyRisk(0.0) == RiskClass::Low);
    CHECK(SimulationEngine::classifyRisk(24.99) == RiskClass::Low);
    CHECK(SimulationEngine::classifyRisk(25.0) == RiskClass::Moderate);
    CHECK(SimulationEngine::classifyRisk(49.99) == RiskClass::Moderate);
    CHECK(SimulationEngine::classifyRisk(50.0) == RiskClass::High);
    CHECK(SimulationEngine::classifyRisk(74.99) == RiskClass::High);
    CHECK(SimulationEngine::classifyRisk(75.0) == RiskClass::Critical);
    CHECK(SimulationEngine::classifyRisk(100.0) == RiskClass::Critical);

    CHECK(std::string(SimulationEngine::riskClassName(RiskClass::Low)) == "LOW");
    CHECK(std::string(SimulationEngine::riskClassName(RiskClass::Moderate)) == "MODERATE");
    CHECK(std::string(SimulationEngine::riskClassName(RiskClass::High)) == "HIGH");
    CHECK(std::string(SimulationEngine::riskClassName(RiskClass::Critical)) == "CRITICAL");

    CHECK(fromOverallRisk(10.0) == Level::Info);
    CHECK(fromOverallRisk(55.0) == Level::Warning);
    CHECK(fromOverallRisk(80.0) == Level::Critical);
    CHECK(std::string(levelName(Level::Critical)) == "CRITICAL");

    bool threwLow = false, threwHigh = false, threwNan = false;
    try { SimulationEngine::classifyRisk(-0.01); } catch (const ThresholdOverflowException&) { threwLow = true; }
    try { SimulationEngine::classifyRisk(100.01); } catch (const ThresholdOverflowException&) { threwHigh = true; }
    try { SimulationEngine::classifyRisk(std::numeric_limits<double>::quiet_NaN()); }
    catch (const ThresholdOverflowException&) { threwNan = true; }
    CHECK(threwLow && threwHigh && threwNan);
}

void testFunctionOverloading() {
    const double idx1 = computeHazardIndex(20.0, 30.0);
    const double expected1 = rainfallSeverity(20.0) * std::sin(30.0 * DisasterCore::Sensors::kPi / 180.0);
    CHECK(std::abs(idx1 - expected1) < 1e-9);

    const double idx2 = computeHazardIndex(0.8, 5.0, 15.0);
    const double expected2 = std::clamp(0.8 * vibrationSeverity(5.0) * std::cos(15.0 * DisasterCore::Sensors::kPi / 180.0), 0.0, 1.0);
    CHECK(std::abs(idx2 - expected2) < 1e-9);

    bool invalid1 = false, invalid2 = false;
    try { (void)computeHazardIndex(-1.0, 30.0); } catch (const std::invalid_argument&) { invalid1 = true; }
    try { (void)computeHazardIndex(1.2, 5.0, 15.0); } catch (const std::invalid_argument&) { invalid2 = true; }
    CHECK(invalid1 && invalid2);
}

void testDeepCopying() {
    TelemetryBuffer buf(2);
    CHECK(buf.size() == 0 && buf.capacity() == 2);
    buf.push_back(10.5);
    buf.push_back(20.5);
    buf.push_back(30.5); // triggers growth
    CHECK(buf.size() == 3 && buf.capacity() >= 4);
    CHECK(buf[0] == 10.5 && buf[1] == 20.5 && buf[2] == 30.5);

    // Copy constructor creates independent deep copy
    TelemetryBuffer copyCtor(buf);
    copyCtor[1] = 999.0;
    CHECK(buf[1] == 20.5);
    CHECK(copyCtor[1] == 999.0);

    // Copy assignment creates independent deep copy and survives self-assignment
    TelemetryBuffer assigned;
    assigned = buf;
    assigned[0] = -42.0;
    CHECK(buf[0] == 10.5);
    CHECK(assigned[0] == -42.0);
    TelemetryBuffer& selfRef = assigned;
    assigned = selfRef;
    CHECK(assigned.size() == 3 && assigned[0] == -42.0);

    // Move constructor and move assignment transfer ownership cleanly
    TelemetryBuffer movedCtor(std::move(copyCtor));
    CHECK(movedCtor.size() == 3 && movedCtor[1] == 999.0);
    CHECK(copyCtor.size() == 0 && copyCtor.capacity() == 0);

    TelemetryBuffer movedAssign;
    movedAssign = std::move(assigned);
    CHECK(movedAssign.size() == 3 && movedAssign[0] == -42.0);
    CHECK(assigned.size() == 0 && assigned.capacity() == 0);

    bool outOfBounds = false;
    try { (void)buf[99]; } catch (const std::out_of_range&) { outOfBounds = true; }
    CHECK(outOfBounds);
}

void testOperatorOverloading() {
    // RegionalHazard operator> and operator<<
    RegionalHazard lowH(0.25), highH(0.85);
    CHECK(highH > lowH);
    CHECK(!(lowH > highH));
    std::ostringstream rhStream;
    rhStream << highH;
    CHECK(rhStream.str().find("0.85") != std::string::npos);

    // SensorStation operator<< and operator>>
    SensorStation st("ST-10", 30.5, 78.9);
    std::ostringstream stOut;
    stOut << st;
    CHECK(stOut.str().find("Station[ST-10]") != std::string::npos);

    SensorStation extracted("INIT", 0.0, 0.0);
    std::istringstream validIn("ST-99 29.75 80.25");
    validIn >> extracted;
    CHECK(static_cast<bool>(validIn));
    CHECK(extracted.id() == "ST-99" && extracted.latitude() == 29.75 && extracted.longitude() == 80.25);

    std::istringstream invalidIn("BAD 95.0 80.0");
    invalidIn >> extracted;
    CHECK(!validIn.fail() && invalidIn.fail());

    // SensorCluster operator+ and operator<<
    SensorCluster c1, c2;
    c1.add(st);
    c2.add(extracted);
    SensorCluster combined = c1 + c2;
    CHECK(combined.size() == 2);
    std::ostringstream clOut;
    clOut << combined;
    CHECK(clOut.str().find("SensorCluster with 2 stations") != std::string::npos);

    // TelemetryBuffer operator[]
    TelemetryBuffer tb(2);
    tb.push_back(7.25);
    tb[0] = 8.5;
    const TelemetryBuffer& constTb = tb;
    CHECK(constTb[0] == 8.5);

    // EvacuationPriority functor operator()
    EvacuationPriority cmp;
    CHECK(cmp(EvacuationRoute{"Route B", 5}, EvacuationRoute{"Route A", 2}));
    CHECK(cmp(EvacuationRoute{"Route A", 3}, EvacuationRoute{"Route B", 3}));
}

void testStaticMembers() {
    const unsigned int beforeCount = SensorStation::activeCount();
    {
        SensorStation s1("STAT-1", 30.0, 78.0);
        SensorStation s2("STAT-2", 31.0, 79.0);
        CHECK(SensorStation::activeCount() == beforeCount + 2);
    }
    bool badStation = false;
    try { SensorStation bad("BAD", 91.0, 78.0); } catch (const std::invalid_argument&) { badStation = true; }
    CHECK(badStation);
    CHECK(SensorStation::activeCount() == beforeCount + 2);

    const unsigned int baseAlert = EarlyWarningSiren::globalAlertLevel();
    EarlyWarningSiren sA("SIREN-A", 30.0, 78.0);
    EarlyWarningSiren sB("SIREN-B", 30.5, 79.0);
    sA.activate();
    sA.activate(); // idempotent when already active
    CHECK(EarlyWarningSiren::globalAlertLevel() == baseAlert + 1);
    sB.activate();
    CHECK(EarlyWarningSiren::globalAlertLevel() == baseAlert + 2);
    sA.deactivate();
    sA.deactivate(); // idempotent when already inactive
    CHECK(EarlyWarningSiren::globalAlertLevel() == baseAlert + 1);
    sB.deactivate();
    CHECK(EarlyWarningSiren::globalAlertLevel() == baseAlert);
}

void testVirtualInheritance() {
    AutonomousHybridProbe hybrid("hybrid-01");
    DisasterTelemetryDevice* throughSolar = static_cast<SolarPoweredNode*>(&hybrid);
    DisasterTelemetryDevice* throughRadio = static_cast<WirelessLoRaTransceiver*>(&hybrid);
    CHECK(throughSolar == throughRadio);
    CHECK(static_cast<void*>(static_cast<BaseSensorNode*>(&hybrid)) == static_cast<void*>(throughSolar));
    CHECK(hybrid.id() == "hybrid-01");
    hybrid.readTelemetry();
    hybrid.evaluateThreshold();
    CHECK(throughSolar->measurement() == 42.0);
    CHECK(throughRadio->thresholdExceeded());
}

void testRuntimePolymorphism() {
    static_assert(std::is_abstract<BaseSensorNode>::value, "sensor base must be abstract");
    int destroyed = 0;
    struct TrackedRainGauge : RainGaugeNode {
        int* destroyedCount;
        explicit TrackedRainGauge(int* count) : destroyedCount(count) {}
        ~TrackedRainGauge() override { ++*destroyedCount; }
    };

    std::vector<std::unique_ptr<BaseSensorNode>> owned;
    owned.push_back(std::make_unique<AutonomousHybridProbe>("poly-hybrid"));
    owned.push_back(std::make_unique<TrackedRainGauge>(&destroyed));

    std::vector<BaseSensorNode*> sweep;
    for (const auto& node : owned) sweep.push_back(node.get());
    executeSensorSweep(sweep);

    auto* sweptHybrid = dynamic_cast<AutonomousHybridProbe*>(owned[0].get());
    auto* sweptRain = dynamic_cast<RainGaugeNode*>(owned[1].get());
    CHECK(sweptHybrid && sweptHybrid->measurement() == 42.0 && sweptHybrid->thresholdExceeded());
    CHECK(sweptRain && sweptRain->measurement() == 12.5 && sweptRain->thresholdExceeded());

    owned.clear();
    CHECK(destroyed == 1);

    bool nullRejected = false;
    std::vector<BaseSensorNode*> badSweep = {nullptr};
    try { executeSensorSweep(badSweep); } catch (const std::invalid_argument&) { nullRejected = true; }
    CHECK(nullRejected);
}

void testContainership() {
    // BaseSensorNode HAS-A PowerSubsystem
    AutonomousHybridProbe hybrid("comp-probe", PowerSubsystem(50.0, 10.0, 5.0, 2.0, 0.8));
    CHECK(hybrid.powerSubsystem().batteryCapacity() == 50.0);
    hybrid.powerSubsystem().chargeFromSolar(2.0); // 10 + 2*5*0.8 = 18
    CHECK(hybrid.powerSubsystem().currentCharge() == 18.0);
    hybrid.powerSubsystem().consume(hybrid.powerSubsystem().powerConsumption());
    CHECK(hybrid.powerSubsystem().currentCharge() == 16.0);

    // SensorCluster HAS-A collection of SensorStation objects by value
    SensorCluster cluster({SensorStation("C1", 30.1, 78.1), SensorStation("C2", 30.2, 78.2)});
    CHECK(cluster.size() == 2);
    CHECK(cluster.stations()[0].id() == "C1");
    CHECK(cluster.stations()[1].id() == "C2");
}

void testExceptionHandling() {
    bool caught = false;
    try { throw SensorFailureException(); }
    catch (const std::exception& error) { caught = std::string(error.what()).find("sensor") != std::string::npos; }
    CHECK(caught);

    caught = false;
    try { verifyTelemetryChecksum(10, 11); }
    catch (const TelemetryChecksumMismatch& error) { caught = std::string(error.what()).find("checksum") != std::string::npos; }
    CHECK(caught);

    verifyTelemetryChecksum(42, 42); // valid checksum does not throw

    caught = false;
    try { throw ThresholdOverflowException(); }
    catch (const ThresholdOverflowException& error) { caught = std::string(error.what()).find("threshold") != std::string::npos; }
    CHECK(caught);

    // Call-by-reference, return-by-reference, and friend TelemetryAuditor
    Telemetry tel;
    double external = 0.0;
    tel.updateMeasurement(external, 42.0);
    CHECK(external == 42.0 && tel.current() == 42.0);
    double& ref = tel.current();
    ref = 100.0;
    CHECK(tel.current() == 100.0);

    TelemetryAuditor auditor;
    CHECK(auditor.inspectRaw(tel) == 100.0);
    CHECK(!auditor.inspectHistory(tel).empty());

    // PriorityQueue empty exceptions
    PriorityQueue<int> pq;
    bool topEmpty = false, popEmpty = false;
    try { (void)pq.top(); } catch (const std::out_of_range&) { topEmpty = true; }
    try { pq.pop(); } catch (const std::out_of_range&) { popEmpty = true; }
    CHECK(topEmpty && popEmpty);

    // Invalid configuration & power bounds
    bool badPower = false, badConfig = false, badSiren = false;
    try { PowerSubsystem(50.0, 60.0); } catch (const std::invalid_argument&) { badPower = true; }
    try {
        IncidentLogger tmp(tempFile("alf_ewg_bad_cfg.bin"));
        SimulationConfig cfg;
        cfg.sensorNoiseFraction = 0.9;
        SimulationEngine eng(tmp, cfg);
    } catch (const std::invalid_argument&) { badConfig = true; }
    try { EarlyWarningSiren("BAD", -95.0, 0.0); } catch (const std::invalid_argument&) { badSiren = true; }
    CHECK(badPower && badConfig && badSiren);
}

void testBinarySerialization() {
    const auto incidentFile = tempFile("alf_ewg_test_binary.bin");
    std::filesystem::remove(incidentFile);
    {
        IncidentLogger logger(incidentFile);
        IncidentRecord rec{"INC-1", "2026-11-26T12:00:00Z", "ST-4", "North Ridge",
                           "landslide", 0.7, 0.2, 0.7, true, "Route A"};
        logger.save(rec);
        CHECK(logger.listHistory().size() == 1);
        const auto found = logger.searchById("INC-1");
        CHECK(found.has_value() && found->region == "North Ridge" && found->sirenActivated);

        // Duplicate ID rejection
        bool dup = false;
        try { logger.save(rec); } catch (const std::invalid_argument&) { dup = true; }
        CHECK(dup);
    }
    // Reload in a brand new IncidentLogger instance (persistence across restarts)
    {
        IncidentLogger reloaded(incidentFile);
        const auto all = reloaded.loadAll();
        CHECK(all.size() == 1 && all[0].incidentId == "INC-1" && all[0].evacuationRoute == "Route A");
        CHECK(!reloaded.searchById("MISSING").has_value());
    }
    std::filesystem::remove(incidentFile);

    // Restart simulation engine sharing the same binary file avoids ID collision
    const auto simFile = tempFile("alf_ewg_test_sim_restart.bin");
    std::filesystem::remove(simFile);
    {
        IncidentLogger logger1(simFile);
        SimulationConfig cfg;
        cfg.randomSeed = 8675309;
        SimulationEngine sim1(logger1, cfg);
        const auto firstRun = sim1.runScenario(SimulationScenario::CombinedThreat);
        CHECK(firstRun.size() == 5 && firstRun[0].incidentId == "SIM-000001-UK-UTT-01");
    }
    {
        IncidentLogger logger2(simFile);
        SimulationConfig cfg;
        cfg.randomSeed = 8675309;
        SimulationEngine sim2(logger2, cfg);
        const auto secondRun = sim2.runScenario(SimulationScenario::CombinedThreat);
        CHECK(secondRun.front().incidentId == "SIM-000001-UK-UTT-01-1");
        CHECK(logger2.listHistory().size() == 10);
    }
    std::filesystem::remove(simFile);

    std::ostringstream alertHeaderOut;
    alertHeaderOut << emergencyAlertHeader;
    CHECK(alertHeaderOut.str().find("INCIDENT\tREGION\tTYPE") == 0);
}

void testSeekpSeekg() {
    const auto file = tempFile("alf_ewg_test_seek.bin");
    std::filesystem::remove(file);
    {
        IncidentLogger logger(file);
        IncidentRecord r1{"REC-1", "T1", "ST-1", "Uttarkashi", "flood", 0.2, 0.6, 0.6, true, "R-1"};
        IncidentRecord r2{"REC-2", "T2", "ST-2", "Chamoli", "landslide", 0.8, 0.1, 0.8, true, "R-2"};
        IncidentRecord r3{"REC-3", "T3", "ST-3", "Rudraprayag", "combined", 0.7, 0.7, 0.7, true, "R-3"};
        logger.save(r1);
        logger.save(r2);
        logger.save(r3);

        const auto sizeBefore = std::filesystem::file_size(file);
        IncidentRecord r2Updated = r2;
        r2Updated.region = "Chamoli-Sector-B";
        r2Updated.evacuationRoute = "R-2-ALT";
        logger.updateById("REC-2", r2Updated); // seeks directly to middle record via seekg/seekp

        const auto sizeAfter = std::filesystem::file_size(file);
        CHECK(sizeBefore == sizeAfter);

        const auto records = logger.loadAll();
        CHECK(records.size() == 3);
        CHECK(records[0].incidentId == "REC-1" && records[0].region == "Uttarkashi");
        CHECK(records[1].incidentId == "REC-2" && records[1].region == "Chamoli-Sector-B" &&
              records[1].evacuationRoute == "R-2-ALT");
        CHECK(records[2].incidentId == "REC-3" && records[2].region == "Rudraprayag");
    }
    // Truncated / misaligned file triggers SensorFailureException via seekg/tellg check
    {
        std::ofstream corrupt(file, std::ios::binary | std::ios::app);
        corrupt.put('\x01');
    }
    {
        IncidentLogger corruptLogger(file);
        bool caughtCorrupt = false;
        try { (void)corruptLogger.loadAll(); }
        catch (const SensorFailureException&) { caughtCorrupt = true; }
        CHECK(caughtCorrupt);
    }
    std::filesystem::remove(file);
}

void testRollback() {
    const auto file = tempFile("alf_ewg_test_rollback.bin");
    std::filesystem::remove(file);
    {
        IncidentLogger logger(file);
        IncidentRecord r1{"RB-1", "T1", "ST-1", "North Ridge", "landslide", 0.7, 0.2, 0.7, true, "Route A"};
        IncidentRecord r2{"RB-2", "T2", "ST-2", "South Ridge", "flood", 0.3, 0.8, 0.8, true, "Route B"};
        logger.save(r1);
        logger.save(r2);

        IncidentRecord modified = r2;
        modified.region = "Corrupted-Region";
        modified.evacuationRoute = "Corrupted-Route";

        bool injectedFailure = false;
        try {
            logger.updateById("RB-2", modified, [] { throw std::runtime_error("forced post-write failure"); });
        } catch (const std::runtime_error&) {
            injectedFailure = true;
        }
        CHECK(injectedFailure);

        const auto restored = logger.searchById("RB-2");
        CHECK(restored.has_value() && restored->region == "South Ridge" && restored->evacuationRoute == "Route B");

        bool invalidUpdate = false;
        try {
            IncidentRecord invalid = modified;
            invalid.overallRisk = 1.5;
            logger.updateById("RB-2", invalid);
        } catch (const ThresholdOverflowException&) {
            invalidUpdate = true;
        }
        CHECK(invalidUpdate);
        CHECK(logger.searchById("RB-2")->region == "South Ridge");
    }
    std::filesystem::remove(file);
}

void testEvacuationPrioritization() {
    std::vector<EvacuationRoute> routes{{"Route C", 1}, {"Route B", 3}, {"Route A", 3}};
    sortEvacuationRoutes(routes);
    CHECK(routes[0].name == "Route A" && routes[1].name == "Route B" && routes[2].name == "Route C");

    PriorityQueue<int> pq;
    pq.push(3);
    pq.push(9);
    pq.push(5);
    CHECK(pq.top() == 9);
    pq.pop();
    CHECK(pq.top() == 5);

    const auto file = tempFile("alf_ewg_test_evac.bin");
    std::filesystem::remove(file);
    {
        IncidentLogger logger(file);
        SimulationEngine sim(logger);
        const auto recRoutes = sim.evaluateRoutesForRegion("Uttarkashi");
        CHECK(recRoutes.size() == 2); // Blocked route R-Uttarkashi-C excluded
        CHECK(recRoutes[0].routeId == "R-Uttarkashi-A"); // Good road beats Slippery
        CHECK(recRoutes[1].routeId == "R-Uttarkashi-B");
        for (const auto& r : recRoutes) {
            CHECK(r.available && r.roadCondition != RoadCondition::Blocked);
            CHECK(std::max(r.landslideRisk, r.floodRisk) < 75.0);
        }
    }
    std::filesystem::remove(file);
}

void testSirenActivation() {
    const auto file = tempFile("alf_ewg_test_sirens.bin");
    std::filesystem::remove(file);
    {
        IncidentLogger logger(file);
        SimulationConfig cfg;
        cfg.randomSeed = 8675309;
        SimulationEngine sim(logger, cfg);

        const auto firstRun = sim.runScenario(SimulationScenario::CombinedThreat);
        CHECK(firstRun.size() == 5);
        CHECK(firstRun[0].classification == RiskClass::Critical && firstRun[0].sirenActive);
        CHECK(EarlyWarningSiren::globalAlertLevel() == 5);
        CHECK(sim.alertHistory().size() == 5);

        // Deduplication on repeated scenario at same classification
        sim.runScenario(SimulationScenario::CombinedThreat);
        CHECK(sim.alertHistory().size() == 5);

        // Deactivation when dropping below 50
        StationTelemetry calm = sim.stations().front();
        calm.soilSaturation = 0.2;
        calm.rainfallRate = 0.0;
        calm.vibrationFrequency = 1.0;
        calm.tiltAngle = 0.0;
        calm.riverLevel = 0.1;
        calm.batteryLevel = 10.0; // low battery logged even when siren clears
        const auto calmResult = sim.runManual(calm);
        CHECK(calmResult.overallRisk < 25.0 && !calmResult.sirenActive);
        CHECK(EarlyWarningSiren::globalAlertLevel() == 4);
        CHECK(sim.alertHistory().size() == 6);
        CHECK(!calmResult.incidentId.empty());

        // Escalation from HIGH to CRITICAL records transition
        StationTelemetry escalate = sim.stations()[1]; // Chamoli already active, set low first
        escalate.soilSaturation = 0.1;
        escalate.rainfallRate = 0.0;
        escalate.vibrationFrequency = 0.0;
        escalate.tiltAngle = 0.0;
        escalate.riverLevel = 0.1;
        sim.runManual(escalate);

        escalate.soilSaturation = 0.4;
        escalate.rainfallRate = 40.0;
        escalate.vibrationFrequency = 10.0;
        escalate.tiltAngle = 10.0;
        escalate.riverLevel = 4.0;
        const auto high = sim.runManual(escalate);
        CHECK(high.classification == RiskClass::High && high.sirenActive);

        escalate.riverLevel = 6.0;
        const auto critical = sim.runManual(escalate);
        CHECK(critical.classification == RiskClass::Critical && critical.sirenActive);
        CHECK(sim.alertHistory().back().level == RiskClass::Critical);
    }
    // Engine destructor must deactivate its regional sirens
    CHECK(EarlyWarningSiren::globalAlertLevel() == 0);
    std::filesystem::remove(file);
}

void testInvalidTelemetryRejection() {
    const auto file = tempFile("alf_ewg_test_invalid_tel.bin");
    std::filesystem::remove(file);
    {
        IncidentLogger logger(file);
        SimulationEngine sim(logger);
        const auto base = sim.stations().front();

        auto expectReject = [&](StationTelemetry bad) {
            const auto prevCycle = sim.cycle();
            bool rejected = false;
            try {
                (void)sim.runManual(bad);
            } catch (const std::invalid_argument&) {
                rejected = true;
            }
            CHECK(rejected);
            CHECK(sim.cycle() == prevCycle);
        };

        auto unknownStation = base;
        unknownStation.stationId = "UNKNOWN-99";
        expectReject(unknownStation);

        auto wrongRegion = base;
        wrongRegion.region = "Chamoli";
        expectReject(wrongRegion);

        auto nanRain = base;
        nanRain.rainfallRate = std::numeric_limits<double>::quiet_NaN();
        expectReject(nanRain);

        auto infRiver = base;
        infRiver.riverLevel = std::numeric_limits<double>::infinity();
        expectReject(infRiver);

        auto badLat = base; badLat.latitude = -91.0; expectReject(badLat);
        auto badLon = base; badLon.longitude = 181.0; expectReject(badLon);
        auto badSoilLow = base; badSoilLow.soilSaturation = -0.01; expectReject(badSoilLow);
        auto badSoilHigh = base; badSoilHigh.soilSaturation = 1.01; expectReject(badSoilHigh);
        auto badRainLow = base; badRainLow.rainfallRate = -1.0; expectReject(badRainLow);
        auto badRainHigh = base; badRainHigh.rainfallRate = 301.0; expectReject(badRainHigh);
        auto badVib = base; badVib.vibrationFrequency = 101.0; expectReject(badVib);
        auto badTilt = base; badTilt.tiltAngle = 91.0; expectReject(badTilt);
        auto badRiver = base; badRiver.riverLevel = 21.0; expectReject(badRiver);
        auto badBat = base; badBat.batteryLevel = 105.0; expectReject(badBat);
    }
    std::filesystem::remove(file);
}

void testDashboardIntegration() {
    const auto file = tempFile("alf_ewg_test_dashboard.bin");
    std::filesystem::remove(file);

    // Session 1: Exercise all 13 menus including invalid input recovery, auto sim, manual sim, and diagnostic
    {
        IncidentLogger logger(file);
        SimulationConfig cfg;
        cfg.randomSeed = 211;
        SimulationEngine sim(logger, cfg);

        std::ostringstream script;
        script << "1\n"                           // 1. Live Monitoring Dashboard
               << "2\n"                           // 2. View Sensor Stations
               << "3\n6\n1\n"                     // 3. Auto Sim -> CombinedThreat -> 1 cycle
               << "4\n1\n0.9\n120\n30\n15\n5.5\n90\n1\n" // 4. Manual input on station 1
               << "5\n"                           // 5. Regional Hazard Analysis
               << "6\n"                           // 6. Active Emergency Alerts
               << "7\n"                           // 7. Siren Status
               << "8\n"                           // 8. Evacuation Recommendations
               << "9\n1\nSIM-000001-UK-UTT-01\n"  // 9. Incident History -> search by ID
               << "10\n"                          // 10. Telemetry Audit
               << "11\n"                          // 11. System Statistics
               << "12\n"                          // 12. Full System Diagnostic
               << "bad_input\n"                   // invalid menu recovery
               << "13\n";                         // 13. Exit

        std::istringstream in(script.str());
        std::ostringstream out;
        ControlRoomDashboard dashboard(sim, in, out, ColorMode::Never);
        CHECK(!dashboard.ansiEnabled());
        CHECK(dashboard.run() == 0);

        const std::string output = out.str();
        CHECK(output.find('\033') == std::string::npos); // clean plain terminal output without ANSI
        CHECK(output.find("LIVE MONITORING DASHBOARD") != std::string::npos);
        CHECK(output.find("VIEW SENSOR STATIONS") != std::string::npos);
        CHECK(output.find("AUTOMATIC SIMULATION") != std::string::npos);
        CHECK(output.find("MANUAL TELEMETRY INPUT") != std::string::npos);
        CHECK(output.find("REGIONAL HAZARD ANALYSIS") != std::string::npos);
        CHECK(output.find("ACTIVE EMERGENCY ALERTS") != std::string::npos);
        CHECK(output.find("SIREN STATUS") != std::string::npos);
        CHECK(output.find("EVACUATION RECOMMENDATIONS") != std::string::npos);
        CHECK(output.find("INCIDENT HISTORY") != std::string::npos);
        CHECK(output.find("TELEMETRY AUDIT") != std::string::npos);
        CHECK(output.find("SYSTEM STATISTICS") != std::string::npos);
        CHECK(output.find("FULL SYSTEM DIAGNOSTIC") != std::string::npos);
        CHECK(output.find("6 / 6 checks passed") != std::string::npos);
        CHECK(output.find("SIM-000001-UK-UTT-01") != std::string::npos);
    }

    // Session 2: Verify persistence across restarts and ANSI color mode
    {
        IncidentLogger restartedLogger(file);
        SimulationEngine restartedSim(restartedLogger);
        std::istringstream in("1\n9\n0\n13\n");
        std::ostringstream out;
        ControlRoomDashboard restartedDashboard(restartedSim, in, out, ColorMode::Always);
        CHECK(restartedDashboard.ansiEnabled());
        CHECK(restartedDashboard.run() == 0);
        const std::string output = out.str();
        CHECK(output.find('\033') != std::string::npos);
        CHECK(output.find("Total persisted incidents: 6") != std::string::npos);
    }

    std::filesystem::remove(file);
}

struct SuiteEntry {
    const char* name;
    void (*fn)();
};

} // namespace

int main(int argc, char* argv[]) {
    const SuiteEntry suites[] = {
        {"HazardCalculations", testHazardCalculations},
        {"RiskClassifications", testRiskClassifications},
        {"FunctionOverloading", testFunctionOverloading},
        {"DeepCopying", testDeepCopying},
        {"OperatorOverloading", testOperatorOverloading},
        {"StaticMembers", testStaticMembers},
        {"VirtualInheritance", testVirtualInheritance},
        {"RuntimePolymorphism", testRuntimePolymorphism},
        {"Containership", testContainership},
        {"ExceptionHandling", testExceptionHandling},
        {"BinarySerialization", testBinarySerialization},
        {"SeekpSeekg", testSeekpSeekg},
        {"Rollback", testRollback},
        {"EvacuationPrioritization", testEvacuationPrioritization},
        {"SirenActivation", testSirenActivation},
        {"InvalidTelemetryRejection", testInvalidTelemetryRejection},
        {"DashboardIntegration", testDashboardIntegration}
    };

    const std::string filter = (argc > 1) ? argv[1] : "";
    bool matched = false;

    try {
        for (const auto& suite : suites) {
            if (!filter.empty() && filter != suite.name) continue;
            matched = true;
            suite.fn();
            std::cout << "[PASS] " << suite.name << "\n";
        }
        if (!matched) {
            std::cerr << "Unknown test suite: " << filter << "\n";
            return 2;
        }
        std::cout << "All selected tests passed.\n";
        return 0;
    } catch (const std::exception& ex) {
        std::cerr << "[FAIL] " << ex.what() << "\n";
        return 1;
    }
}
