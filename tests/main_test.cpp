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
