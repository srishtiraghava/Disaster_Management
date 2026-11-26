#include <iostream>
#include <memory>
#include <vector>
#include "../include/core/SensorNode.hpp"
#include "../include/core/Exceptions.hpp"

int main() {
    using namespace DisasterCore::Core;
    try {
        std::vector<std::unique_ptr<BaseSensorNode>> ownedNodes;
        ownedNodes.push_back(std::make_unique<AutonomousHybridProbe>("hybrid-01"));
        ownedNodes.push_back(std::make_unique<RainGaugeNode>("rain-01"));
        std::vector<BaseSensorNode*> sweep;
        for (const auto& node : ownedNodes) sweep.push_back(node.get());
        executeSensorSweep(sweep);
        std::cout << "ALF_EWG sensor sweep complete for " << sweep.size() << " nodes." << std::endl;
        return 0;
    } catch (const SensorFailureException& error) {
        std::cerr << "Sensor subsystem failure: " << error.what() << std::endl;
    } catch (const TelemetryChecksumMismatch& error) {
        std::cerr << "Telemetry rejected: " << error.what() << std::endl;
    } catch (const ThresholdOverflowException& error) {
        std::cerr << "Risk evaluation failure: " << error.what() << std::endl;
    } catch (const std::exception& error) {
        std::cerr << "ALF_EWG failure: " << error.what() << std::endl;
    }
    return 1;
}
