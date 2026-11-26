#pragma once

#include <exception>
#include <cstdint>

namespace DisasterCore::Core {

class SensorFailureException : public std::exception {
public:
    const char* what() const noexcept override { return "sensor read or processing failed"; }
};

class TelemetryChecksumMismatch : public std::exception {
public:
    const char* what() const noexcept override { return "telemetry checksum does not match the payload"; }
};

class ThresholdOverflowException : public std::exception {
public:
    const char* what() const noexcept override { return "risk threshold exceeded the supported range"; }
};

inline void verifyTelemetryChecksum(std::uint32_t expected, std::uint32_t actual) {
    if (expected != actual) throw TelemetryChecksumMismatch();
}

} // namespace DisasterCore::Core
