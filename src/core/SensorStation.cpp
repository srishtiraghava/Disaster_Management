#include "../include/core/SensorStation.hpp"

namespace DisasterCore {
namespace Core {

unsigned int SensorStation::activeCount_ = 0;

SensorStation::SensorStation(const std::string& id, double latitude, double longitude)
    : id_(id), latitude_(latitude), longitude_(longitude) {
    if (latitude < -90.0 || latitude > 90.0 || longitude < -180.0 || longitude > 180.0) {
        throw std::invalid_argument("Invalid geographic coordinates");
    }
    ++activeCount_;
}

} // namespace Core
} // namespace DisasterCore
