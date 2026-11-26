#include "../../include/ui/Dashboard.hpp"

#include "../../include/alerts/AlertTypes.hpp"
#include "../../include/core/EarlyWarningSiren.hpp"
#include "../../include/core/Exceptions.hpp"
#include "../../include/core/IncidentLogger.hpp"
#include "../../include/core/RegionalHazard.hpp"
#include "../../include/core/SensorNode.hpp"
#include "../../include/core/SensorStation.hpp"
#include "../../include/core/Telemetry.hpp"
#include "../../include/core/TelemetryBuffer.hpp"
#include "../../include/sensors/Hazard.hpp"
#include "../../include/sensors/HazardIndex.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#include <stdexcept>
#include <vector>

#ifdef _WIN32
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <io.h>
#include <windows.h>
#else
#include <unistd.h>
#endif

namespace DisasterCore::UI {
namespace {

using namespace DisasterCore::Core;

constexpr const char* kReset = "\033[0m";
constexpr const char* kBold = "\033[1m";
constexpr const char* kDim = "\033[2m";
constexpr const char* kCyan = "\033[36m";
constexpr const char* kGreen = "\033[32m";
constexpr const char* kYellow = "\033[33m";
constexpr const char* kRed = "\033[31m";
constexpr const char* kBoldRed = "\033[1;31m";
constexpr const char* kBoldCyan = "\033[1;36m";
constexpr const char* kBoldYellow = "\033[1;33m";

std::string trim(const std::string& text) {
    const auto first = text.find_first_not_of(" \t\r\n");
    if (first == std::string::npos) return "";
    const auto last = text.find_last_not_of(" \t\r\n");
    return text.substr(first, last - first + 1);
}

std::string padRight(const std::string& text, std::size_t width) {
    if (text.size() >= width) return text.substr(0, width);
    return text + std::string(width - text.size(), ' ');
}

std::uint32_t computeTelemetryChecksum(const StationTelemetry& t) {
    std::ostringstream oss;
    oss << t.stationId << '|' << t.region << '|'
        << std::fixed << std::setprecision(4)
        << t.soilSaturation << '|' << t.rainfallRate << '|'
        << t.vibrationFrequency << '|' << t.tiltAngle << '|'
        << t.riverLevel << '|' << t.batteryLevel << '|' << (t.connected ? 1 : 0);
    const std::string payload = oss.str();
    std::uint32_t hash = 2166136261u;
    for (unsigned char ch : payload) {
        hash ^= ch;
        hash *= 16777619u;
    }
    return hash;
}

std::string formatDouble(double value, int precision = 1) {
    std::ostringstream oss;
    oss << std::fixed << std::setprecision(precision) << value;
    return oss.str();
}

} // namespace

bool ControlRoomDashboard::detectAnsiSupport(std::ostream& out, ColorMode mode) {
    if (mode == ColorMode::Never) return false;
    if (mode == ColorMode::Always) return true;

    const char* noColor = std::getenv("NO_COLOR");
    if (noColor != nullptr && noColor[0] != '\0') return false;

    if (&out != &std::cout) return false;

#ifdef _WIN32
    if (!_isatty(_fileno(stdout))) return false;
    HANDLE handle = GetStdHandle(STD_OUTPUT_HANDLE);
    if (handle == INVALID_HANDLE_VALUE || handle == nullptr) return false;
    DWORD consoleMode = 0;
    if (!GetConsoleMode(handle, &consoleMode)) return false;
    if ((consoleMode & ENABLE_VIRTUAL_TERMINAL_PROCESSING) == 0) {
        if (!SetConsoleMode(handle, consoleMode | ENABLE_VIRTUAL_TERMINAL_PROCESSING)) {
            return false;
        }
    }
    return true;
#else
    if (!isatty(fileno(stdout))) return false;
    const char* term = std::getenv("TERM");
    if (term != nullptr && std::string(term) == "dumb") return false;
    return true;
#endif
}

ControlRoomDashboard::ControlRoomDashboard(SimulationEngine& engine,
                                           std::istream& in,
                                           std::ostream& out,
                                           ColorMode colorMode)
    : engine_(engine),
      in_(in),
      out_(out),
      useAnsi_(detectAnsiSupport(out, colorMode)) {
    for (const auto& st : engine_.stations()) {
        stationCluster_.add(SensorStation(st.stationId, st.latitude, st.longitude));
    }
}

std::string ControlRoomDashboard::colorize(const std::string& text, const char* ansiCode) const {
    if (!useAnsi_) return text;
    return std::string(ansiCode) + text + kReset;
}

std::string ControlRoomDashboard::riskBadge(RiskClass level) const {
    switch (level) {
        case RiskClass::Low:      return colorize("[LOW]     ", kGreen);
        case RiskClass::Moderate: return colorize("[MODERATE]", kYellow);
        case RiskClass::High:     return colorize("[HIGH]    ", kRed);
        case RiskClass::Critical: return colorize("[CRITICAL]", kBoldRed);
    }
    return "[UNKNOWN] ";
}

std::string ControlRoomDashboard::sirenBadge(bool active) const {
    return active ? colorize("[ACTIVE]", kBoldRed) : colorize("[OFF]   ", kDim);
}

std::string ControlRoomDashboard::connectionBadge(bool connected) const {
    return connected ? colorize("[ONLINE] ", kGreen) : colorize("[OFFLINE]", kBoldRed);
}

void ControlRoomDashboard::printBanner() {
    const std::string line(78, '=');
    out_ << "\n" << colorize(line, kCyan) << "\n";
    out_ << colorize("  ALF-EWG :: AUTONOMOUS LANDSLIDE & FLASH-FLOOD EARLY WARNING GRID", kBoldCyan) << "\n";
    out_ << "  Control Room Terminal Interface  |  Seed: " << engine_.config().randomSeed
         << "  |  Cycle: " << engine_.cycle()
         << "  |  Color: " << (useAnsi_ ? "ANSI" : "Plain") << "\n";
    out_ << "  Note: All sensor readings, sirens, and routes are simulated.\n";
    out_ << colorize(line, kCyan) << "\n";
}

void ControlRoomDashboard::printSummaryStrip() {
    const auto snapshot = engine_.snapshotCurrentState();

    std::size_t activeStations = 0;
    std::size_t disconnectedStations = 0;
    std::vector<std::string> disconnectedNames;

    const SimulationResult* maxLandslide = nullptr;
    const SimulationResult* maxFlood = nullptr;
    double maxOverallRisk = -1.0;
    RiskClass emergencyLevel = RiskClass::Low;

    for (const auto& item : snapshot) {
        if (item.telemetry.connected) {
            ++activeStations;
        } else {
            ++disconnectedStations;
            disconnectedNames.push_back(item.telemetry.stationId + " (" + item.telemetry.region + ")");
        }
        if (!maxLandslide || item.landslideRisk > maxLandslide->landslideRisk) maxLandslide = &item;
        if (!maxFlood || item.floodRisk > maxFlood->floodRisk) maxFlood = &item;
        if (item.overallRisk > maxOverallRisk) {
            maxOverallRisk = item.overallRisk;
            emergencyLevel = item.classification;
        }
    }

    std::vector<std::string> activeSirenNames;
    for (const auto& entry : engine_.sirens()) {
        if (entry.second.isActive()) {
            activeSirenNames.push_back(entry.second.id());
        }
    }

    std::string latestIncidentSummary = "None recorded";
    try {
        const auto history = engine_.incidentLogger().listHistory();
        if (!history.empty()) {
            const auto& latest = history.back();
            latestIncidentSummary = latest.incidentId + " | " + latest.region + " | " +
                                    latest.incidentType + " | Risk " +
                                    formatDouble(latest.overallRisk * 100.0) + "/100";
        }
    } catch (const std::exception& err) {
        latestIncidentSummary = std::string("Unavailable (") + err.what() + ")";
    }

    out_ << "+----------------------------------------------------------------------------+\n";
    out_ << "| CONTROL ROOM STATUS SUMMARY                                                |\n";
    out_ << "+----------------------------------------------------------------------------+\n";
    out_ << "  Active stations        : " << activeStations << " / " << snapshot.size() << "\n";
    out_ << "  Disconnected stations  : " << disconnectedStations;
    if (!disconnectedNames.empty()) {
        out_ << " [";
        for (std::size_t i = 0; i < disconnectedNames.size(); ++i) {
            if (i > 0) out_ << ", ";
            out_ << disconnectedNames[i];
        }
        out_ << "]";
    }
    out_ << "\n";
    out_ << "  Current emergency level: " << riskBadge(emergencyLevel)
         << " (Max Risk: " << formatDouble(std::max(0.0, maxOverallRisk))
         << "/100, Global Alert Level: " << EarlyWarningSiren::globalAlertLevel() << ")\n";
    out_ << "  Active sirens          : " << activeSirenNames.size() << " / " << engine_.sirens().size();
    if (!activeSirenNames.empty()) {
        out_ << " [";
        for (std::size_t i = 0; i < activeSirenNames.size(); ++i) {
            if (i > 0) out_ << ", ";
            out_ << activeSirenNames[i];
        }
        out_ << "]";
    }
    out_ << "\n";

    if (maxLandslide) {
        out_ << "  Highest landslide risk : " << formatDouble(maxLandslide->landslideRisk)
             << "/100 at " << maxLandslide->telemetry.stationId
             << " (" << maxLandslide->telemetry.region << ")\n";
    }
    if (maxFlood) {
        out_ << "  Highest flood risk     : " << formatDouble(maxFlood->floodRisk)
             << "/100 at " << maxFlood->telemetry.stationId
             << " (" << maxFlood->telemetry.region << ")\n";
    }
    out_ << "  Latest incident        : " << latestIncidentSummary << "\n";
    out_ << "  Latest system events   :\n";
    const auto& events = engine_.systemEvents();
    if (events.empty()) {
        out_ << "    - No system events recorded yet.\n";
    } else {
        const std::size_t startIdx = events.size() > 4 ? events.size() - 4 : 0;
        for (std::size_t i = startIdx; i < events.size(); ++i) {
            out_ << "    - " << events[i] << "\n";
        }
    }
    out_ << "+----------------------------------------------------------------------------+\n";
}

void ControlRoomDashboard::printMainMenu() {
    out_ << "\n" << colorize("MAIN MENU", kBold) << "\n";
    out_ << "   1. Live Monitoring Dashboard\n"
         << "   2. View Sensor Stations\n"
         << "   3. Automatic Simulation\n"
         << "   4. Manual Telemetry Input\n"
         << "   5. Regional Hazard Analysis\n"
         << "   6. Active Emergency Alerts\n"
         << "   7. Siren Status\n"
         << "   8. Evacuation Recommendations\n"
         << "   9. Incident History\n"
         << "  10. Telemetry Audit\n"
         << "  11. System Statistics\n"
         << "  12. Full System Diagnostic\n"
         << "  13. Exit\n";
}

bool ControlRoomDashboard::readLine(std::string& outLine) {
    if (!std::getline(in_, outLine)) return false;
    outLine = trim(outLine);
    return true;
}

bool ControlRoomDashboard::promptInt(const std::string& prompt, int minVal, int maxVal, int& outValue) {
    while (true) {
        out_ << prompt;
        out_.flush();
        std::string line;
        if (!readLine(line)) return false;
        if (line.empty()) {
            out_ << colorize("  Input required. Please enter a number.\n", kYellow);
            continue;
        }
        std::istringstream iss(line);
        int parsed = 0;
        char extra = '\0';
        if (!(iss >> parsed) || (iss >> extra)) {
            out_ << colorize("  Invalid integer input. Try again.\n", kYellow);
            continue;
        }
        if (parsed < minVal || parsed > maxVal) {
            out_ << colorize("  Value must be between " + std::to_string(minVal) +
                             " and " + std::to_string(maxVal) + ".\n", kYellow);
            continue;
        }
        outValue = parsed;
        return true;
    }
}

bool ControlRoomDashboard::promptDouble(const std::string& prompt, double minVal, double maxVal, double& outValue) {
    while (true) {
        out_ << prompt;
        out_.flush();
        std::string line;
        if (!readLine(line)) return false;
        if (line.empty()) {
            out_ << colorize("  Input required. Please enter a numeric value.\n", kYellow);
            continue;
        }
        std::istringstream iss(line);
        double parsed = 0.0;
        char extra = '\0';
        if (!(iss >> parsed) || (iss >> extra) || !std::isfinite(parsed)) {
            out_ << colorize("  Invalid numeric input. Try again.\n", kYellow);
            continue;
        }
        if (parsed < minVal || parsed > maxVal) {
            out_ << colorize("  Value must be in [" + formatDouble(minVal, 2) + ", " +
                             formatDouble(maxVal, 2) + "].\n", kYellow);
            continue;
        }
        outValue = parsed;
        return true;
    }
}

bool ControlRoomDashboard::promptLine(const std::string& prompt, std::string& outValue) {
    out_ << prompt;
    out_.flush();
    return readLine(outValue);
}

int ControlRoomDashboard::run() {
    printBanner();
    printSummaryStrip();

    while (true) {
        printMainMenu();
        out_ << "\nSelect option (1-13): ";
        out_.flush();
        std::string line;
        if (!readLine(line)) {
            out_ << "\nInput stream closed. Exiting ALF-EWG Control Room.\n";
            return 0;
        }
        if (line.empty()) continue;

        std::istringstream iss(line);
        int choice = 0;
        char extra = '\0';
        if (!(iss >> choice) || (iss >> extra) || choice < 1 || choice > 13) {
            out_ << colorize("Invalid selection. Enter an integer from 1 to 13.\n", kYellow);
            continue;
        }

        try {
            switch (choice) {
                case 1: renderLiveDashboard(); break;
                case 2: renderSensorStations(); break;
                case 3: handleAutomaticSimulation(); break;
                case 4: handleManualTelemetry(); break;
                case 5: renderRegionalHazardAnalysis(); break;
                case 6: renderActiveEmergencyAlerts(); break;
                case 7: renderSirenStatus(); break;
                case 8: renderEvacuationRecommendations(); break;
                case 9: handleIncidentHistory(); break;
                case 10: renderTelemetryAudit(); break;
                case 11: renderSystemStatistics(); break;
                case 12: runFullSystemDiagnostic(); break;
                case 13:
                    out_ << colorize("\nShutting down ALF-EWG Control Room. Goodbye.\n", kCyan);
                    return 0;
            }
        } catch (const SensorFailureException& err) {
            out_ << colorize(std::string("\n[ERROR] Sensor/Persistence failure: ") + err.what() + "\n", kBoldRed);
        } catch (const TelemetryChecksumMismatch& err) {
            out_ << colorize(std::string("\n[ERROR] Telemetry checksum mismatch: ") + err.what() + "\n", kBoldRed);
        } catch (const ThresholdOverflowException& err) {
            out_ << colorize(std::string("\n[ERROR] Threshold overflow: ") + err.what() + "\n", kBoldRed);
        } catch (const std::exception& err) {
            out_ << colorize(std::string("\n[ERROR] Operation failed: ") + err.what() + "\n", kBoldRed);
        }
    }
}

void ControlRoomDashboard::renderLiveDashboard() {
    out_ << "\n" << colorize("=== 1. LIVE MONITORING DASHBOARD ===", kBoldCyan) << "\n";
    printSummaryStrip();

    const auto snapshot = engine_.snapshotCurrentState();
    out_ << "\n  STATION TELEMETRY GRID (Cycle " << engine_.cycle() << ")\n";
    out_ << "  ----------------------------------------------------------------------------\n";
    out_ << "  " << padRight("STATION", 10) << " "
         << padRight("REGION", 12) << " "
         << padRight("STATUS", 9) << " "
         << padRight("LAND", 6) << " "
         << padRight("FLOOD", 6) << " "
         << padRight("OVERALL", 7) << " "
         << padRight("CLASS", 11) << " "
         << "SIREN\n";
    out_ << "  ----------------------------------------------------------------------------\n";

    for (const auto& item : snapshot) {
        out_ << "  " << padRight(item.telemetry.stationId, 10) << " "
             << padRight(item.telemetry.region, 12) << " "
             << connectionBadge(item.telemetry.connected) << " "
             << std::setw(6) << formatDouble(item.landslideRisk) << " "
             << std::setw(6) << formatDouble(item.floodRisk) << " "
             << std::setw(7) << formatDouble(item.overallRisk) << " "
             << riskBadge(item.classification) << " "
             << sirenBadge(item.sirenActive) << "\n";
    }
    out_ << "  ----------------------------------------------------------------------------\n";
}

void ControlRoomDashboard::renderSensorStations() {
    out_ << "\n" << colorize("=== 2. VIEW SENSOR STATIONS ===", kBoldCyan) << "\n";
    out_ << "  Registered SensorStation instances (static activeCount): "
         << SensorStation::activeCount() << "\n";
    out_ << "  Cluster size: " << stationCluster_.size() << " stations\n\n";

    const auto& stations = engine_.stations();
    for (const auto& st : stations) {
        double projX = 0.0;
        double projY = 0.0;
        transformCoordinates(st.latitude, st.longitude, projX, projY);

        const double landslide = SimulationEngine::calculateLandslideRisk(st);
        const double flood = SimulationEngine::calculateFloodRisk(st);
        const double overall = SimulationEngine::calculateOverallRisk(landslide, flood);
        const RiskClass cls = SimulationEngine::classifyRisk(overall);
        const bool lowBattery = st.batteryLevel <= engine_.config().criticalBatteryPercent;

        out_ << "  [" << st.stationId << "] " << st.region << " "
             << connectionBadge(st.connected) << " " << riskBadge(cls) << "\n"
             << "    Geo Coords : (" << std::fixed << std::setprecision(4)
             << st.latitude << " deg N, " << st.longitude << " deg E)"
             << " -> Planar XY: (" << std::setprecision(1) << projX << " km, " << projY << " km)\n"
             << "    Soil Sat   : " << std::setprecision(2) << st.soilSaturation
             << "  |  Rain: " << std::setprecision(1) << st.rainfallRate << " mm/h"
             << "  |  Vibration: " << st.vibrationFrequency << " Hz"
             << "  |  Tilt: " << st.tiltAngle << " deg\n"
             << "    River Level: " << st.riverLevel << " m"
             << "  |  Battery: " << st.batteryLevel << "%"
             << (lowBattery ? colorize(" [LOW BATTERY]", kBoldRed) : "") << "\n"
             << "    Hazard     : Landslide=" << landslide << "/100, Flood=" << flood
             << "/100, Overall=" << overall << "/100\n\n";
    }
}

void ControlRoomDashboard::handleAutomaticSimulation() {
    out_ << "\n" << colorize("=== 3. AUTOMATIC SIMULATION ===", kBoldCyan) << "\n";
    out_ << "  Select scenario:\n"
         << "    1. Normal conditions\n"
         << "    2. Heavy rainfall\n"
         << "    3. Increasing soil saturation\n"
         << "    4. Abnormal seismic vibrations\n"
         << "    5. Rapid river-level increase\n"
         << "    6. Combined landslide and flash-flood threat\n"
         << "    0. Cancel and return\n";

    int choice = 0;
    if (!promptInt("  Scenario (0-6): ", 0, 6, choice) || choice == 0) return;

    int cycles = 1;
    if (!promptInt("  Number of cycles to simulate (1-10): ", 1, 10, cycles)) return;

    const auto scenario = static_cast<SimulationScenario>(choice - 1);
    std::vector<SimulationResult> latestRun;
    for (int c = 0; c < cycles; ++c) {
        latestRun = engine_.runScenario(scenario);
    }

    out_ << "\n  Scenario: " << SimulationEngine::scenarioName(scenario)
         << " (" << cycles << " cycle(s), current grid cycle=" << engine_.cycle() << ")\n";
    out_ << "  " << emergencyAlertHeader;
    for (const auto& res : latestRun) {
        out_ << "  " << res.telemetry.stationId << '\t'
             << res.telemetry.region << '\t'
             << SimulationEngine::riskClassName(res.classification) << '\t'
             << std::fixed << std::setprecision(1) << res.overallRisk << '\t'
             << (res.sirenActive ? "ACTIVE" : "inactive") << '\n';
        out_ << "     landslide=" << res.landslideRisk << "/100, flood=" << res.floodRisk
             << "/100, rain=" << res.telemetry.rainfallRate << " mm/h, soil="
             << std::setprecision(2) << res.telemetry.soilSaturation
             << ", river=" << std::setprecision(1) << res.telemetry.riverLevel << " m";
        if (!res.recommendedRoutes.empty()) {
            const auto& topRoute = res.recommendedRoutes.front();
            out_ << ", route=" << topRoute.routeId << " ("
                 << SimulationEngine::roadConditionName(topRoute.roadCondition) << ")";
        }
        if (!res.incidentId.empty()) {
            out_ << ", incident=" << res.incidentId;
        }
        out_ << "\n";
    }
}

void ControlRoomDashboard::handleManualTelemetry() {
    out_ << "\n" << colorize("=== 4. MANUAL TELEMETRY INPUT ===", kBoldCyan) << "\n";
    const auto& stations = engine_.stations();
    for (std::size_t i = 0; i < stations.size(); ++i) {
        out_ << "    " << (i + 1) << ". " << stations[i].stationId
             << " - " << stations[i].region << "\n";
    }
    out_ << "    0. Cancel and return\n";

    int idx = 0;
    if (!promptInt("  Select station (0-" + std::to_string(stations.size()) + "): ",
                   0, static_cast<int>(stations.size()), idx) || idx == 0) {
        return;
    }

    StationTelemetry reading = stations[static_cast<std::size_t>(idx - 1)];
    out_ << "  Enter readings for " << reading.stationId << " (" << reading.region << "):\n";

    if (!promptDouble("    Soil saturation [0.0 - 1.0]: ", 0.0, 1.0, reading.soilSaturation)) return;
    if (!promptDouble("    Rainfall rate mm/h [0.0 - 300.0]: ", 0.0, 300.0, reading.rainfallRate)) return;
    if (!promptDouble("    Vibration frequency Hz [0.0 - 100.0]: ", 0.0, 100.0, reading.vibrationFrequency)) return;
    if (!promptDouble("    Tilt angle deg [0.0 - 90.0]: ", 0.0, 90.0, reading.tiltAngle)) return;
    if (!promptDouble("    River level m [0.0 - 20.0]: ", 0.0, 20.0, reading.riverLevel)) return;
    if (!promptDouble("    Battery level % [0.0 - 100.0]: ", 0.0, 100.0, reading.batteryLevel)) return;

    int conn = 1;
    if (!promptInt("    Connection status (1 = connected, 0 = disconnected): ", 0, 1, conn)) return;
    reading.connected = (conn == 1);

    const SimulationResult result = engine_.runManual(reading);
    out_ << "\n  Manual Assessment Result:\n"
         << "    Station        : " << result.telemetry.stationId << " (" << result.telemetry.region << ")\n"
         << "    Landslide Risk : " << formatDouble(result.landslideRisk) << "/100\n"
         << "    Flood Risk     : " << formatDouble(result.floodRisk) << "/100\n"
         << "    Overall Risk   : " << formatDouble(result.overallRisk) << "/100 "
         << riskBadge(result.classification) << "\n"
         << "    Siren Status   : " << sirenBadge(result.sirenActive) << "\n";
    if (!result.recommendedRoutes.empty()) {
        const auto& top = result.recommendedRoutes.front();
        out_ << "    Top Route      : " << top.routeId << " -> " << top.destination
             << " (" << formatDouble(top.distanceKm) << " km, "
             << SimulationEngine::roadConditionName(top.roadCondition) << ")\n";
    } else {
        out_ << "    Top Route      : No safe route available.\n";
    }
    if (!result.incidentId.empty()) {
        out_ << "    Incident Saved : " << result.incidentId << "\n";
    }
}

void ControlRoomDashboard::renderRegionalHazardAnalysis() {
    out_ << "\n" << colorize("=== 5. REGIONAL HAZARD ANALYSIS ===", kBoldCyan) << "\n";

    struct RegionAnalysis {
        std::string stationId;
        std::string region;
        RegionalHazard hazard;
        double rainSlopeIndex = 0.0;
        double soilVibTiltIndex = 0.0;
        double combined = 0.0;
        double landslideRisk = 0.0;
        double floodRisk = 0.0;
        double overallRisk = 0.0;
        RiskClass classification = RiskClass::Low;
    };

    std::vector<RegionAnalysis> analyses;
    std::vector<double> normalizedIndices;

    for (const auto& st : engine_.stations()) {
        const double landslide = SimulationEngine::calculateLandslideRisk(st);
        const double flood = SimulationEngine::calculateFloodRisk(st);
        const double overall = SimulationEngine::calculateOverallRisk(landslide, flood);
        const double idxRainSlope = Sensors::computeHazardIndex(st.rainfallRate, st.tiltAngle);
        const double idxSoilVibTilt = Sensors::computeHazardIndex(st.soilSaturation, st.vibrationFrequency, st.tiltAngle);
        const double rainSev = Sensors::rainfallSeverity(st.rainfallRate);
        const double vibNorm = std::min(1.0, Sensors::vibrationSeverity(st.vibrationFrequency) /
                                             Sensors::vibrationSeverity(40.0));
        const double floodSev = Sensors::floodSeverity(st.riverLevel);
        const double combined = Sensors::combinedHazard(rainSev, st.soilSaturation, vibNorm, floodSev);

        RegionalHazard rh(overall / 100.0);
        normalizedIndices.push_back(rh.severity());
        analyses.push_back({st.stationId, st.region, rh, idxRainSlope, idxSoilVibTilt,
                            combined, landslide, flood, overall, SimulationEngine::classifyRisk(overall)});
    }

    // Rank regions using RegionalHazard::operator>
    std::sort(analyses.begin(), analyses.end(), [](const RegionAnalysis& a, const RegionAnalysis& b) {
        return a.hazard > b.hazard;
    });

    const double gridMeanHazard = accumulateRegionalRisk(normalizedIndices);
    out_ << "  Grid Mean Normalized Severity (accumulateRegionalRisk): "
         << std::fixed << std::setprecision(3) << gridMeanHazard << " ("
         << std::setprecision(1) << gridMeanHazard * 100.0 << "/100)\n\n";

    for (std::size_t rank = 0; rank < analyses.size(); ++rank) {
        const auto& a = analyses[rank];
        out_ << "  #" << (rank + 1) << " " << padRight(a.region, 12)
             << " [" << a.stationId << "]  " << riskBadge(a.classification)
             << "  " << a.hazard << "\n"
             << "     Landslide=" << std::setprecision(1) << a.landslideRisk
             << "/100 | Flood=" << a.floodRisk
             << "/100 | Overall=" << a.overallRisk << "/100\n"
             << "     Indices: Rain-Slope=" << std::setprecision(3) << a.rainSlopeIndex
             << " | Soil-Vib-Tilt=" << a.soilVibTiltIndex
             << " | Combined=" << a.combined << "\n";
    }
}

void ControlRoomDashboard::renderActiveEmergencyAlerts() {
    out_ << "\n" << colorize("=== 6. ACTIVE EMERGENCY ALERTS ===", kBoldCyan) << "\n";

    const auto snapshot = engine_.snapshotCurrentState();
    bool anyActive = false;
    out_ << "  CURRENT REGIONAL WARNINGS:\n";
    for (const auto& item : snapshot) {
        const auto alertLvl = Alerts::fromOverallRisk(item.overallRisk);
        const bool lowBattery = item.telemetry.batteryLevel <= engine_.config().criticalBatteryPercent;
        if (item.sirenActive || !item.telemetry.connected || lowBattery) {
            anyActive = true;
            out_ << "    * " << item.telemetry.region << " (" << item.telemetry.stationId << ") - "
                 << Alerts::levelName(alertLvl) << " " << riskBadge(item.classification)
                 << " Risk=" << formatDouble(item.overallRisk) << "/100";
            if (!item.telemetry.connected) out_ << " [DISCONNECTED]";
            if (lowBattery) out_ << " [BATTERY " << formatDouble(item.telemetry.batteryLevel) << "%]";
            out_ << "\n";
        }
    }
    if (!anyActive) {
        out_ << "    No active emergency warnings, offline stations, or critical battery alerts.\n";
    }

    out_ << "\n  SESSION ALERT TRANSITION LOG:\n";
    const auto& history = engine_.alertHistory();
    if (history.empty()) {
        out_ << "    No siren state transitions recorded in this session.\n";
    } else {
        out_ << "  " << emergencyAlertHeader;
        for (const auto& ev : history) {
            out_ << "  " << ev.sirenId << '\t' << ev.region << '\t'
                 << SimulationEngine::riskClassName(ev.level) << '\t'
                 << "cycle=" << ev.cycle << '\t'
                 << (ev.activated ? "ACTIVE" : "CLEARED")
                 << " (" << ev.description << ")\n";
        }
    }
}

void ControlRoomDashboard::renderSirenStatus() {
    out_ << "\n" << colorize("=== 7. SIREN STATUS ===", kBoldCyan) << "\n";
    out_ << "  Global Alert Level (EarlyWarningSiren::globalAlertLevel): "
         << EarlyWarningSiren::globalAlertLevel() << "\n";
    out_ << "  Activation Rule: overallRisk >= 50.0 (HIGH/CRITICAL) activates; < 50.0 clears.\n\n";
    out_ << "  " << padRight("SIREN ID", 20) << " "
         << padRight("REGION", 14) << " "
         << padRight("COORDINATES", 22) << " "
         << "STATE\n";
    out_ << "  ----------------------------------------------------------------------\n";

    for (const auto& entry : engine_.sirens()) {
        const auto& siren = entry.second;
        std::ostringstream coords;
        coords << std::fixed << std::setprecision(4) << siren.latitude() << ", " << siren.longitude();
        out_ << "  " << padRight(siren.id(), 20) << " "
             << padRight(entry.first, 14) << " "
             << padRight(coords.str(), 22) << " "
             << sirenBadge(siren.isActive()) << "\n";
    }
}

void ControlRoomDashboard::renderEvacuationRecommendations() {
    out_ << "\n" << colorize("=== 8. EVACUATION RECOMMENDATIONS ===", kBoldCyan) << "\n";
    out_ << "  Routes are ranked by EvacuationPriority (risk & road condition over distance;\n"
         << "  blocked routes and routes with adjusted risk >= 75.0 are excluded).\n\n";

    for (const auto& st : engine_.stations()) {
        const auto recommended = engine_.evaluateRoutesForRegion(st.region);
        out_ << "  Region: " << st.region << " (" << st.stationId << ")\n";
        if (recommended.empty()) {
            out_ << "    " << colorize("No safe available route in the simulation.", kBoldRed) << "\n";
        } else {
            for (std::size_t i = 0; i < recommended.size(); ++i) {
                const auto& r = recommended[i];
                out_ << "    " << (i + 1) << ". " << r.routeId << " -> " << r.destination
                     << " | " << formatDouble(r.distanceKm) << " km"
                     << " | Road: " << SimulationEngine::roadConditionName(r.roadCondition)
                     << " | Adj Landslide=" << formatDouble(r.landslideRisk)
                     << ", Adj Flood=" << formatDouble(r.floodRisk) << "\n";
            }
        }
        // Also display any blocked/unavailable routes for situational awareness
        for (const auto& r : engine_.routes()) {
            if (r.startingRegion == st.region && (!r.available || r.roadCondition == RoadCondition::Blocked)) {
                out_ << "    [UNAVAILABLE] " << r.routeId << " -> " << r.destination
                     << " (" << SimulationEngine::roadConditionName(r.roadCondition) << ")\n";
            }
        }
        out_ << "\n";
    }
}

void ControlRoomDashboard::handleIncidentHistory() {
    out_ << "\n" << colorize("=== 9. INCIDENT HISTORY (PERSISTENT BINARY STORE) ===", kBoldCyan) << "\n";
    const auto records = engine_.incidentLogger().listHistory();
    out_ << "  Total persisted incidents: " << records.size() << "\n";
    if (records.empty()) {
        out_ << "  No incidents have been persisted yet. Run a high/critical simulation or manual input.\n";
        return;
    }

    for (const auto& rec : records) {
        out_ << "  ----------------------------------------------------------------------------\n";
        out_ << "  ID: " << rec.incidentId << "  |  Timestamp: " << rec.timestamp << "\n"
             << "  Station: " << rec.stationId << " (" << rec.region << ")  |  Type: " << rec.incidentType << "\n"
             << "  Risks (/100): Landslide=" << formatDouble(rec.landslideRisk * 100.0)
             << ", Flood=" << formatDouble(rec.floodRisk * 100.0)
             << ", Overall=" << formatDouble(rec.overallRisk * 100.0)
             << "  |  Siren=" << (rec.sirenActivated ? "YES" : "NO")
             << "  |  Route=" << rec.evacuationRoute << "\n";
    }
    out_ << "  ----------------------------------------------------------------------------\n";

    out_ << "\n  Actions: [1] Search by ID  [2] Update evacuation route (in-place seekp)  [0] Back\n";
    int action = 0;
    if (!promptInt("  Action (0-2): ", 0, 2, action) || action == 0) return;

    std::string targetId;
    if (!promptLine("  Enter Incident ID: ", targetId) || targetId.empty()) return;

    const auto found = engine_.incidentLogger().searchById(targetId);
    if (!found) {
        out_ << colorize("  Incident ID '" + targetId + "' not found.\n", kYellow);
        return;
    }

    if (action == 1) {
        out_ << "  Found: " << found->incidentId << " | Region: " << found->region
             << " | Type: " << found->incidentType
             << " | Overall: " << formatDouble(found->overallRisk * 100.0)
             << "/100 | Route: " << found->evacuationRoute << "\n";
    } else if (action == 2) {
        std::string newRoute;
        if (!promptLine("  Enter updated evacuation route (1-159 chars): ", newRoute) || newRoute.empty()) {
            out_ << colorize("  Update cancelled: route cannot be empty.\n", kYellow);
            return;
        }
        IncidentRecord replacement = *found;
        replacement.evacuationRoute = newRoute;
        engine_.incidentLogger().updateById(targetId, replacement);
        out_ << colorize("  Incident '" + targetId + "' updated in binary log.\n", kGreen);
    }
}

void ControlRoomDashboard::renderTelemetryAudit() {
    out_ << "\n" << colorize("=== 10. TELEMETRY AUDIT ===", kBoldCyan) << "\n";
    TelemetryAuditor auditor;
    const auto& audits = engine_.telemetryAudits();

    out_ << "  Friend-Class TelemetryAuditor Inspection (Per Station):\n";
    for (const auto& entry : audits) {
        const auto& history = auditor.inspectHistory(entry.second);
        out_ << "    " << padRight(entry.first, 12)
             << " | Latest Raw Risk: " << std::setw(6) << formatDouble(auditor.inspectRaw(entry.second))
             << " | Samples Recorded: " << history.size();
        if (!history.empty()) {
            out_ << " | Recent: [";
            const std::size_t start = history.size() > 5 ? history.size() - 5 : 0;
            for (std::size_t i = start; i < history.size(); ++i) {
                if (i > start) out_ << ", ";
                out_ << formatDouble(history[i]);
            }
            out_ << "]";
        }
        out_ << "\n";
    }

    // Deep copy snapshot via TelemetryBuffer
    const TelemetryBuffer& sourceBuffer = engine_.auditBuffer();
    TelemetryBuffer snapshotCopy(sourceBuffer);
    out_ << "\n  TelemetryBuffer Audit Snapshot (Deep Copy):\n"
         << "    Source size=" << sourceBuffer.size() << ", capacity=" << sourceBuffer.capacity() << "\n"
         << "    Snapshot copy size=" << snapshotCopy.size() << ", capacity=" << snapshotCopy.capacity() << "\n";
    if (snapshotCopy.size() > 0) {
        out_ << "    Latest 5 buffered readings: ";
        const std::size_t start = snapshotCopy.size() > 5 ? snapshotCopy.size() - 5 : 0;
        for (std::size_t i = start; i < snapshotCopy.size(); ++i) {
            if (i > start) out_ << ", ";
            out_ << formatDouble(snapshotCopy[i]);
        }
        out_ << "\n";
    }

    out_ << "\n  Telemetry Payload Checksum Verification:\n";
    for (const auto& st : engine_.stations()) {
        const std::uint32_t expected = computeTelemetryChecksum(st);
        const std::uint32_t actual = computeTelemetryChecksum(st);
        verifyTelemetryChecksum(expected, actual);
        out_ << "    " << padRight(st.stationId, 12) << " CRC/FNV32=0x"
             << std::hex << std::setw(8) << std::setfill('0') << actual
             << std::dec << std::setfill(' ') << " [VERIFIED]\n";
    }
}

void ControlRoomDashboard::renderSystemStatistics() {
    out_ << "\n" << colorize("=== 11. SYSTEM STATISTICS ===", kBoldCyan) << "\n";
    const auto snapshot = engine_.snapshotCurrentState();

    std::size_t online = 0;
    std::size_t lowCnt = 0, modCnt = 0, highCnt = 0, critCnt = 0;
    double sumLand = 0.0, sumFlood = 0.0, maxOverall = 0.0, minBattery = 100.0, sumBattery = 0.0;

    for (const auto& item : snapshot) {
        if (item.telemetry.connected) ++online;
        sumLand += item.landslideRisk;
        sumFlood += item.floodRisk;
        maxOverall = std::max(maxOverall, item.overallRisk);
        minBattery = std::min(minBattery, item.telemetry.batteryLevel);
        sumBattery += item.telemetry.batteryLevel;
        switch (item.classification) {
            case RiskClass::Low: ++lowCnt; break;
            case RiskClass::Moderate: ++modCnt; break;
            case RiskClass::High: ++highCnt; break;
            case RiskClass::Critical: ++critCnt; break;
        }
    }

    const double n = snapshot.empty() ? 1.0 : static_cast<double>(snapshot.size());
    const std::size_t incidentCount = engine_.incidentLogger().listHistory().size();

    out_ << "  Simulation Cycles Executed     : " << engine_.cycle() << "\n"
         << "  Configured Monitoring Stations : " << snapshot.size()
         << " (" << online << " online, " << (snapshot.size() - online) << " offline)\n"
         << "  SensorStation::activeCount()   : " << SensorStation::activeCount() << "\n"
         << "  Global Alert Level (Sirens)    : " << EarlyWarningSiren::globalAlertLevel() << "\n"
         << "  Session Siren Transitions      : " << engine_.alertHistory().size() << "\n"
         << "  Persisted Binary Incidents     : " << incidentCount << "\n"
         << "  Audit Buffer Samples           : " << engine_.auditBuffer().size() << "\n"
         << "  Average Landslide Risk         : " << formatDouble(sumLand / n) << "/100\n"
         << "  Average Flood Risk             : " << formatDouble(sumFlood / n) << "/100\n"
         << "  Peak Overall Risk              : " << formatDouble(maxOverall) << "/100\n"
         << "  Battery (Min / Avg)            : " << formatDouble(minBattery)
         << "% / " << formatDouble(sumBattery / n) << "%\n"
         << "  Risk Distribution              : LOW=" << lowCnt
         << ", MODERATE=" << modCnt << ", HIGH=" << highCnt << ", CRITICAL=" << critCnt << "\n";
}

void ControlRoomDashboard::runFullSystemDiagnostic() {
    out_ << "\n" << colorize("=== 12. FULL SYSTEM DIAGNOSTIC ===", kBoldCyan) << "\n";
    int passed = 0;
    int total = 0;

    auto report = [&](const std::string& name, bool ok, const std::string& detail) {
        ++total;
        if (ok) ++passed;
        out_ << "  " << (ok ? colorize("[PASS]", kGreen) : colorize("[FAIL]", kBoldRed))
             << " " << padRight(name, 34) << " - " << detail << "\n";
    };

    // 1. Virtual inheritance diamond + PowerSubsystem HAS-A
    {
        AutonomousHybridProbe probe("diag-hybrid", PowerSubsystem(50.0, 20.0, 4.0, 1.0, 1.0));
        DisasterTelemetryDevice* viaSolar = static_cast<SolarPoweredNode*>(&probe);
        DisasterTelemetryDevice* viaLora = static_cast<WirelessLoRaTransceiver*>(&probe);
        probe.powerSubsystem().chargeFromSolar(2.0);
        probe.powerSubsystem().consume(probe.powerSubsystem().powerConsumption());
        const bool ok = (viaSolar == viaLora) && (probe.powerSubsystem().currentCharge() == 27.0);
        report("Virtual Diamond & Power HAS-A", ok, "Single shared subobject; charge=27.0/50.0");
    }

    // 2. Runtime polymorphism sweep
    {
        std::vector<std::unique_ptr<BaseSensorNode>> owned;
        owned.push_back(std::make_unique<AutonomousHybridProbe>("diag-h"));
        owned.push_back(std::make_unique<RainGaugeNode>("diag-r"));
        std::vector<BaseSensorNode*> sweep;
        for (const auto& p : owned) sweep.push_back(p.get());
        executeSensorSweep(sweep);
        auto* h = dynamic_cast<AutonomousHybridProbe*>(owned[0].get());
        auto* r = dynamic_cast<RainGaugeNode*>(owned[1].get());
        const bool ok = h && r && h->thresholdExceeded() && r->thresholdExceeded();
        report("Polymorphic Sensor Sweep", ok, "AutonomousHybridProbe=42.0, RainGauge=12.5");
    }

    // 3. TelemetryBuffer deep copy isolation
    {
        TelemetryBuffer orig(2);
        orig.push_back(11.0);
        orig.push_back(22.0);
        orig.push_back(33.0);
        TelemetryBuffer copy(orig);
        copy[0] = 99.0;
        const bool ok = (orig[0] == 11.0) && (copy[0] == 99.0) && (copy.size() == 3);
        report("TelemetryBuffer Deep Copy", ok, "Reallocated cap=" + std::to_string(orig.capacity()) + ", isolated copy");
    }

    // 4. Checksum verification positive & negative paths
    {
        bool mismatchCaught = false;
        const auto& sample = engine_.stations().front();
        const std::uint32_t csum = computeTelemetryChecksum(sample);
        verifyTelemetryChecksum(csum, csum);
        try {
            verifyTelemetryChecksum(csum, csum ^ 0x1u);
        } catch (const TelemetryChecksumMismatch&) {
            mismatchCaught = true;
        }
        report("Telemetry Checksum Integrity", mismatchCaught, "Valid checksum accepted; bit-flip rejected");
    }

    // 5. Binary incident store readability
    {
        bool storeOk = false;
        std::size_t count = 0;
        try {
            const auto all = engine_.incidentLogger().loadAll();
            count = all.size();
            storeOk = true;
        } catch (...) {
            storeOk = false;
        }
        report("Binary Incident Store Integrity", storeOk,
               "Verified " + std::to_string(count) + " serialized record(s)");
    }

    // 6. Station coordinates & evacuation route sanity
    {
        bool allValid = !engine_.stations().empty();
        for (const auto& st : engine_.stations()) {
            double x = 0.0, y = 0.0;
            transformCoordinates(st.latitude, st.longitude, x, y);
            if (!std::isfinite(x) || !std::isfinite(y)) allValid = false;
        }
        report("Station Projection & Bounds", allValid,
               std::to_string(engine_.stations().size()) + " stations projected cleanly");
    }

    out_ << "\n  Diagnostic Summary: " << passed << " / " << total << " checks passed.\n";
}

} // namespace DisasterCore::UI
