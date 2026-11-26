#pragma once

#include <stdexcept>
#include <cmath>
#include <algorithm>
#include "Hazard.hpp"

namespace DisasterCore {
namespace Sensors {

constexpr double kPi = 3.14159265358979323846;

// Existing functions (soilSaturation, rainfallSeverity, etc.) are defined in Hazard.hpp
// Here we provide overloads for hazard index computation.

/**
 * Compute hazard index based on rainfall rate (mm/h) and slope angle (degrees).
 * Formula: index = rainfallSeverity(rainfallRate) * sin(slopeAngle * PI/180)
 */
inline double computeHazardIndex(double rainfallRate, double slopeAngle) {
    if (rainfallRate < 0.0) {
        throw std::invalid_argument("rainfallRate must be >= 0");
    }
    if (slopeAngle < 0.0 || slopeAngle > 90.0) {
        throw std::invalid_argument("slopeAngle must be in [0,90]");
    }
    // Use rainfallSeverity from Hazard.hpp
    double rainSev = rainfallSeverity(rainfallRate);
    double slopeFactor = std::sin(slopeAngle * kPi / 180.0);
    return std::clamp(rainSev * slopeFactor, 0.0, 1.0);
}

/**
 * Compute hazard index based on soil saturation, vibration frequency, and tilt angle.
 * Formula: index = (soilSaturation * vibrationSeverity(freq)) * cos(tiltAngle * PI/180)
 */
inline double computeHazardIndex(double soilSat, double vibrationFreq, double tiltAngle) {
    if (soilSat < 0.0 || soilSat > 1.0) {
        throw std::invalid_argument("soilSat must be in [0,1]");
    }
    if (vibrationFreq < 0.0) {
        throw std::invalid_argument("vibrationFreq must be >= 0");
    }
    if (tiltAngle < 0.0 || tiltAngle > 90.0) {
        throw std::invalid_argument("tiltAngle must be in [0,90]");
    }
    double vibSev = vibrationSeverity(vibrationFreq);
    double tiltFactor = std::cos(tiltAngle * kPi / 180.0);
    double raw = soilSat * vibSev * tiltFactor;
    return std::clamp(raw, 0.0, 1.0);
}

} // namespace Sensors
} // namespace DisasterCore
