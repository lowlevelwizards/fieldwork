# Fieldwork AI V2

AI V2 is a parallel causal runtime. It does not import the legacy tactical authorities.

## Current milestone: 2.0F

The Observation & Concealment Behavior Lab fixture now runs this explicit cognitive chain:

```text
Authored mission
→ tasked observation
→ temporary observer role
→ persistent ObserveSector action
→ attention execution
→ visual evidence
→ personal contact memory
→ persistent ReportContact action
→ local voice execution
→ received second-hand knowledge
→ shared team report
→ mission relevance assessment
→ uncertain team encounter hypothesis
→ team decision ledger
→ scored response candidates
→ persistent selected response
```

Each team evaluates only its authored mission and its own communicated encounter hypothesis. Northline selects **Heighten Watch**; the Commune selects **Maintain Concealment**.

A response is still only a team decision. There is intentionally no procedure, role reassignment, movement, cover seeking, target selection, aiming, or firing.

## Current modules

- `runtime/` — update boundary and read-only world snapshots.
- `actions/` — persistent action lifecycle, channels, scheduler, ObserveSector, and ReportContact.
- `communication/` — local voice range, timing, recipient validity, and delivery execution.
- `execution/` — narrow physical attention execution.
- `senses/` — visual evidence from field of view, distance, obstruction, and concealment.
- `knowledge/` — private visual memory plus explicitly delivered reported knowledge.
- `missions/` — authored objectives, concern areas, decision context, response bias, and persistence policy.
- `encounters/` — mission-relative assessment and persistent uncertain encounter hypotheses.
- `decisions/` — the descriptive team decision ledger.
- `responses/` — response definitions, evaluation, selection persistence, switching, and invalidation.
- `diagnostics/` — decision history and invariant monitoring.

## Ownership rules

- Fixture data supplies the upstream mission, task, reporting policy, concern area, and current decision context.
- Actions own behavioral continuity.
- Executors perform physical or communicative delivery but do not choose goals.
- Sensors produce evidence but do not make decisions.
- Personal knowledge stores direct beliefs but does not share them automatically.
- Team knowledge accepts only reports that a communication action actually delivered.
- Encounter assessment describes why a report matters but does not command a response.
- The decision ledger describes tradeoffs but does not choose or execute behavior.
- Response evaluation compares options; response state owns persistence and invalidation.
- The scheduler remains the only authority that starts or ends actor actions.
