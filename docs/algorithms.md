# ALF-EWG Algorithms & Mathematical Models

## 1. Sensor Normalization Primitives (`include/sensors/Hazard.hpp`)

All raw physical inputs are validated for domain bounds before normalization:

1. **Soil Saturation** (`soilSaturation(waterContent, porosity)`):
   $$S = \operatorname{clamp}\!\left(\frac{\text{waterContent}}{\text{porosity}},\, 0.0,\, 1.0\right), \quad \text{porosity} > 0$$

2. **Rainfall Severity** (`rainfallSeverity(rainfallRate)`):
   $$R_{\text{sev}} = 1 - e^{-r / 10.0}, \quad r \ge 0 \text{ (mm/h)}$$
   At $r = 10\text{ mm/h}$, $R_{\text{sev}} \approx 0.6321$; as $r \to \infty$, $R_{\text{sev}} \to 1.0$.

3. **Vibration Severity** (`vibrationSeverity(frequency)`):
   $$V_{\text{sev}} = \ln(1 + f), \quad f \ge 0 \text{ (Hz)}$$

4. **Flood Severity** (`floodSeverity(waterLevel)`):
   $$F_{\text{sev}} = \tanh\!\left(\frac{h}{5.0}\right), \quad h \ge 0 \text{ (metres)}$$

5. **Combined Weighted Hazard** (`combinedHazard(rainSev, soilSat, vibSev, floodSev)`):
   $$H_{\text{comb}} = \operatorname{clamp}(0.30 R_{\text{sev}} + 0.30 S + 0.20 V_{\text{sev}} + 0.20 F_{\text{sev}},\, 0.0,\, 1.0)$$

---

## 2. Overloaded Hazard Indices (`include/sensors/HazardIndex.hpp`)

1. **Rainfall + Slope Overload** (`computeHazardIndex(rainfallRate, slopeAngle)`):
   $$I_1 = \operatorname{clamp}\!\left(\left(1 - e^{-r/10}\right) \sin\!\left(\frac{\theta \pi}{180}\right),\, 0.0,\, 1.0\right), \quad \theta \in [0^\circ, 90^\circ]$$

2. **Soil + Vibration + Tilt Overload** (`computeHazardIndex(soilSat, vibrationFreq, tiltAngle)`):
   $$I_2 = \operatorname{clamp}\!\left(S \cdot \ln(1 + f) \cdot \cos\!\left(\frac{\alpha \pi}{180}\right),\, 0.0,\, 1.0\right), \quad S \in [0, 1],\; \alpha \in [0^\circ, 90^\circ]$$

---

## 3. Simulation Engine Risk Scoring (`src/core/Simulation.cpp`)

### 3.1 Landslide Risk (`calculateLandslideRisk`, $0\text{–}100$)

$$\text{LandslideRisk} = \operatorname{clamp}\!\left(40 \cdot S + 25 \cdot R_{\text{sev}} + 20 \cdot \operatorname{clamp}\!\left(\frac{\ln(1+f)}{\ln(41)},\, 0,\, 1\right) + 15 \cdot \operatorname{clamp}\!\left(\frac{\alpha}{30.0},\, 0,\, 1\right),\, 0.0,\, 100.0\right)$$

Weights reflect physical geotechnical coupling: soil moisture ($40\%$), rainfall infiltration ($25\%$), seismic vibration normalized against a $40\text{ Hz}$ reference ($20\%$), and slope tilt normalized against $30^\circ$ ($15\%$).

### 3.2 Flood Risk (`calculateFloodRisk`, $0\text{–}100$)

$$\text{FloodRisk} = \operatorname{clamp}\!\left(75 \cdot \tanh\!\left(\frac{h}{5.0}\right) + 25 \cdot R_{\text{sev}},\, 0.0,\, 100.0\right)$$

### 3.3 Overall Risk & Classification (`calculateOverallRisk`, `classifyRisk`)

$$\text{OverallRisk} = \max(\text{LandslideRisk},\, \text{FloodRisk})$$

Using `max` instead of an arithmetic mean guarantees that an extreme single-domain hazard (for example, $90$ landslide and $10$ flood) is never diluted to a moderate alert.

| Overall Risk Range | `RiskClass` | `Alerts::Level` | Siren Behavior |
|---|---|---|---|
| $[0.0, 25.0)$ | `LOW` | `Info` | Deactivated / Standby |
| $[25.0, 50.0)$ | `MODERATE` | `Info` | Deactivated / Standby |
| $[50.0, 75.0)$ | `HIGH` | `Warning` | Activated |
| $[75.0, 100.0]$ | `CRITICAL` | `Critical` | Activated |
| Outside $[0, 100]$ or non-finite | Throws `ThresholdOverflowException` | — | — |

---

## 4. Geographic Projection & Regional Accumulation (`include/core/Telemetry.hpp`)

- **Equirectangular Projection** (`transformCoordinates(latDeg, lonDeg, xOut, yOut)`):
  With Earth radius $R = 6371.0\text{ km}$:
  $$x = R \cdot \lambda_{\text{rad}} \cdot \cos(\phi_{\text{rad}}), \qquad y = R \cdot \phi_{\text{rad}}$$
- **Regional Accumulation** (`accumulateRegionalRisk(hazardIndices)`):
  Validates each $h_i \in [0, 1]$ and returns $\operatorname{clamp}\!\left(\frac{1}{N}\sum_{i=1}^N h_i,\, 0.0,\, 1.0\right)$ (or $0.0$ if empty).

---

## 5. Evacuation Route Prioritization (`src/core/Simulation.cpp`, `include/core/IncidentLogger.hpp`)

For each route $r$ starting in the target region:
1. **Hard Exclusion**: Discard if `!r.available` or `r.roadCondition == RoadCondition::Blocked`.
2. **Dynamic Hazard Adjustment**:
   - $r.\text{landslideRisk} \leftarrow \max(r.\text{landslideRisk},\, 0.45 \cdot \text{stationLandslide})$
   - $r.\text{floodRisk} \leftarrow \max(r.\text{floodRisk},\, 0.45 \cdot \text{stationFlood})$
   - Road condition surcharge: `Slippery` adds $+5.0$ landslide risk; `Damaged` adds $+10.0$ landslide and $+5.0$ flood risk.
3. **Safety Cutoff**: Discard if $\max(r.\text{landslideRisk},\, r.\text{floodRisk}) \ge 75.0$.
4. **Priority Score** (higher is safer/better):
   $$\text{roadPenalty} = \begin{cases}0 & \text{Good}\\ 5 & \text{Slippery}\\ 15 & \text{Damaged}\end{cases}$$
   $$\text{score} = \operatorname{clamp}\!\left(\operatorname{lround}(1000.0 - \text{routeRisk}\cdot 10.0 - \text{roadPenalty}\cdot 10.0 - \text{distanceKm}\cdot 0.1),\, 0,\, 1000\right)$$
5. **Sorting (`EvacuationPriority`)**: Orders descending by `priority` and breaks ties lexicographically by `name` ($O(K \log K)$ for $K$ candidate routes per region).

---

## 6. Binary Serialization, Random Access & Rollback (`src/core/IncidentLogger.cpp`)

Each `IncidentRecord` occupies an exact fixed-size **457-byte** binary frame:

| Field | Binary Width | Type |
|---|---|---|
| `incidentId` | 48 bytes | Null-padded fixed char array |
| `timestamp` | 40 bytes | Null-padded fixed char array |
| `stationId` | 48 bytes | Null-padded fixed char array |
| `region` | 64 bytes | Null-padded fixed char array |
| `incidentType` | 48 bytes | Null-padded fixed char array |
| `landslideRisk` | 8 bytes | IEEE-754 `double` ($[0, 1]$) |
| `floodRisk` | 8 bytes | IEEE-754 `double` ($[0, 1]$) |
| `overallRisk` | 8 bytes | IEEE-754 `double` ($[0, 1]$) |
| `sirenActivated` | 1 byte | `std::uint8_t` ($0$ or $1$) |
| `evacuationRoute` | 160 bytes | Null-padded fixed char array |
| **Total (`recordBytes`)** | **433 bytes** | Verified: $48+40+48+64+48 + 3\times 8 + 1 + 160 = 433$ bytes |

Wait — let's check the arithmetic explicitly:
$48 + 40 + 48 + 64 + 48 = 248$ text header bytes; $3 \times 8 = 24$ double bytes; $1$ byte flag; $+ 160$ route bytes $= 433$ bytes!
- **Append (`save`)**: Checks uniqueness via `searchById()`, positions write pointer via `file.seekp(0, std::ios::end)`, writes 433 bytes, and flushes.
- **Load (`loadAll`)**: Uses `file.seekg(0, std::ios::end)` and `file.tellg()` to verify `length % 433 == 0` (throwing `SensorFailureException` on truncation/corruption), then seeks to `0` and reads `length / 433` records in $O(N)$ time.
- **In-Place Update & Rollback (`updateById`)**: Scans slot offsets $\text{pos} = i \times 433$ using `seekg(pos, std::ios::beg)`. When the target ID matches:
  1. Preserves `previous` in memory.
  2. Seeks output pointer with `file.seekp(pos, std::ios::beg)` and writes `replacement`.
  3. Invokes optional `afterWrite()` validation hook.
  4. If any exception occurs after writing, clears stream flags, calls `file.seekp(pos, std::ios::beg)`, writes `previous` back to disk, flushes, and rethrows the original exception.
