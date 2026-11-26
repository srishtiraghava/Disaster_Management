# ALF-EWG Viva Preparation Guide (CIC-211 OOP in C++)

This guide contains **42 conceptual and implementation viva questions with answers** followed by **10 code-tracing and numerical problems** directly grounded in the ALF-EWG codebase.

---

## Part I — 42 Viva Questions and Answers

### Unit I — OOP Fundamentals, Functions & Encapsulation

**Q1. What problem does ALF-EWG model and why is it structured in layers?**  
ALF-EWG models an Autonomous Landslide & Flash-Flood Early Warning Grid across five regions. Separating sensor math (`include/sensors/`), domain/persistence (`include/core/`), and terminal presentation (`include/ui/`) keeps business logic independent of console I/O and enables deterministic automated testing.

**Q2. How are namespaces organized in ALF-EWG?**  
Core entities, persistence, and simulation reside in `DisasterCore::Core`; stateless math primitives reside in `DisasterCore::Sensors`; alert severity helpers reside in `DisasterCore::Alerts`; and the terminal control room resides in `DisasterCore::UI`.

**Q3. Why are the functions in `include/sensors/Hazard.hpp` declared `inline`?**  
Because they are small, pure mathematical functions defined directly in a header file included by multiple `.cpp` translation units (`Simulation.cpp`, `Dashboard.cpp`, `main_test.cpp`). `inline` avoids multiple-definition linker errors (ODR violations) while allowing compiler inlining.

**Q4. Give an example of function overloading in ALF-EWG and explain how the compiler resolves it.**  
`DisasterCore::Sensors::computeHazardIndex` in `include/sensors/HazardIndex.hpp` has two overloads: `computeHazardIndex(double rainfallRate, double slopeAngle)` (2 parameters) and `computeHazardIndex(double soilSat, double vibrationFreq, double tiltAngle)` (3 parameters). The compiler resolves the call statically at compile time based on argument count (arity).

**Q5. How does `Telemetry::updateMeasurement` demonstrate call-by-reference?**  
`void updateMeasurement(double& target, double newValue)` takes `target` as a non-const reference (`double&`), updating both the caller's external variable and `rawMeasurement_`, and appending `newValue` to `history_`.

**Q6. Why is `Telemetry::current()` safe when returning `double&`?**  
Because it returns a reference to `rawMeasurement_`, which is a non-static data member whose lifetime matches the owning `Telemetry` object—never a local stack variable.

**Q7. Why does `SimulationEngine` mark accessors like `stations()` and `cycle()` as `const noexcept`?**  
`const` guarantees the method does not modify the object's observable state (enabling calls on `const` references), and `noexcept` tells the compiler and callers that no exceptions will escape, allowing stronger optimization and move guarantees.

**Q8. Why are `SimulationScenario`, `RiskClass`, and `RoadCondition` declared as `enum class` instead of unscoped `enum`?**  
Scoped `enum class` avoids polluting the enclosing namespace with enumerator names and prevents accidental implicit conversions to `int`.

**Q9. How does `SimulationEngine` validate manual telemetry inputs?**  
`SimulationEngine::validateTelemetry()` verifies that `(stationId, region)` matches a configured station, checks every numeric field with `std::isfinite()`, and enforces physical bounds (e.g., soil saturation in `[0, 1]`, rainfall in `[0, 300]`, vibration in `[0, 100]`, tilt in `[0, 90]`, river in `[0, 20]`, battery in `[0, 100]`).

**Q10. Why does `calculateOverallRisk` use `std::max(landslideRisk, floodRisk)` rather than an average?**  
Averaging would dilute a life-threatening hazard in one domain (e.g., `90` landslide and `10` flood averaging to `50`) and delay critical alerts. Taking the maximum ensures severe single-domain hazards retain full priority.

---

### Unit II — Dynamic Memory, Deep Copy, Static & Friend Members, Operators & Containership

**Q11. Why did `TelemetryBuffer` need a custom destructor, copy constructor, and copy assignment operator?**  
Because `TelemetryBuffer` manages a raw heap array (`double* data_`) allocated with `new double[]`. The compiler-generated shallow copy would copy the pointer address, causing double-free crashes and aliased mutations on destruction.

**Q12. How does `TelemetryBuffer::operator=` achieve strong exception safety?**  
Using the **copy-and-swap idiom**: after checking `if (this != &other)`, it constructs a temporary deep copy `TelemetryBuffer temp(other)`, then swaps pointers and sizes via `noexcept` `swap(temp)`. If allocation fails, `*this` remains unmodified.

**Q13. What happens during `TelemetryBuffer` move construction and move assignment?**  
The target steals `other.data_`, `other.size_`, and `other.capacity_`, then sets `other.data_ = nullptr` and zeroes `other.size_` and `other.capacity_` so `~TelemetryBuffer()` on the moved-from object safely executes `delete[] nullptr`.

**Q14. What happens if an invalid index is passed to `TelemetryBuffer::operator[]`?**  
`checkIndex(idx)` detects `idx >= size_` and throws `std::out_of_range("TelemetryBuffer index out of range")`.

**Q15. Explain the purpose of `static` members in `SensorStation` and `EarlyWarningSiren`.**  
`SensorStation::activeCount_` tracks total instantiated `SensorStation` objects across the entire class, and `EarlyWarningSiren::globalAlertLevel_` tracks how many sirens are currently active grid-wide. Both belong to the class rather than any single instance and are initialized once in their respective `.cpp` files.

**Q16. How does `EarlyWarningSiren` prevent `globalAlertLevel_` corruption on repeated `activate()` or `deactivate()` calls?**  
`activate()` only increments `globalAlertLevel_` if `!active_`, and `deactivate()` only decrements if `active_` (and `globalAlertLevel_ > 0`). Thus repeated calls are idempotent.

**Q17. What is `TelemetryAuditor` and why is it a `friend` class of `Telemetry`?**  
`TelemetryAuditor` needs read access to `Telemetry::rawMeasurement_` and `Telemetry::history_` for diagnostics and auditing without exposing mutating setters or breaking `Telemetry`'s encapsulation for general callers.

**Q18. Which operators are overloaded in `RegionalHazard`, `SensorCluster`, and `SensorStation`?**  
`RegionalHazard` overloads relational `>` and stream insertion `<<`. `SensorCluster` overloads binary `+` (cluster concatenation) and `<<`. `SensorStation` overloads `<<` and stream extraction `>>` (setting `std::ios::failbit` if coordinates are invalid).

**Q19. Why are `operator<<` and `operator>>` implemented as non-member `friend` functions rather than member functions?**  
Because the left-hand operand is `std::ostream&` or `std::istream&`, not the user-defined class. A member function would force reversed syntax like `station << std::cout`.

**Q20. How is containership (HAS-A) demonstrated in `SensorNode.hpp` and `SensorCluster.hpp`?**  
Every `BaseSensorNode` owns a `PowerSubsystem power_` member by value (composition/HAS-A), and `SensorCluster` contains a `std::vector<SensorStation>` by value.

**Q21. What is the difference between `PowerSubsystem` composition in `BaseSensorNode` and `IncidentLogger&` in `SimulationEngine`?**  
`BaseSensorNode` owns `PowerSubsystem` by value (their lifetimes are bound together—composition), whereas `SimulationEngine` holds a reference `IncidentLogger&` to an externally owned logger (aggregation/association) so logs persist independently across engine restarts.

---

### Unit III — Inheritance, Virtual Base Classes & Runtime Polymorphism

**Q22. What makes `BaseSensorNode` an abstract class?**  
It declares two pure virtual functions: `virtual void readTelemetry() = 0;` and `virtual void evaluateThreshold() = 0;`. It cannot be instantiated directly.

**Q23. Why must `BaseSensorNode` have a `virtual` destructor?**  
When a derived object (`RainGaugeNode` or `TrackedRainGauge`) is deleted through a `std::unique_ptr<BaseSensorNode>` or `BaseSensorNode*`, a non-virtual destructor causes undefined behavior and skips the derived class's destructor. Making `~BaseSensorNode()` `virtual` ensures full dynamic cleanup.

**Q24. Explain the diamond problem in `SensorNode.hpp` and how ALF-EWG solves it.**  
`AutonomousHybridProbe` inherits from both `SolarPoweredNode` and `WirelessLoRaTransceiver`, both of which derive from `DisasterTelemetryDevice`. Without `virtual` inheritance, `AutonomousHybridProbe` would contain two duplicate `DisasterTelemetryDevice` (and `BaseSensorNode`) subobjects, causing ambiguous calls to `id()` and `measurement()`. Using `virtual public DisasterTelemetryDevice` merges them into a single shared base subobject.

**Q25. In virtual inheritance, which class is responsible for constructing the virtual base `DisasterTelemetryDevice`?**  
The most-derived concrete class (`AutonomousHybridProbe`, or `LandslideStationProbe` when further derived—Wait: `AutonomousHybridProbe`'s constructor explicitly initializes `DisasterTelemetryDevice(id, power)`, and if a derived class does not explicitly call the virtual base constructor, the virtual base's default constructor is used). Note that intermediate `SolarPoweredNode` / `WirelessLoRaTransceiver` initializer calls to `DisasterTelemetryDevice` are ignored when constructing `AutonomousHybridProbe`.

**Q26. How does `executeSensorSweep()` achieve runtime polymorphism?**  
It accepts `const std::vector<BaseSensorNode*>&` and invokes `node->readTelemetry()` and `node->evaluateThreshold()`. At runtime, vtable dispatch routes each call to the concrete override (`LandslideStationProbe`, `FloodStationProbe`, `AutonomousHybridProbe`, or `RainGaugeNode`).

**Q27. Why does `SimulationEngine::evaluate()` pass non-owning `BaseSensorNode*` pointers to `executeSensorSweep()`?**  
The probes live on the stack (or in `std::unique_ptr` in tests), while `executeSensorSweep()` only observes them for the duration of the sweep without taking ownership.

**Q28. When is `dynamic_cast` used in ALF-EWG?**  
In `runFullSystemDiagnostic()` and `testRuntimePolymorphism()`, `dynamic_cast<AutonomousHybridProbe*>(node)` safely downcasts a `BaseSensorNode*` to inspect probe-specific `measurement()` and `thresholdExceeded()` accessors.

---

### Unit IV — Exceptions, Binary Files, Templates & STL

**Q29. Name the three custom exception classes in `include/core/Exceptions.hpp` and their base class.**  
`SensorFailureException`, `TelemetryChecksumMismatch`, and `ThresholdOverflowException`, all publicly inheriting `std::exception` and overriding `what() const noexcept`.

**Q30. Why does `what()` return `const char*` and carry `noexcept`?**  
It matches `std::exception::what()`'s signature and guarantees that inspecting an error message during stack unwinding will never throw a secondary exception (`std::terminate`).

**Q31. Why does `IncidentLogger` write fixed-width 433-byte records instead of variable-length text?**  
Fixed record sizes make record $i$'s byte offset deterministic ($\text{offset} = i \times 433$), enabling constant-time `seekg(offset)` / `seekp(offset)` in-place updates and immediate file-integrity verification (`fileSize % 433 == 0`).

**Q32. How do `seekg()` and `seekp()` differ in `IncidentLogger.cpp`?**  
`seekg()` moves the **get** (input/read) pointer used by `file.read()` and `tellg()`. `seekp()` moves the **put** (output/write) pointer used by `file.write()`. Both are needed in `updateById()` on a bidirectional `std::fstream` opened with `ios::binary | ios::in | ios::out`.

**Q33. How does `IncidentLogger::updateById()` guarantee rollback on failure?**  
Before overwriting the matched slot at `position`, it keeps `IncidentRecord previous` in memory. If writing or the optional `afterWrite()` hook throws, the `catch (...)` block clears stream error flags (`file.clear()`), seeks back to `position` with `seekp()`, writes `previous`, flushes, and rethrows the original exception.

**Q34. What happens if `alf_ewg_incidents.bin` is truncated or has extra stray bytes?**  
`loadAll()` computes `length % recordBytes` using `seekg(0, std::ios::end)` and `tellg()`. Because `length % 433 != 0`, it immediately throws `SensorFailureException` instead of silently parsing corrupted records.

**Q35. How does `SimulationEngine::saveImportantIncident()` prevent duplicate IDs after an application restart?**  
Even if a restarted process uses the same random seed and starts at `cycle_ = 1`, it queries `incidentLogger_.searchById()` in a loop and appends `-1`, `-2`, ... until a unique `incidentId` is found.

**Q36. What is `EvacuationPriority` and why is it called a functor?**  
`EvacuationPriority` is a struct overloading `bool operator()(const EvacuationRoute&, const EvacuationRoute&) const noexcept`. Because instances can be invoked like functions and passed directly to `std::sort()`, it is a function object (functor).

**Q37. Explain how `PriorityQueue<T>` works internally.**  
It is a class template wrapping `std::vector<T>` and using `<algorithm>` heap primitives: `std::push_heap` on `push()`, `values_.front()` on `top()`, and `std::pop_heap` + `pop_back()` on `pop()`, throwing `std::out_of_range` if empty.

**Q38. What is `emergencyAlertHeader`?**  
A custom output stream manipulator (`std::ostream& emergencyAlertHeader(std::ostream& out)`) that prints `"INCIDENT\tREGION\tTYPE\tRISK\tSIREN\n"` when inserted into `std::cout << emergencyAlertHeader`.

**Q39. Why does `IncidentLogger::searchById()` return `std::optional<IncidentRecord>`?**  
Because searching for an ID may legitimately find nothing. Returning `std::optional` makes absence explicit in the type system without requiring sentinel values or throwing exceptions for normal "not found" lookups.

**Q40. How does `ControlRoomDashboard` support terminals without ANSI color escape codes?**  
`detectAnsiSupport()` honors `--no-color` and `NO_COLOR`, verifies stdout is a TTY (`_isatty` / `isatty`), enables `ENABLE_VIRTUAL_TERMINAL_PROCESSING` on Windows only when supported, and falls back to plain ASCII text badges (`[HIGH]`, `[ACTIVE]`, `[OFF]`) and ASCII tables.

**Q41. How does `SimulationEngine::updateSiren()` avoid flooding `alertHistory_` during prolonged disasters?**  
It maintains `std::map<std::string, RiskClass> activeAlertLevels_`. When a region stays active at the same `RiskClass`, no duplicate event is emitted; events are only appended on activation, deactivation, or classification escalation/change (`HIGH <-> CRITICAL`).

**Q42. How does `ControlRoomDashboard` avoid `std::cin` stream lockups on bad user input?**  
It reads whole lines via `std::getline()` and parses numbers strictly via `std::istringstream` (checking for trailing characters and `std::isfinite()`), allowing clean re-prompting and graceful EOF exit.

---

## Part II — 10 Code-Tracing and Numerical Questions

### Problem 1 — Landslide Risk Calculation (Numerical)

Given `StationTelemetry` with `soilSaturation = 0.5`, `rainfallRate = 0.0`, `vibrationFrequency = 0.0`, `tiltAngle = 15.0`, `riverLevel = 0.0`:
Calculate `SimulationEngine::calculateLandslideRisk(t)`.

**Solution:**
- `soil = soilSaturation(0.5, 1.0) * 40.0 = 0.5 * 40.0 = 20.0`
- `rain = rainfallSeverity(0.0) * 25.0 = (1 - e^0) * 25.0 = 0.0`
- `vibration = 0.0` (since `log1p(0) = 0`)
- `tilt = clamp(15.0 / 30.0, 0.0, 1.0) * 15.0 = 0.5 * 15.0 = 7.5`
- Total `LandslideRisk = 20.0 + 0.0 + 0.0 + 7.5 = 27.5 / 100` (`RiskClass::Moderate`).

---

### Problem 2 — Flood Risk, Overall Risk & Siren Activation (Numerical)

Using `rainfallRate = 10.0` mm/h and `riverLevel = 5.0` m, with `landslideRisk = 42.0`:
1. Find `FloodRisk` (to 2 decimal places).
2. Find `OverallRisk`, `RiskClass`, and whether the regional siren activates.

**Solution:**
- `floodSeverity(5.0) = tanh(5.0 / 5.0) = tanh(1.0) ≈ 0.76159` -> `river = 0.76159 * 75.0 ≈ 57.12`
- `rainfallSeverity(10.0) = 1 - e^{-1} ≈ 0.63212` -> `rain = 0.63212 * 25.0 ≈ 15.80`
- `FloodRisk = 57.12 + 15.80 = 72.92 / 100`
- `OverallRisk = max(42.0, 72.92) = 72.92` -> `RiskClass::High` (`[50.0, 75.0)`).
- Since `OverallRisk >= 50.0`, the regional siren **activates** and the incident is logged.

---

### Problem 3 — Overloaded `computeHazardIndex` Dispatch & Value (Code Tracing + Numerical)

```cpp
double a = DisasterCore::Sensors::computeHazardIndex(0.0, 45.0);
double b = DisasterCore::Sensors::computeHazardIndex(0.5, 0.0, 60.0);
```
Which overload is called for `a` and `b`, and what are their exact return values?

**Solution:**
- `a` calls `computeHazardIndex(double rainfallRate, double slopeAngle)`. Since `rainfallSeverity(0.0) = 0.0`, `a = 0.0 * sin(45°) = 0.0`.
- `b` calls `computeHazardIndex(double soilSat, double vibrationFreq, double tiltAngle)`. Since `vibrationSeverity(0.0) = log1p(0.0) = 0.0`, `b = clamp(0.5 * 0.0 * cos(60°), 0.0, 1.0) = 0.0`.

---

### Problem 4 — Deep Copy vs Move Semantics in `TelemetryBuffer` (Code Tracing)

Trace `a.size()`, `b.size()`, `a[0]`, and `b[0]` after executing:
```cpp
TelemetryBuffer a(2);
a.push_back(5.0);
a.push_back(10.0);
TelemetryBuffer b(a);
b[0] = 99.0;
TelemetryBuffer c(std::move(a));
```

**Solution:**
- After `push_back`: `a` has `[5.0, 10.0]`, `a.size() == 2`.
- `b(a)` performs a **deep copy**: `b` gets its own buffer `[5.0, 10.0]`. Setting `b[0] = 99.0` leaves `a[0] == 5.0`.
- `c(std::move(a))` **moves** `a`'s buffer into `c`, resetting `a` to empty (`a.size() == 0`, `a.capacity() == 0`, `a.data_ == nullptr`).
- Final state: `a.size() == 0`, `b.size() == 2`, `b[0] == 99.0`, `c.size() == 2`, `c[0] == 5.0`.

---

### Problem 5 — Virtual Inheritance Pointer Identity (Code Tracing)

```cpp
AutonomousHybridProbe probe("H1");
DisasterTelemetryDevice* p1 = static_cast<SolarPoweredNode*>(&probe);
DisasterTelemetryDevice* p2 = static_cast<WirelessLoRaTransceiver*>(&probe);
```
What is the boolean value of `(p1 == p2)` and why? What would happen if `virtual` were removed?

**Solution:**
- `(p1 == p2)` evaluates to **`true`**. Because both `SolarPoweredNode` and `WirelessLoRaTransceiver` virtually inherit `DisasterTelemetryDevice`, `probe` contains only one shared `DisasterTelemetryDevice` subobject, so both casts resolve to the identical subobject address.
- If `virtual` were removed, `probe` would have two distinct `DisasterTelemetryDevice` subobjects, making `static_cast<DisasterTelemetryDevice*>(&probe)` ambiguous and `(p1 == p2)` **`false`**.

---

### Problem 6 — Static `globalAlertLevel_` Tracking (Code Tracing)

Assume `EarlyWarningSiren::globalAlertLevel()` starts at `0`. Trace its value after each line:
```cpp
EarlyWarningSiren s1("S1", 30.0, 78.0);
EarlyWarningSiren s2("S2", 30.5, 79.0);
s1.activate();
s1.activate();
s2.activate();
s1.deactivate();
s2.deactivate();
s2.deactivate();
```

**Solution:**
1. Construction (`s1`, `s2`): both inactive -> `0`
2. `s1.activate()`: `s1` transitions false->true -> `1`
3. `s1.activate()`: already active (ignored) -> `1`
4. `s2.activate()`: `s2` transitions false->true -> `2`
5. `s1.deactivate()`: `s1` transitions true->false -> `1`
6. `s2.deactivate()`: `s2` transitions true->false -> `0`
7. `s2.deactivate()`: already inactive (ignored) -> `0`

---

### Problem 7 — Binary Record Byte Offset Calculation (Numerical)

In `IncidentLogger`, `recordBytes = 433`. Suppose 4 records (`INC-0`, `INC-1`, `INC-2`, `INC-3`) are saved in `alf_ewg_incidents.bin`.
1. What is the total file size in bytes?
2. At what byte offset does `updateById("INC-2", ...)` call `file.seekp(position, std::ios::beg)`?

**Solution:**
1. Total file size = $4 \times 433 = 1732$ bytes.
2. `"INC-2"` is at zero-based index $2$, so `position = 2 * 433 = 866` bytes.

---

### Problem 8 — `updateById()` Rollback Behavior (Code Tracing)

Suppose `"REC-1"` has `region = "Uttarkashi"`. Trace what is stored on disk after:
```cpp
IncidentRecord next = *logger.searchById("REC-1");
next.region = "Chamoli";
try {
    logger.updateById("REC-1", next, [] { throw std::runtime_error("disk verify failed"); });
} catch (const std::exception&) {}
```

**Solution:**
1. `updateById` reads `previous` (`region = "Uttarkashi"`).
2. `seekp` moves to `REC-1`'s offset and writes `next` (`region = "Chamoli"`).
3. `afterWrite()` throws `std::runtime_error`.
4. `catch (...)` clears stream state, seeks back to `position`, re-writes `previous` (`region = "Uttarkashi"`), flushes, and rethrows.
5. The outer `catch` catches it. On disk, `"REC-1"` still has **`region = "Uttarkashi"`**.

---

### Problem 9 — Evacuation Route Ranking & Cutoff (Numerical)

Suppose station `"Uttarkashi"` has `landslideRisk = 60.0`, `floodRisk = 20.0`, and three routes:
- `R-A`: `Good`, `distanceKm = 12.0`, base risks `(12.0, 9.0)`, `available = true`
- `R-B`: `Slippery`, `distanceKm = 7.5`, base risks `(24.0, 18.0)`, `available = true`
- `R-C`: `Blocked`, `distanceKm = 5.0`, base risks `(8.0, 10.0)`, `available = false`

Which routes are returned by `evaluateRoutesForRegion("Uttarkashi")`, and in what order with what priority scores?

**Solution:**
- `R-C` is immediately excluded (`!available` and `Blocked`).
- `R-A` (`Good`):
  - `adjLand = max(12.0, 0.45 * 60.0) = 27.0`, `adjFlood = max(9.0, 0.45 * 20.0) = 9.0`, `routeRisk = 27.0 < 75.0`
  - `roadPenalty = 0.0`
  - `score = lround(1000 - 270 - 0 - 1.2) = 729`
- `R-B` (`Slippery`):
  - `adjLand = max(24.0, 27.0) + 5.0 = 32.0`, `adjFlood = 18.0`, `routeRisk = 32.0 < 75.0`
  - `roadPenalty = 5.0`
  - `score = lround(1000 - 320 - 50 - 0.75) = 629`
- Returned order: **`[R-A (729), R-B (629)]`**.

---

### Problem 10 — Planar Coordinate Projection (`transformCoordinates`) (Numerical)

Compute `(xOut, yOut)` in kilometres for `latitudeDeg = 0.0`, `longitudeDeg = 90.0` using Earth radius `R = 6371.0` km.

**Solution:**
- `latRad = 0.0`, `lonRad = 90.0 * pi / 180.0 = pi / 2`
- `xOut = 6371.0 * (pi / 2) * cos(0.0) = 6371.0 * 1.5707963... ≈ 10007.54 km` (one quarter of Earth's equatorial circumference)
- `yOut = 6371.0 * 0.0 = 0.0 km`
