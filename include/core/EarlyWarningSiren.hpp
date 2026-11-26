#pragma once

#include <string>
#include <iostream>
#include <stdexcept>

namespace DisasterCore {
namespace Core {

class EarlyWarningSiren {
private:
    std::string id_;               // unique identifier
    double latitude_;
    double longitude_;
    bool active_;                  // whether siren is currently sounding
    static unsigned int globalAlertLevel_; // cumulative emergency level (e.g., number of active sirens)
public:
    // Parameterized constructor
    EarlyWarningSiren(const std::string& id, double latitude, double longitude)
        : id_(id), latitude_(latitude), longitude_(longitude), active_(false) {
        if (latitude < -90.0 || latitude > 90.0 || longitude < -180.0 || longitude > 180.0) {
            throw std::invalid_argument("Invalid geographic coordinates");
        }
    }

    // Activate the siren – increments global alert level
    void activate() {
        if (!active_) {
            active_ = true;
            ++globalAlertLevel_;
        }
    }

    // Deactivate – decrements global alert level
    void deactivate() {
        if (active_) {
            active_ = false;
            if (globalAlertLevel_ > 0) --globalAlertLevel_;
        }
    }

    bool isActive() const noexcept { return active_; }
    const std::string& id() const noexcept { return id_; }
    double latitude() const noexcept { return latitude_; }
    double longitude() const noexcept { return longitude_; }

    static unsigned int globalAlertLevel() noexcept { return globalAlertLevel_; }
};

} // namespace Core
} // namespace DisasterCore
