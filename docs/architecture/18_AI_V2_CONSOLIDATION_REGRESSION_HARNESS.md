# 18 — AI V2 Consolidation & Regression Harness

## Purpose

2.0N pauses behavioral expansion after AI V2 proved two distinct complete chains. The release makes those behaviors safer to extend without changing their visible outcomes.

The build is intentionally not a new gameplay layer.

## Proven reuse

The warning/withdrawal fixture and casualty-recovery fixture both use:

```text
knowledge
→ mission-relative encounter
→ response
→ procedure
→ temporary role
→ persistent actor action
→ narrow executor
→ consequence
→ outcome memory
```

This shared chain is the evidence that AI V2 is a reusable Fieldwork architecture rather than fixture-specific scripting.

## Procedure transition ownership

Before 2.0N, `TeamProcedureState` contained branches for named procedures. Each new procedure would have enlarged the central state store.

In 2.0N, procedure definitions own transitions:

```text
event
+ expected phase
+ optional data guard
→ next phase
+ optional record mutation
+ optional completion marker
```

`TeamProcedureState` now performs one generic operation:

```text
record event
→ find transition in current procedure definition
→ verify phase and guard
→ apply transition
→ record diagnostic event
```

This is not a general-purpose state-machine framework. It is a small data contract for the procedures the simulation already owns.

## Runtime and diagnostics

`AIV2Runtime` remains the composition root and preserves the explicit update order. Actor debug-object construction and readable debug summaries moved to `diagnostics/ai-debug-projection.js`.

Diagnostics read runtime state. They do not decide behavior or mutate simulation authority.

## Outcome semantics

Outcome memory now distinguishes:

- `immediateHazardResolved`
- `missionResolved`
- `followUp`
- `subjectCondition`
- `mobility`
- derived `status`

The casualty-recovery fixture records:

```text
immediateHazardResolved: true
missionResolved: false
followUp: evacuation_required
subjectCondition: stable_critical
mobility: non_ambulatory
status: ongoing_obligation
```

This preserves the difference between saving a life and completing the rescue.

## Behavior Lab data

Authored fixture facts and map geometry now live under `data/`:

- `data/behavior-lab-fixtures.js`
- `data/behavior-lab-map.js`

`js/combat-sandbox.js` only instantiates actors, teams, authored missions, and seeded fixture conditions.

## Regression harness

The repository now contains deterministic Node tests for:

- one warning delivered to valid recipients
- staged Commune withdrawal order
- non-pursuit and resolved contact outcomes
- casualty report, approach, assessment, drag, and stabilization order
- security remaining active during care
- pressure-dressing consumption
- bleeding controlled while the casualty remains critical
- ongoing evacuation obligation semantics
- inert unactivated V2 fixtures
- separate Legacy initialization
- data-owned procedure transitions
- syntax, imports, cycles, and retired duplicates

The harness has no runtime dependency and uses the same production modules as the browser build.

## Repository hygiene

Nineteen JavaScript files from older root-level and `data/` layouts were proven unreachable from `index.html → js/main.js` and removed. The import checker prevents them from silently returning.

Patch installations can run:

```bash
npm run cleanup
npm test
```

## Explicit exclusions

2.0N does not add:

- evacuation behavior
- aiming or firing
- combat cover
- generic planning
- an event bus
- a third-party state machine
- dependency injection
- TypeScript or a build pipeline

The next behavioral discrepancy remains the stabilized casualty who still has to get home.
