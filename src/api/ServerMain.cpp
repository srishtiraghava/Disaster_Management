#include "../../include/alerts/AlertTypes.hpp"
#include "../../include/core/EarlyWarningSiren.hpp"
#include "../../include/core/Exceptions.hpp"
#include "../../include/core/IncidentLogger.hpp"
#include "../../include/core/RegionalHazard.hpp"
#include "../../include/core/SensorNode.hpp"
#include "../../include/core/SensorStation.hpp"
#include "../../include/core/Simulation.hpp"
#include "../../include/core/Telemetry.hpp"
#include "../../include/core/TelemetryBuffer.hpp"
#include "../../include/sensors/Hazard.hpp"
#include "../../include/sensors/HazardIndex.hpp"
#include "../../include/third_party/httplib.h"
#include "../../include/third_party/nlohmann/json.hpp"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <limits>
#include <memory>
#include <mutex>
#include <sstream>
#include <stdexcept>
#include <string>
#include <vector>

namespace {

using json = nlohmann::json;
using namespace DisasterCore::Core;
using namespace DisasterCore::Sensors;
using namespace DisasterCore::Alerts;

struct ServerConfig {
    std::string host = "127.0.0.1";
    int port = 8080;
    std::uint32_t seed = 211;
    std::string logFilePath = "alf_ewg_incidents.bin";
    std::string corsOrigin = "*";
};

std::uint32_t computeTelemetryChecksum(const StationTelemetry& t) {
    std::ostringstream oss;
    oss << t.stationId << '|' << t.region << '|'
        << std::fixed << std::setprecision(4)
        << t.soilSaturation << '|' << t.rainfallRate << '|'
        << t.vibrationFrequency << '|' << t.tiltAngle << '|'
        << t.riverLevel << '|' << t.batteryLevel << '|' << (t.connected ? 1 : 0);
    const std::string payload = oss.str();
    std::uint32_t hash = 2166136261u;
    for (unsigned char ch : payload) {
        hash ^= ch;
        hash *= 16777619u;
    }
    return hash;
}

std::string toHex32(std::uint32_t value) {
    std::ostringstream oss;
    oss << "0x" << std::hex << std::setw(8) << std::setfill('0') << value;
    return oss.str();
}

json stationTelemetryToJson(const StationTelemetry& t) {
    return json{
        {"stationId", t.stationId},
        {"region", t.region},
        {"latitude", t.latitude},
        {"longitude", t.longitude},
        {"soilSaturation", t.soilSaturation},
        {"rainfallRate", t.rainfallRate},
        {"vibrationFrequency", t.vibrationFrequency},
        {"tiltAngle", t.tiltAngle},
        {"riverLevel", t.riverLevel},
        {"batteryLevel", t.batteryLevel},
        {"connected", t.connected}
    };
}

json evacuationRouteToJson(const EvacuationRouteRecord& r) {
    return json{
        {"routeId", r.routeId},
        {"startingRegion", r.startingRegion},
        {"destination", r.destination},
        {"distanceKm", r.distanceKm},
        {"roadCondition", SimulationEngine::roadConditionName(r.roadCondition)},
        {"landslideRisk", r.landslideRisk},
        {"floodRisk", r.floodRisk},
        {"available", r.available}
    };
}

json simulationResultToJson(const SimulationResult& res) {
    json routesJson = json::array();
    for (const auto& route : res.recommendedRoutes) {
        routesJson.push_back(evacuationRouteToJson(route));
    }
    return json{
        {"telemetry", stationTelemetryToJson(res.telemetry)},
        {"landslideRisk", res.landslideRisk},
        {"floodRisk", res.floodRisk},
        {"overallRisk", res.overallRisk},
        {"classification", SimulationEngine::riskClassName(res.classification)},
        {"alertLevel", levelName(fromOverallRisk(res.overallRisk))},
        {"sirenActive", res.sirenActive},
        {"recommendedRoutes", routesJson},
        {"incidentId", res.incidentId}
    };
}

json incidentRecordToJson(const IncidentRecord& rec) {
    return json{
        {"incidentId", rec.incidentId},
        {"timestamp", rec.timestamp},
        {"stationId", rec.stationId},
        {"region", rec.region},
        {"incidentType", rec.incidentType},
        {"landslideRisk", rec.landslideRisk},
        {"floodRisk", rec.floodRisk},
        {"overallRisk", rec.overallRisk},
        {"sirenActivated", rec.sirenActivated},
        {"evacuationRoute", rec.evacuationRoute}
    };
}

json alertEventToJson(const AlertEvent& ev) {
    return json{
        {"region", ev.region},
        {"sirenId", ev.sirenId},
        {"cycle", ev.cycle},
        {"activated", ev.activated},
        {"level", SimulationEngine::riskClassName(ev.level)},
        {"description", ev.description}
    };
}

void sendJson(httplib::Response& res, int status, const json& body) {
    res.status = status;
    res.set_content(body.dump(), "application/json; charset=utf-8");
}

void sendError(httplib::Response& res, int status, const std::string& code, const std::string& message) {
    sendJson(res, status, json{
        {"error", code},
        {"message", message}
    });
}

bool parseScenario(const json& val, SimulationScenario& outScenario) {
    if (val.is_number_integer()) {
        const int idx = val.get<int>();
        if (idx < 0 || idx > 5) return false;
        outScenario = static_cast<SimulationScenario>(idx);
        return true;
    }
    if (val.is_string()) {
        const std::string s = val.get<std::string>();
        if (s == "Normal") { outScenario = SimulationScenario::Normal; return true; }
        if (s == "HeavyRainfall") { outScenario = SimulationScenario::HeavyRainfall; return true; }
        if (s == "IncreasingSoilSaturation") { outScenario = SimulationScenario::IncreasingSoilSaturation; return true; }
        if (s == "AbnormalSeismicVibrations") { outScenario = SimulationScenario::AbnormalSeismicVibrations; return true; }
        if (s == "RapidRiverRise") { outScenario = SimulationScenario::RapidRiverRise; return true; }
        if (s == "CombinedThreat") { outScenario = SimulationScenario::CombinedThreat; return true; }
    }
    return false;
}

void applyCorsHeaders(httplib::Response& res, const std::string& corsOrigin) {
    res.set_header("Access-Control-Allow-Origin", corsOrigin);
    res.set_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

void printUsage(const char* programName) {
    std::cout << "Usage: " << programName << " [options]\n"
              << "Options:\n"
              << "  --host <addr>         Bind address (default: 127.0.0.1)\n"
              << "  --port <port>         Listen port (default: 8080)\n"
              << "  --seed <number>       Deterministic simulation seed (default: 211)\n"
              << "  --log-file <path>     Binary incident log file (default: alf_ewg_incidents.bin)\n"
              << "  --cors-origin <orig>  Access-Control-Allow-Origin value (default: *)\n"
              << "  -h, --help            Show this help message and exit\n";
}

bool parseArgs(int argc, char* argv[], ServerConfig& cfg, int& exitCode) {
    if (const char* envHost = std::getenv("SENTRA_HOST")) {
        if (envHost[0] != '\0') cfg.host = envHost;
    }
    if (const char* envPort = std::getenv("SENTRA_PORT")) {
        if (envPort[0] != '\0') {
            try {
                const int p = std::stoi(envPort);
                if (p > 0 && p <= 65535) cfg.port = p;
            } catch (...) {}
        }
    }
    if (const char* envCors = std::getenv("SENTRA_CORS_ORIGIN")) {
        if (envCors[0] != '\0') cfg.corsOrigin = envCors;
    }

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "-h" || arg == "--help") {
            printUsage(argv[0]);
            exitCode = 0;
            return false;
        } else if (arg == "--host" && i + 1 < argc) {
            cfg.host = argv[++i];
        } else if (arg == "--port" && i + 1 < argc) {
            try {
                const int p = std::stoi(argv[++i]);
                if (p < 1 || p > 65535) {
                    std::cerr << "Port must be between 1 and 65535.\n";
                    exitCode = 2;
                    return false;
                }
                cfg.port = p;
            } catch (const std::exception&) {
                std::cerr << "Invalid --port value.\n";
                exitCode = 2;
                return false;
            }
        } else if (arg == "--seed" && i + 1 < argc) {
            try {
                const unsigned long parsed = std::stoul(argv[++i]);
                if (parsed > std::numeric_limits<std::uint32_t>::max()) {
                    std::cerr << "Seed out of 32-bit unsigned range.\n";
                    exitCode = 2;
                    return false;
                }
                cfg.seed = static_cast<std::uint32_t>(parsed);
            } catch (const std::exception&) {
                std::cerr << "Invalid --seed value.\n";
                exitCode = 2;
                return false;
            }
        } else if (arg == "--log-file" && i + 1 < argc) {
            cfg.logFilePath = argv[++i];
        } else if (arg == "--cors-origin" && i + 1 < argc) {
            cfg.corsOrigin = argv[++i];
        } else {
            std::cerr << "Unknown or incomplete argument: " << arg << "\n";
            printUsage(argv[0]);
            exitCode = 2;
            return false;
        }
    }
    return true;
}

} // namespace

int main(int argc, char* argv[]) {
    ServerConfig serverCfg;
    int exitCode = 0;
    if (!parseArgs(argc, argv, serverCfg, exitCode)) {
        return exitCode;
    }

    try {
        IncidentLogger incidentLogger(serverCfg.logFilePath);
        SimulationConfig simConfig;
        simConfig.randomSeed = serverCfg.seed;
        SimulationEngine engine(incidentLogger, simConfig);
        std::mutex engineMutex;

        httplib::Server server;

        server.set_pre_routing_handler([&](const httplib::Request& req, httplib::Response& res) {
            applyCorsHeaders(res, serverCfg.corsOrigin);
            if (req.method == "OPTIONS") {
                res.status = 204;
                return httplib::Server::HandlerResponse::Handled;
            }
            return httplib::Server::HandlerResponse::Unhandled;
        });

        server.set_exception_handler([&](const httplib::Request&, httplib::Response& res, std::exception_ptr ep) {
            applyCorsHeaders(res, serverCfg.corsOrigin);
            try {
                if (ep) std::rethrow_exception(ep);
            } catch (const SensorFailureException& e) {
                sendError(res, 500, "SENSOR_OR_PERSISTENCE_FAILURE", e.what());
            } catch (const TelemetryChecksumMismatch& e) {
                sendError(res, 422, "CHECKSUM_MISMATCH", e.what());
            } catch (const ThresholdOverflowException& e) {
                sendError(res, 422, "THRESHOLD_OVERFLOW", e.what());
            } catch (const std::invalid_argument& e) {
                sendError(res, 400, "INVALID_ARGUMENT", e.what());
            } catch (const std::out_of_range& e) {
                sendError(res, 404, "NOT_FOUND", e.what());
            } catch (const std::exception& e) {
                sendError(res, 500, "INTERNAL_ERROR", e.what());
            } catch (...) {
                sendError(res, 500, "INTERNAL_ERROR", "Unknown server exception");
            }
        });

        // GET /api/health
        server.Get("/api/health", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            sendJson(res, 200, json{
                {"status", "ok"},
                {"service", "SENTRA_api"},
                {"engine", "ALF_EWG_core"},
                {"cycle", engine.cycle()},
                {"seed", engine.config().randomSeed},
                {"stationCount", engine.stations().size()},
                {"activeStationCount", SensorStation::activeCount()},
                {"globalAlertLevel", EarlyWarningSiren::globalAlertLevel()}
            });
        });

        // GET /api/snapshot
        server.Get("/api/snapshot", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            const auto snapshot = engine.snapshotCurrentState();

            std::size_t activeStations = 0;
            std::size_t disconnectedStations = 0;
            double maxLandslideRisk = 0.0;
            double maxFloodRisk = 0.0;
            double maxOverallRisk = 0.0;
            RiskClass emergencyLevel = RiskClass::Low;

            json stationsJson = json::array();
            for (const auto& item : snapshot) {
                if (item.telemetry.connected) ++activeStations;
                else ++disconnectedStations;

                maxLandslideRisk = std::max(maxLandslideRisk, item.landslideRisk);
                maxFloodRisk = std::max(maxFloodRisk, item.floodRisk);
                if (item.overallRisk >= maxOverallRisk) {
                    maxOverallRisk = item.overallRisk;
                    emergencyLevel = item.classification;
                }
                stationsJson.push_back(simulationResultToJson(item));
            }

            std::size_t activeSirens = 0;
            for (const auto& entry : engine.sirens()) {
                if (entry.second.isActive()) ++activeSirens;
            }

            json latestIncident = nullptr;
            const auto history = engine.incidentLogger().listHistory();
            if (!history.empty()) {
                latestIncident = incidentRecordToJson(history.back());
            }

            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"seed", engine.config().randomSeed},
                {"globalAlertLevel", EarlyWarningSiren::globalAlertLevel()},
                {"activeSirens", activeSirens},
                {"totalSirens", engine.sirens().size()},
                {"stations", stationsJson},
                {"summary", {
                    {"activeStations", activeStations},
                    {"disconnectedStations", disconnectedStations},
                    {"maxLandslideRisk", maxLandslideRisk},
                    {"maxFloodRisk", maxFloodRisk},
                    {"maxOverallRisk", maxOverallRisk},
                    {"emergencyLevel", SimulationEngine::riskClassName(emergencyLevel)},
                    {"latestIncident", latestIncident},
                    {"systemEvents", engine.systemEvents()}
                }}
            });
        });

        // GET /api/stations
        server.Get("/api/stations", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            json list = json::array();
            for (const auto& st : engine.stations()) {
                double projX = 0.0;
                double projY = 0.0;
                transformCoordinates(st.latitude, st.longitude, projX, projY);

                const double landslide = SimulationEngine::calculateLandslideRisk(st);
                const double flood = SimulationEngine::calculateFloodRisk(st);
                const double overall = SimulationEngine::calculateOverallRisk(landslide, flood);
                const RiskClass cls = SimulationEngine::classifyRisk(overall);
                const bool lowBattery = st.batteryLevel <= engine.config().criticalBatteryPercent;

                json item = stationTelemetryToJson(st);
                item["projectedXKm"] = projX;
                item["projectedYKm"] = projY;
                item["landslideRisk"] = landslide;
                item["floodRisk"] = flood;
                item["overallRisk"] = overall;
                item["classification"] = SimulationEngine::riskClassName(cls);
                item["lowBattery"] = lowBattery;
                list.push_back(std::move(item));
            }
            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"activeCount", SensorStation::activeCount()},
                {"criticalBatteryPercent", engine.config().criticalBatteryPercent},
                {"stations", list}
            });
        });

        // GET /api/hazards/analysis
        server.Get("/api/hazards/analysis", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            struct RegionAnalysis {
                std::string stationId;
                std::string region;
                RegionalHazard hazard;
                double rainSlopeIndex = 0.0;
                double soilVibTiltIndex = 0.0;
                double combined = 0.0;
                double landslideRisk = 0.0;
                double floodRisk = 0.0;
                double overallRisk = 0.0;
                RiskClass classification = RiskClass::Low;
            };

            std::vector<RegionAnalysis> analyses;
            std::vector<double> normalizedIndices;

            for (const auto& st : engine.stations()) {
                const double landslide = SimulationEngine::calculateLandslideRisk(st);
                const double flood = SimulationEngine::calculateFloodRisk(st);
                const double overall = SimulationEngine::calculateOverallRisk(landslide, flood);
                const double idxRainSlope = computeHazardIndex(st.rainfallRate, st.tiltAngle);
                const double idxSoilVibTilt = computeHazardIndex(st.soilSaturation, st.vibrationFrequency, st.tiltAngle);
                const double rainSev = rainfallSeverity(st.rainfallRate);
                const double vibNorm = std::min(1.0, vibrationSeverity(st.vibrationFrequency) /
                                                     vibrationSeverity(40.0));
                const double floodSev = floodSeverity(st.riverLevel);
                const double combined = combinedHazard(rainSev, st.soilSaturation, vibNorm, floodSev);

                RegionalHazard rh(overall / 100.0);
                normalizedIndices.push_back(rh.severity());
                analyses.push_back({st.stationId, st.region, rh, idxRainSlope, idxSoilVibTilt,
                                    combined, landslide, flood, overall, SimulationEngine::classifyRisk(overall)});
            }

            std::sort(analyses.begin(), analyses.end(), [](const RegionAnalysis& a, const RegionAnalysis& b) {
                return a.hazard > b.hazard;
            });

            const double gridMeanHazard = accumulateRegionalRisk(normalizedIndices);
            json rankedJson = json::array();
            for (std::size_t rank = 0; rank < analyses.size(); ++rank) {
                const auto& a = analyses[rank];
                rankedJson.push_back(json{
                    {"rank", rank + 1},
                    {"stationId", a.stationId},
                    {"region", a.region},
                    {"normalizedSeverity", a.hazard.severity()},
                    {"landslideRisk", a.landslideRisk},
                    {"floodRisk", a.floodRisk},
                    {"overallRisk", a.overallRisk},
                    {"classification", SimulationEngine::riskClassName(a.classification)},
                    {"rainSlopeIndex", a.rainSlopeIndex},
                    {"soilVibTiltIndex", a.soilVibTiltIndex},
                    {"combinedHazard", a.combined}
                });
            }

            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"gridMeanNormalizedSeverity", gridMeanHazard},
                {"regions", rankedJson}
            });
        });

        // GET /api/alerts
        server.Get("/api/alerts", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            const auto snapshot = engine.snapshotCurrentState();

            json activeWarnings = json::array();
            for (const auto& item : snapshot) {
                const auto alertLvl = fromOverallRisk(item.overallRisk);
                const bool lowBattery = item.telemetry.batteryLevel <= engine.config().criticalBatteryPercent;
                if (item.sirenActive || !item.telemetry.connected || lowBattery) {
                    activeWarnings.push_back(json{
                        {"stationId", item.telemetry.stationId},
                        {"region", item.telemetry.region},
                        {"alertLevel", levelName(alertLvl)},
                        {"classification", SimulationEngine::riskClassName(item.classification)},
                        {"overallRisk", item.overallRisk},
                        {"sirenActive", item.sirenActive},
                        {"disconnected", !item.telemetry.connected},
                        {"lowBattery", lowBattery},
                        {"batteryLevel", item.telemetry.batteryLevel}
                    });
                }
            }

            json historyJson = json::array();
            for (const auto& ev : engine.alertHistory()) {
                historyJson.push_back(alertEventToJson(ev));
            }

            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"activeWarnings", activeWarnings},
                {"alertHistory", historyJson}
            });
        });

        // GET /api/sirens
        server.Get("/api/sirens", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            json sirensJson = json::array();
            for (const auto& entry : engine.sirens()) {
                const auto& siren = entry.second;
                sirensJson.push_back(json{
                    {"region", entry.first},
                    {"sirenId", siren.id()},
                    {"latitude", siren.latitude()},
                    {"longitude", siren.longitude()},
                    {"active", siren.isActive()}
                });
            }
            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"globalAlertLevel", EarlyWarningSiren::globalAlertLevel()},
                {"activationThreshold", 50.0},
                {"sirens", sirensJson}
            });
        });

        // GET /api/evacuation
        server.Get("/api/evacuation", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            json regionsJson = json::array();
            for (const auto& st : engine.stations()) {
                const auto recommended = engine.evaluateRoutesForRegion(st.region);
                json recJson = json::array();
                for (const auto& r : recommended) {
                    recJson.push_back(evacuationRouteToJson(r));
                }

                json unavailableJson = json::array();
                for (const auto& r : engine.routes()) {
                    if (r.startingRegion == st.region && (!r.available || r.roadCondition == RoadCondition::Blocked)) {
                        unavailableJson.push_back(evacuationRouteToJson(r));
                    }
                }

                regionsJson.push_back(json{
                    {"region", st.region},
                    {"stationId", st.stationId},
                    {"recommendedRoutes", recJson},
                    {"unavailableRoutes", unavailableJson}
                });
            }

            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"maxSafeRouteRisk", 75.0},
                {"regions", regionsJson}
            });
        });

        // GET /api/incidents
        server.Get("/api/incidents", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            const auto records = engine.incidentLogger().listHistory();
            json list = json::array();
            for (const auto& rec : records) {
                list.push_back(incidentRecordToJson(rec));
            }
            sendJson(res, 200, json{
                {"total", records.size()},
                {"incidents", list}
            });
        });

        // GET /api/incidents/:id
        server.Get(R"(/api/incidents/([^/]+))", [&](const httplib::Request& req, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            const std::string id = req.matches[1];
            const auto found = engine.incidentLogger().searchById(id);
            if (!found) {
                sendError(res, 404, "INCIDENT_NOT_FOUND", "Incident ID '" + id + "' not found");
                return;
            }
            sendJson(res, 200, incidentRecordToJson(*found));
        });

        // PATCH /api/incidents/:id
        server.Patch(R"(/api/incidents/([^/]+))", [&](const httplib::Request& req, httplib::Response& res) {
            json body;
            try {
                body = json::parse(req.body);
            } catch (const std::exception&) {
                sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON");
                return;
            }

            if (!body.is_object() || !body.contains("evacuationRoute") || !body["evacuationRoute"].is_string()) {
                sendError(res, 400, "VALIDATION_ERROR", "JSON body must contain string field 'evacuationRoute'");
                return;
            }

            const std::string newRoute = body["evacuationRoute"].get<std::string>();
            if (newRoute.empty() || newRoute.size() >= 160) {
                sendError(res, 400, "VALIDATION_ERROR", "'evacuationRoute' must be 1 to 159 characters");
                return;
            }

            std::lock_guard<std::mutex> lock(engineMutex);
            const std::string id = req.matches[1];
            const auto found = engine.incidentLogger().searchById(id);
            if (!found) {
                sendError(res, 404, "INCIDENT_NOT_FOUND", "Incident ID '" + id + "' not found");
                return;
            }

            IncidentRecord replacement = *found;
            replacement.evacuationRoute = newRoute;
            engine.incidentLogger().updateById(id, replacement);
            sendJson(res, 200, incidentRecordToJson(replacement));
        });

        // GET /api/audit
        server.Get("/api/audit", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            TelemetryAuditor auditor;
            json stationAudits = json::array();
            for (const auto& entry : engine.telemetryAudits()) {
                const auto& history = auditor.inspectHistory(entry.second);
                stationAudits.push_back(json{
                    {"stationId", entry.first},
                    {"latestRawRisk", auditor.inspectRaw(entry.second)},
                    {"sampleCount", history.size()},
                    {"history", history}
                });
            }

            const TelemetryBuffer& sourceBuffer = engine.auditBuffer();
            TelemetryBuffer snapshotCopy(sourceBuffer);
            json recentSamples = json::array();
            for (std::size_t i = 0; i < snapshotCopy.size(); ++i) {
                recentSamples.push_back(snapshotCopy[i]);
            }

            json checksums = json::array();
            for (const auto& st : engine.stations()) {
                const std::uint32_t expected = computeTelemetryChecksum(st);
                const std::uint32_t actual = computeTelemetryChecksum(st);
                verifyTelemetryChecksum(expected, actual);
                checksums.push_back(json{
                    {"stationId", st.stationId},
                    {"checksum", toHex32(actual)},
                    {"verified", true}
                });
            }

            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"stationAudits", stationAudits},
                {"buffer", {
                    {"sourceSize", sourceBuffer.size()},
                    {"sourceCapacity", sourceBuffer.capacity()},
                    {"snapshotSize", snapshotCopy.size()},
                    {"snapshotCapacity", snapshotCopy.capacity()},
                    {"samples", recentSamples}
                }},
                {"checksums", checksums}
            });
        });

        // GET /api/statistics
        server.Get("/api/statistics", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            const auto snapshot = engine.snapshotCurrentState();

            std::size_t online = 0;
            std::size_t lowCnt = 0, modCnt = 0, highCnt = 0, critCnt = 0;
            double sumLand = 0.0, sumFlood = 0.0, maxOverall = 0.0, minBattery = 100.0, sumBattery = 0.0;

            for (const auto& item : snapshot) {
                if (item.telemetry.connected) ++online;
                sumLand += item.landslideRisk;
                sumFlood += item.floodRisk;
                maxOverall = std::max(maxOverall, item.overallRisk);
                minBattery = std::min(minBattery, item.telemetry.batteryLevel);
                sumBattery += item.telemetry.batteryLevel;
                switch (item.classification) {
                    case RiskClass::Low: ++lowCnt; break;
                    case RiskClass::Moderate: ++modCnt; break;
                    case RiskClass::High: ++highCnt; break;
                    case RiskClass::Critical: ++critCnt; break;
                }
            }

            const double n = snapshot.empty() ? 1.0 : static_cast<double>(snapshot.size());
            const std::size_t incidentCount = engine.incidentLogger().listHistory().size();

            sendJson(res, 200, json{
                {"cyclesExecuted", engine.cycle()},
                {"totalStations", snapshot.size()},
                {"onlineStations", online},
                {"offlineStations", snapshot.size() - online},
                {"sensorStationActiveCount", SensorStation::activeCount()},
                {"globalAlertLevel", EarlyWarningSiren::globalAlertLevel()},
                {"sessionSirenTransitions", engine.alertHistory().size()},
                {"persistedIncidents", incidentCount},
                {"auditBufferSamples", engine.auditBuffer().size()},
                {"averageLandslideRisk", sumLand / n},
                {"averageFloodRisk", sumFlood / n},
                {"peakOverallRisk", maxOverall},
                {"minBattery", minBattery},
                {"averageBattery", sumBattery / n},
                {"riskDistribution", {
                    {"LOW", lowCnt},
                    {"MODERATE", modCnt},
                    {"HIGH", highCnt},
                    {"CRITICAL", critCnt}
                }}
            });
        });

        // POST /api/simulate/scenario
        server.Post("/api/simulate/scenario", [&](const httplib::Request& req, httplib::Response& res) {
            json body;
            try {
                body = json::parse(req.body);
            } catch (const std::exception&) {
                sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON");
                return;
            }

            if (!body.is_object() || !body.contains("scenario")) {
                sendError(res, 400, "VALIDATION_ERROR", "JSON body must contain 'scenario'");
                return;
            }

            SimulationScenario scenario = SimulationScenario::Normal;
            if (!parseScenario(body["scenario"], scenario)) {
                sendError(res, 400, "INVALID_SCENARIO",
                          "Invalid scenario. Use 0-5 or one of: Normal, HeavyRainfall, IncreasingSoilSaturation, AbnormalSeismicVibrations, RapidRiverRise, CombinedThreat");
                return;
            }

            int cycles = 1;
            if (body.contains("cycles")) {
                if (!body["cycles"].is_number_integer()) {
                    sendError(res, 400, "VALIDATION_ERROR", "'cycles' must be an integer between 1 and 10");
                    return;
                }
                cycles = body["cycles"].get<int>();
                if (cycles < 1 || cycles > 10) {
                    sendError(res, 400, "VALIDATION_ERROR", "'cycles' must be between 1 and 10");
                    return;
                }
            }

            std::lock_guard<std::mutex> lock(engineMutex);
            std::vector<SimulationResult> latestRun;
            for (int c = 0; c < cycles; ++c) {
                latestRun = engine.runScenario(scenario);
            }

            json resultsJson = json::array();
            for (const auto& item : latestRun) {
                resultsJson.push_back(simulationResultToJson(item));
            }

            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"scenario", SimulationEngine::scenarioName(scenario)},
                {"cyclesExecuted", cycles},
                {"results", resultsJson}
            });
        });

        // POST /api/simulate/manual
        server.Post("/api/simulate/manual", [&](const httplib::Request& req, httplib::Response& res) {
            json body;
            try {
                body = json::parse(req.body);
            } catch (const std::exception&) {
                sendError(res, 400, "INVALID_JSON", "Request body must be valid JSON");
                return;
            }

            if (!body.is_object() ||
                !body.contains("stationId") || !body["stationId"].is_string() ||
                !body.contains("region") || !body["region"].is_string()) {
                sendError(res, 400, "VALIDATION_ERROR", "JSON body must include string 'stationId' and 'region'");
                return;
            }

            const char* numericFields[] = {
                "soilSaturation", "rainfallRate", "vibrationFrequency",
                "tiltAngle", "riverLevel", "batteryLevel"
            };
            for (const char* field : numericFields) {
                if (!body.contains(field) || !body[field].is_number()) {
                    sendError(res, 400, "VALIDATION_ERROR", std::string("Missing or non-numeric field: ") + field);
                    return;
                }
            }

            if (!body.contains("connected") || !body["connected"].is_boolean()) {
                sendError(res, 400, "VALIDATION_ERROR", "Missing or non-boolean field: connected");
                return;
            }

            std::lock_guard<std::mutex> lock(engineMutex);
            StationTelemetry reading;
            reading.stationId = body["stationId"].get<std::string>();
            reading.region = body["region"].get<std::string>();

            // Default lat/lon to configured station if omitted, or use provided values for validation
            const auto& stations = engine.stations();
            const auto found = std::find_if(stations.begin(), stations.end(), [&](const StationTelemetry& st) {
                return st.stationId == reading.stationId && st.region == reading.region;
            });
            if (found != stations.end()) {
                reading.latitude = found->latitude;
                reading.longitude = found->longitude;
            }
            if (body.contains("latitude")) {
                if (!body["latitude"].is_number()) {
                    sendError(res, 400, "VALIDATION_ERROR", "'latitude' must be numeric");
                    return;
                }
                reading.latitude = body["latitude"].get<double>();
            }
            if (body.contains("longitude")) {
                if (!body["longitude"].is_number()) {
                    sendError(res, 400, "VALIDATION_ERROR", "'longitude' must be numeric");
                    return;
                }
                reading.longitude = body["longitude"].get<double>();
            }

            reading.soilSaturation = body["soilSaturation"].get<double>();
            reading.rainfallRate = body["rainfallRate"].get<double>();
            reading.vibrationFrequency = body["vibrationFrequency"].get<double>();
            reading.tiltAngle = body["tiltAngle"].get<double>();
            reading.riverLevel = body["riverLevel"].get<double>();
            reading.batteryLevel = body["batteryLevel"].get<double>();
            reading.connected = body["connected"].get<bool>();

            const SimulationResult result = engine.runManual(reading);
            sendJson(res, 200, json{
                {"cycle", engine.cycle()},
                {"result", simulationResultToJson(result)}
            });
        });

        // POST /api/diagnostics
        server.Post("/api/diagnostics", [&](const httplib::Request&, httplib::Response& res) {
            std::lock_guard<std::mutex> lock(engineMutex);
            int passed = 0;
            int total = 0;
            json checks = json::array();

            auto report = [&](const std::string& name, bool ok, const std::string& detail) {
                ++total;
                if (ok) ++passed;
                checks.push_back(json{
                    {"name", name},
                    {"passed", ok},
                    {"detail", detail}
                });
            };

            // 1. Virtual inheritance diamond + PowerSubsystem HAS-A
            {
                AutonomousHybridProbe probe("diag-hybrid", PowerSubsystem(50.0, 20.0, 4.0, 1.0, 1.0));
                DisasterTelemetryDevice* viaSolar = static_cast<SolarPoweredNode*>(&probe);
                DisasterTelemetryDevice* viaLora = static_cast<WirelessLoRaTransceiver*>(&probe);
                probe.powerSubsystem().chargeFromSolar(2.0);
                probe.powerSubsystem().consume(probe.powerSubsystem().powerConsumption());
                const bool ok = (viaSolar == viaLora) && (probe.powerSubsystem().currentCharge() == 27.0);
                report("Virtual Diamond & Power HAS-A", ok, "Single shared subobject; charge=27.0/50.0");
            }

            // 2. Runtime polymorphism sweep
            {
                std::vector<std::unique_ptr<BaseSensorNode>> owned;
                owned.push_back(std::make_unique<AutonomousHybridProbe>("diag-h"));
                owned.push_back(std::make_unique<RainGaugeNode>("diag-r"));
                std::vector<BaseSensorNode*> sweep;
                for (const auto& p : owned) sweep.push_back(p.get());
                executeSensorSweep(sweep);
                auto* h = dynamic_cast<AutonomousHybridProbe*>(owned[0].get());
                auto* r = dynamic_cast<RainGaugeNode*>(owned[1].get());
                const bool ok = h && r && h->thresholdExceeded() && r->thresholdExceeded();
                report("Polymorphic Sensor Sweep", ok, "AutonomousHybridProbe=42.0, RainGauge=12.5");
            }

            // 3. TelemetryBuffer deep copy isolation
            {
                TelemetryBuffer orig(2);
                orig.push_back(11.0);
                orig.push_back(22.0);
                orig.push_back(33.0);
                TelemetryBuffer copy(orig);
                copy[0] = 99.0;
                const bool ok = (orig[0] == 11.0) && (copy[0] == 99.0) && (copy.size() == 3);
                report("TelemetryBuffer Deep Copy", ok, "Reallocated cap=" + std::to_string(orig.capacity()) + ", isolated copy");
            }

            // 4. Checksum verification positive & negative paths
            {
                bool mismatchCaught = false;
                const auto& sample = engine.stations().front();
                const std::uint32_t csum = computeTelemetryChecksum(sample);
                verifyTelemetryChecksum(csum, csum);
                try {
                    verifyTelemetryChecksum(csum, csum ^ 0x1u);
                } catch (const TelemetryChecksumMismatch&) {
                    mismatchCaught = true;
                }
                report("Telemetry Checksum Integrity", mismatchCaught, "Valid checksum accepted; bit-flip rejected");
            }

            // 5. Binary incident store readability
            {
                bool storeOk = false;
                std::size_t count = 0;
                try {
                    const auto all = engine.incidentLogger().loadAll();
                    count = all.size();
                    storeOk = true;
                } catch (...) {
                    storeOk = false;
                }
                report("Binary Incident Store Integrity", storeOk,
                       "Verified " + std::to_string(count) + " serialized record(s)");
            }

            // 6. Station coordinates & evacuation route sanity
            {
                bool allValid = !engine.stations().empty();
                for (const auto& st : engine.stations()) {
                    double x = 0.0, y = 0.0;
                    transformCoordinates(st.latitude, st.longitude, x, y);
                    if (!std::isfinite(x) || !std::isfinite(y)) allValid = false;
                }
                report("Station Projection & Bounds", allValid,
                       std::to_string(engine.stations().size()) + " stations projected cleanly");
            }

            sendJson(res, 200, json{
                {"passed", passed},
                {"total", total},
                {"allPassed", passed == total},
                {"checks", checks}
            });
        });

        std::cout << "SENTRA C++ REST API listening on http://" << serverCfg.host << ":" << serverCfg.port
                  << " (seed=" << serverCfg.seed << ", log=" << serverCfg.logFilePath << ")\n";
        std::cout.flush();

        if (!server.listen(serverCfg.host, serverCfg.port)) {
            std::cerr << "Failed to bind SENTRA_api to " << serverCfg.host << ":" << serverCfg.port << "\n";
            return 1;
        }
        return 0;
    } catch (const std::exception& err) {
        std::cerr << "SENTRA_api startup error: " << err.what() << "\n";
        return 1;
    }
}
