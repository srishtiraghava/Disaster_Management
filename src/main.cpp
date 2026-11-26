#include "../include/core/Exceptions.hpp"
#include "../include/core/IncidentLogger.hpp"
#include "../include/core/Simulation.hpp"

#include <iomanip>
#include <iostream>

namespace {
using namespace DisasterCore::Core;

void printResults(const std::vector<SimulationResult>& results, const char* label) {
    std::cout << "\nSIMULATED READINGS — " << label << "\n";
    std::cout << emergencyAlertHeader;
    for (const auto& result : results) {
        std::cout << result.telemetry.stationId << '\t' << result.telemetry.region << '\t'
                  << SimulationEngine::riskClassName(result.classification) << '\t'
                  << std::fixed << std::setprecision(1) << result.overallRisk << '\t'
                  << (result.sirenActive ? "ACTIVE" : "inactive") << '\n';
        std::cout << "  landslide=" << result.landslideRisk << "/100, flood=" << result.floodRisk
                  << "/100, soil=" << result.telemetry.soilSaturation
                  << ", rain=" << result.telemetry.rainfallRate << " mm/h, river="
                  << result.telemetry.riverLevel << " m, battery=" << result.telemetry.batteryLevel
                  << "%, connection=" << (result.telemetry.connected ? "connected" : "offline")
                  << " (simulated)\n";
        if (result.sirenActive)
            std::cout << "  SIMULATED regional siren active for " << result.telemetry.region << "\n";
        if (!result.recommendedRoutes.empty()) {
            const auto& route = result.recommendedRoutes.front();
            std::cout << "  SIMULATED safer route: " << route.routeId << " -> " << route.destination
                      << " (" << route.distanceKm << " km, "
                      << SimulationEngine::roadConditionName(route.roadCondition) << ")\n";
        } else {
            std::cout << "  No safe available route in the simulation.\n";
        }
        if (!result.incidentId.empty()) std::cout << "  Incident logged: " << result.incidentId << "\n";
    }
    std::cout << "\n";
}

void printAlertHistory(const std::vector<DisasterCore::Core::AlertEvent>& history) {
    if (history.empty()) return;
    std::cout << "SIMULATED ALERT HISTORY\n";
    for (const auto& event : history) {
        std::cout << "  cycle " << event.cycle << ", " << event.region << ", "
                  << (event.activated ? "ACTIVE" : "CLEARED") << ", "
                  << DisasterCore::Core::SimulationEngine::riskClassName(event.level)
                  << ": " << event.description << '\n';
    }
}

bool readNumber(const char* prompt, double& value) {
    std::cout << prompt;
    return static_cast<bool>(std::cin >> value);
}
} // namespace

int main() {
    using namespace DisasterCore::Core;
    try {
        IncidentLogger incidentLogger("alf_ewg_incidents.bin");
        SimulationConfig config;
        config.randomSeed = 211; // reproducible baseline seed; edit SimulationConfig to customize
        SimulationEngine simulation(incidentLogger, config);

        std::cout << "ALF-EWG disaster management simulator (all outputs are simulated)\n"
                  << "Seed: " << config.randomSeed << "\n"
                  << "1 Normal  2 Heavy rainfall  3 Rising soil saturation\n"
                  << "4 Seismic vibrations  5 Rapid river rise  6 Combined threat\n"
                  << "7 Manual telemetry\nSelect mode: ";
        int choice = 0;
        if (!(std::cin >> choice)) return 0;
        if (choice >= 1 && choice <= 6) {
            const auto scenario = static_cast<SimulationScenario>(choice - 1);
            printResults(simulation.runScenario(scenario), SimulationEngine::scenarioName(scenario));
            printAlertHistory(simulation.alertHistory());
        } else if (choice == 7) {
            std::cout << "Configured stations:\n";
            for (std::size_t index = 0; index < simulation.stations().size(); ++index)
                std::cout << index + 1 << ". " << simulation.stations()[index].stationId
                          << " — " << simulation.stations()[index].region << '\n';
            std::cout << "Select station: ";
            std::size_t stationIndex = 0;
            if (!(std::cin >> stationIndex) || stationIndex == 0 || stationIndex > simulation.stations().size()) {
                std::cerr << "Invalid station selection.\n";
                return 2;
            }
            StationTelemetry reading = simulation.stations()[stationIndex - 1];
            std::cout << "Enter soil saturation [0-1], rainfall mm/h [0-300], vibration Hz [0-100], "
                         "tilt degrees [0-90], river metres [0-20], battery percent [0-100].\n";
            if (!readNumber("Soil saturation: ", reading.soilSaturation) ||
                !readNumber("Rainfall: ", reading.rainfallRate) ||
                !readNumber("Vibration frequency: ", reading.vibrationFrequency) ||
                !readNumber("Tilt angle: ", reading.tiltAngle) ||
                !readNumber("River level: ", reading.riverLevel) ||
                !readNumber("Battery level: ", reading.batteryLevel)) {
                std::cerr << "Invalid numeric input.\n";
                return 2;
            }
            int connectionStatus = 1;
            std::cout << "Connection status (1 connected, 0 disconnected): ";
            if (!(std::cin >> connectionStatus) || (connectionStatus != 0 && connectionStatus != 1)) {
                std::cerr << "Connection status must be 0 or 1.\n";
                return 2;
            }
            reading.connected = connectionStatus == 1;
            std::vector<SimulationResult> result{simulation.runManual(reading)};
            printResults(result, "Manual telemetry");
            printAlertHistory(simulation.alertHistory());
        } else {
            std::cerr << "Select a mode from 1 to 7.\n";
            return 2;
        }
        std::cout << "Regional siren state transitions this session: " << simulation.alertHistory().size() << '\n';
        return 0;
    } catch (const SensorFailureException& error) {
        std::cerr << "Persistence or sensor failure: " << error.what() << '\n';
    } catch (const TelemetryChecksumMismatch& error) {
        std::cerr << "Telemetry integrity failure: " << error.what() << '\n';
    } catch (const ThresholdOverflowException& error) {
        std::cerr << "Risk calculation failure: " << error.what() << '\n';
    } catch (const std::exception& error) {
        std::cerr << "Simulation stopped: " << error.what() << '\n';
    }
    return 1;
}
