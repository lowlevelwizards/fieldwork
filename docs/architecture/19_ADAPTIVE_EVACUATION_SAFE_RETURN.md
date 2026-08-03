# 19 — Adaptive Evacuation & Safe Return

## Purpose

2.0O completes the casualty-care arc while deliberately testing whether AI V2 can adapt when an expected procedure stops being locally feasible.

The target is not a scripted evacuation scene. The target is a reusable causal contract:

```text
stable critical casualty
→ unresolved evacuation obligation
→ team reprioritization
→ response and procedure
→ capability-based responsibilities
→ locally selected actions
→ changed capability
→ invalid assignment
→ safe release and reassignment
→ continued procedure
→ safe return
```

## Team and operator authority

The team owns:

- mission reprioritization
- response selection
- procedure selection
- responsibility assignment
- reassessment when a responsibility cannot be fulfilled

The operator owns:

- evaluating whether the assigned responsibility is currently satisfied
- proposing a permitted action that could satisfy it
- checking local capability and feasibility
- executing, completing, failing, or safely interrupting that action
- reporting consequences back into shared causal state

The procedure does not directly move an actor or casualty.

## Evacuation obligation

`casualty_stabilized` records:

```text
immediateHazardResolved: true
missionResolved: false
followUp: evacuation_required
subjectCondition: stable_critical
mobility: non_ambulatory
```

The response evaluator can therefore select `evacuate_casualty` without pretending stabilization completed the rescue.

The original observation task is suspended because preserving and returning the casualty has become the higher-value obligation.

## Adaptive Casualty Evacuation procedure

The procedure defines these responsibilities:

### Carrier

Required conditions:

- a living stabilized casualty exists
- the actor has patient-transport capability
- current transport stamina meets the minimum threshold
- the patient is exclusively controlled
- the next route leg has been secured

### Route Security

Required conditions:

- available route affordances have been compared
- the next selected waypoint is reachable
- the next movement leg is occupied and secured before casualty transport

### Rear Security

Required conditions:

- awareness is preserved behind the evacuation group
- the remaining operator is available to respond when another responsibility becomes invalid

These are functions, not named characters.

## Route affordances

The mission offers multiple candidate route descriptions. `EvacuationRouteService` evaluates them from current world state using:

- waypoint clearance
- travel distance
- obstacle exposure
- authored protection value
- authored cohesion value
- current route availability

The service returns the strongest viable option. It does not move actors or advance the procedure.

The current Behavior Lab map supplies authored candidates because it is a controlled laboratory. The interface is intentionally compatible with later dynamically discovered cover, extraction, vehicle-access, or safehouse affordances.

## Local actions

The procedure currently asks individual operators to propose and execute:

- `SelectEvacuationRoute`
- `AdvanceRouteSecurity`
- `EvacuateCasualty`
- `ReassessEvacuationCasualty`
- `TransferCasualty`

Each action owns narrow channels, has explicit continuation conditions, and reports a consequence event. Procedure phases change because those consequences become true, not because fixture time elapsed.

## Controlled failure and reassignment

The initial Carrier completes the first transport leg but loses enough transport stamina to fall below role eligibility.

The following safeguards apply:

1. The completed action releases the patient claim, destination claim, drag attachment, and locomotion state.
2. `TeamProcedureState` detects that the Carrier assignment no longer satisfies the role eligibility contract.
3. The procedure remembers the interrupted phase.
4. All responsibilities are reassigned among currently capable operators.
5. The carrier handoff is recorded as causal history.
6. The procedure returns from `establish_responsibilities` to the interrupted phase.
7. A different capable operator completes transport.

No actor ID, character name, or fixture timer specifies the replacement.

## Safe-return outcome

At extraction, the Carrier transfers exclusive patient control and records:

```text
kind: casualty_evacuated_alive
immediateHazardResolved: true
missionResolved: true
followUp: continued_care_required
subjectCondition: stable_critical
mobility: unavailable_for_field_duty
```

The dressing remains consumed. The casualty remains critically injured. Safe return completes the local rescue without erasing its cost.

## Regression proof

The committed tests run the same production procedure in two deterministic configurations:

### Default configuration

- west brush route selected
- Field Medic begins as Carrier
- first-leg stamina loss invalidates that assignment
- Scout becomes replacement Carrier
- safe return completes

### Alternate configuration

- west route is unavailable
- east open route is selected
- changed capability scores select Scout first
- Field Medic becomes replacement Carrier
- safe return completes

Both configurations verify:

- exactly one route selection
- two secured route legs
- two casualty-transport legs
- different initial and replacement carriers
- one deliberate role reassignment
- one between-leg casualty reassessment
- exclusive patient and destination claims released
- zero aiming or firing
- critical condition and zero active bleeding preserved
- evidence-grounded safe-return outcome

## Explicit exclusions

2.0O does not add:

- dynamic navigation-mesh pathfinding
- vehicles or stretcher inventory
- multiple simultaneous casualties
- enemy pursuit or combat
- universal multi-goal planning
- actor-name branches
- fixture-time choreography
- full safehouse medical simulation

The release proves that one procedure can encounter a local failure, preserve causal state, reassign responsibility, and continue toward its team-level purpose.
