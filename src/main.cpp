#include "../include/core/Exceptions.hpp"
#include "../include/core/IncidentLogger.hpp"
#include "../include/core/Simulation.hpp"
#include "../include/ui/Dashboard.hpp"

#include <cstdlib>
#include <iostream>
#include <limits>
#include <string>

namespace {

void printUsage(const char* programName) {
    std::cout << "Usage: " << programName << " [options]\n"
              << "Options:\n"
              << "  --no-color          Disable ANSI terminal colors\n"
              << "  --color             Force ANSI terminal colors\n"
              << "  --seed <number>     Set deterministic simulation seed (default: 211)\n"
              << "  --log-file <path>   Set binary incident log file (default: alf_ewg_incidents.bin)\n"
              << "  -h, --help          Show this help message and exit\n";
}

} // namespace

int main(int argc, char* argv[]) {
    using namespace DisasterCore::Core;
    using namespace DisasterCore::UI;

    ColorMode colorMode = ColorMode::Auto;
    SimulationConfig config;
    config.randomSeed = 211;
    std::string logFilePath = "alf_ewg_incidents.bin";

    for (int i = 1; i < argc; ++i) {
        const std::string arg = argv[i];
        if (arg == "--no-color") {
            colorMode = ColorMode::Never;
        } else if (arg == "--color") {
            colorMode = ColorMode::Always;
        } else if (arg == "-h" || arg == "--help") {
            printUsage(argv[0]);
            return 0;
        } else if (arg == "--seed" && i + 1 < argc) {
            try {
                const unsigned long parsed = std::stoul(argv[++i]);
                if (parsed > std::numeric_limits<std::uint32_t>::max()) {
                    std::cerr << "Seed out of 32-bit unsigned range.\n";
                    return 2;
                }
                config.randomSeed = static_cast<std::uint32_t>(parsed);
            } catch (const std::exception&) {
                std::cerr << "Invalid --seed value.\n";
                return 2;
            }
        } else if (arg == "--log-file" && i + 1 < argc) {
            logFilePath = argv[++i];
        } else {
            std::cerr << "Unknown or incomplete argument: " << arg << "\n";
            printUsage(argv[0]);
            return 2;
        }
    }

    try {
        IncidentLogger incidentLogger(logFilePath);
        SimulationEngine simulation(incidentLogger, config);
        ControlRoomDashboard dashboard(simulation, std::cin, std::cout, colorMode);
        return dashboard.run();
    } catch (const SensorFailureException& error) {
        std::cerr << "Persistence or sensor failure: " << error.what() << '\n';
    } catch (const TelemetryChecksumMismatch& error) {
        std::cerr << "Telemetry integrity failure: " << error.what() << '\n';
    } catch (const ThresholdOverflowException& error) {
        std::cerr << "Risk calculation failure: " << error.what() << '\n';
    } catch (const std::exception& error) {
        std::cerr << "Application error: " << error.what() << '\n';
    }
    return 1;
}
