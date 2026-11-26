#include "../../include/core/IncidentLogger.hpp"

#include <algorithm>
#include <cstring>

namespace DisasterCore::Core {

void IncidentLogger::validate(const IncidentRecord& incident) {
    const std::pair<const std::string*, std::size_t> fields[] = {
        {&incident.incidentId, idBytes}, {&incident.timestamp, timestampBytes},
        {&incident.stationId, stationBytes}, {&incident.region, regionBytes},
        {&incident.incidentType, typeBytes}, {&incident.evacuationRoute, routeBytes}
    };
    for (const auto& field : fields) {
        if (field.first->empty() || field.first->size() >= field.second)
            throw std::invalid_argument("incident text field is empty or exceeds its storage limit");
    }
    for (double risk : {incident.landslideRisk, incident.floodRisk, incident.overallRisk}) {
        if (!std::isfinite(risk) || risk < 0.0 || risk > 1.0) throw ThresholdOverflowException();
    }
}

void IncidentLogger::writeText(std::fstream& file, const std::string& text, std::size_t width) {
    std::array<char, routeBytes> buffer{};
    if (width > buffer.size() || text.size() >= width) throw std::invalid_argument("text exceeds binary field width");
    std::copy(text.begin(), text.end(), buffer.begin());
    file.write(buffer.data(), static_cast<std::streamsize>(width));
    if (!file) throw SensorFailureException();
}

std::string IncidentLogger::readText(std::fstream& file, std::size_t width) {
    std::array<char, routeBytes> buffer{};
    if (width > buffer.size()) throw SensorFailureException();
    file.read(buffer.data(), static_cast<std::streamsize>(width));
    if (file.gcount() != static_cast<std::streamsize>(width)) throw SensorFailureException();
    const auto end = std::find(buffer.begin(), buffer.begin() + static_cast<std::ptrdiff_t>(width), '\0');
    if (end == buffer.begin() + static_cast<std::ptrdiff_t>(width)) throw SensorFailureException();
    return std::string(buffer.begin(), end);
}

void IncidentLogger::writeRecord(std::fstream& file, const IncidentRecord& incident) {
    writeText(file, incident.incidentId, idBytes);
    writeText(file, incident.timestamp, timestampBytes);
    writeText(file, incident.stationId, stationBytes);
    writeText(file, incident.region, regionBytes);
    writeText(file, incident.incidentType, typeBytes);
    file.write(reinterpret_cast<const char*>(&incident.landslideRisk), sizeof(double));
    file.write(reinterpret_cast<const char*>(&incident.floodRisk), sizeof(double));
    file.write(reinterpret_cast<const char*>(&incident.overallRisk), sizeof(double));
    const std::uint8_t siren = incident.sirenActivated ? 1 : 0;
    file.write(reinterpret_cast<const char*>(&siren), sizeof(siren));
    writeText(file, incident.evacuationRoute, routeBytes);
    if (!file) throw SensorFailureException();
}

IncidentRecord IncidentLogger::readRecord(std::fstream& file) {
    IncidentRecord incident;
    incident.incidentId = readText(file, idBytes);
    incident.timestamp = readText(file, timestampBytes);
    incident.stationId = readText(file, stationBytes);
    incident.region = readText(file, regionBytes);
    incident.incidentType = readText(file, typeBytes);
    file.read(reinterpret_cast<char*>(&incident.landslideRisk), sizeof(double));
    file.read(reinterpret_cast<char*>(&incident.floodRisk), sizeof(double));
    file.read(reinterpret_cast<char*>(&incident.overallRisk), sizeof(double));
    std::uint8_t siren = 0;
    file.read(reinterpret_cast<char*>(&siren), sizeof(siren));
    if (!file || siren > 1) throw SensorFailureException();
    incident.sirenActivated = siren != 0;
    incident.evacuationRoute = readText(file, routeBytes);
    return incident;
}

void IncidentLogger::save(const IncidentRecord& incident) {
    validate(incident);
    if (searchById(incident.incidentId)) throw std::invalid_argument("incident ID already exists");
    if (!std::filesystem::exists(filePath_)) {
        std::ofstream create(filePath_, std::ios::binary);
        if (!create) throw SensorFailureException();
    }
    std::fstream file(filePath_, std::ios::binary | std::ios::in | std::ios::out);
    if (!file) throw SensorFailureException();
    file.seekp(0, std::ios::end); // append using explicit output positioning
    if (!file) throw SensorFailureException();
    writeRecord(file, incident);
    file.flush();
    if (!file) throw SensorFailureException();
}

std::vector<IncidentRecord> IncidentLogger::loadAll() const {
    std::vector<IncidentRecord> records;
    if (!std::filesystem::exists(filePath_)) return records;
    std::fstream file(filePath_, std::ios::binary | std::ios::in);
    if (!file) throw SensorFailureException();
    file.seekg(0, std::ios::end); // inspect size with explicit input positioning
    const auto length = file.tellg();
    if (length < 0 || static_cast<std::uint64_t>(length) % recordBytes != 0) throw SensorFailureException();
    const auto count = static_cast<std::size_t>(static_cast<std::uint64_t>(length) / recordBytes);
    records.reserve(count);
    file.seekg(0, std::ios::beg);
    for (std::size_t i = 0; i < count; ++i) records.push_back(readRecord(file));
    return records;
}

std::optional<IncidentRecord> IncidentLogger::searchById(const std::string& id) const {
    std::map<std::string, IncidentRecord> index;
    const auto records = loadAll();
    std::for_each(records.begin(), records.end(), [&](const IncidentRecord& incident) {
        index.emplace(incident.incidentId, incident);
    });
    const auto found = index.find(id);
    if (found == index.end()) return std::nullopt;
    return found->second;
}

void IncidentLogger::updateById(const std::string& id, const IncidentRecord& replacement,
                                const std::function<void()>& afterWrite) {
    validate(replacement);
    if (replacement.incidentId != id) throw std::invalid_argument("replacement incident ID must match target ID");
    std::fstream file(filePath_, std::ios::binary | std::ios::in | std::ios::out);
    if (!file) throw SensorFailureException();
    file.seekg(0, std::ios::end);
    const auto length = file.tellg();
    if (length < 0 || static_cast<std::uint64_t>(length) % recordBytes != 0) throw SensorFailureException();
    const auto count = static_cast<std::size_t>(static_cast<std::uint64_t>(length) / recordBytes);
    file.seekg(0, std::ios::beg);
    for (std::size_t index = 0; index < count; ++index) {
        const auto position = static_cast<std::streamoff>(index * recordBytes);
        file.seekg(position, std::ios::beg);
        IncidentRecord previous = readRecord(file);
        if (previous.incidentId != id) continue;
        try {
            file.seekp(position, std::ios::beg); // in-place update via explicit output positioning
            writeRecord(file, replacement);
            file.flush();
            if (!file) throw SensorFailureException();
            if (afterWrite) afterWrite();
            return;
        } catch (...) {
            file.clear();
            file.seekp(position, std::ios::beg);
            try {
                writeRecord(file, previous); // rollback to the preserved prior record
                file.flush();
                if (!file) throw SensorFailureException();
            } catch (...) {
                throw SensorFailureException();
            }
            throw;
        }
    }
    throw std::out_of_range("incident ID not found");
}

} // namespace DisasterCore::Core
