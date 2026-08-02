# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0C

The Observation & Concealment Behavior Lab fixture now runs the first explicit cognitive chain:

```text
Authored mission
→ tasked observation
→ temporary observer role
→ persistent ObserveSector action
→ attention execution
→ visual evidence
→ personal contact memory
```

One observer on each team turns toward an authored sector and may form private contact records. Contact records retain approximate position, confidence, visibility state, and last-observed time.

There is intentionally no report action and no team-knowledge store yet. Seeing something does not automatically inform teammates or create an encounter.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — persistent action lifecycle, channels, scheduler, and ObserveSector.
- `execution/` — narrow physical attention execution.
- `senses/` — visual evidence from field of view, distance, obstruction, and concealment.
- `knowledge/` — personal-only contact memory.
- `diagnostics/` — decision history and invariant monitoring.

## Ownership rules

- Fixture data supplies the upstream reason for the behavior.
- Actions own behavioral continuity.
- Executors perform physical changes but do not choose goals.
- Sensors produce evidence but do not make decisions.
- Personal knowledge stores beliefs but does not communicate them.
- The scheduler is the only authority that starts or ends actions.
