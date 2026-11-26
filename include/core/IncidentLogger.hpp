#pragma once

#include "Exceptions.hpp"
#include <array>
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <filesystem>
#include <fstream>
#include <functional>
#include <iostream>
#include <map>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace DisasterCore::Core {

struct IncidentRecord {
    std::string incidentId;
    std::string timestamp;
    std::string stationId;
    std::string region;
    std::string incidentType;
    double landslideRisk = 0.0;
    double floodRisk = 0.0;
    double overallRisk = 0.0;
    bool sirenActivated = false;
    std::string evacuationRoute;
};

class IncidentLogger {
public:
    explicit IncidentLogger(std::filesystem::path filePath) : filePath_(std::move(filePath)) {}

    void save(const IncidentRecord& incident);
    std::vector<IncidentRecord> loadAll() const;
    std::optional<IncidentRecord> searchById(const std::string& id) const;
    std::vector<IncidentRecord> listHistory() const { return loadAll(); }

    // The optional hook is useful for integrating a post-write validation step. If it
    // throws, the original serialized record is written back before the exception escapes.
    void updateById(const std::string& id, const IncidentRecord& replacement,
                    const std::function<void()>& afterWrite = {});

private:
    static constexpr std::size_t idBytes = 48, timestampBytes = 40, stationBytes = 48;
    static constexpr std::size_t regionBytes = 64, typeBytes = 48, routeBytes = 160;
    static constexpr std::size_t recordBytes = idBytes + timestampBytes + stationBytes +
        regionBytes + typeBytes + 3 * sizeof(double) + sizeof(std::uint8_t) + routeBytes;

    using TextField = std::pair<const std::string*, std::size_t>;
    static void validate(const IncidentRecord& incident);
    static void writeText(std::fstream& file, const std::string& text, std::size_t width);
    static std::string readText(std::fstream& file, std::size_t width);
    static void writeRecord(std::fstream& file, const IncidentRecord& incident);
    static IncidentRecord readRecord(std::fstream& file);
    std::filesystem::path filePath_;
};

struct EvacuationRoute {
    std::string name;
    unsigned int priority = 0; // larger values are more urgent
};

struct EvacuationPriority {
    bool operator()(const EvacuationRoute& left, const EvacuationRoute& right) const noexcept {
        if (left.priority != right.priority) return left.priority > right.priority;
        return left.name < right.name;
    }
};

inline void sortEvacuationRoutes(std::vector<EvacuationRoute>& routes) {
    std::sort(routes.begin(), routes.end(), EvacuationPriority{});
}

// Usage: std::cout << emergencyAlertHeader << ...
inline std::ostream& emergencyAlertHeader(std::ostream& out) {
    return out << "INCIDENT\tREGION\tTYPE\tRISK\tSIREN\n";
}

template <typename T>
class PriorityQueue {
public:
    void push(T value) { values_.push_back(std::move(value)); std::push_heap(values_.begin(), values_.end(), compare_); }
    const T& top() const {
        if (values_.empty()) throw std::out_of_range("PriorityQueue is empty");
        return values_.front();
    }
    void pop() {
        if (values_.empty()) throw std::out_of_range("PriorityQueue is empty");
        std::pop_heap(values_.begin(), values_.end(), compare_);
        values_.pop_back();
    }
    bool empty() const noexcept { return values_.empty(); }
    std::size_t size() const noexcept { return values_.size(); }
private:
    std::vector<T> values_;
    std::less<T> compare_;
};

} // namespace DisasterCore::Core
