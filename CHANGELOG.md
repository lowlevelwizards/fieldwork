# Fieldwork 2.0A

## Causal Architecture Foundation

- Preserved the 1.2H combat AI as the default legacy research runtime.
- Added a title-screen selector for Legacy 1.2H and AI V2 Foundation.
- Added an intentionally non-tactical AI V2 observer runtime so the new architecture can be built in parallel without importing legacy tactical authorities.
- Added read-only world snapshots, a persistent action lifecycle, explicit action channels, an action scheduler, bounded decision logging, and invariant monitoring.
- Added architecture documents for Fieldwork purpose, causal grammar, layer contracts, state ownership, runtime order, and the first damaged-relay vertical slice.
- Added legacy-runtime documentation identifying the active files, proven mechanics, and authority overlaps.
- Updated build identity and README for the 2.0A foundation.

# Fieldwork 1.2E

## Fire Teams, Suppression & Movement Authority

- Added stable fire-team roles with dedicated base-of-fire and maneuver assignments.
- Added sustained suppressive bursts against occupied cover and last-known threat sectors.
- Maneuver elements now wait for active covering fire before longer flank and push movements.
- Added retained combat targets and reliable clear-shot reaction windows.
- Stabilized primary-threat and squad-plan selection to reduce wandering between competing fronts.
- Added movement reversal damping and post-arrival dead zones to reduce high-frequency jitter.
- Operators in useful cover require a stronger reason to leave it.
- Fixed wounded arm poses incorrectly hiding weapons; ordinary wounded and serious operators keep visible weapons.
- Fixed support-team casualty scoring and expanded incoming-fire timestamps for suppression and triage decisions.

# Changelog

## 0.5A.0 — Care Under Pressure

- Added the first authored incident: Ada injured beside the maintenance truck.
- Added actor conditions, needs, assessment, stabilization, recovery, and gentle deterioration.
- Made bandages and water usable on a nearby actor while held.
- Added assisted movement from the truck to the break table.
- Made the radio battery installable in the field-radio cradle.
- Added incident outcome tracking and world-state reactions.
- Added injury posture, blood evidence, objective updates, event hooks, and debug readouts.
