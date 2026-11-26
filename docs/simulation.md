# ALF-EWG simulation engine

The executable provides a reproducible demonstration simulator. All readings,
alerts, incident timestamps, and route recommendations are simulated and are not
connected to field equipment or emergency services.

## Stations and scenarios

The engine models five stations: Uttarkashi, Chamoli, Rudraprayag, Joshimath, and
Pithoragarh. Each includes coordinates, soil saturation, rainfall, vibration,
tilt, river level, battery percentage, and connectivity status. `SimulationConfig`
contains the random seed, sensor-noise amount, battery warning threshold, and
scenario ranges/increments. Use the same configuration and scenario sequence to
reproduce the generated telemetry.

The menu offers normal, heavy rainfall, increasing soil saturation, abnormal
seismic vibration, rapid river rise, combined threat, and manual telemetry.
Manual input is checked for finite values, valid coordinate ranges, and sensor
limits before it enters the hazard engine.

## Risk and alerts

Landslide risk uses soil saturation, rainfall, vibration, and tilt. Flood risk
uses river level and rainfall. Each is reported from 0 to 100. Overall risk is
the greater of the two independent indices, so a severe threat in either domain
cannot be hidden by averaging. Class boundaries are LOW 0–24, MODERATE 25–49,
HIGH 50–74, and CRITICAL 75–100.

Each region has an associated siren. HIGH and CRITICAL risks activate it;
falling below HIGH deactivates it. The engine stores state transitions and
changes between HIGH and CRITICAL in alert history, suppressing repeated events
while the regional alert state is unchanged. Incidents at HIGH or CRITICAL risk
and critical-battery incidents are written through `IncidentLogger`.

Available, unblocked routes below CRITICAL route risk are ranked with the
Unit IV evacuation priority functor. Risk and road condition take precedence
over distance. If no route meets the safe-route rule, the output says so.

## Run

Configure and build with CMake, then run `ALF_EWG` from a terminal to use the
menu. The default seed is 211. Change `SimulationConfig` in `src/main.cpp` to
use another seed or scenario profile. Incidents are stored in
`alf_ewg_incidents.bin` in the current working directory.
