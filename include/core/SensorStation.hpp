#pragma once

#include <string>
#include <iostream>
#include <stdexcept>

namespace DisasterCore {
namespace Core {

class SensorStation {
private:
    std::string id_;               // unique identifier
    double latitude_;              // geographic coordinate
    double longitude_;
    static unsigned int activeCount_; // number of instantiated stations
public:
    // Parameterized constructor
    SensorStation(const std::string& id, double latitude, double longitude);

    // Copy / move defaults (stations are lightweight)
    SensorStation(const SensorStation&) = default;
    SensorStation(SensorStation&&) noexcept = default;
    SensorStation& operator=(const SensorStation&) = default;
    SensorStation& operator=(SensorStation&&) noexcept = default;
    ~SensorStation() = default;

    // Accessors (const correctness)
    const std::string& id() const noexcept { return id_; }
    double latitude() const noexcept { return latitude_; }
    double longitude() const noexcept { return longitude_; }

    // Static accessor for active station count
    static unsigned int activeCount() noexcept { return activeCount_; }

    // Stream insertion (friend)
    friend std::ostream& operator<<(std::ostream& os, const SensorStation& s) {
        os << "Station[" << s.id_ << "] (" << s.latitude_ << ", " << s.longitude_ << ")";
        return os;
    }

    // Stream extraction (friend)
    friend std::istream& operator>>(std::istream& is, SensorStation& s) {
        std::string id; double lat, lon;
        if (is >> id >> lat >> lon) {
            // Validate range
            if (lat < -90.0 || lat > 90.0 || lon < -180.0 || lon > 180.0) {
                is.setstate(std::ios::failbit);
                return is;
            }
            s.id_ = id;
            s.latitude_ = lat;
            s.longitude_ = lon;
        }
        return is;
    }
};

} // namespace Core
} // namespace DisasterCore
