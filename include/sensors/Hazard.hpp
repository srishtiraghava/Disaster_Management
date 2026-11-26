#pragma once

#include <cmath>
#include <algorithm>
#include <stdexcept>

namespace DisasterCore {
namespace Sensors {

// Soil saturation: waterContent / porosity, clamped to [0,1]
inline double soilSaturation(double waterContent, double porosity) {
    if (porosity <= 0.0) {
        throw std::invalid_argument("porosity must be > 0");
    }
    double sat = waterContent / porosity;
    return std::clamp(sat, 0.0, 1.0);
}

// Rainfall severity: exponential decay mapping (mm/h) -> [0,1]
inline double rainfallSeverity(double rainfallRate) {
    if (rainfallRate < 0.0) {
        throw std::invalid_argument("rainfallRate must be >= 0");
    }
    // 1 - e^(-r/10) gives ~0.63 at 10 mm/h, asymptotically approaches 1.
    return 1.0 - std::exp(-rainfallRate / 10.0);
}

// Vibration severity: log1p mapping (Hz) -> [0,∞)
inline double vibrationSeverity(double frequency) {
    if (frequency < 0.0) {
        throw std::invalid_argument("frequency must be >= 0");
    }
    return std::log1p(frequency);
}

// Flood severity: tanh mapping (water level meters) -> [0,1]
inline double floodSeverity(double waterLevel) {
    if (waterLevel < 0.0) {
        throw std::invalid_argument("waterLevel must be >= 0");
    }
    return std::tanh(waterLevel / 5.0);
}

// Combined hazard: weighted, normalized to [0,1]
inline double combinedHazard(double rainfallSev, double soilSat, double vibrationSev, double floodSev) {
    // Weights sum to 1. Adjust as needed for domain knowledge.
    constexpr double wRain = 0.3;
    constexpr double wSoil = 0.3;
    constexpr double wVib  = 0.2;
    constexpr double wFlood= 0.2;
    double raw = wRain * rainfallSev + wSoil * soilSat + wVib * vibrationSev + wFlood * floodSev;
    return std::clamp(raw, 0.0, 1.0);
}

} // namespace Sensors
} // namespace DisasterCore
