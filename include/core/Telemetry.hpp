#pragma once

#include <vector>
#include <stdexcept>
#include <algorithm>
#include <cmath>

namespace DisasterCore {
namespace Core {

constexpr double kPi = 3.14159265358979323846;

// Simple telemetry holder for sensor raw values.
class Telemetry {
private:
    double rawMeasurement_; // latest raw sensor value
    std::vector<double> history_; // store past measurements

    // Allow auditor to inspect private members.
    friend class TelemetryAuditor;
public:
    Telemetry() : rawMeasurement_(0.0) {}

    // Update raw measurement by reference (call‑by‑reference).
    void updateMeasurement(double& target, double newValue) {
        target = newValue;
        rawMeasurement_ = newValue;
        history_.push_back(newValue);
    }

    // Return a reference to the stored raw measurement (safe because it lives as a member).
    double& current() noexcept { return rawMeasurement_; }
    const double& current() const noexcept { return rawMeasurement_; }
};

// Auditor class with friend access to Telemetry's internals.
class TelemetryAuditor {
public:
    // Inspect raw measurement without exposing a public getter.
    double inspectRaw(const Telemetry& t) const noexcept {
        return t.rawMeasurement_; // direct access via friendship
    }
    // Inspect full history.
    const std::vector<double>& inspectHistory(const Telemetry& t) const noexcept {
        return t.history_;
    }
};

// Coordinate transformation (e.g., simple equirectangular projection).
inline void transformCoordinates(double latitudeDeg, double longitudeDeg, double& xOut, double& yOut) {
    if (latitudeDeg < -90.0 || latitudeDeg > 90.0) {
        throw std::invalid_argument("latitude out of range");
    }
    if (longitudeDeg < -180.0 || longitudeDeg > 180.0) {
        throw std::invalid_argument("longitude out of range");
    }
    // Earth radius in km (approx).
    constexpr double R = 6371.0;
    double latRad = latitudeDeg * kPi / 180.0;
    double lonRad = longitudeDeg * kPi / 180.0;
    xOut = R * lonRad * std::cos(latRad);
    yOut = R * latRad;
}

// Regional risk accumulation: sum of hazard indices, clamped to [0,1].
inline double accumulateRegionalRisk(const std::vector<double>& hazardIndices) {
    double sum = 0.0;
    for (double h : hazardIndices) {
        if (h < 0.0 || h > 1.0) {
            throw std::invalid_argument("hazard index out of [0,1]");
        }
        sum += h;
    }
    // Normalize by number of cells (simple average) and clamp.
    double avg = hazardIndices.empty() ? 0.0 : sum / static_cast<double>(hazardIndices.size());
    return std::clamp(avg, 0.0, 1.0);
}

} // namespace Core
} // namespace DisasterCore
