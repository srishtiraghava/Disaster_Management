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

int main() {
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
