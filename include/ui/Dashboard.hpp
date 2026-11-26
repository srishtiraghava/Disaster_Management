#pragma once

#include "../core/SensorCluster.hpp"
#include "../core/Simulation.hpp"

#include <iosfwd>
#include <string>

namespace DisasterCore::UI {

enum class ColorMode {
    Auto,
    Always,
    Never
};

class ControlRoomDashboard {
public:
    ControlRoomDashboard(Core::SimulationEngine& engine,
                         std::istream& in,
                         std::ostream& out,
                         ColorMode colorMode = ColorMode::Auto);

    int run();
    bool ansiEnabled() const noexcept { return useAnsi_; }

    // Exposed for automated verification and single-panel rendering
    void renderLiveDashboard();
    void renderSensorStations();
    void handleAutomaticSimulation();
    void handleManualTelemetry();
    void renderRegionalHazardAnalysis();
    void renderActiveEmergencyAlerts();
    void renderSirenStatus();
    void renderEvacuationRecommendations();
    void handleIncidentHistory();
    void renderTelemetryAudit();
    void renderSystemStatistics();
    void runFullSystemDiagnostic();

private:
    static bool detectAnsiSupport(std::ostream& out, ColorMode mode);

    std::string colorize(const std::string& text, const char* ansiCode) const;
    std::string riskBadge(Core::RiskClass level) const;
    std::string sirenBadge(bool active) const;
    std::string connectionBadge(bool connected) const;

    void printBanner();
    void printMainMenu();
    void printSummaryStrip();

    bool readLine(std::string& outLine);
    bool promptInt(const std::string& prompt, int minVal, int maxVal, int& outValue);
    bool promptDouble(const std::string& prompt, double minVal, double maxVal, double& outValue);
    bool promptLine(const std::string& prompt, std::string& outValue);

    Core::SimulationEngine& engine_;
    std::istream& in_;
    std::ostream& out_;
    bool useAnsi_ = false;
    Core::SensorCluster stationCluster_;
};

} // namespace DisasterCore::UI
