#pragma once

#include "SensorStation.hpp"
#include <vector>
#include <algorithm>
#include <iostream>

namespace DisasterCore {
namespace Core {

class SensorCluster {
private:
    std::vector<SensorStation> stations_; // stored by value (copyable)
public:
    SensorCluster() = default;
    explicit SensorCluster(const std::vector<SensorStation>& stations) : stations_(stations) {}
    // Add a station
    void add(const SensorStation& station) { stations_.push_back(station); }
    const std::vector<SensorStation>& stations() const noexcept { return stations_; }
    std::size_t size() const noexcept { return stations_.size(); }

    // Binary + aggregates two clusters
    friend SensorCluster operator+(const SensorCluster& a, const SensorCluster& b) {
        SensorCluster result = a;
        result.stations_.insert(result.stations_.end(), b.stations_.begin(), b.stations_.end());
        return result;
    }

    // Stream insertion for debugging/display
    friend std::ostream& operator<<(std::ostream& os, const SensorCluster& cluster) {
        os << "SensorCluster with " << cluster.stations_.size() << " stations:" << std::endl;
        for (const auto& s : cluster.stations_) {
            os << "  " << s << std::endl; // relies on SensorStation <<
        }
        return os;
    }
};

} // namespace Core
} // namespace DisasterCore
