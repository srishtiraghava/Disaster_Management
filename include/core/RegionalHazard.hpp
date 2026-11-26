#pragma once

#include <iostream>
#include <stdexcept>

namespace DisasterCore {
namespace Core {

class RegionalHazard {
private:
    double severity_; // normalized [0,1]
public:
    explicit RegionalHazard(double severity = 0.0) : severity_(severity) {
        if (severity < 0.0 || severity > 1.0) {
            throw std::invalid_argument("severity must be in [0,1]");
        }
    }
    // Copy / move defaults
    RegionalHazard(const RegionalHazard&) = default;
    RegionalHazard(RegionalHazard&&) noexcept = default;
    RegionalHazard& operator=(const RegionalHazard&) = default;
    RegionalHazard& operator=(RegionalHazard&&) noexcept = default;
    ~RegionalHazard() = default;

    double severity() const noexcept { return severity_; }
    void setSeverity(double s) {
        if (s < 0.0 || s > 1.0) {
            throw std::invalid_argument("severity must be in [0,1]");
        }
        severity_ = s;
    }
};

// Relational operator > (higher severity is "greater")
inline bool operator>(const RegionalHazard& lhs, const RegionalHazard& rhs) noexcept {
    return lhs.severity() > rhs.severity();
}

// Stream insertion for display
inline std::ostream& operator<<(std::ostream& os, const RegionalHazard& rh) {
    os << "RegionalHazard(severity=" << rh.severity() << ")";
    return os;
}

} // namespace Core
} // namespace DisasterCore
