# Fieldwork 2.0F

## Response Evaluation & Decision Ledger

- Added a team decision ledger that keeps mission value, preservation, information certainty, position, concealment, time pressure, resource cost, and exit options distinct.
- Added seven readable nonviolent response options: Continue Observation, Heighten Watch, Maintain Concealment, Wait, Warn, Reroute, and Withdraw.
- Added response evaluation with named scoring contributions, authored mission biases, and readable winning explanations.
- Added persistent team response state with minimum hold time, scheduled reassessment, switch margins, and evidence-based invalidation.
- Northline now selects Heighten Watch while the Commune independently selects Maintain Concealment from the same physical situation.
- Added world and debug presentation for selected responses, decision scores, candidate alternatives, and the explicit absence of a procedure.
- Kept all actors physically still and excluded role assignment, movement, warnings, cover selection, hostility, aiming, and firing.
- Added architecture documentation for the encounter-to-response decision chain.

# Fieldwork 2.0E

## Mission Relevance & Encounter Recognition

- Added authored V2 team missions with objective, immediate task, success and abort conditions, concern areas, mission sensitivity, and explicit interference reasons.
- Added a team mission store that reads mission data without issuing actor commands.
- Added mission-relative encounter assessment based only on successfully communicated team reports.
- Added independent team encounter hypotheses with possible, relevant, potentially incompatible, and stale states.
- Added persistent encounter memory that cites its evidence and decays after supporting reports become stale.
- Added world and debug presentation for mission relevance, possible conflict, stale encounters, and the explicit absence of a selected response.
- Kept identity and intent unknown and excluded hostility, movement, cover, targeting, procedures, and combat response.
- Added architecture documentation for the shared-report-to-encounter-recognition chain.

# Fieldwork 2.0D

## Contact Reporting & Shared Team Knowledge

- Added the persistent `ReportContact` V2 action with timed local-voice delivery.
- Added authored reporting policies for voice range, credibility threshold, and reporting purpose.
- Added a narrow communication executor that determines valid recipients without deciding tactical meaning.
- Added received second-hand contact knowledge with source, approximate position, reduced confidence, report age, and explicit non-confirmation.
- Added a team knowledge store populated only by successfully delivered reports.
- Added concurrent action presentation: observers continue `ObserveSector` while `ReportContact` temporarily becomes the readable primary action.
- Added communication links, shared-report markers, recipient indicators, and expanded V2 diagnostics.
- Clipped V2 observation overlays to the active Behavior Lab fixture for clearer inspection.
- Kept recipients inert and excluded encounter recognition, hostility, cover response, and combat.
- Added architecture documentation for the personal-observation-to-shared-report chain.

# Fieldwork 2.0C

## Tasked Observation & Personal Knowledge

- Added one authored observer assignment per team in the Observation & Concealment fixture.
- Added the persistent `ObserveSector` V2 action using attention and stance channels.
- Added a narrow attention executor that turns actors toward assigned sectors without choosing those sectors.
- Added visual observation evidence using range, field of view, hard obstacles, and brush concealment.
- Added personal-only contact memory with confidence, approximate position, visible/lost transitions, decay, and forgetting.
- Added V2 world overlays for observation sectors, private contact markers, and observer status.
- Added debug readouts for authored assignments, personal knowledge, and intentionally empty team knowledge.
- Kept all non-observer actors inert and excluded communication, encounters, hostility, cover, and combat response.
- Added architecture documentation for the complete mission-to-personal-knowledge chain.

# Fieldwork 2.0B

## Intentional Behavior Lab

- Replaced the randomized three-faction combat sandbox with a controlled Behavior Lab.
- Added four selectable fixtures: Open Contact, Observation & Concealment, Cover & Position, and Casualty Recovery.
- Added fixed team missions, tasks, roles, starting positions, facing, and terrain for each fixture.
- Removed random patrol destinations and reinforcement waves from the sandbox director.
- Added a dedicated Behavior Lab map with labeled bays, north/south pressure lines, an observer walk, and active-fixture highlighting.
- Added a title-screen fixture selector with saved and URL-selectable fixture state.
- Kept AI V2 actors intentionally still while preserving Legacy 1.2H as a comparison runtime.
- Added a seeded critical casualty and intentionally placed field bandages for the recovery fixture.
- Added Behavior Lab architecture documentation and updated build identity.

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
