#pragma once

namespace DisasterCore {
namespace Alerts {

    enum class Level {
        Info,
        Warning,
        Critical
    };

    inline const char* levelName(Level level) noexcept {
        switch (level) {
            case Level::Info: return "INFO";
            case Level::Warning: return "WARNING";
            case Level::Critical: return "CRITICAL";
        }
        return "UNKNOWN";
    }

    inline Level fromOverallRisk(double overallRisk) noexcept {
        if (overallRisk >= 75.0) return Level::Critical;
        if (overallRisk >= 50.0) return Level::Warning;
        return Level::Info;
    }

} // namespace Alerts
} // namespace DisasterCore
