# Changelog

## 1.3A — Repository Consolidation

Repository-health build. No intended gameplay changes.

- Declared `js/` as the single canonical runtime source tree.
- Removed obsolete historical gameplay copies from repository root.
- Removed obsolete gameplay/source copies from `data/`; `data/` now contains static game data only.
- Added `ARCHITECTURE.md` documenting runtime flow, ownership boundaries, and cleanup rules.
- Updated the README to describe the actual 1.2H runtime and current systems.
- Added baseline editor and ignore configuration for future tooling work.
- Deliberately left runtime module cache-version cleanup for the next isolated stabilization build so it can be verified separately.

## 1.2H — Reactive Fire, Engagement Momentum & Medical Recovery

- Current browser runtime represented by `index.html` and `js/main.js`.
- Extended tactical combat behavior, engagement handling, and medical recovery on top of the 1.2E foundations.
- Added later presentation work including relay visuals.

## 1.2E — Fire Teams, Suppression & Movement Authority

- Added stable fire-team roles with dedicated base-of-fire and maneuver assignments.
- Added sustained suppressive bursts against occupied cover and last-known threat sectors.
- Maneuver elements now wait for active covering fire before longer flank and push movements.
- Added retained combat targets and reliable clear-shot reaction windows.
- Stabilized primary-threat and squad-plan selection to reduce wandering between competing fronts.
- Added movement reversal damping and post-arrival dead zones to reduce high-frequency jitter.
- Operators in useful cover require a stronger reason to leave it.
- Fixed wounded arm poses incorrectly hiding weapons; ordinary wounded and serious operators keep visible weapons.
- Fixed support-team casualty scoring and expanded incoming-fire timestamps for suppression and triage decisions.

## 0.5A.0 — Care Under Pressure

- Added the first authored incident: Ada injured beside the maintenance truck.
- Added actor conditions, needs, assessment, stabilization, recovery, and gentle deterioration.
- Made bandages and water usable on a nearby actor while held.
- Added assisted movement from the truck to the break table.
- Made the radio battery installable in the field-radio cradle.
- Added incident outcome tracking and world-state reactions.
- Added injury posture, blood evidence, objective updates, event hooks, and debug readouts.
